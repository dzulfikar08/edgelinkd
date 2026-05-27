# Network Nodes

## MQTT In

Subscribes to MQTT topics and receives messages.

**Type**: `mqtt in`

**Properties**:
- `broker` - MQTT broker config node ID
- `topic` - subscription topic (supports `#` and `+` wildcards)
- `qos` - QoS level (0 or 1)
- `datatype` - payload type: "auto", "utf8", "json", "buffer"

**Config Node**: Requires an `mqtt-broker` or `mqtt-broker-embedded` config node.

## MQTT Out

Publishes messages to MQTT topics.

**Type**: `mqtt out`

**Properties**:
- `broker` - MQTT broker config node ID
- `topic` - default publish topic (overridden by `msg.topic`)
- `qos` - QoS level
- `retain` - retain message on broker

## HTTP In

Creates HTTP endpoint listeners.

**Type**: `http in`

**Properties**:
- `method` - HTTP method: "get", "post", "put", "delete", "patch"
- `url` - URL path (e.g., `/api/data`)
- `swaggerDoc` - OpenAPI documentation

**Input**: None (listens for incoming requests)
**Output**: `msg.payload` contains request body, `msg.req` has request details

## HTTP Response

Sends HTTP responses.

**Type**: `http response`

**Properties**:
- `statusCode` - HTTP status code (default: 200)
- `headers` - response headers

## HTTP Request

Makes HTTP requests to external services.

**Type**: `http request`

**Properties**:
- `method` - HTTP method
- `url` - target URL
- `headers` - request headers
- `payload` - request body

## WebSocket

WebSocket listener and client.

**Types**: `websocket-listener`, `websocket-client`, `websocket in`, `websocket out`

**Properties**:
- `path` - WebSocket path (for listeners)
- `url` - WebSocket URL (for clients)

## TCP In / Out

TCP client and server nodes.

**Types**: `tcp in`, `tcp out`, `tcp request`

**Properties**:
- `server` - "server" or "client" mode
- `host` - remote host (client mode)
- `port` - TCP port
- `datamode` - "stream" or "single"

## UDP In / Out

UDP sender and receiver.

**Types**: `udp in`, `udp out`

**Properties**:
- `host` - target host
- `port` - UDP port
- `multicast` - multicast group (optional)
- `group` - multicast address
