//! Auth configuration loaded from the `[auth]` section of `rust-red.toml`.
//!
//! Example configuration:
//! ```toml
//! [auth]
//! enabled = true
//! token_secret = "your-secret-key-change-me"
//! access_token_ttl_secs = 900
//! refresh_token_ttl_secs = 604800
//! default_role = "viewer"
//! ```

use serde::{Deserialize, Serialize};

use super::roles::Role;

/// Default access token TTL: 15 minutes.
const DEFAULT_ACCESS_TOKEN_TTL: i64 = 900;

/// Default refresh token TTL: 7 days.
const DEFAULT_REFRESH_TOKEN_TTL: i64 = 604_800;

/// Authentication configuration section.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    /// Enable or disable authentication entirely.
    /// When disabled, all routes are accessible without authentication.
    #[serde(default)]
    pub enabled: bool,

    /// Secret key used for JWT signing. Must be changed in production.
    #[serde(default = "default_token_secret")]
    pub token_secret: String,

    /// Access token lifetime in seconds.
    #[serde(default = "default_access_token_ttl")]
    pub access_token_ttl_secs: i64,

    /// Refresh token lifetime in seconds.
    #[serde(default = "default_refresh_token_ttl")]
    pub refresh_token_ttl_secs: i64,

    /// Default role assigned to new users.
    #[serde(default = "default_role")]
    pub default_role: Role,
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            token_secret: default_token_secret(),
            access_token_ttl_secs: DEFAULT_ACCESS_TOKEN_TTL,
            refresh_token_ttl_secs: DEFAULT_REFRESH_TOKEN_TTL,
            default_role: Role::Viewer,
        }
    }
}

impl AuthConfig {
    /// Load from `config::Config`, looking for the `[auth]` section.
    /// Returns default (auth disabled) if section not found.
    pub fn load(cfg: &config::Config) -> Self {
        match cfg.get::<Self>("auth") {
            Ok(c) => c,
            Err(config::ConfigError::NotFound(_)) => {
                log::info!("[auth] config section not found, authentication disabled");
                Self::default()
            }
            Err(e) => {
                log::warn!("[auth] config parse error: {e}, authentication disabled");
                Self::default()
            }
        }
    }
}

fn default_token_secret() -> String {
    "change-me-in-production".to_string()
}

fn default_access_token_ttl() -> i64 {
    DEFAULT_ACCESS_TOKEN_TTL
}

fn default_refresh_token_ttl() -> i64 {
    DEFAULT_REFRESH_TOKEN_TTL
}

fn default_role() -> Role {
    Role::Viewer
}
