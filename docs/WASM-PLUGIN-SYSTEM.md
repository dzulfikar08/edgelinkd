# EdgeLinkd WASM Plugin System Design

## 1. Problem Statement

EdgeLinkd currently supports only **compile-time linked plugins** via the `inventory` crate. Adding a new node type requires creating a Rust crate, adding it to `Cargo.toml`, and recompiling the entire application. This blocks:

- **Third-party node ecosystem** — the #1 reason people choose Node-RED
- **Hot reloading** — updating a node without restarting the runtime
- **Multi-language nodes** — not everything needs to be Rust
- **Safe sandboxing** — untrusted node code runs in-process today

## 2. Goals

| Goal | Priority |
|------|----------|
| Load `.wasm` node plugins at runtime | P0 |
| Implement `FlowNodeBehavior` via WASM guest | P0 |
| Guest SDK for Rust (primary) and JS/Go (secondary) | P0 |
| Host-provided capability imports (no raw WASI) | P0 |
| Fuel metering + memory limits per plugin | P1 |
| Hot reload without engine restart | P1 |
| Global/config node support via WASM | P2 |
| WASM Component Model migration path | P2 |

## 3. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│                    EdgeLinkd Host                    │
│                                                     │
│  ┌─────────────┐    ┌────────────────────────────┐  │
│  │  Registry    │───>│  WasmNodeShim              │  │
│  │  (extended)  │    │  implements FlowNodeBehavior│  │
│  └─────────────┘    │                              │  │
│                     │  holds: BaseFlowNodeState    │  │
│  ┌─────────────┐    │  owns: Wasmtime Instance    │  │
│  │  PluginMgr  │───>│  delegates to WASM guest    │  │
│  │  (loader)   │    └──────────┬─────────────────┘  │
│  └──────┬──────┘               │                    │
│         │                      │ WASM calls         │
│  ┌──────▼──────┐    ┌──────────▼─────────────────┐  │
│  │  PluginDir  │    │   Wasmtime Engine (shared)  │  │
│  │  ~/.edgelink│    │   ┌──────────────────────┐  │  │
│  │  /plugins/  │    │   │  Guest Instance       │  │  │
│  └─────────────┘    │   │  ┌─────────────────┐ │  │  │
│                     │   │  │ process_msg()   │ │  │  │
│                     │   │  │ on_start()      │ │  │  │
│                     │   │  │ on_stop()       │ │  │  │
│                     │   │  └─────────────────┘ │  │  │
│                     │   └──────────────────────┘  │  │
│                     └─────────────────────────────┘  │
│                                                     │
│  Host Imports (capability functions):               │
│  ├── host_log(level, ptr, len)                      │
│  ├── host_send_msg(port, ptr, len) -> ()            │
│  ├── host_get_context(scope, key_ptr, key_len)      │
│  ├── host_set_context(scope, key_ptr, key_len, ...) │
│  ├── host_http_fetch(method, url, body) -> response  │
│  ├── host_sleep_ms(ms)                              │
│  └── host_status(fill, shape, text_ptr, text_len)   │
└─────────────────────────────────────────────────────┘
```

## 4. Host-Guest ABI

### 4.1 Guest Exports (functions the WASM module MUST export)

```rust
// Mandatory exports
export fn edgelink_node_info() -> u32          // returns ptr to NodeInfo JSON
export fn edgelink_on_start(config_ptr: u32, config_len: u32) -> u32  // returns 0=ok
export fn edgelink_process_msg(msg_ptr: u32, msg_len: u32) -> u32    // returns ptr to result
export fn edgelink_on_stop() -> u32            // returns 0=ok
```

### 4.2 Guest Imports (functions the host provides to WASM)

```rust
// Logging
import fn host_log(level: u32, msg_ptr: u32, msg_len: u32)

// Message output
import fn host_send_msg(port: u32, msg_ptr: u32, msg_len: u32)

// Context access
import fn host_context_get(scope: u32, key_ptr: u32, key_len: u32) -> u32  // returns result_ptr
import fn host_context_set(scope: u32, key_ptr: u32, key_len: u32, val_ptr: u32, val_len: u32) -> u32

// Status reporting
import fn host_set_status(fill: u32, shape: u32, text_ptr: u32, text_len: u32)

// Async operations
import fn host_sleep_ms(ms: u64)

// HTTP client (capability-gated)
import fn host_http_request(method_ptr: u32, method_len: u32,
                            url_ptr: u32, url_len: u32,
                            headers_ptr: u32, headers_len: u32,
                            body_ptr: u32, body_len: u32) -> u32  // returns response_ptr

// Allocation (guest must export for host to write into guest memory)
import fn host_alloc(size: u32) -> u32  // returns ptr in guest memory

// Error reporting
import fn host_report_error(msg_ptr: u32, msg_len: u32)
```

### 4.3 Data Serialization

All data crossing the WASM boundary uses **MessagePack** (compact, fast, schema-less).

**NodeInfo** (returned by `edgelink_node_info`):
```rust
#[derive(Serialize, Deserialize)]
struct WasmNodeInfo {
    node_type: String,          // e.g. "my-plugin/http-request"
    red_name: String,           // e.g. "http-request"
    module: String,             // e.g. "my-plugin"
    version: String,            // semver
    inputs: u32,                // number of input ports
    outputs: u32,               // number of output ports
    color: Option<String>,      // UI color (e.g. "#3FADB5")
    icon: Option<String>,       // UI icon (e.g. "white-globe.svg")
    label: Option<String>,      // default label template
    label_style: Option<String>,
    palette_label: Option<String>,
    align: Option<String>,      // "left" | "right"
    // Editor HTML (for custom config UI in Node-RED editor)
    editor_template: Option<String>,
    // Capabilities this node needs (gated at load time)
    capabilities: Vec<String>,  // e.g. ["http_client", "filesystem_read"]
}
```

**Message** (passed to/from `edgelink_process_msg`):
```rust
#[derive(Serialize, Deserialize)]
struct WasmMessage {
    #[serde(rename = "_msgid")]
    msg_id: String,
    payload: WasmValue,         // dynamic value
    topic: Option<String>,
    // ... all other msg properties flattened
    #[serde(flatten)]
    extra: BTreeMap<String, WasmValue>,
}

// Mirrors Variant but serializable
#[derive(Serialize, Deserialize)]
#[serde(untagged)]
enum WasmValue {
    Null,
    Bool(bool),
    Number(serde_json::Number),
    String(String),
    Bytes(#[serde(with = "serde_bytes")] Vec<u8>),
    Array(Vec<WasmValue>),
    Object(BTreeMap<String, WasmValue>),
}
```

**ProcessResult** (returned by `edgelink_process_msg`):
```rust
#[derive(Serialize, Deserialize)]
struct ProcessResult {
    // null = swallow the message (don't forward)
    // array of arrays = output per port, each inner array = multiple msgs
    output: Option<Vec<Vec<Option<WasmMessage>>>>,
}
```

## 5. Host Implementation: `WasmNodeShim`

The shim is the bridge between EdgeLinkd's `FlowNodeBehavior` trait and the WASM guest. It owns the `BaseFlowNodeState` (channels, ports, context) and delegates message processing to the WASM guest.

```rust
// crates/core/src/runtime/wasm/shim.rs

pub struct WasmNodeShim {
    base: BaseFlowNodeState,
    instance: wasmtime::Instance,
    store: Mutex<Store<WasmNodeState>>,
    // Pre-looked-up exported functions
    process_fn: TypedFunc<(u32, u32), u32>,
    on_start_fn: TypedFunc<(u32, u32), u32>,
    on_stop_fn: TypedFunc<(), u32>,
    node_info: WasmNodeInfo,
    // Shared memory for reading return values
    memory: Memory,
}

pub struct WasmNodeState {
    // Access to host capabilities
    pending_outputs: Vec<Envelope>,
    status: Option<StatusObject>,
    errors: Vec<String>,
    context_manager: Arc<ContextManager>,
    node_scope: String,   // "node:{id}"
}

#[async_trait]
impl FlowNodeBehavior for WasmNodeShim {
    fn get_base(&self) -> &BaseFlowNodeState {
        &self.base
    }

    async fn run(self: Arc<Self>, stop_token: CancellationToken) {
        // Call guest on_start
        self.call_guest_on_start().await;

        // Standard message loop (same pattern as native nodes)
        loop {
            select! {
                _ = stop_token.cancelled() => break,
                result = self.recv_msg(stop_token.clone()) => {
                    match result {
                        Ok(msg) => {
                            if let Err(e) = self.process_and_forward(msg, stop_token.clone()).await {
                                log::error!("WASM node error: {e}");
                            }
                        }
                        Err(_) => break,
                    }
                }
            }
        }

        // Call guest on_stop
        self.call_guest_on_stop().await;
    }
}
```

### Message Processing Flow

```rust
impl WasmNodeShim {
    async fn process_and_forward(&self, msg: MsgHandle, cancel: CancellationToken) -> Result<()> {
        // 1. Serialize Msg to MessagePack bytes
        let wasm_msg = WasmMessage::from_msg(msg.clone()).await;
        let msg_bytes = rmp_serde::to_vec(&wasm_msg)?;

        // 2. Write bytes into guest memory
        let mut store = self.store.lock().await;
        let guest_ptr = self.write_to_guest_memory(&mut store, &msg_bytes)?;

        // 3. Call guest process_msg
        let result_ptr = self.process_fn.call(&mut store, (guest_ptr, msg_bytes.len() as u32))?;

        // 4. Read result from guest memory
        let result_bytes = self.read_from_guest_memory(&mut store, result_ptr)?;
        let result: ProcessResult = rmp_serde::from_slice(&result_bytes)?;

        // 5. Fan out messages
        if let Some(outputs) = result.output {
            for (port_idx, port_msgs) in outputs.iter().enumerate() {
                for wasm_msg in port_msgs.iter().flatten() {
                    let msg_handle = wasm_msg.to_msg_handle().await;
                    let envelope = Envelope { port: port_idx, msg: msg_handle };
                    self.fan_out_one(envelope, cancel.clone()).await?;
                }
            }
        }

        // 6. Forward any pending outputs from host_send_msg imports
        // (already collected in WasmNodeState during guest execution)
        drop(store);
        let mut store = self.store.lock().await;
        let state = store.data_mut();
        for envelope in state.pending_outputs.drain(..) {
            drop(store);
            self.fan_out_one(envelope, cancel.clone()).await?;
            store = self.store.lock().await;
        }

        Ok(())
    }
}
```

## 6. Plugin Manager

```rust
// crates/core/src/runtime/wasm/plugin_manager.rs

pub struct PluginManager {
    engine: wasmtime::Engine,
    plugins: DashMap<String, LoadedPlugin>,   // keyed by node_type
    plugin_dir: PathBuf,
    watcher: OptionRecommended<RecommendedWatcher>,
}

struct LoadedPlugin {
    module: Module,                           // compiled WASM module
    info: WasmNodeInfo,                       // metadata
    source_path: PathBuf,                     // for hot reload
    checksum: Vec<u8>,                        // SHA256 of .wasm file
    loaded_at: SystemTime,
}

impl PluginManager {
    /// Scan plugin directory and load all .wasm files
    pub async fn load_all(&self, plugin_dir: &Path) -> Result<Vec<WasmNodeInfo>> {
        for entry in fs::read_dir(plugin_dir)? {
            let path = entry?.path();
            if path.extension() == Some(OsStr::new("wasm")) {
                self.load_plugin(&path).await?;
            }
        }
    }

    /// Load a single .wasm plugin, validate, and register
    pub async fn load_plugin(&self, path: &Path) -> Result<WasmNodeInfo> {
        // 1. Compile WASM module (cached by Wasmtime)
        let module = Module::from_file(&self.engine, path)?;

        // 2. Validate exports: must have edgelink_node_info, edgelink_process_msg
        self.validate_module(&module)?;

        // 3. Create temporary instance to call edgelink_node_info
        let info = self.extract_node_info(&module).await?;

        // 4. Store in registry
        let checksum = sha256_file(path)?;
        self.plugins.insert(info.node_type.clone(), LoadedPlugin {
            module, info: info.clone(), source_path: path.to_path_buf(),
            checksum, loaded_at: SystemTime::now(),
        });

        Ok(info)
    }

    /// Register all loaded plugins into the EdgeLinkd node registry
    pub fn register_into(&self, registry: &mut RegistryBuilder) -> Result<()> {
        for entry in self.plugins.iter() {
            let LoadedPlugin { module, info, .. } = entry.value();
            let meta = MetaNode {
                kind: NodeKind::Flow,
                type_: Box::leak(info.node_type.clone().into_boxed_str()),
                factory: NodeFactory::Wasm(WasmNodeFactory {
                    plugin_type: info.node_type.clone(),
                    module: module.clone(),
                }),
                red_name: Box::leak(info.red_name.clone().into_boxed_str()),
                module: Box::leak(info.module.clone().into_boxed_str()),
                version: Box::leak(info.version.clone().into_boxed_str()),
                local: false,
                user: false,
            };
            registry.register_dynamic(meta)?;
        }
        Ok(())
    }

    /// Watch plugin directory for changes and hot-reload
    pub async fn start_watcher(&mut self) -> Result<()> {
        let engine = self.engine.clone();
        let plugins = self.plugins.clone();

        let mut watcher = notify::recommended_watcher(move |res| {
            match res {
                Ok(Event { kind: Create(_) | Modify(_), paths, .. }) => {
                    for path in paths {
                        if path.extension() == Some(OsStr::new("wasm")) {
                            // Reload in background
                            let engine = engine.clone();
                            let plugins = plugins.clone();
                            tokio::spawn(async move {
                                if let Err(e) = reload_plugin(&engine, &plugins, &path).await {
                                    log::error!("Failed to reload plugin {:?}: {e}", path);
                                }
                            });
                        }
                    }
                }
                _ => {}
            }
        })?;
        watcher.watch(&self.plugin_dir, RecursiveMode::NonRecursive)?;
        self.watcher = Some(watcher);
        Ok(())
    }
}
```

## 7. Guest SDK (`edgelink-wasm-sdk`)

A Rust crate that plugin authors depend on. Wraps the low-level ABI in ergonomic types.

```rust
// crates/wasm-sdk/src/lib.rs

/// Main entry point macro — generates all the boilerplate
#[macro_export]
macro_rules! export_node {
    ($handler:ty) => {
        #[no_mangle]
        pub extern "C" fn edgelink_node_info() -> u32 {
            let info = <$handler>::info();
            let bytes = rmp_serde::to_vec(&info).unwrap();
            write_to_host(&bytes)
        }

        #[no_mangle]
        pub extern "C" fn edgelink_on_start(config_ptr: u32, config_len: u32) -> u32 {
            let config_bytes = read_from_host(config_ptr, config_len);
            let config: serde_json::Value = rmp_serde::from_slice(&config_bytes).unwrap();
            <$handler>::on_start(config);
            0
        }

        #[no_mangle]
        pub extern "C" fn edgelink_process_msg(msg_ptr: u32, msg_len: u32) -> u32 {
            let msg_bytes = read_from_host(msg_ptr, msg_len);
            let msg: WasmMessage = rmp_serde::from_slice(&msg_bytes).unwrap();
            let result = <$handler>::process(msg);
            let result_bytes = rmp_serde::to_vec(&result).unwrap();
            write_to_host(&result_bytes)
        }

        #[no_mangle]
        pub extern "C" fn edgelink_on_stop() -> u32 {
            <$handler>::on_stop();
            0
        }

        static mut STATE: Option<$handler> = None;
    };
}

/// Trait that plugin authors implement
pub trait WasmNodeHandler: Default + 'static {
    /// Return node metadata
    fn info() -> WasmNodeInfo;

    /// Called when the node starts (optional)
    fn on_start(config: serde_json::Value) where Self: Sized {}

    /// Process an incoming message, return outputs
    fn process(msg: WasmMessage) -> ProcessResult;

    /// Called when the node stops (optional)
    fn on_stop() where Self: Sized {}
}

/// Helper: send a message to an output port (from within process())
pub fn send(port: u32, msg: WasmMessage) {
    let bytes = rmp_serde::to_vec(&msg).unwrap();
    unsafe {
        host_send_msg(port, bytes.as_ptr() as u32, bytes.len() as u32);
    }
}

/// Helper: set node status
pub fn set_status(fill: &str, shape: &str, text: &str) {
    let fill_code = match fill {
        "red" => 0, "green" => 1, "yellow" => 2, "grey" => 3, "blue" => 4, _ => 3,
    };
    let shape_code = match shape { "ring" => 0, "dot" => 1, _ => 1 };
    unsafe {
        host_set_status(fill_code, shape_code, text.as_ptr() as u32, text.len() as u32);
    }
}

/// Helper: log a message
pub fn log(level: &str, msg: &str) {
    let level_code = match level {
        "error" => 0, "warn" => 1, "info" => 2, "debug" => 3, "trace" => 4, _ => 2,
    };
    unsafe {
        host_log(level_code, msg.as_ptr() as u32, msg.len() as u32);
    }
}

extern "C" {
    fn host_log(level: u32, msg_ptr: u32, msg_len: u32);
    fn host_send_msg(port: u32, msg_ptr: u32, msg_len: u32);
    fn host_set_status(fill: u32, shape: u32, text_ptr: u32, text_len: u32);
    fn host_sleep_ms(ms: u64);
    fn host_report_error(msg_ptr: u32, msg_len: u32);
}
```

### Example: HTTP Request Node Plugin

```rust
// plugins/http-request/src/lib.rs

use edgelink_wasm_sdk::*;

struct HttpRequestNode;

impl WasmNodeHandler for HttpRequestNode {
    fn info() -> WasmNodeInfo {
        WasmNodeInfo {
            node_type: "my-plugin/http-request".into(),
            red_name: "http-request".into(),
            module: "my-plugin".into(),
            version: "1.0.0".into(),
            inputs: 1,
            outputs: 1,
            color: Some("#3FADB5".into()),
            icon: Some("white-globe.svg".into()),
            label: Some("http request".into()),
            label_style: None,
            palette_label: None,
            align: None,
            editor_template: None,
            capabilities: vec!["http_client".into()],
        }
    }

    fn process(msg: WasmMessage) -> ProcessResult {
        let url = msg.extra.get("url")
            .and_then(|v| v.as_str())
            .unwrap_or("https://httpbin.org/get");

        log("info", &format!("Fetching {}", url));

        // Use host HTTP capability
        let response = http_get(url);

        let mut output_msg = msg.clone();
        output_msg.payload = WasmValue::String(response.body);
        output_msg.extra.insert("statusCode".into(), WasmValue::Number(200.into()));
        output_msg.extra.insert("headers".into(), response.headers);

        set_status("green", "dot", &format!("{}: {}", response.status_code, url));

        ProcessResult {
            output: Some(vec![vec![Some(output_msg)]]),
        }
    }
}

export_node!(HttpRequestNode);
```

## 8. Security Model

### 8.1 Runtime Configuration

```rust
fn create_wasm_engine() -> wasmtime::Engine {
    let mut config = Config::new();
    config.async_support(true);
    config.epoch_interruption(true);
    // No WASI by default — all capabilities through host imports
    Engine::new(&config).unwrap()
}

fn create_store(engine: &Engine, limits: &PluginLimits) -> Store<WasmNodeState> {
    let mut store = Store::new(engine, WasmNodeState::new());

    // Fuel metering: prevent infinite loops
    store.set_fuel(limits.max_fuel);  // e.g. 10_000_000

    // Memory limits via ResourceLimiter
    store.limiter(Arc::new(PluginResourceLimiter {
        max_memory_pages: limits.max_memory_pages,  // e.g. 16 pages = 1MB
        max_table_size: limits.max_table_elements,   // e.g. 1024
    }));

    // Set epoch deadline for timeslicing
    store.set_epoch_deadline(1);

    store
}
```

### 8.2 Capability Gating

Each plugin declares required capabilities in its `WasmNodeInfo`. The host checks these at load time and only links the corresponding host imports if the capability is allowed.

```rust
#[derive(Debug, Clone)]
struct PluginCapabilities {
    http_client: bool,
    filesystem_read: bool,
    filesystem_write: bool,
    network_tcp: bool,
    network_udp: bool,
    subprocess: bool,
}

impl PluginManager {
    fn create_linker(&self, caps: &PluginCapabilities) -> Result<Linker<WasmNodeState>> {
        let mut linker = Linker::new(&self.engine);

        // Always available
        linker.func_wrap("edgelink", "host_log", host_log_fn)?;
        linker.func_wrap("edgelink", "host_send_msg", host_send_msg_fn)?;
        linker.func_wrap("edgelink", "host_set_status", host_set_status_fn)?;
        linker.func_wrap("edgelink", "host_alloc", host_alloc_fn)?;
        linker.func_wrap("edgelink", "host_report_error", host_report_error_fn)?;

        // Capability-gated
        if caps.http_client {
            linker.func_wrap("edgelink", "host_http_request", host_http_request_fn)?;
        }
        if caps.network_tcp {
            linker.func_wrap("edgelink", "host_tcp_connect", host_tcp_connect_fn)?;
        }
        if caps.filesystem_read {
            linker.func_wrap("edgelink", "host_fs_read", host_fs_read_fn)?;
        }

        Ok(linker)
    }
}
```

### 8.3 Configuration

```toml
# edgelink.toml

[wasm]
enabled = true
plugin_dir = "./plugins"

[wasm.limits]
max_fuel = 10_000_000        # per process_msg call
max_memory_pages = 16         # 16 * 64KB = 1MB
epoch_interval_ms = 100       # timeslice duration

[wasm.capabilities.default]
http_client = true
filesystem_read = false
filesystem_write = false
network_tcp = false
network_udp = false
subprocess = false

# Per-plugin overrides
[wasm.capabilities.overrides."my-plugin/http-request"]
http_client = true
```

## 9. Changes to Existing Code

### 9.1 Registry Extension (`registry.rs`)

```rust
// Add dynamic registration support
impl RegistryBuilder {
    pub fn register_dynamic(&mut self, meta: MetaNode) -> Result<()> {
        // MetaNode.type_ is currently &'static str
        // For dynamic plugins, we Box::leak to get a 'static reference
        self.builtins.insert(meta.type_, meta);
        Ok(())
    }
}

// Extend NodeFactory enum
pub enum NodeFactory {
    Global(GlobalNodeFactoryFn),
    Flow(FlowNodeFactoryFn),
    Wasm(WasmNodeFactory),  // NEW
}

pub struct WasmNodeFactory {
    pub plugin_type: String,
    pub module: wasmtime::Module,
}
```

### 9.2 New Crate: `crates/wasm-host`

```
crates/wasm-host/
├── Cargo.toml
└── src/
    ├── lib.rs              # Public API
    ├── plugin_manager.rs   # Plugin loading, scanning, hot reload
    ├── shim.rs             # WasmNodeShim (FlowNodeBehavior impl)
    ├── state.rs            # WasmNodeState
    ├── abi.rs              # Host-side ABI functions (imports)
    ├── memory.rs           # Guest memory read/write helpers
    ├── config.rs           # PluginLimits, PluginCapabilities
    └── error.rs            # WASM-specific errors
```

### 9.3 New Crate: `crates/wasm-sdk`

```
crates/wasm-sdk/
├── Cargo.toml
└── src/
    ├── lib.rs              # export_node! macro, WasmNodeHandler trait
    ├── types.rs            # WasmMessage, WasmValue, ProcessResult, WasmNodeInfo
    ├── memory.rs           # read_from_host, write_to_host helpers
    └── capabilities.rs     # http_get, http_post, etc. wrappers
```

### 9.4 Engine Integration

```rust
// In engine initialization:
let plugin_mgr = PluginManager::new(&wasm_engine, plugin_dir);
let plugin_infos = plugin_mgr.load_all(plugin_dir).await?;
let mut registry_builder = RegistryBuilder::default().with_builtins();
plugin_mgr.register_into(&mut registry_builder)?;
let registry = registry_builder.build();
```

## 10. Migration Path to Component Model

The raw WASM ABI described above is the MVP. The migration path to the Component Model is:

1. **Define WIT interface** that mirrors our ABI:
```wit
// wit/edgelink-node.wit
interface node {
    resource node-handler {
        process: func(msg: message) -> result<process-result>;
        on-start: func(config: string) -> result;
        on-stop: func() -> result;
    }
}
```

2. **Use `wit-bindgen`** to generate both host and guest bindings from the WIT file.

3. **The `WasmNodeShim`** switches from calling raw `TypedFunc` to using the generated trait.

4. **The `wasm-sdk`** crate switches from manual `extern "C"` declarations to using the generated guest bindings.

5. **The ABI layer** becomes type-safe and language-agnostic for free.

This migration can happen incrementally — the raw ABI continues to work while Component Model support is added alongside it.

## 11. Implementation Plan

### Phase 1: Foundation (Week 1-2)
- [ ] Add `wasmtime` dependency (feature-gated behind `wasm_plugins`)
- [ ] Create `crates/wasm-host` with `PluginManager` skeleton
- [ ] Create `crates/wasm-sdk` with `WasmNodeHandler` trait and `export_node!` macro
- [ ] Implement `WasmNodeShim` with basic `edgelink_process_msg` support
- [ ] Extend `NodeFactory` enum with `Wasm` variant
- [ ] Extend `RegistryBuilder` with `register_dynamic()`

### Phase 2: Core Features (Week 3-4)
- [ ] Implement full host import functions (log, send_msg, status, context)
- [ ] Implement `ProcessResult` deserialization and message fan-out
- [ ] Add MessagePack serialization for `WasmMessage`
- [ ] Add TOML configuration for WASM settings
- [ ] Write integration test with a simple "echo" WASM plugin

### Phase 3: Security & Production (Week 5-6)
- [ ] Add fuel metering and epoch-based interruption
- [ ] Add `ResourceLimiter` for memory constraints
- [ ] Implement capability gating
- [ ] Add plugin validation (required exports check)
- [ ] Hot reload via file watcher

### Phase 4: SDK Polish & Examples (Week 7-8)
- [ ] Guest SDK ergonomics (builder pattern for `WasmNodeInfo`)
- [ ] Example plugins: echo, filter, transform, http-request
- [ ] Build pipeline: `cargo build --target wasm32-unknown-unknown` instructions
- [ ] Documentation and contributor guide

### Phase 5: Advanced (Week 9+)
- [ ] Component Model WIT definition
- [ ] `wit-bindgen` integration
- [ ] Global/config node WASM support
- [ ] Multi-language SDK (JS via AssemblyScript, Go via TinyGo)
- [ ] Plugin marketplace infrastructure

## 12. Performance Considerations

| Concern | Mitigation |
|---------|-----------|
| **Serialization overhead** | MessagePack is ~2-3x faster than JSON for binary data. For large payloads, consider shared memory regions. |
| **Per-call WASM overhead** | ~100ns per call on ARM. Negligible compared to I/O-bound node operations. |
| **Cold start** | Compile WASM modules once at load time. Wasmtime caches compiled modules. |
| **Memory** | Each instance costs ~1-2MB. Pool instances for high-node-count flows, or use a shared-module-per-plugin pattern. |
| **Async** | All async operations go through host imports. Guest calls `host_sleep_ms()` → host does `tokio::time::sleep` → guest resumes. |

**Benchmarking target**: WASM node throughput should be within 80% of native Rust nodes for I/O-bound workloads. The serialization overhead is the main bottleneck, and MessagePack keeps it minimal.
