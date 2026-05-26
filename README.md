# Rust-Red: Node-RED Reimplemented in Rust

[![Build Status]][actions]
[![GitHub Release]][releases]
[![GitHub Downloads]][releases]

[Build Status]: https://img.shields.io/github/actions/workflow/status/oldrev/edgelinkd/CICD.yml?branch=master
[actions]: https://github.com/oldrev/edgelinkd/actions?query=branch%3Amaster
[GitHub Release]: https://img.shields.io/github/v/release/oldrev/edgelinkd?include_prereleases
[releases]: https://github.com/github.com/oldrev/edgelinkd/releases
[GitHub Downloads]: https://img.shields.io/github/downloads/oldrev/edgelinkd/total
![Node-RED Rust Backend](assets/banner.jpg)

English | [简中](README.zh-cn.md)

## Overview

**Rust-Red** is a high-performance, memory-efficient Node-RED compatible runtime engine built from the ground up in Rust, now featuring an integrated web UI for complete standalone operation.

**Why Rust-Red?**
- **10x less memory usage** than Node-RED (only 10% of Node-RED's memory footprint)
- **Native performance** with Rust's zero-cost abstractions
- **Integrated web interface** - full Node-RED UI built-in for flow design and management
- **Standalone operation** - no external Node-RED installation required
- **Drop-in replacement** - use your existing `flows.json` files
- **Perfect for edge devices** with limited resources
- **Built-in clustering & HA** - run multiple nodes for fault tolerance and horizontal scaling
- **Node-RED compatibility** - design, deploy, and run flows all in one application

Rust-Red now includes the complete Node-RED web editor, allowing you to design flows directly in the browser while executing them with native Rust performance. You can also run it headless for production deployments on resource-constrained devices.

Only the `function` node uses the lightweight QuickJS JS interpreter to run JavaScript code; all other functionalities are implemented in native Rust code for maximum performance.

## A Short Demo


<video src="https://github.com/user-attachments/assets/5841db63-513a-4b36-8566-57c74adb7b60" controls width="100%"></video>

### Use Cases

- **Flow Development**: Design and test flows directly in the integrated web editor
- **Rapid Prototyping**: Full Node-RED UI for quick flow development and iteration
- **IoT Edge Gateways**: Process sensor data with minimal resource usage
- **Industrial Automation**: Run control flows on embedded controllers with web-based monitoring
- **Home Automation**: Deploy smart home logic on Raspberry Pi with remote web access
- **Development & Production**: Use web UI for development, headless mode for production deployment
- **Cloud-to-Edge Migration**: Move Node-RED flows from cloud to edge with unified interface
- **Container Deployments**: Lightweight containers for edge computing with optional web UI
- **Remote Management**: Access and modify flows remotely through the web interface


## Quick Start

### 0. Clone the Repository

**Clone the repository with submodules:**

```bash
git clone --recursive https://github.com/oldrev/edgelinkd.git
```

Or if you've already cloned without submodules:

```bash
git clone https://github.com/oldrev/edgelinkd.git
cd edgelinkd
git submodule update --init --recursive
```

### 1. Build

**Prerequisites**: Rust 1.80 or later

```bash
cargo build --release
```

**Windows users**: Ensure `patch.exe` is in your PATH (included with Git) and install Visual Studio for MSVC.

**Supported platforms**:

- `x86_64-pc-windows-msvc`
- `x86_64-pc-windows-gnu`
- `x86_64-unknown-linux-gnu`
- `aarch64-unknown-linux-gnu`
- `armv7-unknown-linux-gnueabihf`
- `armv7-unknown-linux-gnueabi`

</details>


### 2. Run

**Start Rust-Red with integrated web UI (recommended):**

```bash
cargo run --release --
# or after build
./target/release/rust-red
```

By default, your browser will open the Node-RED frontend at [http://127.0.0.1:1888](http://127.0.0.1:1888).

**Main command-line options:**

- `[FLOWS_PATH]`: Optional, specify the flow file (default: `~/.rust-red/flows.json`)
- `--headless`: Headless mode (no Web UI, suitable for production)
- `--bind <BIND>`: Custom web server bind address (default: `127.0.0.1:1888`)
- `-u, --user-dir <USER_DIR>`: Specify user directory (default: `~/.rust-red`)
- See more options with `--help`

**Examples:**

```bash
# Run in headless mode
./target/release/rust-red run --headless

# Specify flow file and port
./target/release/rust-red run ./myflows.json --bind 0.0.0.0:8080
```

> All data and configuration are stored in the `~/.rust-red` directory by default.

Use `--help` to see all commands and options:

```bash
./target/release/rust-red --help
./target/release/rust-red run --help
```

#### Run Unit Tests

```bash
cargo test --all
```

#### Run Integration Tests

Running integration tests requires first installing Python 3.9+ and the corresponding Pytest dependencies:

```bash
pip install -r ./tests/requirements.txt
```

Then execute the following command:

```bash
set PYO3_PYTHON=YOUR_PYTHON_EXECUTABLE_PATH # Windows only
cargo build --all
py.test
```

## Configuration

Rust-Red can be configured through command-line arguments and configuration files.

### Web UI Configuration

**Command-line options:**
- `--bind <address>`: Set the web server binding address (default: `127.0.0.1:1888`)
- `--headless`: Run without the web UI for production deployments
- `--user-dir <path>`: Specify custom user directory for flows and settings

**Configuration file:**
You can also configure the web UI through the configuration file (`rust-red.toml`):

```toml
[ui-host]
host = "0.0.0.0"
port = 1888
```

---

## Clustering & High Availability

Rust-Red has built-in clustering. Run multiple instances as a single logical unit — each node runs a subset of your flows, and if a node dies, its flows are automatically reassigned to surviving nodes. No external tools required.

### Why This Matters

| Problem | Without Cluster | With Cluster |
|---------|----------------|--------------|
| Node crashes | All flows stop | Flows migrate to surviving nodes |
| Need more throughput | Vertical scaling only | Add more nodes horizontally |
| Deployment downtime | Stop -> deploy -> start | Zero-downtime rolling deploys |
| Single point of failure | Yes | No — automatic failover |

Node-RED runs as a single process — if it crashes, everything stops. Rust-Red's clustering fixes this: run 10+ Rust-Red instances where 1 Node-RED instance runs today, using roughly the same total memory.

### How It Works

```
 +-----------+     +-----------+     +-----------+
 |  Node A   |<--->|  Node B   |<--->|  Node C   |
 | (Leader)  |     | (Follower)|     | (Follower)|
 |           |     |           |     |           |
 | Flows:    |     | Flows:    |     | Flows:    |
 |  flow-0   |     |  flow-1   |     |  flow-2   |
 |  flow-3   |     |  flow-4   |     |  flow-5   |
 |           |     |           |     |           |
 | Gossip ---+-----+--- Gossip-+-----+--- Gossip |
 | :7980     |     | :7980     |     | :7980     |
 +-----------+     +-----------+     +-----------+
        |               |                 |
        +---------------+-----------------+
                        |
                HTTP API :1888
          (each node serves its own)
```

**Five subsystems:**

1. **Gossip Membership** — Each node sends heartbeats to a random peer every 2 seconds. Heartbeats carry membership data. 10% of heartbeats include a full membership table sync. New nodes are auto-discovered.

2. **Failure Detection** — If a node misses heartbeats beyond the timeout (default 10s), it transitions through `Suspect` -> `Dead`. Dead nodes trigger automatic flow rebalancing.

3. **Flow Partitioning** — The leader (lowest alive node ID) assigns flows round-robin across alive nodes. Each node only starts the flows it owns. If a node dies, its flows are redistributed to survivors.

4. **State Synchronization** — Global context is replicated across nodes with version-based last-writer-wins conflict resolution. Deployment requests are coordinated with acknowledgement tracking.

5. **Session Affinity** — Consistent hashing determines which node owns a session key, ensuring sticky routing.

### Step-by-Step: 3-Node Cluster on Ubuntu VPS

This guide assumes three Ubuntu 22.04/24.04 VPS instances on a private network. Adjust IP addresses to match your setup.

```
Node A: 10.0.0.1  (leader)
Node B: 10.0.0.2
Node C: 10.0.0.3
```

#### Step 1: Install Rust on All Nodes

```bash
# On each node:
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

Or, build once and copy the binary (recommended for production — smaller attack surface):

```bash
# On your build machine:
git clone --recursive https://github.com/oldrev/edgelinkd.git
cd edgelinkd
cargo build --release --features cluster

# The binary is at ./target/release/rust-red
# Copy it to each VPS:
scp target/release/rust-red user@10.0.0.1:/usr/local/bin/
scp target/release/rust-red user@10.0.0.2:/usr/local/bin/
scp target/release/rust-red user@10.0.0.3:/usr/local/bin/
```

> **Important**: Use `--features cluster` to enable clustering. Without it, all cluster code is compiled out with zero overhead.

You also need the static UI files. After building, copy them too:

```bash
scp -r target/ui_static/ user@10.0.0.1:/opt/rust-red/ui_static/
scp -r target/ui_static/ user@10.0.0.2:/opt/rust-red/ui_static/
scp -r target/ui_static/ user@10.0.0.3:/opt/rust-red/ui_static/
```

#### Step 2: Create Config on Each Node

**Node A** (`/etc/rust-red/config.toml`):

```toml
[ui-host]
host = "0.0.0.0"
port = 1888

[cluster]
enabled = true
node_id = "node-a"
bind = "0.0.0.0:7980"
peers = ["10.0.0.2:7980", "10.0.0.3:7980"]
heartbeat_interval_ms = 2000
failure_timeout_ms = 10000
```

**Node B** (`/etc/rust-red/config.toml`):

```toml
[ui-host]
host = "0.0.0.0"
port = 1888

[cluster]
enabled = true
node_id = "node-b"
bind = "0.0.0.0:7980"
peers = ["10.0.0.1:7980", "10.0.0.3:7980"]
heartbeat_interval_ms = 2000
failure_timeout_ms = 10000
```

**Node C** (`/etc/rust-red/config.toml`):

```toml
[ui-host]
host = "0.0.0.0"
port = 1888

[cluster]
enabled = true
node_id = "node-c"
bind = "0.0.0.0:7980"
peers = ["10.0.0.1:7980", "10.0.0.2:7980"]
heartbeat_interval_ms = 2000
failure_timeout_ms = 10000
```

> **Tip**: Each node should list all *other* nodes as peers. It's fine to list yourself too — the engine ignores self-connections.

#### Step 3: Open Firewall Ports

On each node:

```bash
# Web UI / API
sudo ufw allow 1888/tcp

# Gossip protocol
sudo ufw allow 7980/tcp
```

If using multicast discovery, also open the UDP port:

```bash
sudo ufw allow 7980/udp
```

#### Step 4: Start Each Node

```bash
# On each node:
rust-red -c /etc/rust-red/config.toml
```

Or in headless mode (recommended for production):

```bash
rust-red run --headless -c /etc/rust-red/config.toml
```

You should see in the logs:

```
cluster: node node-a started, bind=0.0.0.0:7980
```

#### Step 5: Verify

On any node, check cluster status:

```bash
curl http://10.0.0.1:1888/cluster/status | jq
```

```json
{
  "enabled": true,
  "local_node_id": "node-a",
  "leader_id": "node-a",
  "total_nodes": 3,
  "alive_nodes": 3,
  "members": [
    {
      "node_id": "node-a",
      "addr": "10.0.0.1:7980",
      "state": "self",
      "incarnation": 0,
      "last_heartbeat_ago_ms": 500,
      "joined_at": "2026-05-26T00:30:00Z"
    },
    {
      "node_id": "node-b",
      "addr": "10.0.0.2:7980",
      "state": "alive",
      "incarnation": 0,
      "last_heartbeat_ago_ms": 800,
      "joined_at": "2026-05-26T00:30:02Z"
    },
    {
      "node_id": "node-c",
      "addr": "10.0.0.3:7980",
      "state": "alive",
      "incarnation": 0,
      "last_heartbeat_ago_ms": 1200,
      "joined_at": "2026-05-26T00:30:03Z"
    }
  ]
}
```

Check flow distribution:

```bash
curl http://10.0.0.1:1888/cluster/flows | jq
```

Open the web UI on any node: `http://10.0.0.1:1888` — design and deploy flows as usual. The cluster distributes them automatically.

### Configuration Reference

All cluster settings go under `[cluster]` in `rust-red.toml`:

| Setting | Default | Description |
|---------|---------|-------------|
| `enabled` | `false` | Enable or disable clustering |
| `node_id` | auto UUID | Unique identifier for this node (auto-generated if empty) |
| `bind` | `"0.0.0.0:7980"` | Address to bind the gossip listener |
| `peers` | `[]` | List of peer addresses for initial discovery |
| `heartbeat_interval_ms` | `2000` | How often heartbeats are sent (ms) |
| `failure_timeout_ms` | `10000` | Time before a node is declared dead (ms) |
| `discovery_mode` | `"static"` | Peer discovery: `static`, `multicast`, or `dns` |
| `multicast_addr` | `"239.255.0.1:7980"` | Multicast group address (multicast mode only) |
| `dns_service` | `""` | DNS service name to resolve (dns mode only) |
| `cluster_port` | `7980` | Port for multicast/DNS-discovered peers |

**Constraints:**
- `failure_timeout_ms` must be greater than `heartbeat_interval_ms`
- All peer addresses must be valid `host:port` socket addresses
- `heartbeat_interval_ms` must be > 0

### Discovery Modes

| Mode | How It Works | When to Use |
|------|-------------|-------------|
| `static` | Explicit `peers` list in config | Fixed servers, Docker Compose, manual setups |
| `multicast` | UDP multicast announcements on LAN | Auto-discovery on local networks, dev/testing |
| `dns` | DNS service resolution | Kubernetes headless services, Consul, SkyDNS |

### API Endpoints

When clustering is enabled, these endpoints are available on every node:

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/cluster/status` | Cluster health, members, leader, alive count |
| `GET` | `/cluster/nodes` | List all cluster nodes with details |
| `POST` | `/cluster/deploy` | Deploy flows cluster-wide (JSON body: `{flows, revision}`) |
| `GET` | `/cluster/flows` | View flow-to-node assignment table |

**Deploy example:**

```bash
curl -X POST http://10.0.0.1:1888/cluster/deploy \
  -H "Content-Type: application/json" \
  -d '{"flows": <your flows json>, "revision": "v1.2.3"}'
```

### What Happens When a Node Dies

```
Before failure:
  Node A: flow-0, flow-3   (leader)
  Node B: flow-1, flow-4
  Node C: flow-2, flow-5

Node C dies (heartbeat timeout exceeded):
  -> Node C marked Suspect, then Dead
  -> Leader rebalances: flow-2 and flow-5 reassigned
  -> Node A picks up flow-2
  -> Node B picks up flow-5

After failover:
  Node A: flow-0, flow-2, flow-3
  Node B: flow-1, flow-4, flow-5
  Node C: (dead)
```

Node C comes back online:
- It sends heartbeats, gets discovered
- Leader recomputes assignments
- Flows get redistributed evenly again across all 3 nodes

### Horizontal Scaling

You don't need Kubernetes. Rust-Red clustering works with plain VPS instances. But Kubernetes makes it easier.

#### Option A: Adding Nodes Manually (No Kubernetes)

To scale from 3 to 5 nodes:

1. **Prepare the new node** (same steps as above):

```bash
# On Node D (10.0.0.4) and Node E (10.0.0.5):
scp rust-red user@10.0.0.4:/usr/local/bin/
scp -r ui_static/ user@10.0.0.4:/opt/rust-red/
```

2. **Create config** for each new node listing all existing peers:

```toml
# /etc/rust-red/config.toml on Node D
[cluster]
enabled = true
node_id = "node-d"
bind = "0.0.0.0:7980"
peers = ["10.0.0.1:7980", "10.0.0.2:7980", "10.0.0.3:7980"]
```

3. **Update existing nodes** to include the new peers in their config:

```toml
# Add to each existing node's config:
peers = ["10.0.0.1:7980", "10.0.0.2:7980", "10.0.0.3:7980", "10.0.0.4:7980", "10.0.0.5:7980"]
```

4. **Start the new nodes**. They contact existing peers via the `peers` list, get discovered through gossip, and the leader automatically distributes flows to include them.

5. **Rolling restart existing nodes** (optional — gossip will propagate the new member table even without updating peer lists, but updating them makes re-discovery after full cluster restart faster).

> **You don't have to restart existing nodes to add new ones.** Gossip auto-discovery handles it. Updating the `peers` list is only needed for robustness against total cluster restart.

#### Option B: Using Docker Compose

```yaml
# docker-compose.yml
version: "3.8"
services:
  node-a:
    image: rustred/rust-red:latest
    ports:
      - "1888:1888"
      - "7980:7980"
    volumes:
      - ./configs/node-a.toml:/etc/rust-red/config.toml
      - ./data:/root/.rust-red
    command: ["-c", "/etc/rust-red/config.toml"]

  node-b:
    image: rustred/rust-red:latest
    ports:
      - "1888:1888"
      - "7980:7980"
    volumes:
      - ./configs/node-b.toml:/etc/rust-red/config.toml
      - ./data:/root/.rust-red
    command: ["-c", "/etc/rust-red/config.toml"]

  node-c:
    image: rustred/rust-red:latest
    ports:
      - "1888:1888"
      - "7980:7980"
    volumes:
      - ./configs/node-c.toml:/etc/rust-red/config.toml
      - ./data:/root/.rust-red
    command: ["-c", "/etc/rust-red/config.toml"]
```

Scale up:

```bash
docker compose up -d --scale node-c=3  # adds 2 more instances
```

#### Option C: Using Kubernetes

Kubernetes gives you automated scaling, self-healing, and service discovery. You don't need it for clustering itself (Rust-Red handles its own membership), but K8s makes the ops easier.

**Deployment (single manifest):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: rust-red
spec:
  replicas: 3
  selector:
    matchLabels:
      app: rust-red
  template:
    metadata:
      labels:
        app: rust-red
    spec:
      containers:
        - name: rust-red
          image: rustred/rust-red:latest
          ports:
            - containerPort: 1888  # Web UI
            - containerPort: 7980  # Gossip
          env:
            - name: NODE_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
          command: ["rust-red"]
          args: ["-c", "/etc/rust-red/config.toml"]
          volumeMounts:
            - name: config
              mountPath: /etc/rust-red
      volumes:
        - name: config
          configMap:
            name: rust-red-config
---
api-version: v1
kind: ConfigMap
metadata:
  name: rust-red-config
data:
  config.toml: |
    [ui-host]
    host = "0.0.0.0"
    port = 1888
    [cluster]
    enabled = true
    node_id = "$(NODE_ID)"
    bind = "0.0.0.0:7980"
    discovery_mode = "dns"
    dns_service = "rust-red-headless.default.svc.cluster.local"
    cluster_port = 7980
    heartbeat_interval_ms = 2000
    failure_timeout_ms = 10000
---
apiVersion: v1
kind: Service
metadata:
  name: rust-red-headless
spec:
  clusterIP: None  # Headless service for DNS discovery
  selector:
    app: rust-red
  ports:
    - name: http
      port: 1888
    - name: gossip
      port: 7980
---
apiVersion: v1
kind: Service
metadata:
  name: rust-red
spec:
  selector:
    app: rust-red
  ports:
    - name: http
      port: 1888
```

**Scale up:**

```bash
kubectl scale deployment rust-red --replicas=5
```

K8s starts new pods -> they resolve `rust-red-headless` via DNS -> gossip discovery -> leader distributes flows -> done.

**Scale down:**

```bash
kubectl scale deployment rust-red --replicas=2
```

Terminated pods stop sending heartbeats -> failure timeout triggers -> leader rebalances flows to surviving pods.

#### Scaling Comparison

| Approach | Best For | Scaling | Complexity |
|----------|----------|---------|------------|
| Manual VPS | 2-5 nodes, simple setups | Edit config, restart | Low |
| Docker Compose | Single-host or small cluster | `docker compose up --scale` | Low |
| Kubernetes | Large deployments, auto-healing | `kubectl scale` | High |

### Running as a systemd Service

For production VPS deployments, run Rust-Red as a systemd service:

```ini
# /etc/systemd/system/rust-red.service
[Unit]
Description=Rust-Red Flow Engine
After=network.target

[Service]
Type=simple
User=rustred
Group=rustred
WorkingDirectory=/opt/rust-red
ExecStart=/usr/local/bin/rust-red run --headless -c /etc/rust-red/config.toml
Restart=on-failure
RestartSec=5

# Graceful shutdown
TimeoutStopSec=15
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -r -s /bin/false rustred
sudo chown -R rustred:rustred /opt/rust-red /etc/rust-red
sudo systemctl daemon-reload
sudo systemctl enable rust-red
sudo systemctl start rust-red
sudo journalctl -u rust-red -f  # watch logs
```

### Shared Flows Storage (Production)

For multi-node clusters, all nodes need access to the same `flows.json`. Options:

| Method | Setup | Best For |
|--------|-------|----------|
| Shared NFS mount | Mount NFS on all nodes | Simple setups |
| S3-compatible | Configure flows path to S3 | Cloud deployments |
| PostgreSQL | Use `nodes_postgres` feature | Enterprise |
| API deploy | Deploy via `/cluster/deploy` endpoint | Any setup |

The simplest approach: design flows on Node A (web UI), then use the cluster deploy API to push to all nodes.

### Feature Flag Details

The `cluster` feature is fully optional. Build without it for single-node deployments:

```bash
# Single-node (no clustering code compiled in):
cargo build --release

# With clustering:
cargo build --release --features cluster

# Everything including cluster:
cargo build --release --features full
```

The feature propagates across three crates:

```
cluster (root Cargo.toml)
  +-- dep:rust-red-cluster       # Pull in the cluster crate
  +-- rust-red-core/cluster      # Enable ClusterFlowPartitioner trait + Engine filtering
  +-- rust-red-web/cluster       # Enable /cluster/* API routes
```

Without the flag, there is zero runtime overhead and zero binary size increase from clustering code.

### Cluster Tests

```bash
cargo test --features cluster --test cluster_integration
```

10 tests covering: config validation, flow assignment, round-robin distribution, rebalancing after failure, bridge trait implementation, member state transitions.

---

## Project Status

**Alpha Stage**: The project is currently in the *alpha* stage and cannot guarantee stable operation.

**New: Integrated Web UI**: Rust-Red now includes a complete Node-RED web interface for flow design and management. The web UI is fully compatible with Node-RED's editor and provides the same user experience while running on the high-performance Rust runtime.

**Web UI Features**:
- Complete Node-RED editor interface
- Flow design and editing
- Node palette with all supported nodes
- Deploy flows directly from the browser
- Real-time flow execution monitoring
- Debug panel integration
- Settings and configuration management
- Import/Export flows functionality

The heavy check mark ( :heavy_check_mark: ) below indicates that this feature has passed the integration test ported from Node-RED.

### Node-RED Features Roadmap:

- [x] :heavy_check_mark: Flow
- [x] :heavy_check_mark: Sub-flow
- [x] Group
- [x] :heavy_check_mark: Environment Variables
- [ ] Context
    - [x] Memory storage
    - [ ] Local file-system storage
- [ ] RED.util (WIP)
    - [x] `RED.util.cloneMessage()`
    - [x] `RED.util.generateId()`
- [x] Plug-in subsystem[^1]
- [ ] JSONata

[^1]: Rust's Tokio async functions cannot call into dynamic libraries, so currently, we can only use statically linked plugins. I will evaluate the possibility of adding plugins based on WebAssembly (WASM) or JavaScript (JS) in the future.

### The Current Status of Nodes:

Refer [REDNODES-SPECS-DIFF.md](tests/REDNODES-SPECS-DIFF.md) to view the details of the currently implemented nodes that comply with the Node-RED specification tests.

- Core nodes:
    - Common nodes:
        - [x] :heavy_check_mark: Console-JSON (For integration tests)
        - [x] :heavy_check_mark: Inject
        - [x] Debug (WIP)
        - [x] :heavy_check_mark: Complete
        - [x] :heavy_check_mark: Catch
        - [x] :heavy_check_mark: Status
        - [x] :heavy_check_mark: Link In
        - [x] :heavy_check_mark: Link Call
        - [x] :heavy_check_mark: Link Out
        - [x] :heavy_check_mark: Comment (Ignored automatically)
        - [x] GlobalConfig (WIP)
        - [x] :heavy_check_mark: Unknown
        - [x] :heavy_check_mark: Junction
    - Function nodes:
        - [x] Function (WIP)
            - [x] Basic functions
            - [x] `node` object (WIP)
            - [x] `context` object
            - [x] `flow` object
            - [x] `global` object
            - [x] `RED.util` object
            - [x] `env` object
        - [x] :heavy_check_mark: Switch
        - [x] :heavy_check_mark: Change
        - [x] :heavy_check_mark: Range
        - [x] :heavy_check_mark: Template
        - [x] Delay
        - [x] Trigger
        - [x] Exec
        - [x] :heavy_check_mark: Filter (RBE)
    - Network nodes:
        - [x] MQTT In
        - [x] MQTT Out
        - [ ] MQTT Broker
        - [x] HTTP In
        - [x] HTTP Out
        - [x] HTTP Request
        - [x] WebSocket Listener
        - [x] WebSocket Client
        - [x] WebSocket In
        - [x] WebSocket Out
        - [x] TCP In
        - [x] TCP Out
        - [x] TCP Get
        - [x] UDP In
        - [x] :heavy_check_mark: UDP Out
            - [x] Unicast
            - [x] Multicast
        - [x] TLS (WIP)
        - [x] HTTP Proxy (WIP)
    - Sqeuence nodes:
        - [x] Split
        - [x] Join
        - [x] Sort
        - [x] Batch
    - Parse nodes:
        - [x] CSV
        - [ ] HTML
        - [x] :heavy_check_mark: JSON
        - [x] :heavy_check_mark: XML
        - [x] YAML
    - Storage
        - [x] File
        - [x] File In
        - [x] Watch

## Roadmap

Check out our [milestones](https://github.com/oldrev/edgelinkd/milestones) to get a glimpse of the upcoming features and milestones.

## Contribution

![Alt](https://repobeats.axiom.co/api/embed/cd18a784e88be20d79778703bda8858523c4257e.svg "Repobeats analytics image")

We welcome contributions! Whether it's:

- **Bug reports** and feature requests
- **Documentation** improvements
- **Code contributions** and new node implementations
- **Testing** on different platforms

> Note: Please make meaningful contributions, or watch and learn. Simply modifying the README or making non-substantive changes will be considered malicious behavior.

Please read [CONTRIBUTING.md](.github/CONTRIBUTING.md) for details.

### Support the Project

If Rust-Red saves you memory and improves your edge deployments, consider supporting development:

<a href='https://ko-fi.com/O5O2U4W4E' target='_blank'><img height='36' style='border:0px;height:36px;' src='https://storage.ko-fi.com/cdn/kofi3.png?v=3' border='0' alt='Buy Me a Coffee at ko-fi.com' /></a>

[![Support via PayPal.me](assets/paypal_button.svg)](https://www.paypal.me/oldrev)

## Known Issues

Please refer to [ISSUES.md](docs/ISSUES.md) for a list of known issues and workarounds.

## Feedback and Support

We welcome your feedback! If you encounter any issues or have suggestions, please open an [issue](https://github.com/oldrev/edgelinkd/issues).

* Contact me: E-mail: oldrev(at)gmail.com
* Discord: [https://discord.gg/XJstgANe26](https://discord.gg/XJstgANe26)

## License

This project is licensed under the Apache 2.0 License - see the [LICENSE](LICENSE) file for more details.

Copyright © Li Wei and other contributors. All rights reserved.
