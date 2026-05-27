# Clustering & High Availability

Rust-RED includes built-in clustering via a gossip protocol. Run multiple instances as a single logical unit with automatic failover.

## Architecture

```
 +-----------+     +-----------+     +-----------+
 |  Node A   |<--->|  Node B   |<--->|  Node C   |
 | (Leader)  |     | (Follower)|     | (Follower)|
 | Flows:    |     | Flows:    |     | Flows:    |
 |  flow-0   |     |  flow-1   |     |  flow-2   |
 |  flow-3   |     |  flow-4   |     |  flow-5   |
 +-----------+     +-----------+     +-----------+
        |               |                 |
        +---------------+-----------------+
                        |
                HTTP API :1888
```

## Five Subsystems

1. **Gossip Membership** - Heartbeats every 2 seconds to random peers. 10% include full membership sync.
2. **Failure Detection** - Missed heartbeats beyond timeout (default 10s) → Suspect → Dead → trigger rebalance.
3. **Flow Partitioning** - Leader assigns flows round-robin across alive nodes.
4. **State Synchronization** - Global context replicated with version-based conflict resolution.
5. **Session Affinity** - Consistent hashing for sticky routing.

## Quick Setup (3 Nodes)

### Node A (10.0.0.1) - `/etc/rust-red/config.toml`

```toml
[ui-host]
host = "0.0.0.0"
port = 1888

[cluster]
enabled = true
node_id = "node-a"
bind = "0.0.0.0:7980"
peers = ["10.0.0.2:7980", "10.0.0.3:7980"]
```

### Node B (10.0.0.2) - `/etc/rust-red/config.toml`

```toml
[ui-host]
host = "0.0.0.0"
port = 1888

[cluster]
enabled = true
node_id = "node-b"
bind = "0.0.0.0:7980"
peers = ["10.0.0.1:7980", "10.0.0.3:7980"]
```

### Node C (10.0.0.3) - `/etc/rust-red/config.toml`

```toml
[ui-host]
host = "0.0.0.0"
port = 1888

[cluster]
enabled = true
node_id = "node-c"
bind = "0.0.0.0:7980"
peers = ["10.0.0.1:7980", "10.0.0.2:7980"]
```

### Start

```bash
# On each node:
rust-red run --headless -c /etc/rust-red/config.toml
```

### Verify

```bash
curl http://10.0.0.1:1888/cluster/status | jq
```

## Configuration Reference

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `false` | Enable clustering |
| `node_id` | auto UUID | Unique node identifier |
| `bind` | `"0.0.0.0:7980"` | Gossip listener address |
| `peers` | `[]` | Initial peer addresses |
| `heartbeat_interval_ms` | `2000` | Heartbeat frequency |
| `failure_timeout_ms` | `10000` | Time before declaring node dead |
| `discovery_mode` | `"static"` | Discovery: static, multicast, dns |
| `multicast_addr` | `"239.255.0.1:7980"` | Multicast group |
| `dns_service` | `""` | DNS service name |

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cluster/status` | Cluster health, members, leader |
| `GET` | `/cluster/nodes` | List all cluster nodes |
| `POST` | `/cluster/deploy` | Deploy flows cluster-wide |
| `GET` | `/cluster/flows` | Flow-to-node assignments |

## Failover Example

```
Before: Node A: flow-0, flow-3  |  Node B: flow-1, flow-4  |  Node C: flow-2, flow-5

Node C dies → Leader (Node A) detects failure → Rebalances flows

After:  Node A: flow-0, flow-2, flow-3  |  Node B: flow-1, flow-4, flow-5
```

No manual intervention needed. Flows restart on surviving nodes automatically.

## Scaling Options

| Approach | Best For | Scaling Method |
|----------|----------|----------------|
| Manual VPS | 2-5 nodes | Edit config, start node |
| Docker Compose | Single-host | `docker compose up --scale` |
| Kubernetes | Large deployments | `kubectl scale` |

## Build with Cluster Support

```bash
cargo build --release --features cluster
```

Without `--features cluster`, all clustering code is compiled out with zero overhead.
