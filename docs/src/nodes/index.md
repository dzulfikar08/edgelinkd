# Node Reference

Rust-RED includes built-in nodes organized by category. All nodes are compatible with their Node-RED equivalents.

## Node Categories

- [Common Nodes](./common.md) - inject, debug, catch, status, comment, link
- [Function Nodes](./function.md) - function, switch, change, range, template, delay, trigger, exec, filter
- [Network Nodes](./network.md) - MQTT, HTTP, TCP, UDP, WebSocket
- [Sequence Nodes](./sequence.md) - split, join, sort, batch
- [Parser Nodes](./parser.md) - CSV, JSON, XML, YAML, HTML
- [Storage Nodes](./storage.md) - file, file in, watch
- [Database Nodes](./database.md) - PostgreSQL, TimescaleDB, MSSQL, SQLite, InfluxDB
- [Industrial Nodes](./industrial.md) - Modbus, OPC-UA, BACnet

## Compatibility Matrix

| Node | Node-RED Type | Status |
|------|--------------|--------|
| Inject | `inject` | Full |
| Debug | `debug` | Full |
| Function | `function` | Full (QuickJS) |
| Switch | `switch` | Full |
| Change | `change` | Full |
| Range | `range` | Full |
| Template | `template` | Full |
| Delay | `delay` | Full |
| Trigger | `trigger` | Full |
| Exec | `exec` | Full |
| Filter (RBE) | `rbe` | Full |
| MQTT In | `mqtt in` | Full |
| MQTT Out | `mqtt out` | Full |
| HTTP In | `http in` | Full |
| HTTP Response | `http response` | Full |
| HTTP Request | `http request` | Full |
| WebSocket | `websocket` | Full |
| TCP In/Out | `tcp in/out` | Full |
| UDP In/Out | `udp in/out` | Full |
| Split | `split` | Full |
| Join | `join` | Full |
| Sort | `sort` | Full |
| Batch | `batch` | Full |
| CSV | `csv` | Full |
| JSON | `json` | Full |
| XML | `xml` | Full |
| YAML | `yaml` | Full |
| HTML | `html` | Full |
| File | `file` | Full |
| File In | `file in` | Full |
| Watch | `watch` | Full |
| Link In/Out | `link in/out` | Full |
| Comment | `comment` | Full |
| Catch | `catch` | Full |
| Status | `status` | Full |
| Complete | `complete` | Full |
| PostgreSQL | `postgres in/out` | Full |
| SQLite | `sqlite in/out` | Full |
| InfluxDB | `influxdb in/out` | Full |
| TimescaleDB | `timescaledb in/out` | Full |
| MSSQL | `mssql in/out` | Full |
| Modbus Read | `modbus-read` | Full |
| Modbus Write | `modbus-write` | Full |
| Modbus Flex | `modbus-flex-getter/writer` | Full |
| Modbus Server | `modbus-server` | Full |
| OPC-UA Read | `opcua-read` | Full |
| OPC-UA Write | `opcua-write` | Full |
| BACnet Read | `bacnet-read` | Full |
| BACnet Write | `bacnet-write` | Full |

## Message Format

Messages follow the Node-RED `msg` format:

```json
{
  "payload": "hello",
  "topic": "sensors/temperature",
  "_msgid": "abc123"
}
```

- `payload` - the main data
- `topic` - optional categorization
- `_msgid` - auto-generated message ID

Nodes can add custom properties. The `payload` can be any JSON type: string, number, boolean, array, object, or null.
