# Architecture

Rust-RED is a Node-RED compatible runtime engine with an integrated web UI, built as a single Rust binary.

## High-Level Design

```
┌─────────────────────────────────────────────┐
│                 rust-red binary              │
│                                             │
│  ┌─────────┐  ┌──────────┐  ┌───────────┐  │
│  │  Web UI  │  │  Runtime │  │  Cluster  │  │
│  │ (React)  │  │  Engine  │  │  Manager  │  │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  │
│       │             │              │         │
│  ┌────┴─────────────┴──────────────┴─────┐  │
│  │            Shared State                │  │
│  │  (Flows, Context, Credentials, etc.)   │  │
│  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Core Components

### Flow Engine

The flow engine is the heart of Rust-RED. It:

1. **Parses** flow JSON (Node-RED format)
2. **Builds** node instances from type registry
3. **Resolves** wires into directed graph edges
4. **Executes** messages through the graph

Each flow is a directed graph of nodes. Messages flow from output ports to input ports along wires. The engine handles:

- **Lifecycle**: build → start → process messages → stop
- **Subflows**: reusable flow fragments with their own scope
- **Groups**: visual grouping in the editor (no runtime effect)
- **Context**: flow-level and global key-value stores

### Node Registry

Nodes are registered via the `inventory` crate. Each node type provides:

- A unique type string (e.g., `"mqtt in"`, `"modbus-read"`)
- A factory function that creates a node instance from JSON config
- Category metadata for the palette UI

Node types are spread across feature-gated modules:

| Module | Feature | Nodes |
|--------|---------|-------|
| `common_nodes` | always | inject, debug, catch, status, comment, etc. |
| `function_nodes` | `js` | function, switch, change, range, template, delay, trigger, exec, filter |
| `network_nodes` | `nodes_network` | mqtt in/out, http in/out, tcp in/out, udp in/out, websocket |
| `storage_nodes` | `nodes_storage` | file, file in, watch |
| `industrial_nodes` | `nodes_modbus` | modbus config/read/write/flex/server |
| `industrial_nodes` | `nodes_opcua` | opcua config/read/write |
| `industrial_nodes` | `nodes_bacnet` | bacnet config/read/write |
| `db_nodes` | `nodes_postgres` | postgres config/in/out |
| `db_nodes` | `nodes_sqlite` | sqlite config/in/out |
| `db_nodes` | `nodes_influxdb` | influxdb in/out |

### Message Passing

Messages are `serde_json::Value` objects (the `msg` in Node-RED). When a node calls `send(output_port, msg)`, the engine:

1. Clones the message for each downstream wire
2. Delivers to each target node's `on_input()` handler
3. Nodes process asynchronously via tokio tasks

### Web Server

Built on Axum, serves:

- Static React UI files
- REST API for flow CRUD, deploy, context
- WebSocket for live debug/status updates
- Authentication endpoints (JWT, API keys)

### Config Node Pattern

Config nodes (MQTT broker, Modbus connection, database) are shared across flow nodes:

1. A config node (e.g., `modbus-config`) stores connection parameters
2. Flow nodes reference the config by ElementId
3. At runtime, flow nodes resolve the config node via the engine's global node registry
4. Connection pooling/reuse happens within the config node instance

## Crate Structure

```
rust-red/
├── src/main.rs                    # CLI entry point
├── crates/
│   ├── core/                      # Runtime engine + all node implementations
│   │   └── src/runtime/nodes/     # Node type modules
│   ├── macro/                     # Proc macros for node registration
│   ├── web/                       # Axum HTTP server + static UI
│   ├── wasm-host/                 # WASM plugin runtime
│   ├── wasm-sdk/                  # SDK for building WASM plugins
│   ├── mqtt-broker/               # Embedded MQTT broker
│   └── cluster/                   # Gossip-based clustering
├── node-plugins/                  # External node plugins
└── benchmarks/                    # Criterion benchmarks
```

## Thread Model

Rust-RED uses tokio's multi-threaded runtime:

- **Main thread**: tokio runtime, handles all async I/O
- **Node processing**: each node's `on_input` runs as a tokio task
- **Network I/O**: non-blocking via tokio (TCP, UDP, MQTT, HTTP)
- **JavaScript**: QuickJS runs on a dedicated thread pool to avoid blocking
- **WASM**: wasmtime runtime with async support

## Data Flow

```
inject node → on_input(msg) → send(0, msg) → engine routes to wire targets
                                                         ↓
                                              next_node.on_input(msg)
                                                         ↓
                                              next_node.send(0, msg)
                                                         ↓
                                                   ... and so on
```

Messages are `serde_json::Value` with standard Node-RED fields: `payload`, `topic`, `_msgid`, etc.
