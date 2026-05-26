//! Trait for core-to-web decoupling: WebStateCore
//! The web crate's WebState must implement this trait; core handlers depend
//! only on the trait, not on a concrete type.

use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio_util::sync::CancellationToken;

use crate::runtime::engine::Engine;
use crate::runtime::registry::RegistryHandle;
use crate::web::WebHandlerRegistry;
use crate::web::frontend_plugin::FrontendPluginRegistry;

/// Trait for core-to-web decoupling: WebStateCore
pub trait WebStateCore: Send + Sync {
    /// Engine instance
    fn engine(&self) -> &RwLock<Option<Arc<Engine>>>;
    /// Node registry
    fn registry(&self) -> &RwLock<Option<RegistryHandle>>;
    /// Static file directory
    fn static_dir(&self) -> &PathBuf;
    /// Web handler registry
    fn web_handlers(&self) -> &WebHandlerRegistry;
    /// Frontend plugin registry
    fn frontend_plugins(&self) -> &FrontendPluginRegistry;
    /// Path to flows.json
    fn flows_file_path(&self) -> &RwLock<Option<PathBuf>>;
    /// Cancellation token
    fn cancel_token(&self) -> &RwLock<Option<CancellationToken>>;
}
