# Plugin Authoring

Rust-RED supports two plugin models: native Rust plugins and WASM plugins.

## Native Rust Plugins

Native plugins register node types via the `inventory` crate. Create a new crate in `node-plugins/`:

### Project Structure

```
node-plugins/my-plugin/
  Cargo.toml
  src/
    lib.rs         # Node registration
    my_node.rs     # Node implementation
```

### Cargo.toml

```toml
[package]
name = "rust-red-nodes-my-plugin"
version = "0.1.0"
edition = "2021"

[dependencies]
rust-red-core = { path = "../../crates/core" }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
anyhow = "1"
async-trait = "0.1"
log = "0.4"
```

### Node Implementation

```rust
// src/my_node.rs
use rust_red_core::prelude::*;
use serde::Deserialize;
use async_trait::async_trait;

#[derive(Deserialize, Clone)]
pub struct MyNodeConfig {
    #[serde(default)]
    pub greeting: String,
}

pub struct MyNode {
    base: BaseFlowNodeState,
    config: MyNodeConfig,
}

impl FlowNode for MyNode {
    fn new_from_config(id: NodeId, config: &serde_json::Value) -> crate::Result<Self>
    where
        Self: Sized,
    {
        let config: MyNodeConfig = serde_json::from_value(config.clone())?;
        Ok(Self {
            base: BaseFlowNodeState::new(id),
            config,
        })
    }

    fn on_build(&mut self) -> crate::Result<()> {
        Ok(())
    }

    async fn on_input(
        &mut self,
        msg: Message,
        _port: usize,
    ) -> crate::Result<Vec<(usize, Message)>> {
        let mut msg = msg;
        msg.payload_set(format!("{} world", self.config.greeting))?;
        Ok(vec![(0, msg)])
    }

    fn node_type(&self) -> &'static str {
        "my-node"
    }
}
```

### Registration

```rust
// src/lib.rs
mod my_node;

use rust_red_core::prelude::*;

inventory::submit! {
    FlowNodeType::new::<my_node::MyNode>("my-node", "custom", "My Custom Node")
}
```

### Using the Plugin

Add to the root `Cargo.toml`:

```toml
[dependencies]
rust-red-nodes-my-plugin = { path = "node-plugins/rust-red-nodes-my-plugin" }
```

## WASM Plugins

WASM plugins allow writing nodes in any language that compiles to WebAssembly.

### Prerequisites

- `wasm-pack` or your language's WASM toolchain
- Rust-RED WASM SDK (`crates/wasm-sdk/`)

### Hello World WASM Plugin

```rust
// Using the wasm-sdk
use rust_red_wasm_sdk::*;

#[flow_node(type = "wasm-greet")]
pub struct GreetNode {
    greeting: String,
}

#[node_handler]
fn handle_input(node: &GreetNode, msg: Message) -> Result<Vec<(usize, Message)>> {
    let mut msg = msg;
    msg.payload = format!("{} from WASM!", node.greeting).into();
    Ok(vec![(0, msg)])
}
```

Build with:

```bash
cd my-wasm-plugin
wasm-pack build --target web
```

### Loading WASM Plugins

Place compiled `.wasm` files in `~/.rust-red/plugins/`. Rust-RED auto-discovers them on startup.

## Plugin Guidelines

1. **Keep nodes focused** - each node does one thing well
2. **Handle errors gracefully** - return `Err()` to trigger the catch node
3. **Use config nodes** for shared connections (databases, MQTT, Modbus)
4. **Test with the test harness** - use `TestHarness::from_flow_json()`
5. **Document your config fields** - they appear in the editor UI
