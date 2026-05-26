//! WASM plugin host for Rust-Red.
//!
//! This crate provides:
//! - `PluginManager` — loads `.wasm` node plugins at runtime
//! - `WasmNodeShim` — bridges `FlowNodeBehavior` to WASM guest code
//! - Host ABI functions that the WASM guest can call back into
//!
//! # Example
//!
//! ```no_run
//! use rust_red_wasm_host::{PluginManager, PluginManagerConfig};
//! use std::path::Path;
//!
//! # async fn example() -> anyhow::Result<()> {
//! let config = PluginManagerConfig::default();
//! let mgr = PluginManager::new(&config)?;
//! let infos = mgr.load_all(Path::new("./plugins")).await?;
//! for info in &infos {
//!     println!("Loaded plugin: {}", info.node_type);
//! }
//! # Ok(())
//! # }
//! ```

pub mod abi;
pub mod memory;
pub mod plugin_manager;
pub mod shim;
pub mod state;
pub mod types;

pub use plugin_manager::{LoadedPlugin, PluginManager, PluginManagerConfig};
pub use shim::WasmNodeShim;
pub use state::WasmNodeState;
pub use types::{ProcessResult, WasmMessage, WasmNodeInfo, WasmValue};
