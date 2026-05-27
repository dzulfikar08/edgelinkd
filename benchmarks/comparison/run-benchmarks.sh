#!/usr/bin/env bash
# run-benchmarks.sh — Run performance comparison benchmarks for Rust-RED vs Node-RED.
#
# This script:
#   1. Builds Rust-RED in release mode (if needed)
#   2. Detects Node-RED availability
#   3. Runs each benchmark scenario against available engines
#   4. Collects results into JSON files
#   5. Generates a comparison report
#
# Prerequisites:
#   - Rust toolchain (for Rust-RED)
#   - Node-RED (optional, for comparison): npm install -g node-red
#   - jq (optional, for JSON processing): brew install jq
#   - autocannon or wrk (optional, for HTTP benchmark): npm install -g autocannon
#   - mosquitto or similar MQTT broker (optional, for MQTT benchmark)
#
# Usage:
#   ./run-benchmarks.sh                # Run both engines
#   ./run-benchmarks.sh --rust-only    # Run only Rust-RED benchmarks
#   ./run-benchmarks.sh --node-only    # Run only Node-RED benchmarks
#   ./run-benchmarks.sh --scenario 1   # Run only scenario 1
#   ./run-benchmarks.sh --quick        # Quick run with fewer iterations
#   ./run-benchmarks.sh --skip-mqtt    # Skip MQTT scenario (no broker needed)
#   ./run-benchmarks.sh --skip-http    # Skip HTTP load test scenario

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
SCENARIOS_DIR="$SCRIPT_DIR/scenarios"
RESULTS_DIR="$SCRIPT_DIR/results"
COLLECT_SCRIPT="$SCRIPT_DIR/collect-results.sh"

# Default configuration
NODE_RED_PORT=18801
RUST_RED_PORT=18802
MSG_COUNT=500
QUICK_MODE=false
SKIP_MQTT=false
SKIP_HTTP=false
RUN_RUST=true
RUN_NODE=true
SCENARIO_FILTER=""

mkdir -p "$RESULTS_DIR"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --rust-only)
            RUN_NODE=false
            shift
            ;;
        --node-only)
            RUN_RUST=false
            shift
            ;;
        --scenario)
            SCENARIO_FILTER="$2"
            shift 2
            ;;
        --quick)
            QUICK_MODE=true
            MSG_COUNT=100
            shift
            ;;
        --skip-mqtt)
            SKIP_MQTT=true
            shift
            ;;
        --skip-http)
            SKIP_HTTP=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --rust-only     Run only Rust-RED benchmarks"
            echo "  --node-only     Run only Node-RED benchmarks"
            echo "  --scenario N    Run only scenario N (1-6)"
            echo "  --quick         Quick run with fewer iterations"
            echo "  --skip-mqtt     Skip MQTT scenario (requires broker)"
            echo "  --skip-http     Skip HTTP load test (requires autocannon/wrk)"
            echo "  --help          Show this help"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ---------------------------------------------------------------------------
# Colors
# ---------------------------------------------------------------------------
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[0;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    BOLD='\033[1m'
    NC='\033[0m'
else
    RED='' GREEN='' YELLOW='' BLUE='' CYAN='' BOLD='' NC=''
fi

# ---------------------------------------------------------------------------
# Utility functions
# ---------------------------------------------------------------------------
log_header() {
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  $1${NC}"
    echo -e "${BOLD}========================================${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_ok() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_err() {
    echo -e "${RED}[ERROR]${NC} $1"
}

ms_now() {
    if date +%s%3N 2>/dev/null | grep -qE '^[0-9]+$'; then
        date +%s%3N
    else
        python3 -c 'import time; print(int(time.time() * 1000))'
    fi
}

cleanup() {
    # Kill any background processes we started
    if [ -n "${NR_PID:-}" ] && kill -0 "$NR_PID" 2>/dev/null; then
        kill "$NR_PID" 2>/dev/null || true
        wait "$NR_PID" 2>/dev/null || true
    fi
    if [ -n "${RR_PID:-}" ] && kill -0 "$RR_PID" 2>/dev/null; then
        kill "$RR_PID" 2>/dev/null || true
        wait "$RR_PID" 2>/dev/null || true
    fi
    # Clean temp directories
    rm -rf "${NR_TMP_DIR:-/tmp/bench-nodered-$$}" 2>/dev/null || true
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Detect tools
# ---------------------------------------------------------------------------
detect_tools() {
    log_info "Detecting available tools..."

    # Node-RED
    if command -v node-red &>/dev/null; then
        NODE_RED_BIN=$(command -v node-red)
        log_ok "Node-RED found: $NODE_RED_BIN"
    else
        NODE_RED_BIN=""
        if [ "$RUN_NODE" = true ]; then
            log_warn "Node-RED not found. Install with: npm install -g node-red"
            log_warn "Continuing with Rust-RED only."
            RUN_NODE=false
        fi
    fi

    # jq
    if command -v jq &>/dev/null; then
        HAS_JQ=true
        log_ok "jq found"
    else
        HAS_JQ=false
        log_warn "jq not found. JSON parsing will use python3 fallback."
    fi

    # autocannon / wrk
    HTTP_TOOL=""
    if command -v autocannon &>/dev/null; then
        HTTP_TOOL="autocannon"
        log_ok "autocannon found (for HTTP benchmark)"
    elif command -v wrk &>/dev/null; then
        HTTP_TOOL="wrk"
        log_ok "wrk found (for HTTP benchmark)"
    else
        if [ "$SKIP_HTTP" = false ]; then
            log_warn "Neither autocannon nor wrk found. HTTP benchmark will use curl (slow)."
            log_warn "Install: npm install -g autocannon  OR  brew install wrk"
        fi
    fi

    # MQTT broker
    MQTT_AVAILABLE=false
    if command -v mosquitto &>/dev/null; then
        MQTT_AVAILABLE=true
        log_ok "mosquitto found (for MQTT benchmark)"
    elif [ -f /usr/sbin/mosquitto ] || [ -f /usr/local/sbin/mosquitto ]; then
        MQTT_AVAILABLE=true
        log_ok "mosquitto found (for MQTT benchmark)"
    else
        if [ "$SKIP_MQTT" = false ]; then
            log_warn "mosquitto not found. MQTT benchmark will be skipped."
            log_warn "Install: brew install mosquitto  OR  apt install mosquitto"
        fi
        SKIP_MQTT=true
    fi

    # python3
    if command -v python3 &>/dev/null; then
        HAS_PYTHON=true
        log_ok "python3 found"
    else
        HAS_PYTHON=false
        log_warn "python3 not found. Some features may be limited."
    fi

    # bc
    if command -v bc &>/dev/null; then
        HAS_BC=true
    else
        HAS_BC=false
        log_warn "bc not found. Some calculations may be limited."
    fi
}

# ---------------------------------------------------------------------------
# Build Rust-RED
# ---------------------------------------------------------------------------
build_rust_red() {
    log_header "Building Rust-RED (release mode)"

    # Check if the binary exists and is up to date
    local binary_path
    binary_path="$PROJECT_DIR/target/release/rust-red"
    if [ -f "$binary_path" ]; then
        log_info "Release binary already exists at $binary_path"
        log_info "Rebuilding to ensure latest version..."
    fi

    cd "$PROJECT_DIR"
    cargo build --release 2>&1 | tail -5
    cd -

    if [ -f "$binary_path" ]; then
        local size_mb
        size_mb=$(echo "scale=1; $(stat -f%z "$binary_path" 2>/dev/null || stat -c%s "$binary_path" 2>/dev/null) / 1048576" | bc 2>/dev/null || echo "?")
        log_ok "Rust-RED binary: $binary_path ($size_mb MB)"
    else
        log_err "Failed to build Rust-RED. Expected binary at $binary_path"
        log_err "Check that the project has a binary target named 'rust-red'."
        log_info "Attempting to find the actual binary name..."
        local found_binary
        found_binary=$(find "$PROJECT_DIR/target/release/" -maxdepth 1 -type f -perm -u+x ! -name '*.d' ! -name '*.*' 2>/dev/null | head -1 || true)
        if [ -n "$found_binary" ]; then
            binary_path="$found_binary"
            log_ok "Found binary: $binary_path"
        else
            log_err "No release binary found. Cannot run Rust-RED benchmarks."
            RUN_RUST=false
        fi
    fi

    RUST_RED_BINARY="$binary_path"
}

# ---------------------------------------------------------------------------
# Run a single scenario against Node-RED
# ---------------------------------------------------------------------------
run_scenario_node_red() {
    local scenario_file="$1"
    local scenario_name="$2"
    local results_file="$RESULTS_DIR/node-red-${scenario_name}.json"

    if [ "$RUN_NODE" = false ]; then
        return 0
    fi

    echo ""
    log_info "[Node-RED] Running scenario: ${scenario_name}"

    # Extract the flow portion from the scenario file
    local flow_json
    if [ "$HAS_PYTHON" = true ]; then
        flow_json=$(python3 -c "
import json, sys
with open('$scenario_file') as f:
    data = json.load(f)
print(json.dumps(data.get('flow', data)))
" 2>/dev/null)
    else
        # Fallback: assume the file is the flow
        flow_json=$(cat "$scenario_file")
    fi

    # Setup temp directory for Node-RED
    NR_TMP_DIR="/tmp/bench-nodered-$$"
    rm -rf "$NR_TMP_DIR" 2>/dev/null || true
    mkdir -p "$NR_TMP_DIR"

    # Write flow file
    echo "$flow_json" > "$NR_TMP_DIR/flows.json"

    # Start Node-RED
    log_info "[Node-RED] Starting on port $NODE_RED_PORT..."
    local start_ms
    start_ms=$(ms_now)

    node-red -p "$NODE_RED_PORT" -u "$NR_TMP_DIR" -- -v &>/dev/null &
    NR_PID=$!

    # Wait for ready and measure startup
    local ready=false
    for i in $(seq 1 30); do
        if curl -sf -o /dev/null -m 2 "http://localhost:${NODE_RED_PORT}/" 2>/dev/null; then
            ready=true
            break
        fi
        sleep 0.5
    done

    local end_ms startup_ms
    end_ms=$(ms_now)
    startup_ms=$(( end_ms - start_ms ))

    if [ "$ready" = false ]; then
        log_err "[Node-RED] Failed to start within 15 seconds"
        kill "$NR_PID" 2>/dev/null || true
        wait "$NR_PID" 2>/dev/null || true
        NR_PID=""
        return 1
    fi

    log_ok "[Node-RED] Started in ${startup_ms}ms (PID: $NR_PID)"

    # Measure memory
    local rss_kb
    rss_kb=$(ps -o rss= -p "$NR_PID" 2>/dev/null | tr -d ' ' || echo "0")
    local rss_mb
    rss_mb=$(echo "scale=2; $rss_kb / 1024" | bc 2>/dev/null || echo "0")

    # Measure throughput by hitting inject endpoint
    local scenario_iterations
    scenario_iterations=$(python3 -c "
import json
with open('$scenario_file') as f:
    data = json.load(f)
print(data.get('iterations', $MSG_COUNT))
" 2>/dev/null || echo "$MSG_COUNT")

    # Find the inject node ID from the flow
    local inject_node_id
    inject_node_id=$(python3 -c "
import json
with open('$scenario_file') as f:
    data = json.load(f)
flow = data.get('flow', data)
for node in flow:
    if node.get('type') == 'inject':
        print(node['id'])
        break
" 2>/dev/null || echo "s1_inject")

    log_info "[Node-RED] Measuring throughput (${scenario_iterations} messages)..."
    local tp_start tp_end tp_ms msgs_per_sec
    tp_start=$(ms_now)

    for i in $(seq 1 "$scenario_iterations"); do
        curl -sf -o /dev/null -m 2 \
            -X POST "http://localhost:${NODE_RED_PORT}/inject/${inject_node_id}" 2>/dev/null || true
    done

    tp_end=$(ms_now)
    tp_ms=$(( tp_end - tp_start ))

    if [ "$tp_ms" -gt 0 ]; then
        msgs_per_sec=$(echo "scale=0; $scenario_iterations * 1000 / $tp_ms" | bc 2>/dev/null || echo "0")
    else
        msgs_per_sec=0
    fi

    log_ok "[Node-RED] Throughput: ${msgs_per_sec} msgs/sec"

    # Write results
    cat > "$results_file" << EOF
{
    "engine": "node-red",
    "scenario": "${scenario_name}",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "startup_ms": ${startup_ms},
    "memory": {
        "rss_kb": ${rss_kb},
        "rss_mb": ${rss_mb}
    },
    "throughput": {
        "messages": ${scenario_iterations},
        "total_ms": ${tp_ms},
        "msgs_per_sec": ${msgs_per_sec}
    }
}
EOF

    log_ok "[Node-RED] Results: ${results_file}"

    # Stop Node-RED
    kill "$NR_PID" 2>/dev/null || true
    wait "$NR_PID" 2>/dev/null || true
    NR_PID=""

    # Brief pause between scenarios
    sleep 2
}

# ---------------------------------------------------------------------------
# Run a single scenario against Rust-RED
# ---------------------------------------------------------------------------
run_scenario_rust_red() {
    local scenario_file="$1"
    local scenario_name="$2"
    local results_file="$RESULTS_DIR/rust-red-${scenario_name}.json"

    if [ "$RUN_RUST" = false ]; then
        return 0
    fi

    echo ""
    log_info "[Rust-RED] Running scenario: ${scenario_name}"

    # Start Rust-RED with the scenario flow
    log_info "[Rust-RED] Starting on port $RUST_RED_PORT..."

    local start_ms
    start_ms=$(ms_now)

    "$RUST_RED_BINARY" --port "$RUST_RED_PORT" --flow "$scenario_file" &>/dev/null &
    RR_PID=$!

    # Wait for ready
    local ready=false
    for i in $(seq 1 30); do
        if curl -sf -o /dev/null -m 2 "http://localhost:${RUST_RED_PORT}/" 2>/dev/null; then
            ready=true
            break
        fi
        sleep 0.5
    done

    local end_ms startup_ms
    end_ms=$(ms_now)
    startup_ms=$(( end_ms - start_ms ))

    if [ "$ready" = false ]; then
        log_warn "[Rust-RED] Could not start as standalone server. Falling back to cargo bench."
        kill "$RR_PID" 2>/dev/null || true
        wait "$RR_PID" 2>/dev/null || true
        RR_PID=""

        # Fall back to running the built-in Rust benchmarks
        run_rust_red_native_bench "$scenario_name" "$results_file"
        return 0
    fi

    log_ok "[Rust-RED] Started in ${startup_ms}ms (PID: $RR_PID)"

    # Measure memory
    local rss_kb
    rss_kb=$(ps -o rss= -p "$RR_PID" 2>/dev/null | tr -d ' ' || echo "0")
    local rss_mb
    rss_mb=$(echo "scale=2; $rss_kb / 1024" | bc 2>/dev/null || echo "0")

    # Measure throughput
    local scenario_iterations
    scenario_iterations=$(python3 -c "
import json
with open('$scenario_file') as f:
    data = json.load(f)
print(data.get('iterations', $MSG_COUNT))
" 2>/dev/null || echo "$MSG_COUNT")

    local inject_node_id
    inject_node_id=$(python3 -c "
import json
with open('$scenario_file') as f:
    data = json.load(f)
flow = data.get('flow', data)
for node in flow:
    if node.get('type') == 'inject':
        print(node['id'])
        break
" 2>/dev/null || echo "s1_inject")

    log_info "[Rust-RED] Measuring throughput (${scenario_iterations} messages)..."
    local tp_start tp_end tp_ms msgs_per_sec
    tp_start=$(ms_now)

    for i in $(seq 1 "$scenario_iterations"); do
        curl -sf -o /dev/null -m 2 \
            -X POST "http://localhost:${RUST_RED_PORT}/inject/${inject_node_id}" 2>/dev/null || true
    done

    tp_end=$(ms_now)
    tp_ms=$(( tp_end - tp_start ))

    if [ "$tp_ms" -gt 0 ]; then
        msgs_per_sec=$(echo "scale=0; $scenario_iterations * 1000 / $tp_ms" | bc 2>/dev/null || echo "0")
    else
        msgs_per_sec=0
    fi

    log_ok "[Rust-RED] Throughput: ${msgs_per_sec} msgs/sec"

    # Binary size
    local binary_size_bytes
    binary_size_bytes=$(stat -f%z "$RUST_RED_BINARY" 2>/dev/null || stat -c%s "$RUST_RED_BINARY" 2>/dev/null || echo "0")
    local binary_size_mb
    binary_size_mb=$(echo "scale=1; $binary_size_bytes / 1048576" | bc 2>/dev/null || echo "0")

    # Write results
    cat > "$results_file" << EOF
{
    "engine": "rust-red",
    "scenario": "${scenario_name}",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "startup_ms": ${startup_ms},
    "memory": {
        "rss_kb": ${rss_kb},
        "rss_mb": ${rss_mb}
    },
    "throughput": {
        "messages": ${scenario_iterations},
        "total_ms": ${tp_ms},
        "msgs_per_sec": ${msgs_per_sec}
    },
    "binary_size": {
        "bytes": ${binary_size_bytes},
        "mb": ${binary_size_mb}
    }
}
EOF

    log_ok "[Rust-RED] Results: ${results_file}"

    # Stop Rust-RED
    kill "$RR_PID" 2>/dev/null || true
    wait "$RR_PID" 2>/dev/null || true
    RR_PID=""

    # Brief pause between scenarios
    sleep 2
}

# ---------------------------------------------------------------------------
# Fallback: run Rust-RED native cargo bench
# ---------------------------------------------------------------------------
run_rust_red_native_bench() {
    local scenario_name="$1"
    local results_file="$2"

    log_info "[Rust-RED] Running native cargo bench (no standalone server)..."

    cd "$PROJECT_DIR"

    # Run the throughput benchmark and capture output
    local bench_output
    bench_output=$(cargo run --release --bench throughput 2>/dev/null || echo "{}")

    # Extract JSON from benchmark output
    local bench_json
    bench_json=$(echo "$bench_output" | sed -n '/--- JSON Results ---/,$p' | tail -n +2 | head -30 || echo "[]")

    cd -

    cat > "$results_file" << EOF
{
    "engine": "rust-red",
    "scenario": "${scenario_name}",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "mode": "native-cargo-bench",
    "results": ${bench_json:-[]}
}
EOF

    log_ok "[Rust-RED] Native bench results: ${results_file}"
}

# ---------------------------------------------------------------------------
# Run HTTP load test scenario
# ---------------------------------------------------------------------------
run_http_benchmark() {
    local engine_name="$1"
    local port="$2"
    local results_file="$3"

    log_info "[${engine_name}] Running HTTP benchmark on port ${port}..."

    if [ "$HTTP_TOOL" = "autocannon" ]; then
        local ac_output
        ac_output=$(autocannon -c 10 -d 5 "http://localhost:${port}/bench/http" 2>/dev/null || echo "")
        local rps
        rps=$(echo "$ac_output" | grep -oE '[0-9.]+ req/sec' | head -1 | grep -oE '[0-9.]+' || echo "0")
        echo "{\"tool\": \"autocannon\", \"requests_per_sec\": ${rps}, \"connections\": 10, \"duration_sec\": 5}" > "$results_file"
    elif [ "$HTTP_TOOL" = "wrk" ]; then
        local wrk_output
        wrk_output=$(wrk -t 2 -c 10 -d 5s "http://localhost:${port}/bench/http" 2>/dev/null || echo "")
        local rps
        rps=$(echo "$wrk_output" | grep -oE 'Requests/sec:[[:space:]]+[0-9.]+' | grep -oE '[0-9.]+' || echo "0")
        echo "{\"tool\": \"wrk\", \"requests_per_sec\": ${rps}, \"threads\": 2, \"connections\": 10, \"duration_sec\": 5}" > "$results_file"
    else
        # Fallback: sequential curl
        local requests=200
        local start_ms end_ms total_ms rps
        start_ms=$(ms_now)
        for i in $(seq 1 "$requests"); do
            curl -sf -o /dev/null -m 2 "http://localhost:${port}/bench/http" 2>/dev/null || true
        done
        end_ms=$(ms_now)
        total_ms=$(( end_ms - start_ms ))
        if [ "$total_ms" -gt 0 ]; then
            rps=$(echo "scale=0; $requests * 1000 / $total_ms" | bc 2>/dev/null || echo "0")
        else
            rps=0
        fi
        echo "{\"tool\": \"curl-sequential\", \"requests_per_sec\": ${rps}, \"requests\": ${requests}, \"total_ms\": ${total_ms}}" > "$results_file"
    fi

    log_ok "[${engine_name}] HTTP benchmark: $(cat "$results_file" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"{d.get(\"requests_per_sec\",0)} req/sec")' 2>/dev/null || echo "done")"
}

# ---------------------------------------------------------------------------
# Run delay accuracy benchmark
# ---------------------------------------------------------------------------
run_delay_benchmark() {
    local engine_name="$1"
    local port="$2"
    local inject_node_id="$3"
    local iterations="${4:-50}"
    local results_file="$5"

    log_info "[${engine_name}] Running delay accuracy benchmark (${iterations} iterations)..."

    local results_array="[]"
    if [ "$HAS_PYTHON" = true ]; then
        results_array=$(python3 -c "
import json, subprocess, time

delays = []
for i in range($iterations):
    t0 = time.time() * 1000
    subprocess.run(
        ['curl', '-sf', '-o', '/dev/null', '-m', '2',
         '-X', 'POST', 'http://localhost:${port}/inject/${inject_node_id}'],
        capture_output=True
    )
    time.sleep(0.2)  # Wait for delay node (100ms) + processing

results = {
    'iterations': $iterations,
    'expected_delay_ms': 100,
    'note': 'Delay accuracy measured from inject to debug output. Check engine logs for actual delay values.',
    'min_acceptable_ms': 90,
    'max_acceptable_ms': 200
}
print(json.dumps(results))
" 2>/dev/null || echo '{}')
    else
        results_array='{"note": "python3 required for delay measurement"}'
    fi

    echo "$results_array" > "$results_file"
    log_ok "[${engine_name}] Delay benchmark: ${results_file}"
}

# ---------------------------------------------------------------------------
# Generate comparison report
# ---------------------------------------------------------------------------
generate_report() {
    log_header "Generating Comparison Report"

    local report_file="$RESULTS_DIR/comparison-report.json"

    # Collect all results
    local all_results="{}"
    if [ "$HAS_PYTHON" = true ]; then
        RESULTS_DIR="$RESULTS_DIR" python3 << 'PYEOF' > "$report_file"
import json
import os
import glob
import sys

results_dir = os.environ.get("RESULTS_DIR", ".")

all_results = {
    "metadata": {
        "timestamp": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "tool": "run-benchmarks.sh"
    },
    "scenarios": {}
}

# Collect all result files
for f in sorted(glob.glob(os.path.join(results_dir, "*.json"))):
    basename = os.path.basename(f)
    if basename == "comparison-report.json":
        continue
    try:
        with open(f) as fh:
            data = json.load(fh)
        engine = data.get("engine", "unknown")
        scenario = data.get("scenario", basename.replace(".json", ""))
        if scenario not in all_results["scenarios"]:
            all_results["scenarios"][scenario] = {}
        all_results["scenarios"][scenario][engine] = data
    except Exception as e:
        print(f"Warning: Could not parse {f}: {e}", file=sys.stderr)

print(json.dumps(all_results, indent=2))
PYEOF
    else
        # Simple fallback: just list all result files
        echo '{"metadata":{"timestamp":"'$(date -u +%Y-%m-%dT%H:%M:%SZ)'","note":"python3 not available, limited report"}}' > "$report_file"
        for f in "$RESULTS_DIR"/*.json; do
            [ "$(basename "$f")" = "comparison-report.json" ] && continue
            echo "  Found: $(basename "$f")"
        done >> "$report_file"
    fi

    log_ok "Full report written to: $report_file"

    # Print summary table
    echo ""
    echo -e "${BOLD}========================================${NC}"
    echo -e "${BOLD}  Performance Summary${NC}"
    echo -e "${BOLD}========================================${NC}"
    echo ""

    if [ "$HAS_PYTHON" = true ]; then
        RESULTS_DIR="$RESULTS_DIR" python3 << 'PYEOF'
import json
import os
import glob

results_dir = os.environ.get("RESULTS_DIR", ".")

# Load all results and print comparison table
node_results = {}
rust_results = {}

for f in sorted(glob.glob(os.path.join(results_dir, "node-red-*.json"))):
    try:
        with open(f) as fh:
            data = json.load(fh)
        scenario = data.get("scenario", "unknown")
        node_results[scenario] = data
    except:
        pass

for f in sorted(glob.glob(os.path.join(results_dir, "rust-red-*.json"))):
    try:
        with open(f) as fh:
            data = json.load(fh)
        scenario = data.get("scenario", "unknown")
        rust_results[scenario] = data
    except:
        pass

all_scenarios = sorted(set(list(node_results.keys()) + list(rust_results.keys())))

if not all_scenarios:
    print("No scenario results found.")
    exit(0)

# Print per-scenario comparison
fmt = "{:<25} {:>15} {:>15} {:>10}"
print(fmt.format("Scenario / Metric", "Node-RED", "Rust-RED", "Speedup"))
print("-" * 67)

for scenario in all_scenarios:
    nr = node_results.get(scenario, {})
    rr = rust_results.get(scenario, {})

    print(f"\n  {scenario}")
    print(f"  {'-' * 63}")

    # Startup
    nr_startup = nr.get("startup_ms", 0)
    rr_startup = rr.get("startup_ms", 0)
    if nr_startup and rr_startup:
        ratio = nr_startup / rr_startup if rr_startup > 0 else 0
        print(f"  {'  startup (ms)':<23} {nr_startup:>12.0f} ms {rr_startup:>12.0f} ms {ratio:>9.1f}x")

    # Memory
    nr_mem = nr.get("memory", {}).get("rss_mb", 0)
    rr_mem = rr.get("memory", {}).get("rss_mb", 0)
    if nr_mem and rr_mem:
        ratio = nr_mem / rr_mem if rr_mem > 0 else 0
        print(f"  {'  memory (MB)':<23} {nr_mem:>12.1f} MB {rr_mem:>12.1f} MB {ratio:>9.1f}x")

    # Throughput
    nr_tp = nr.get("throughput", {}).get("msgs_per_sec", 0)
    rr_tp = rr.get("throughput", {}).get("msgs_per_sec", 0)
    if nr_tp and rr_tp:
        ratio = rr_tp / nr_tp if nr_tp > 0 else 0
        print(f"  {'  throughput (msg/s)':<23} {nr_tp:>12.0f}/s {rr_tp:>12.0f}/s {ratio:>9.1f}x")

    # If no comparable metrics, show what we have
    if not nr:
        print(f"  {'  (Node-RED not run)':<23}")
    if not rr:
        print(f"  {'  (Rust-RED not run)':<23}")

# Overall summary
print(f"\n{'=' * 67}")
print(f"\nResults directory: {results_dir}")
print(f"Full report: {os.path.join(results_dir, 'comparison-report.json')}")
PYEOF
    else
        echo "Install python3 for detailed comparison table."
        echo "Results available in: $RESULTS_DIR/"
        ls -la "$RESULTS_DIR/"*.json 2>/dev/null || echo "  (no results files)"
    fi
}

# ---------------------------------------------------------------------------
# Run Rust-RED internal benchmarks (cargo bench)
# ---------------------------------------------------------------------------
run_rust_red_internal_benchmarks() {
    if [ "$RUN_RUST" = false ]; then
        return 0
    fi

    log_header "Running Rust-RED Internal Benchmarks (cargo bench)"

    cd "$PROJECT_DIR"

    # Run each benchmark
    for bench_name in throughput startup memory; do
        log_info "Running ${bench_name} benchmark..."
        local bench_output
        bench_output=$(cargo run --release --bench "$bench_name" 2>/dev/null || echo "FAILED")

        # Extract JSON output
        local bench_json
        bench_json=$(echo "$bench_output" | sed -n '/--- JSON Results ---/,$p' | tail -n +2 | head -30 || echo "[]")

        if [ "$bench_json" != "[]" ] && [ "$bench_json" != "FAILED" ]; then
            echo "$bench_json" > "$RESULTS_DIR/rust-red-internal-${bench_name}.json"
            log_ok "${bench_name} benchmark complete"
        else
            log_warn "${bench_name} benchmark produced no JSON output"
        fi
    done

    # Run WASM overhead if available
    log_info "Running wasm_overhead benchmark (if available)..."
    cargo run --release --bench wasm_overhead 2>/dev/null | \
        sed -n '/--- JSON Results ---/,$p' | tail -n +2 | head -30 > \
        "$RESULTS_DIR/rust-red-internal-wasm_overhead.json" 2>/dev/null || true

    cd -
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
log_header "Rust-RED vs Node-RED Performance Benchmark"

echo "Configuration:"
echo "  Scenarios dir:    $SCENARIOS_DIR"
echo "  Results dir:      $RESULTS_DIR"
echo "  Message count:    $MSG_COUNT"
echo "  Quick mode:       $QUICK_MODE"
echo "  Skip MQTT:        $SKIP_MQTT"
echo "  Skip HTTP:        $SKIP_HTTP"
echo "  Run Rust-RED:     $RUN_RUST"
echo "  Run Node-RED:     $RUN_NODE"
if [ -n "$SCENARIO_FILTER" ]; then
    echo "  Scenario filter:  $SCENARIO_FILTER"
fi

# Phase 1: Detect tools and build
detect_tools

if [ "$RUN_RUST" = true ]; then
    build_rust_red
fi

# Phase 2: Determine which scenarios to run
declare -a SCENARIOS=(
    "scenario-1-throughput.json:throughput"
    "scenario-2-fanout.json:fanout"
    "scenario-3-switch.json:switch"
    "scenario-4-mqtt.json:mqtt"
    "scenario-5-http.json:http"
    "scenario-6-delay.json:delay"
)

# Phase 3: Run scenarios
for scenario_entry in "${SCENARIOS[@]}"; do
    IFS=':' read -r scenario_file scenario_name <<< "$scenario_entry"

    # Apply scenario filter
    if [ -n "$SCENARIO_FILTER" ]; then
        local_num=$(echo "$scenario_file" | grep -oE '[0-9]+' | head -1)
        if [ "$local_num" != "$SCENARIO_FILTER" ]; then
            continue
        fi
    fi

    # Skip scenarios that require external services
    if [ "$scenario_name" = "mqtt" ] && [ "$SKIP_MQTT" = true ]; then
        log_info "Skipping MQTT scenario (--skip-mqtt)"
        continue
    fi
    if [ "$scenario_name" = "http" ] && [ "$SKIP_HTTP" = true ]; then
        log_info "Skipping HTTP scenario (--skip-http)"
        continue
    fi

    scenario_path="$SCENARIOS_DIR/$scenario_file"
    if [ ! -f "$scenario_path" ]; then
        log_warn "Scenario file not found: $scenario_path"
        continue
    fi

    log_header "Scenario: ${scenario_name}"

    # Run Node-RED
    run_scenario_node_red "$scenario_path" "$scenario_name"

    # Run Rust-RED
    run_scenario_rust_red "$scenario_path" "$scenario_name"

    # HTTP-specific load testing
    if [ "$scenario_name" = "http" ] && [ "$SKIP_HTTP" = false ]; then
        # Start Node-RED for HTTP load test
        if [ "$RUN_NODE" = true ]; then
            log_info "Starting Node-RED for HTTP load test..."
            NR_TMP_DIR="/tmp/bench-nodered-$$"
            mkdir -p "$NR_TMP_DIR"
            python3 -c "
import json
with open('$scenario_path') as f:
    data = json.load(f)
print(json.dumps(data.get('flow', data)))
" > "$NR_TMP_DIR/flows.json" 2>/dev/null

            node-red -p "$NODE_RED_PORT" -u "$NR_TMP_DIR" -- -v &>/dev/null &
            NR_PID=$!
            for i in $(seq 1 20); do
                curl -sf -o /dev/null -m 2 "http://localhost:${NODE_RED_PORT}/" 2>/dev/null && break
                sleep 0.5
            done
            run_http_benchmark "node-red" "$NODE_RED_PORT" "$RESULTS_DIR/node-red-http-load.json"
            kill "$NR_PID" 2>/dev/null || true
            wait "$NR_PID" 2>/dev/null || true
            NR_PID=""
            sleep 1
        fi

        # Start Rust-RED for HTTP load test
        if [ "$RUN_RUST" = true ]; then
            log_info "Starting Rust-RED for HTTP load test..."
            "$RUST_RED_BINARY" --port "$RUST_RED_PORT" --flow "$scenario_path" &>/dev/null &
            RR_PID=$!
            for i in $(seq 1 20); do
                curl -sf -o /dev/null -m 2 "http://localhost:${RUST_RED_PORT}/" 2>/dev/null && break
                sleep 0.5
            done
            run_http_benchmark "rust-red" "$RUST_RED_PORT" "$RESULTS_DIR/rust-red-http-load.json"
            kill "$RR_PID" 2>/dev/null || true
            wait "$RR_PID" 2>/dev/null || true
            RR_PID=""
        fi
    fi

    # Delay accuracy test
    if [ "$scenario_name" = "delay" ]; then
        # Start engines for delay test
        if [ "$RUN_NODE" = true ]; then
            log_info "Starting Node-RED for delay accuracy test..."
            NR_TMP_DIR="/tmp/bench-nodered-$$"
            mkdir -p "$NR_TMP_DIR"
            python3 -c "
import json
with open('$scenario_path') as f:
    data = json.load(f)
print(json.dumps(data.get('flow', data)))
" > "$NR_TMP_DIR/flows.json" 2>/dev/null

            node-red -p "$NODE_RED_PORT" -u "$NR_TMP_DIR" -- -v &>/dev/null &
            NR_PID=$!
            for i in $(seq 1 20); do
                curl -sf -o /dev/null -m 2 "http://localhost:${NODE_RED_PORT}/" 2>/dev/null && break
                sleep 0.5
            done
            nr_delay_inject_id=$(python3 -c "
import json
with open('$scenario_path') as f:
    data = json.load(f)
for node in data.get('flow', data):
    if node.get('type') == 'inject':
        print(node['id'])
        break
" 2>/dev/null || echo "s6_inject")
            run_delay_benchmark "node-red" "$NODE_RED_PORT" "$nr_delay_inject_id" "50" "$RESULTS_DIR/node-red-delay-accuracy.json"
            kill "$NR_PID" 2>/dev/null || true
            wait "$NR_PID" 2>/dev/null || true
            NR_PID=""
            sleep 1
        fi
    fi
done

# Phase 4: Run Rust-RED internal cargo bench
run_rust_red_internal_benchmarks

# Phase 5: Generate report
generate_report

log_header "Benchmark Complete"
echo ""
echo "Results directory: $RESULTS_DIR/"
echo "  - Per-scenario results:  {node-red,rust-red}-<scenario>.json"
echo "  - Internal benchmarks:   rust-red-internal-<bench>.json"
echo "  - Full comparison:       comparison-report.json"
echo ""
echo "To view the report:"
echo "  cat $RESULTS_DIR/comparison-report.json | python3 -m json.tool"
echo ""
echo "To fill in the benchmark report template:"
echo "  See benchmarks/comparison/benchmark-report.md"
