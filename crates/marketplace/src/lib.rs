//! WASM plugin marketplace backend for Rust-Red.
//!
//! Provides plugin publishing, discovery, download, rating, and verification.
//!
//! # Example
//!
//! ```no_run
//! use rust_red_marketplace::{MarketplaceConfig, store::PluginStore, api::marketplace_router};
//! use std::sync::Arc;
//! use tokio::sync::RwLock;
//!
//! # async fn example() -> anyhow::Result<()> {
//! let config = MarketplaceConfig::default();
//! let store = Arc::new(RwLock::new(PluginStore::new(&config)));
//! let router = marketplace_router(store);
//! # Ok(())
//! # }
//! ```

pub mod api;
pub mod config;
pub mod error;
pub mod models;
pub mod store;
pub mod verify;

pub use config::MarketplaceConfig;
pub use error::MarketplaceError;
