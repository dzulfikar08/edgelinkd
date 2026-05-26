use std::sync::atomic::{AtomicU16, Ordering};
use tokio::sync::mpsc;

/// Raw bytes to be written to a client's TCP stream.
pub type RawPacket = Vec<u8>;

/// A message to be sent outbound to a connected client (structured form).
#[derive(Debug, Clone)]
pub struct OutboundMessage {
    pub topic: String,
    pub payload: Vec<u8>,
    pub qos: crate::protocol::packets::QoS,
    pub retain: bool,
    pub packet_id: Option<u16>,
}

static PACKET_ID_COUNTER: AtomicU16 = AtomicU16::new(1);

pub fn next_packet_id() -> u16 {
    // Wrap safely: skip 0 (invalid packet ID in MQTT)
    let val = PACKET_ID_COUNTER.fetch_add(1, Ordering::Relaxed);
    if val == 0 { 1 } else { val }
}

pub struct Session {
    client_id: String,
    keep_alive: u16,
    connected_at: chrono::DateTime<chrono::Utc>,
    /// Channel for sending raw encoded packets to this client's writer task.
    outbound_tx: mpsc::Sender<RawPacket>,
}

impl Session {
    pub fn new(
        client_id: String,
        keep_alive: u16,
        outbound_tx: mpsc::Sender<RawPacket>,
    ) -> Self {
        Self {
            client_id,
            keep_alive,
            connected_at: chrono::Utc::now(),
            outbound_tx,
        }
    }

    pub fn client_id(&self) -> &str { &self.client_id }
    pub fn keep_alive(&self) -> u16 { self.keep_alive }
    pub fn connected_at(&self) -> chrono::DateTime<chrono::Utc> { self.connected_at }

    /// Try to send a raw encoded packet to this session's TCP stream.
    /// Returns false if the channel is closed or full (client likely disconnected).
    pub fn send_raw(&self, packet: RawPacket) -> bool {
        self.outbound_tx.try_send(packet).is_ok()
    }
}
