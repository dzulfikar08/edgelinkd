# API Reference

Rust-RED exposes a REST API for managing flows, nodes, and runtime state.

## Base URL

```
http://localhost:1888
```

## Authentication

When authentication is enabled, include a JWT token or API key:

```bash
# JWT token
curl -H "Authorization: Bearer <token>" http://localhost:1888/api/flows

# API key
curl -H "X-API-Key: <key>" http://localhost:1888/api/flows
```

## Flow Management

### List Flows

```
GET /api/flows
```

Returns all flow configurations.

### Get Flow

```
GET /api/flows/:id
```

### Deploy Flows

```
POST /api/flows
Content-Type: application/json

[{"id":"node1","type":"inject","wires":[["node2"]]},{"id":"node2","type":"debug","wires":[]}]
```

Deploys the provided flow configuration, replacing the current one.

### Delete Flow

```
DELETE /api/flows/:id
```

## Context

### Get Context Value

```
GET /api/context/:scope/:key
```

- `scope`: `global`, `flow:<flow-id>`, `node:<node-id>`
- `key`: context variable name

### Set Context Value

```
POST /api/context/:scope/:key
Content-Type: application/json

{"value": "hello"}
```

## Nodes

### Get Node Info

```
GET /api/nodes
```

Returns all registered node types with their module info.

## Credentials

### List Credentials

```
GET /api/credentials
```

### Get Credential

```
GET /api/credentials/:id
```

## Debug

### WebSocket Debug Stream

```
WS /ws/debug
```

Real-time debug output stream. Messages are JSON with `msg.payload`, `msg.topic`, `msg._msgid`.

## Cluster

Only available when built with `--features cluster`.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cluster/status` | Cluster health overview |
| `GET` | `/cluster/nodes` | List all cluster members |
| `POST` | `/cluster/deploy` | Deploy flows across cluster |
| `GET` | `/cluster/flows` | View flow assignments |

## System

### Health Check

```
GET /health
```

Returns `200 OK` when the runtime is healthy.
