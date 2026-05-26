use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// Metadata about a WASM node plugin, returned by `rust_red_node_info`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmNodeInfo {
    /// Full node type identifier, e.g. "my-plugin/http-request"
    pub node_type: String,
    /// Short name in Node-RED, e.g. "http-request"
    pub red_name: String,
    /// Module name, e.g. "my-plugin"
    pub module: String,
    /// Semantic version, e.g. "1.0.0"
    pub version: String,
    /// Number of input ports
    pub inputs: u32,
    /// Number of output ports
    pub outputs: u32,
    /// UI color hint, e.g. "#3FADB5"
    pub color: Option<String>,
    /// UI icon hint, e.g. "white-globe.svg"
    pub icon: Option<String>,
    /// Default label template
    pub label: Option<String>,
    /// Label style
    pub label_style: Option<String>,
    /// Palette label
    pub palette_label: Option<String>,
    /// Alignment: "left" | "right"
    pub align: Option<String>,
    /// Editor HTML template for custom config UI
    pub editor_template: Option<String>,
    /// Capabilities this node requires (gated at load time)
    pub capabilities: Vec<String>,
}

/// A message passed across the WASM boundary, serialized with postcard.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WasmMessage {
    /// Message ID
    pub msg_id: String,
    /// Primary payload
    pub payload: WasmValue,
    /// Topic
    pub topic: Option<String>,
    /// Additional properties
    pub extra: BTreeMap<String, WasmValue>,
}

/// Dynamic value type that can cross the WASM boundary.
/// Uses explicit tagged variants for reliable postcard serialization.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum WasmValue {
    /// Null / absent
    Null,
    /// Boolean
    Bool(bool),
    /// Signed integer
    I64(i64),
    /// Unsigned integer
    U64(u64),
    /// Floating point
    F64(f64),
    /// String
    String(String),
    /// Binary data
    Bytes(Vec<u8>),
    /// Array of values
    Array(Vec<WasmValue>),
    /// Object / map
    Object(BTreeMap<String, WasmValue>),
}

impl Default for WasmValue {
    fn default() -> Self {
        WasmValue::Null
    }
}

impl WasmValue {
    /// Try to get a string reference.
    pub fn as_str(&self) -> Option<&str> {
        match self {
            WasmValue::String(s) => Some(s),
            _ => None,
        }
    }
}

/// Result returned by the guest's `rust_red_process_msg`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessResult {
    /// `None` = swallow the message (don't forward anything).
    /// Each outer Vec element = one output port.
    /// Each inner Vec element = messages on that port.
    /// `None` inside = skip that message slot.
    pub output: Option<Vec<Vec<Option<WasmMessage>>>>,
}
