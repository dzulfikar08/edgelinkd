#!/usr/bin/env bash
# compare.sh — Compare Node-RED and Rust-Red performance
#
# Prerequisites:
#   - Node-RED installed: npm install -g node-red
#   - Rust-Red built: cargo build --release
#   - jq installed: brew install jq (or apt install jq)
#
# Usage:
#   ./benchmarks/compare.sh
#   ./benchmarks/compare.sh --node-red-only
#   ./benchmarks/compare.sh --rust-red-only

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RESULTS_DIR="$SCRIPT_DIR/results"
mkdir -p "$RESULTS_DIR"

BENCH_MSG_COUNT=1000
BENCH_TIMEOUT=30
NODE_RED_PORT=18801
RUST_RED_PORT=18802

# Colors (if terminal supports it)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    NC='\033[0m' # No Color
else
    RED='' GREEN='' YELLOW='' BLUE='' NC=''
fi

run_node_red_bench() {
    echo -e "${BLUE}[Node-RED]${NC} Running benchmarks..."

    local results_file="$RESULTS_DIR/node-red-results.json"

    # Create a simple Node-RED flow
    local flow='[
        {"id":"tab1","label":"Bench","type":"tab"},
        {"id":"inject1","name":"bench-inject","type":"inject","z":"tab1",
         "once":false,"onceDelay":0,"payload":"benchmark","payloadType":"str",
         "repeat":"","crontab":"","topic":"bench",
         "props":[{"p":"payload"},{"p":"topic","vt":"str"}],
         "wires":[["debug1"]]},
        {"id":"debug1","name":"bench-debug","type":"debug","z":"tab1",
         "active":true,"console":true,"tosidebar":false,"tostatus":false,
         "complete":"payload","targetType":"msg","statusType":"auto","statusVal":"",
         "wires":[]}
    ]'

    # Start Node-RED
    echo -e "${YELLOW}[Node-RED]${NC} Starting..."
    local start_time=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')

    # Write flow file
    echo "$flow" > /tmp/bench-nodered-flow.json

    node-red -p "$NODE_RED_PORT" -u /tmp/bench-nodered -- -v &
    local nr_pid=$!

    # Wait for Node-RED to be ready
    echo -e "${YELLOW}[Node-RED]${NC} Waiting for server to be ready..."
    for i in $(seq 1 30); do
        if curl -s "http://localhost:$NODE_RED_PORT/" > /dev/null 2>&1; then
            break
        fi
        sleep 1
    done

    local end_time=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
    local startup_ms=$((end_time - start_time))

    # Measure RSS
    local rss_kb=$(ps -o rss= -p "$nr_pid" 2>/dev/null | tr -d ' ' || echo "0")
    local rss_mb=$(echo "scale=2; $rss_kb / 1024" | bc 2>/dev/null || echo "0")

    echo -e "${GREEN}[Node-RED]${NC} Startup: ${startup_ms}ms, RSS: ${rss_mb}MB"

    # Inject messages and measure throughput
    echo -e "${YELLOW}[Node-RED]${NC} Measuring throughput (${BENCH_MSG_COUNT} messages)..."
    local tp_start=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')

    for i in $(seq 1 "$BENCH_MSG_COUNT"); do
        curl -s -X POST "http://localhost:$NODE_RED_PORT/inject/inject1" > /dev/null 2>&1
    done

    # Give messages time to flow through
    sleep 2

    local tp_end=$(date +%s%3N 2>/dev/null || python3 -c 'import time; print(int(time.time()*1000))')
    local tp_ms=$((tp_end - tp_start))
    local msgs_per_sec=$(echo "scale=0; $BENCH_MSG_COUNT * 1000 / $tp_ms" | bc 2>/dev/null || echo "0")

    echo -e "${GREEN}[Node-RED]${NC} Throughput: ${msgs_per_sec} msgs/sec (${tp_ms}ms total)"

    # Stop Node-RED
    kill "$nr_pid" 2>/dev/null || true
    wait "$nr_pid" 2>/dev/null || true

    # Write results
    cat > "$results_file" << EOF
{
    "engine": "node-red",
    "startup_ms": $startup_ms,
    "rss_mb": $rss_mb,
    "throughput_msgs_per_sec": $msgs_per_sec,
    "messages": $BENCH_MSG_COUNT,
    "total_time_ms": $tp_ms
}
EOF
    echo -e "${GREEN}[Node-RED]${NC} Results saved to $results_file"
}

run_rust_red_bench() {
    echo -e "${BLUE}[Rust-Red]${NC} Running benchmarks..."

    local results_file="$RESULTS_DIR/rust-red-results.json"

    # Run the Rust benchmarks
    echo -e "${YELLOW}[Rust-Red]${NC} Building benchmarks..."
    cargo build --release --bench throughput --bench startup --bench memory 2>/dev/null || \
    cargo build --release --bench throughput --bench startup --bench memory

    # Startup benchmark
    echo -e "${YELLOW}[Rust-Red]${NC} Running startup benchmark..."
    local startup_output
    startup_output=$(cargo run --release --bench startup 2>/dev/null | tail -20)

    # Throughput benchmark
    echo -e "${YELLOW}[Rust-Red]${NC} Running throughput benchmark..."
    local throughput_output
    throughput_output=$(cargo run --release --bench throughput 2>/dev/null | tail -20)

    # Memory benchmark
    echo -e "${YELLOW}[Rust-Red]${NC} Running memory benchmark..."
    local memory_output
    memory_output=$(cargo run --release --bench memory 2>/dev/null | tail -20)

    # Parse JSON from benchmark outputs
    local startup_json=$(echo "$startup_output" | sed -n '/--- JSON Results ---/,${p}' | tail -n +2 | head -20)
    local throughput_json=$(echo "$throughput_output" | sed -n '/--- JSON Results ---/,${p}' | tail -n +2 | head -20)
    local memory_json=$(echo "$memory_output" | sed -n '/--- JSON Results ---/,${p}' | tail -n +2 | head -20)

    cat > "$results_file" << EOF
{
    "engine": "rust-red",
    "startup": $startup_json,
    "throughput": $throughput_json,
    "memory": $memory_json
}
EOF
    echo -e "${GREEN}[Rust-Red]${NC} Results saved to $results_file"
}

print_comparison() {
    echo ""
    echo "========================================"
    echo "  Performance Comparison"
    echo "========================================"
    echo ""

    local nr_file="$RESULTS_DIR/node-red-results.json"
    local rr_file="$RESULTS_DIR/rust-red-results.json"

    if [ -f "$nr_file" ] && [ -f "$rr_file" ]; then
        # Use Python to format a nice comparison table
        python3 -c "
import json, sys

try:
    with open('$nr_file') as f: nr = json.load(f)
    with open('$rr_file') as f: rr = json.load(f)

    print('{:<25} {:>15} {:>15} {:>10}'.format('Metric', 'Node-RED', 'Rust-Red', 'Speedup'))
    print('-' * 67)

    # Startup
    nr_startup = nr.get('startup_ms', 0)
    rr_startup = rr.get('startup', [{}])
    if isinstance(rr_startup, list) and rr_startup:
        rr_startup = min(s.get('total_us', 0) for s in rr_startup) / 1000
    else:
        rr_startup = 0
    if nr_startup > 0 and rr_startup > 0:
        ratio = nr_startup / rr_startup
        print('{:<25} {:>12.1f} ms {:>12.1f} ms {:>9.1f}x'.format('Startup Time', nr_startup, rr_startup, ratio))

    # RSS
    nr_rss = nr.get('rss_mb', 0)
    rr_rss = rr.get('memory', [{}])
    if isinstance(rr_rss, list) and rr_rss:
        rr_rss = max(m.get('rss_human', '0').replace(' MB', '').replace(' KB', '') for m in rr_rss)
        try: rr_rss = float(rr_rss)
        except: rr_rss = 0
    else:
        rr_rss = 0
    if nr_rss > 0 and rr_rss > 0:
        ratio = nr_rss / rr_rss
        print('{:<25} {:>12.1f} MB {:>12.1f} MB {:>9.1f}x'.format('RSS Memory', nr_rss, rr_rss, ratio))

    # Throughput
    nr_tp = nr.get('throughput_msgs_per_sec', 0)
    rr_tp = rr.get('throughput', [{}])
    if isinstance(rr_tp, list) and rr_tp:
        rr_tp = max(t.get('throughput_per_sec', 0) for t in rr_tp)
    else:
        rr_tp = 0
    if nr_tp > 0 and rr_tp > 0:
        ratio = rr_tp / nr_tp
        print('{:<25} {:>12.0f}/s {:>12.0f}/s {:>9.1f}x'.format('Throughput (passthrough)', nr_tp, rr_tp, ratio))

except Exception as e:
    print(f'Error generating comparison: {e}')
    print('Raw results available in $RESULTS_DIR/')
" 2>/dev/null || echo "Install Python 3 for comparison table"
    else
        echo "Results not available. Run with both engines to get a comparison."
        if [ -f "$nr_file" ]; then
            echo ""
            echo "Node-RED results:"
            cat "$nr_file"
        fi
        if [ -f "$rr_file" ]; then
            echo ""
            echo "Rust-Red results:"
            cat "$rr_file"
        fi
    fi

    echo ""
    echo "Full results available in: $RESULTS_DIR/"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

echo "========================================"
echo "  Node-RED vs Rust-Red Benchmark"
echo "========================================"
echo ""

MODE="${1:-all}"

case "$MODE" in
    --node-red-only)
        run_node_red_bench
        ;;
    --rust-red-only)
        run_rust_red_bench
        ;;
    *)
        run_node_red_bench
        echo ""
        run_rust_red_bench
        ;;
esac

print_comparison
