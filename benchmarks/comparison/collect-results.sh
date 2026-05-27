#!/usr/bin/env bash
# collect-results.sh — Collect performance metrics for a running engine instance.
#
# Measures:
#   - Startup time (time to first HTTP response)
#   - Memory usage (RSS via ps)
#   - Throughput (messages/second via inject API)
#   - Binary size (file size of the executable)
#
# Usage:
#   collect-results.sh <engine> <port> <results_json> [pid] [binary_path]
#
#   engine:       "node-red" or "rust-red"
#   port:         HTTP port the engine is listening on
#   results_json: path to write JSON results
#   pid:          process ID (for memory measurement, 0 to skip)
#   binary_path:  path to the binary (for size measurement, "" to skip)

set -euo pipefail

ENGINE="${1:?Usage: collect-results.sh <engine> <port> <results_json> [pid] [binary_path]}"
PORT="${2:?port required}"
RESULTS_JSON="${3:?results path required}"
ENGINE_PID="${4:-0}"
BINARY_PATH="${5:-}"

# ---------------------------------------------------------------------------
# Utility: cross-platform millisecond timestamp
# ---------------------------------------------------------------------------
ms_now() {
    if date +%s%3N 2>/dev/null | grep -qE '^[0-9]+$'; then
        date +%s%3N
    else
        python3 -c 'import time; print(int(time.time() * 1000))'
    fi
}

# ---------------------------------------------------------------------------
# Metric: startup time
# ---------------------------------------------------------------------------
measure_startup() {
    local port="$1"
    local max_wait="${2:-30}"
    local start_ms end_ms startup_ms

    start_ms=$(ms_now)

    for i in $(seq 1 "$max_wait"); do
        if curl -sf -o /dev/null -m 2 "http://localhost:${port}/" 2>/dev/null; then
            end_ms=$(ms_now)
            startup_ms=$(( end_ms - start_ms ))
            echo "$startup_ms"
            return 0
        fi
        sleep 1
    done

    echo "-1"
    return 1
}

# ---------------------------------------------------------------------------
# Metric: memory (RSS)
# ---------------------------------------------------------------------------
measure_memory() {
    local pid="$1"

    if [ "$pid" = "0" ] || [ -z "$pid" ]; then
        echo '{"rss_kb": 0, "rss_mb": 0.0}'
        return 0
    fi

    local rss_kb
    rss_kb=$(ps -o rss= -p "$pid" 2>/dev/null | tr -d ' ' || echo "0")
    if [ -z "$rss_kb" ] || [ "$rss_kb" = "" ]; then
        rss_kb=0
    fi

    local rss_mb
    rss_mb=$(echo "scale=2; $rss_kb / 1024" | bc 2>/dev/null || echo "0")

    echo "{\"rss_kb\": $rss_kb, \"rss_mb\": $rss_mb}"
}

# ---------------------------------------------------------------------------
# Metric: binary size
# ---------------------------------------------------------------------------
measure_binary_size() {
    local binary_path="$1"

    if [ -z "$binary_path" ] || [ ! -f "$binary_path" ]; then
        echo '{"size_bytes": 0, "size_mb": 0.0}'
        return 0
    fi

    local size_bytes
    size_bytes=$(stat -f%z "$binary_path" 2>/dev/null || stat -c%s "$binary_path" 2>/dev/null || echo "0")
    local size_mb
    size_mb=$(echo "scale=2; $size_bytes / 1048576" | bc 2>/dev/null || echo "0")

    echo "{\"size_bytes\": $size_bytes, \"size_mb\": $size_mb}"
}

# ---------------------------------------------------------------------------
# Metric: throughput via inject API
# ---------------------------------------------------------------------------
measure_throughput() {
    local port="$1"
    local msg_count="${2:-500}"
    local inject_node_id="${3:-s1_inject}"

    # Check if engine is reachable
    if ! curl -sf -o /dev/null -m 2 "http://localhost:${port}/" 2>/dev/null; then
        echo '{"throughput_msgs_per_sec": 0, "messages": 0, "total_ms": 0}'
        return 1
    fi

    local start_ms end_ms total_ms msgs_per_sec

    start_ms=$(ms_now)

    for i in $(seq 1 "$msg_count"); do
        # Try the inject endpoint (Node-RED style)
        if ! curl -sf -o /dev/null -m 2 \
            -X POST "http://localhost:${port}/inject/${inject_node_id}" 2>/dev/null; then
            # If inject endpoint fails, try a generic POST to /bench/inject
            if ! curl -sf -o /dev/null -m 2 \
                -X POST "http://localhost:${port}/bench/inject" \
                -H "Content-Type: application/json" \
                -d '{"payload":"bench-'$i'"}' 2>/dev/null; then
                # Silent failure, continue
                :
            fi
        fi
    done

    end_ms=$(ms_now)
    total_ms=$(( end_ms - start_ms ))

    if [ "$total_ms" -gt 0 ]; then
        msgs_per_sec=$(echo "scale=0; $msg_count * 1000 / $total_ms" | bc 2>/dev/null || echo "0")
    else
        msgs_per_sec=0
    fi

    echo "{\"throughput_msgs_per_sec\": $msgs_per_sec, \"messages\": $msg_count, \"total_ms\": $total_ms}"
}

# ---------------------------------------------------------------------------
# Metric: HTTP throughput (for scenario-5)
# ---------------------------------------------------------------------------
measure_http_throughput() {
    local port="$1"
    local requests="${2:-1000}"

    # Try autocannon first
    if command -v autocannon &>/dev/null; then
        local ac_output
        ac_output=$(autocannon -c 10 -d 5 -l "http://localhost:${port}/bench/http" 2>/dev/null || echo "")
        if [ -n "$ac_output" ]; then
            local rps
            rps=$(echo "$ac_output" | grep -oE '[0-9]+ req/sec' | head -1 | grep -oE '[0-9]+' || echo "0")
            echo "{\"tool\": \"autocannon\", \"requests_per_sec\": $rps, \"duration_sec\": 5}"
            return 0
        fi
    fi

    # Try wrk
    if command -v wrk &>/dev/null; then
        local wrk_output
        wrk_output=$(wrk -t 2 -c 10 -d 5s "http://localhost:${port}/bench/http" 2>/dev/null || echo "")
        if [ -n "$wrk_output" ]; then
            local rps
            rps=$(echo "$wrk_output" | grep -oE 'Requests/sec:[[:space:]]+[0-9.]+' | grep -oE '[0-9.]+' || echo "0")
            echo "{\"tool\": \"wrk\", \"requests_per_sec\": $rps, \"duration_sec\": 5}"
            return 0
        fi
    fi

    # Fallback: sequential curl
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

    echo "{\"tool\": \"curl-sequential\", \"requests_per_sec\": $rps, \"requests\": $requests, \"total_ms\": $total_ms}"
}

# ---------------------------------------------------------------------------
# Main collection
# ---------------------------------------------------------------------------
main() {
    echo "Collecting metrics for ${ENGINE} on port ${PORT}..."

    # Startup time
    local startup_ms
    startup_ms=$(measure_startup "$PORT")
    echo "  Startup: ${startup_ms}ms"

    # Memory
    local memory_json
    memory_json=$(measure_memory "$ENGINE_PID")
    echo "  Memory: $(echo "$memory_json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"{d[\"rss_mb\"]} MB")' 2>/dev/null || echo "$memory_json")"

    # Throughput
    local throughput_json
    throughput_json=$(measure_throughput "$PORT")
    echo "  Throughput: $(echo "$throughput_json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"{d[\"throughput_msgs_per_sec\"]} msgs/sec")' 2>/dev/null || echo "$throughput_json")"

    # Binary size
    local size_json
    size_json=$(measure_binary_size "$BINARY_PATH")
    echo "  Binary size: $(echo "$size_json" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"{d[\"size_mb\"]} MB")' 2>/dev/null || echo "$size_json")"

    # Write combined JSON
    cat > "$RESULTS_JSON" << RESULTSEOF
{
    "engine": "${ENGINE}",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "startup_ms": ${startup_ms},
    "memory": ${memory_json},
    "throughput": ${throughput_json},
    "binary_size": ${size_json}
}
RESULTSEOF

    echo "  Results written to: ${RESULTS_JSON}"
}

main
