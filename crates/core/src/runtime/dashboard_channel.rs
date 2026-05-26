use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

/// A message carrying data for a specific dashboard widget.
///
/// Dashboard flow nodes produce `DashboardMessage`s. The web layer subscribes
/// to the broadcast channel and forwards each message to connected browser
/// clients over the `/comms` WebSocket under the `dashboard/data` topic.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardMessage {
    /// The dashboard widget ID this message targets.
    pub widget_id: String,
    /// The dashboard ID (optional -- allows scoping to a specific dashboard).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub dashboard_id: Option<String>,
    /// The payload to push into the widget.
    pub payload: serde_json::Value,
    /// Timestamp in milliseconds since UNIX epoch.
    pub timestamp: i64,
}

/// Broadcast channel for dashboard data updates.
///
/// Works identically to [`DebugChannel`]: flow nodes call [`send`] and the web
/// layer calls [`subscribe`] to receive updates.
///
/// [`DebugChannel`]: crate::runtime::debug_channel::DebugChannel
/// [`send`]: DashboardChannel::send
/// [`subscribe`]: DashboardChannel::subscribe
#[derive(Debug, Clone)]
pub struct DashboardChannel {
    sender: broadcast::Sender<DashboardMessage>,
}

impl DashboardChannel {
    /// Create a new channel with the given buffer capacity.
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    /// Broadcast a dashboard data message to all subscribers.
    pub fn send(&self, message: DashboardMessage) {
        match self.sender.send(message) {
            Ok(n) => log::debug!("Dashboard message sent to {n} subscribers"),
            Err(e) => log::warn!("Failed to send dashboard message: {e}"),
        }
    }

    /// Subscribe to dashboard data messages.
    pub fn subscribe(&self) -> broadcast::Receiver<DashboardMessage> {
        self.sender.subscribe()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn dashboard_channel_send_and_receive() {
        let channel = DashboardChannel::new(10);
        let mut rx = channel.subscribe();

        let msg = DashboardMessage {
            widget_id: "widget-1".to_string(),
            dashboard_id: Some("dash-1".to_string()),
            payload: json!({ "value": 42.5 }),
            timestamp: 1000,
        };

        channel.send(msg.clone());

        let received = rx.try_recv().expect("Should receive message");
        assert_eq!(received.widget_id, "widget-1");
        assert_eq!(received.dashboard_id, Some("dash-1".to_string()));
        assert_eq!(received.payload["value"], 42.5);
        assert_eq!(received.timestamp, 1000);
    }

    #[test]
    fn dashboard_channel_multiple_subscribers() {
        let channel = DashboardChannel::new(10);
        let mut rx1 = channel.subscribe();
        let mut rx2 = channel.subscribe();

        let msg = DashboardMessage {
            widget_id: "w1".to_string(),
            dashboard_id: None,
            payload: json!("hello"),
            timestamp: 2000,
        };

        channel.send(msg);

        assert!(rx1.try_recv().is_ok());
        assert!(rx2.try_recv().is_ok());
    }

    #[test]
    fn dashboard_message_serialization_roundtrip() {
        let msg = DashboardMessage {
            widget_id: "abc".to_string(),
            dashboard_id: None,
            payload: json!({ "temp": 23.5, "unit": "C" }),
            timestamp: 3000,
        };

        let json_str = serde_json::to_string(&msg).unwrap();
        let deserialized: DashboardMessage = serde_json::from_str(&json_str).unwrap();

        assert_eq!(deserialized.widget_id, "abc");
        assert!(deserialized.dashboard_id.is_none());
        assert_eq!(deserialized.payload["temp"], 23.5);
        assert_eq!(deserialized.timestamp, 3000);
    }

    #[tokio::test]
    async fn dashboard_channel_cloned_sender_works() {
        let channel = DashboardChannel::new(10);
        let mut rx = channel.subscribe();
        let channel2 = channel.clone();

        let msg = DashboardMessage {
            widget_id: "w2".to_string(),
            dashboard_id: Some("d2".to_string()),
            payload: json!(null),
            timestamp: 4000,
        };

        // Send via the cloned channel
        channel2.send(msg);

        let received = rx.try_recv().expect("Should receive from cloned channel");
        assert_eq!(received.widget_id, "w2");
    }
}
