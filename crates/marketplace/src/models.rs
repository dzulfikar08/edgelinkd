//! Data models for the marketplace.

use std::collections::BTreeMap;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Node type descriptor within a plugin.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NodeTypeEntry {
    /// Node type identifier (e.g. "my-transform").
    #[serde(rename = "type")]
    pub node_type: String,
    /// Number of input ports.
    pub inputs: u32,
    /// Number of output ports.
    pub outputs: u32,
}

/// Plugin metadata submitted by the author at publish time.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginMetadata {
    /// Unique plugin name (e.g. "my-transform-plugin").
    pub name: String,
    /// Semantic version (e.g. "1.0.0").
    pub version: String,
    /// Human-readable description.
    pub description: String,
    /// Author identifier (email or handle).
    pub author: String,
    /// Category for browsing (e.g. "transform", "io", "storage").
    pub category: String,
    /// Free-form tags.
    #[serde(default)]
    pub tags: Vec<String>,
    /// SPDX license identifier.
    #[serde(default)]
    pub license: String,
    /// Node types this plugin provides.
    #[serde(default)]
    pub node_types: Vec<NodeTypeEntry>,
    /// Permission strings the plugin requires.
    #[serde(default)]
    pub permissions: Vec<String>,
}

/// Internal record for a single plugin version stored in the marketplace.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginVersion {
    /// Semantic version string.
    pub version: String,
    /// SHA-256 hex digest of the WASM binary.
    pub checksum: String,
    /// Size of the WASM binary in bytes.
    pub size_bytes: u64,
    /// When this version was published.
    pub published_at: DateTime<Utc>,
}

/// Internal record for a plugin, combining metadata with analytics.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginRecord {
    /// Unique plugin ID (UUID v4).
    pub id: String,
    /// Plugin name (unique key).
    pub name: String,
    /// Author.
    pub author: String,
    /// Description.
    pub description: String,
    /// Category.
    pub category: String,
    /// Tags.
    pub tags: Vec<String>,
    /// License.
    pub license: String,
    /// Node types provided by the plugin.
    pub node_types: Vec<NodeTypeEntry>,
    /// Permissions requested.
    pub permissions: Vec<String>,
    /// All published versions, keyed by version string.
    pub versions: BTreeMap<String, PluginVersion>,
    /// Total download count across all versions.
    pub downloads: u64,
    /// When the plugin was first published.
    pub created_at: DateTime<Utc>,
    /// When the plugin metadata was last updated.
    pub updated_at: DateTime<Utc>,
}

/// Public plugin summary returned in list endpoints.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginSummary {
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
    pub latest_version: Option<String>,
    pub downloads: u64,
    pub rating_avg: Option<f64>,
    pub rating_count: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Public plugin detail returned by the detail endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginDetail {
    pub id: String,
    pub name: String,
    pub author: String,
    pub description: String,
    pub category: String,
    pub tags: Vec<String>,
    pub license: String,
    pub node_types: Vec<NodeTypeEntry>,
    pub permissions: Vec<String>,
    pub versions: Vec<VersionSummary>,
    pub latest_version: Option<String>,
    pub downloads: u64,
    pub rating_avg: Option<f64>,
    pub rating_count: u64,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Version summary for the detail and versions endpoints.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionSummary {
    pub version: String,
    pub checksum: String,
    pub size_bytes: u64,
    pub published_at: DateTime<Utc>,
}

/// Query parameters for the plugin list endpoint.
#[derive(Debug, Clone, Deserialize, Default)]
pub struct ListPluginsQuery {
    pub category: Option<String>,
    pub tag: Option<String>,
    pub search: Option<String>,
    pub author: Option<String>,
    /// Page number (1-based). Default 1.
    #[serde(default = "default_page")]
    pub page: u32,
    /// Page size. Default 20, max 100.
    #[serde(default = "default_page_size")]
    pub page_size: u32,
}

fn default_page() -> u32 {
    1
}

fn default_page_size() -> u32 {
    20
}

/// Response for the plugin list endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PluginListResponse {
    pub plugins: Vec<PluginSummary>,
    pub total: usize,
    pub page: u32,
    pub page_size: u32,
}

/// Request body for rating a plugin.
#[derive(Debug, Clone, Deserialize)]
pub struct RateRequest {
    /// Rating from 1 to 5.
    pub rating: u8,
}

/// Aggregated rating stored per plugin.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct RatingAggregate {
    /// Sum of all ratings.
    pub total_score: u64,
    /// Number of ratings.
    pub count: u64,
}

impl RatingAggregate {
    pub fn average(&self) -> Option<f64> {
        if self.count == 0 {
            None
        } else {
            Some(self.total_score as f64 / self.count as f64)
        }
    }
}
