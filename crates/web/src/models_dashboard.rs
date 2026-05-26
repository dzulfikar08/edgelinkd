use serde::{Deserialize, Serialize};

/// Widget configuration within a dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WidgetConfig {
    pub x: u32,
    pub y: u32,
    pub w: u32,
    pub h: u32,
    /// Additional type-specific configuration
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

/// A single widget on a dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DashboardWidget {
    pub id: String,
    #[serde(rename = "type")]
    pub widget_type: String,
    pub title: String,
    pub config: WidgetConfig,
    #[serde(default)]
    pub data: Option<serde_json::Value>,
}

/// A dashboard containing an arrangement of widgets
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dashboard {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub widgets: Vec<DashboardWidget>,
    pub created_at: String,
    pub updated_at: String,
}

/// Payload for creating a new dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDashboardPayload {
    pub name: String,
    #[serde(default)]
    pub description: String,
}

/// Payload for updating an existing dashboard
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateDashboardPayload {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub widgets: Option<Vec<DashboardWidget>>,
}
