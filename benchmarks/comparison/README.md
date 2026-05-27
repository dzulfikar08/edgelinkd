# Rust-RED vs Node-RED Performance Comparison

This directory contains the infrastructure for benchmarking Rust-RED against Node-RED across multiple real-world scenarios.

## Prerequisites

### Required

- **Rust toolchain** (stable): for building and running Rust-RED benchmarks
- **curl**: for HTTP-based message injection and load testing

### Optional (enables additional benchmarks)

| Tool | Install | Purpose |
|------|---------|---------|
| Node-RED | `npm install -g node-red` | Node-RED comparison target |
| jq | `brew install jq` or `apt install jq` | JSON result processing |
| python3 | system package | Fallback JSON parsing, comparison table generation |
| bc | system package | Arithmetic in shell scripts |
| autocannon | `npm install -g autocannon` | HTTP load generation (scenario 5) |
| wrk | `brew install wrk` or build from source | HTTP load generation (alternative to autocannon) |
| mosquitto | `brew install mosquitto` or `apt install mosquitto` | MQTT broker (scenario 4) |

### Hardware Requirements

For reproducible results:

- **Idle system**: Close other CPU-intensive applications
- **Minimum**: 2 CPU cores, 2 GB RAM
- **Recommended**: 4+ CPU cores, 4+ GB RAM
- **Disk**: ~500 MB for builds
- Run 3+ times and average results for consistency

## Quick Start

```bash
# Full comparison (both engines, all scenarios)
./benchmarks/comparison/run-benchmarks.sh

# Rust-RED only (Node-RED not installed)
./benchmarks/comparison/run-benchmarks.sh --rust-only

# Quick run (fewer iterations, faster feedback)
./benchmarks/comparison/run-benchmarks.sh --quick --skip-mqtt

# Single scenario
./benchmarks/comparison/run-benchmarks.sh --scenario 1 --skip-mqtt --skip-http
```

## Benchmark Scenarios

### Scenario 1: Throughput (`scenario-1-throughput.json`)

**Flow**: inject -> function (pass-through) -> debug

**What it measures**: Maximum single-message processing rate. The function node simply returns the message unchanged, measuring raw node-to-node message passing overhead.

**Key metric**: messages/second

**Interpretation**: This is the baseline throughput. Both engines should handle this well, but Rust-RED's zero-copy message passing should show an advantage at high volumes.

---

### Scenario 2: Fan-Out (`scenario-2-fanout.json`)

**Flow**: inject -> 10 parallel debug nodes

**What it measures**: Message fan-out performance. A single message is cloned to 10 destinations simultaneously. Tests the efficiency of message cloning and multi-output wire handling.

**Key metric**: messages/second (counting total output messages = injected * 10)

**Interpretation**: Fan-out is common in real flows (e.g., logging + processing + alerting). Rust-RED's approach to message cloning (Arc-based or copy-on-write) affects performance here.

---

### Scenario 3: Switch/Routing (`scenario-3-switch.json`)

**Flow**: inject -> switch (5 rules) -> 5 debug nodes

**What it measures**: Conditional routing performance. The switch node evaluates message payload against 5 string equality rules. Tests the overhead of message property inspection and branching.

**Key metric**: messages/second

**Interpretation**: Switch nodes are one of the most commonly used nodes. Performance here directly impacts real-world flow throughput.

---

### Scenario 4: MQTT (`scenario-4-mqtt.json`)

**Flow**: mqtt-in -> mqtt-out loop (requires MQTT broker)

**What it measures**: End-to-end MQTT message processing, including broker round-trip. An inject node seeds the loop by publishing to a topic; the mqtt-in node receives and forwards to mqtt-out, which publishes again.

**Key metric**: messages/second (full round-trip)

**Prerequisites**: Mosquitto or another MQTT broker running on `localhost:1883`.

**Interpretation**: This scenario is broker-bound. The difference between engines reflects their MQTT client overhead and message processing efficiency.

---

### Scenario 5: HTTP (`scenario-5-http.json`)

**Flow**: http-in -> function (set response) -> http-out

**What it measures**: HTTP request/response throughput under load. Uses `autocannon` (preferred), `wrk`, or sequential `curl` as the load generator.

**Key metric**: requests/second

**Prerequisites**: `autocannon` or `wrk` for meaningful results. Sequential `curl` gives a lower bound.

**Interpretation**: This tests the HTTP server implementation. Rust-RED's tokio-based HTTP stack should significantly outperform Node.js's single-threaded HTTP handling under concurrent load.

---

### Scenario 6: Delay Accuracy (`scenario-6-delay.json`)

**Flow**: inject -> delay (100ms) -> function (timestamp) -> debug

**What it measures**: Timing accuracy of the delay node. Each message should be held for exactly 100ms. The test measures the actual delay distribution.

**Key metric**: Delay accuracy (mean, p50, p99 deviation from 100ms target)

**Interpretation**: Tests the timer/scheduler implementation. Rust-RED's tokio timer should provide more consistent delays, especially under load. Node.js's event loop can introduce jitter.

## How Results Are Collected

### Startup Time

Measured as wall-clock time from process spawn to the first successful HTTP response from the engine's admin API.

```bash
start_ms=$(date +%s%3N)
node-red -p 18801 ... &
# ... wait for curl to succeed ...
end_ms=$(date +%s%3N)
startup_ms = end_ms - start_ms
```

### Memory (RSS)

Measured using `ps -o rss` after the engine has started and processed a few messages.

```bash
rss_kb=$(ps -o rss= -p $PID | tr -d ' ')
```

This captures the Resident Set Size, which is the portion of memory held in RAM.

### Throughput

Measured by injecting messages via HTTP POST to the engine's inject endpoint and timing how long it takes for all messages to be processed.

```bash
for i in $(seq 1 $MSG_COUNT); do
    curl -X POST "http://localhost:$PORT/inject/$NODE_ID"
done
# msgs_per_sec = MSG_COUNT * 1000 / total_ms
```

Note: This measures the inject API round-trip, not pure engine throughput. The internal `cargo bench` benchmarks measure pure engine throughput without HTTP overhead.

### Binary Size

Measured using `stat` on the compiled binary.

```bash
size_bytes=$(stat -f%z target/release/rust-red)
```

Node-RED has no single binary; its footprint is the sum of `node` + `node-red` npm package.

## Output Format

All results are written to `benchmarks/comparison/results/` as JSON files:

```
results/
  node-red-throughput.json       # Node-RED scenario results
  node-red-fanout.json
  rust-red-throughput.json       # Rust-RED scenario results
  rust-red-fanout.json
  rust-red-internal-throughput.json  # Cargo bench native results
  rust-red-internal-startup.json
  rust-red-internal-memory.json
  comparison-report.json         # Combined report
```

Each result file follows this structure:

```json
{
  "engine": "rust-red",
  "scenario": "throughput",
  "timestamp": "2026-05-27T12:00:00Z",
  "startup_ms": 150,
  "memory": {
    "rss_kb": 25600,
    "rss_mb": 25.0
  },
  "throughput": {
    "messages": 500,
    "total_ms": 1200,
    "msgs_per_sec": 416
  },
  "binary_size": {
    "bytes": 8388608,
    "mb": 8.0
  }
}
```

## Interpreting Results

### Speedup Ratio

The comparison table computes speedup ratios:

- **Startup**: `Node-RED_ms / Rust-RED_ms` (higher = Rust-RED faster)
- **Memory**: `Node-RED_MB / Rust-RED_MB` (higher = Rust-RED uses less)
- **Throughput**: `Rust-RED_msgs_per_sec / Node-RED_msgs_per_sec` (higher = Rust-RED faster)

A ratio of 1.0 means parity. Ratios above 2.0 indicate a significant advantage.

### Known Biases

1. **Inject API overhead**: The inject endpoint adds HTTP round-trip latency to each message. This biases results toward engines with faster HTTP handling.
2. **Node-RED debug output**: Node-RED's debug node writes to the sidebar over WebSocket, which may slow throughput measurement.
3. **Warm vs cold start**: The first run may be slower due to disk cache. Use `--quick` for a warm-up run, then run the full benchmark.
4. **OS differences**: macOS and Linux have different memory reporting and process scheduling. Compare results only within the same OS.

### Validating Results

Run the benchmark 3 times and check for consistency:

```bash
for i in 1 2 3; do
    ./benchmarks/comparison/run-benchmarks.sh --rust-only --skip-mqtt --skip-http
    mv results/comparison-report.json results/run-$i.json
done
```

Compare with the internal cargo bench results, which measure pure engine throughput without HTTP overhead:

```bash
cargo bench --bench throughput
```

## Adding New Scenarios

1. Create `scenarios/scenario-N-name.json` with the flow definition.
2. The JSON must have:
   - `scenario`: scenario name
   - `description`: what it tests
   - `iterations`: message count for the throughput test
   - `timeout_seconds`: max time to wait
   - `flow`: Node-RED-compatible flow JSON array
3. Add the scenario to the `SCENARIOS` array in `run-benchmarks.sh`.
4. Run `./run-benchmarks.sh --scenario N` to test it.

## Troubleshooting

### Node-RED won't start

```bash
# Check if Node-RED is installed
which node-red
node-red --version

# Check if port is available
lsof -i :18801
kill $(lsof -t -i :18801)  # Kill existing process

# Start manually to see errors
node-red -p 18801 -v
```

### Rust-RED won't start as a server

The Rust-RED standalone binary may not support `--flow` flag yet. In this case, the script falls back to running `cargo bench` and collecting native benchmark results.

```bash
# Check if the binary exists
ls -la target/release/rust-red

# Try running it manually
./target/release/rust-red --help
```

### Port conflicts

```bash
# Change ports via environment variables
NODE_RED_PORT=28801 RUST_RED_PORT=28802 ./run-benchmarks.sh
```

### Out of memory during build

```bash
# Limit parallel compilation
CARGO_BUILD_JOBS=2 cargo build --release
```
