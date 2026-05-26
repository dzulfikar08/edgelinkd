# Rust-Red Benchmark Suite

This directory contains performance benchmarks for Rust-Red and comparison tools for Node-RED.

## Quick Start

```bash
# Run all benchmarks
cargo bench

# Run individual benchmarks
cargo bench --bench throughput
cargo bench --bench startup
cargo bench --bench memory
cargo bench --bench wasm_overhead

# Compare with Node-RED
./benchmarks/compare.sh
```

## Benchmarks

### throughput

Measures message throughput (messages/second) through various flow topologies:

| Test | Description |
|------|-------------|
| `passthrough` | inject -> debug (baseline, 0 intermediate nodes) |
| `chain-10` | inject -> 10 dummy nodes -> debug |
| `chain-100` | inject -> 100 dummy nodes -> debug |
| `fan-out-10` | inject -> 10 parallel debug nodes |

Reports: msgs/sec, mean/p50/p99 latency in microseconds.

### startup

Measures time to:
1. Build the node registry
2. Parse and load flow JSON
3. Start all node tasks

Tested with 0, 10, and 100 node flows.

### memory

Measures RSS (Resident Set Size) for:
- Baseline (registry only)
- Flows with 0, 10, and 100 nodes

### wasm_overhead

Measures WASM boundary overhead:
- postcard serialization/deserialization timing
- Payload sizes from 0 to 4096 bytes
- WASM plugin load time (if plugin is compiled)

## Sample Flow Files

The `flows/` directory contains pre-built Node-RED compatible flow JSON files:

| File | Description |
|------|-------------|
| `simple-passthrough.json` | inject -> debug |
| `chain-10.json` | inject -> 10 nodes -> debug |
| `chain-100.json` | inject -> 100 nodes -> debug |
| `fan-out.json` | inject -> 10 parallel paths |
| `wasm-echo.json` | inject -> WASM echo -> debug |

## Output Format

Each benchmark outputs:
1. Human-readable table to stdout
2. Machine-readable JSON (after `--- JSON Results ---` marker)

## Node-RED Comparison

```bash
# Full comparison (requires Node-RED installed)
./benchmarks/compare.sh

# Run only one engine
./benchmarks/compare.sh --node-red-only
./benchmarks/compare.sh --rust-red-only
```

Results are saved to `benchmarks/results/`.

## Adding New Benchmarks

1. Create a new file `benchmarks/your_bench.rs`
2. Add it to `Cargo.toml`:
   ```toml
   [[bench]]
   name = "your_bench"
   path = "benchmarks/your_bench.rs"
   harness = false
   ```
3. Import the common module:
   ```rust
   mod bench_common;
   use bench_common::{init_test_logger, Stats};
   ```
4. Implement a `fn main()` with your benchmark logic
5. Output results in both table and JSON format
