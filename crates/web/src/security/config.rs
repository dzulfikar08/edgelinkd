//! Security configuration for Rust-Red
//!
//! Loaded from `[security]` section of `rust-red.toml`.

use serde::{Deserialize, Serialize};

/// Default maximum flow JSON payload size in bytes (10 MB)
pub const DEFAULT_MAX_FLOW_SIZE: usize = 10 * 1024 * 1024;

/// Default rate limit: requests per minute per IP
pub const DEFAULT_RATE_LIMIT_RPM: u32 = 300;

/// Security configuration section
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Require authentication for admin API (currently advisory, used for docs/logging)
    /// Default: true (secure-by-default)
    #[serde(default = "default_true")]
    pub require_auth: bool,

    /// Maximum size of flow JSON payloads in bytes
    /// Default: 10485760 (10 MB)
    #[serde(default = "default_max_flow_size")]
    pub max_flow_size: usize,

    /// Rate limit: requests per minute per IP for admin API
    /// Default: 300
    #[serde(default = "default_rate_limit_rpm")]
    pub rate_limit_rpm: u32,

    /// Allowed CORS origins. Empty vec = same-origin only (no CORS headers).
    /// Use ["*"] to allow all origins (NOT recommended for production).
    /// Default: [] (same-origin only)
    #[serde(default)]
    pub cors_origins: Vec<String>,

    /// Enable or disable security headers (X-Content-Type-Options, X-Frame-Options, CSP, etc.)
    /// Default: true
    #[serde(default = "default_true")]
    pub security_headers: bool,
}

impl Default for SecurityConfig {
    fn default() -> Self {
        Self {
            require_auth: true,
            max_flow_size: DEFAULT_MAX_FLOW_SIZE,
            rate_limit_rpm: DEFAULT_RATE_LIMIT_RPM,
            cors_origins: Vec::new(),
            security_headers: true,
        }
    }
}

impl SecurityConfig {
    /// Load from config::Config, looking for the `[security]` section.
    /// Returns default if section not found.
    pub fn load(cfg: &config::Config) -> Self {
        match cfg.get::<Self>("security") {
            Ok(s) => s,
            Err(config::ConfigError::NotFound(_)) => {
                log::info!("[security] config section not found, using secure defaults");
                Self::default()
            }
            Err(e) => {
                log::warn!("[security] config parse error: {e}, using secure defaults");
                Self::default()
            }
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_max_flow_size() -> usize {
    DEFAULT_MAX_FLOW_SIZE
}

fn default_rate_limit_rpm() -> u32 {
    DEFAULT_RATE_LIMIT_RPM
}
