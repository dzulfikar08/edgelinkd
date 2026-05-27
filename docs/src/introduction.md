# Introduction

**Rust-RED** is a high-performance, memory-efficient Node-RED compatible runtime engine built in Rust.

## Why Rust-RED?

Node-RED is excellent for wiring together IoT devices, APIs, and online services. But it runs on Node.js, which means higher memory usage and slower execution for data-heavy workloads. Rust-RED solves this:

- **10x less memory** than Node-RED (only 10% of the footprint)
- **Native performance** with Rust's zero-cost abstractions
- **Integrated web UI** - full Node-RED editor built-in
- **Drop-in compatible** - use your existing `flows.json` files
- **Built-in clustering** - horizontal scaling without Kubernetes
- **259+ passing tests** - comprehensive Node-RED compatibility

## How It Works

Rust-RED is a standalone binary. No Node.js runtime, no npm install. It serves the Node-RED web editor from an embedded HTTP server and executes flows with native Rust code. Only the `function` node uses QuickJS (a lightweight JavaScript interpreter) for backwards compatibility.

```
Browser  <--HTTP-->  Rust-RED Binary  <--MQTT/TCP/HTTP/Modbus-->  Devices
  (Editor UI)        (Runtime Engine)
```

## Feature Flags

Rust-RED uses Cargo feature flags so you only compile what you need:

| Feature | Description |
|---------|-------------|
| `default` | Core + JS + all protocol/storage nodes |
| `full` | Default + WASM plugins + clustering |
| `core` | Minimal runtime, no nodes |
| `js` | QuickJS interpreter (function node) |
| `nodes_network` | MQTT, HTTP, TCP, UDP, WebSocket |
| `nodes_storage` | File I/O, watch |
| `nodes_postgres` | PostgreSQL read/write |
| `nodes_sqlite` | SQLite read/write |
| `nodes_influxdb` | InfluxDB read/write |
| `nodes_modbus` | Modbus read/write/flex/server |
| `nodes_opcua` | OPC-UA read/write |
| `nodes_bacnet` | BACnet read/write |
| `cluster` | Clustering & high availability |
| `mqtt_broker` | Embedded MQTT broker |

Build what you need:

```bash
# Everything
cargo build --release --features full

# Just MQTT and Modbus for an edge gateway
cargo build --release --features nodes_network,nodes_modbus

# Minimal headless runner
cargo build --release --features core
```

## What's Different from Node-RED

| Aspect | Node-RED | Rust-RED |
|--------|----------|----------|
| Runtime | Node.js | Native Rust binary |
| Memory | ~100MB base | ~10MB base |
| Function node | V8 JavaScript | QuickJS JavaScript |
| Dashboard | node-red-dashboard (separate) | Built-in dashboard node |
| Clustering | Not built-in | Gossip-based HA |
| Plugins | npm packages | WASM or Rust plugins |
| Flow format | flows.json | Same flows.json (compatible) |

## License

Apache 2.0 - see [LICENSE](https://github.com/dzulfikar08/rust-red/blob/master/LICENSE).
