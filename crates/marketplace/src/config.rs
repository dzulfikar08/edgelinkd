//! Marketplace configuration.

use serde::{Deserialize, Serialize};

/// Marketplace configuration, loaded from `[marketplace]` in `rust-red.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketplaceConfig {
    /// Whether the marketplace API is enabled.
    #[serde(default = "default_enabled")]
    pub enabled: bool,

    /// Maximum allowed WASM plugin binary size in bytes.
    #[serde(default = "default_max_plugin_size")]
    pub max_plugin_size_bytes: u64,

    /// Whether verification is required before publishing.
    #[serde(default = "default_require_verification")]
    pub require_verification: bool,
}

fn default_enabled() -> bool {
    true
}

fn default_max_plugin_size() -> u64 {
    10 * 1024 * 1024 // 10 MB
}

fn default_require_verification() -> bool {
    true
}

impl Default for MarketplaceConfig {
    fn default() -> Self {
        Self {
            enabled: default_enabled(),
            max_plugin_size_bytes: default_max_plugin_size(),
            require_verification: default_require_verification(),
        }
    }
}

impl MarketplaceConfig {
    /// Load from the global config under the `[marketplace]` key.
    pub fn load(cfg: &config::Config) -> Self {
        match cfg.get::<Self>("marketplace") {
            Ok(c) => c,
            Err(config::ConfigError::NotFound(_)) => Self::default(),
            Err(e) => {
                log::warn!("Failed to load marketplace config: {e}, using defaults");
                Self::default()
            }
        }
    }
}
