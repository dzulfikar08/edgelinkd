# EdgeLinkd Usage Guides

## RRD-26: Pluggable Frontend

### Plugin Architecture
Frontend plugins implement the `FrontendPlugin` trait (`rust_red_core::web::frontend_plugin`) and are registered at compile time via the `inventory` crate.

### Creating a Plugin

```rust
use rust_red_core::web::frontend_plugin::{FrontendPlugin, PluginDescriptor, FrontendPluginEntry};
use std::path::PathBuf;

pub struct MyPlugin {
    descriptor: PluginDescriptor,
}

impl FrontendPlugin for MyPlugin {
    fn descriptor(&self) -> &PluginDescriptor {
        &self.descriptor
    }

    fn routes(&self) -> axum::Router {
        axum::Router::new()
            .route("/api/hello", axum::routing::get(|| async { "hello" }))
    }

    fn static_dir(&self) -> Option<&PathBuf> {
        self.descriptor.static_dir.as_ref()
    }
}

// Register at compile time:
fn create_my_plugin() -> Box<dyn FrontendPlugin> {
    Box::new(MyPlugin::new())
}

inventory::submit! {
    FrontendPluginEntry {
        factory: create_my_plugin,
    }
}
```

### Plugin Properties

| Field | Description | Example |
|-------|-------------|---------|
| `id` | Unique identifier | `"flow-editor"` |
| `name` | Human-readable name | `"Flow Editor (Modern)"` |
| `route_prefix` | URL prefix for routes and static files | `"/editor"` |
| `static_dir` | Path to static assets (React dist, etc.) | `PathBuf::from("./dist")` |
| `version` | Semantic version | `env!("CARGO_PKG_VERSION")` |

### API Endpoints

- `GET /api/frontend/plugins` — List all registered plugins (authenticated)
- `GET /editor/api/status` — Editor health check (no auth required)

### Built-in Plugin: Flow Editor

The default `FlowEditorPlugin` serves the React flow editor at `/editor/`. Static dir is resolved from:
1. `RUST_RED_EDITOR_STATIC_DIR` environment variable
2. `ui_static_dir()/editor` fallback

---

## RRD-27: Built-in MQTT Broker

### Configuration

The broker lives in `crates/mqtt-broker` and is configured via `BrokerConfig`:

```rust
BrokerConfig {
    enabled: true,
    bind: "0.0.0.0:1883".into(),
    max_connections: 10000,
    max_packet_size: 268435,
    default_keep_alive_secs: 60,
    session_expiry_secs: 1800,
    max_qos: 2,
    retain_available: true,
    wildcard_subscriptions_available: true,  // supports + and #
    auth: AuthConfig { username: None, password: None },
    persistence: PersistenceConfig::Memory,
}
```

### Starting the Broker

```rust
let broker = Arc::new(MqttBroker::new(config));
let addr = broker.clone().start_background().await?;
```

### MQTT Nodes in Flows

**Config node** (`mqtt-broker`):
```json
{"id": "broker1", "type": "mqtt-broker", "url": "mqtt://localhost:1883"}
```

**Subscribe** (`mqtt in`):
```json
{"type": "mqtt in", "broker": "broker1", "topic": "sensors/#", "qos": "1", "datatype": "json"}
```

**Publish** (`mqtt out`):
```json
{"type": "mqtt out", "broker": "broker1", "topic": "sensors/temp", "qos": "1"}
```

### Wildcard Support

| Wildcard | Meaning | Example |
|----------|---------|---------|
| `#` | Multi-level | `sensors/#` matches `sensors/room1/temp` |
| `+` | Single-level | `sensors/+/temp` matches `sensors/room1/temp` |

### Features

- QoS 0, 1, 2 message delivery
- Retained messages and will messages
- Session management with clean session support
- Connection pooling in MQTT client nodes
- Automatic reconnection with exponential backoff
- Memory-based persistence

---

## RRD-28: Database Driver Nodes

All DB nodes follow the same pattern: a **config node** (global) manages the connection pool, and **query/write nodes** reference it via `configNode`.

### PostgreSQL

**Config:** `postgres-config`
```json
{
  "id": "pg1", "type": "postgres-config",
  "host": "localhost", "port": 5432,
  "dbname": "mydb", "user": "postgres", "password": "secret",
  "poolMaxSize": 10, "connectTimeoutMs": 5000
}
```

**Query:** `postgres-query`
```json
{
  "type": "postgres-query", "configNode": "pg1",
  "query": "SELECT * FROM sensors WHERE loc = $1",
  "timeout_ms": 30000
}
```

Pass params: `msg.queryParams = ["room1"]`
Output: `msg.payload` (array of row objects), `msg.rowCount`

### TimescaleDB

Same as PostgreSQL but uses `timescaledb-config` / `timescaledb-query`. Includes automatic hypertable creation.

### InfluxDB v2

**Config:** `influxdb-config`
```json
{
  "id": "ifx1", "type": "influxdb-config",
  "url": "http://localhost:8086", "token": "my-token",
  "org": "myorg", "bucket": "mybucket"
}
```

**Write:** `influxdb-in` — builds line protocol from message
```json
{
  "type": "influxdb-in", "configNode": "ifx1",
  "measurement": "sensor_data",
  "tagColumns": ["device_id"], "fieldColumns": ["temperature", "humidity"],
  "timestampColumn": "ts"
}
```

**Query:** `influxdb-out` — Flux query with mustache templating
```json
{
  "type": "influxdb-out", "configNode": "ifx1",
  "query": "from(bucket: \"mybucket\") |> range(start: {{rangeStart}})",
  "timeoutMs": 30000
}
```

### MSSQL

**Config:** `mssql-config`
```json
{
  "id": "ms1", "type": "mssql-config",
  "host": "localhost", "port": 1433,
  "database": "mydb", "user": "sa", "password": "secret",
  "encrypt": true, "trust_server_certificate": false
}
```

**Query:** `mssql-query`
```json
{
  "type": "mssql-query", "configNode": "ms1",
  "query": "EXEC GetReadings @device = @P1",
  "timeout_ms": 30000
}
```

### Common Behavior

- All nodes set `msg.error` on failure and forward to output port 0
- Connection pools managed by config nodes
- Query timeouts configurable per node (default 30s)
- Parameterized queries prevent SQL injection

---

## RRD-32: Industrial Protocol Nodes

All industrial nodes follow: **config node** (global) manages connection, **read/write nodes** reference it via `configNode`.

### Modbus TCP

**Config:** `modbus-config`
```json
{
  "id": "mb1", "type": "modbus-config",
  "host": "192.168.1.100", "port": 502,
  "unitId": 1, "timeoutMs": 5000
}
```

**Read:** `modbus read`
```json
{
  "type": "modbus read", "configNode": "mb1",
  "functionCode": "readHoldingRegisters",
  "address": 0, "quantity": 10, "dataType": "uint16"
}
```

**Write:** `modbus write`
```json
{
  "type": "modbus write", "configNode": "mb1",
  "functionCode": "writeSingleRegister", "address": 0
}
```

**Function codes:**

| Code | Description |
|------|-------------|
| `readCoils` | Read boolean coils (FC1) |
| `readDiscreteInputs` | Read discrete inputs (FC2) |
| `readHoldingRegisters` | Read holding registers (FC3) |
| `readInputRegisters` | Read input registers (FC4) |
| `writeSingleCoil` | Write single coil (FC5) |
| `writeMultipleCoils` | Write multiple coils (FC15) |
| `writeSingleRegister` | Write single register (FC6) |
| `writeMultipleRegisters` | Write multiple registers (FC16) |

**Data types:** uint16, int16, uint32, int32, float, uint64, int64, double

### OPC-UA

**Config:** `opcua-config`
```json
{
  "id": "opc1", "type": "opcua-config",
  "endpoint": "opc.tcp://192.168.1.100:4840/",
  "securityMode": "None", "securityPolicy": "None"
}
```

**Read:** `opcua read`
```json
{
  "type": "opcua read", "configNode": "opc1",
  "nodeId": "ns=2;s=Temperature", "attribute": "Value"
}
```

**Write:** `opcua write` — set `msg.payload` to the value to write.

### BACnet/IP

**Config:** `bacnet-config`
```json
{
  "id": "bac1", "type": "bacnet-config",
  "deviceId": 1001, "targetHost": "192.168.1.100",
  "apduTimeoutMs": 3000, "retries": 3
}
```

**Read:** `bacnet read`
```json
{
  "type": "bacnet read", "configNode": "bac1",
  "objectType": "analogInput", "objectInstance": 1,
  "property": "presentValue"
}
```

COV subscriptions: set `subscribeCov: true` and `covLifetime: 60` for change-of-value notifications.

**BACnet object types:** analogInput, analogOutput, analogValue, binaryInput, binaryOutput, binaryValue, device

### Error Handling

- All nodes set `msg.error` on failure and forward to output port 0
- Config nodes report status (red ring on connection error)
- Modbus: overflow-safe register count calculation

---

## RRD-33: Dashboard Widgets

### Architecture

```
Flow Node → ui_dashboard_data → WebSocket (/comms) → Frontend Widget
```

### Pushing Data to Widgets

Use the `ui_dashboard_data` node:
```json
{
  "type": "ui_dashboard_data",
  "widget_id": "temp-gauge",
  "dashboard_id": "monitoring",
  "property": "payload"
}
```

Or set `msg.widget_id` dynamically in a function node.

### Widget Types

| Widget | Description | Data Format |
|--------|-------------|-------------|
| **Gauge** | Semi-circular gauge with color ranges | `{value, min, max, label, unit}` |
| **Chart** | Real-time line chart (Canvas) | `{data: [{t, v}], label, color}` |
| **Text** | Simple text/metric display | `{value, label, unit}` |
| **Toggle** | On/off switch with MQTT publish | `{on, label, mqttTopic}` |
| **Indicator** | Animated status light | `{status: "green"\|"yellow"\|"red"\|"off", label}` |

### Example: Temperature Monitor

```
inject (every 5s) → function (random temp) → ui_dashboard_data → debug
```

Function node:
```javascript
msg.payload = 20 + Math.random() * 15;
msg.widget_id = "main-temp";
return msg;
```

### Real-time Features

- WebSocket communication with instant updates
- Auto-resubscription on reconnect (tracks active subscriptions)
- Heartbeat monitoring for connection health
- Serialization failures logged at warning level (no silent data loss)
