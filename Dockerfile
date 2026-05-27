# =============================================================================
# rust-red Dockerfile — multi-stage build
# Full variant: all nodes (network, storage, postgres, sqlite, influxdb,
#   modbus, opcua, bacnet, timescaledb, mssql) + JS runtime
# =============================================================================
# Build:
#   docker build -t rust-red:latest .
# Run:
#   docker run -p 1880:1880 -p 1883:1883 -v rust-red-data:/data rust-red:latest
# =============================================================================

# ---------------------------------------------------------------------------
# Stage 1: Build the statically-linked binary with musl
# ---------------------------------------------------------------------------
FROM rust:1.82-slim AS builder

# Install build dependencies
#   - musl-tools: static linking via musl libc
#   - pkg-config, libssl-dev: needed by some transitive crates
#     (rustls is used for TLS, but some crates still check for openssl at build time)
#   - git: build.rs embeds the git revision hash
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        musl-tools \
        pkg-config \
        git \
    && rm -rf /var/lib/apt/lists/*

# Add the musl target
RUN rustup target add x86_64-unknown-linux-musl

WORKDIR /usr/src/rust-red

# Cache dependencies: copy only manifest files first, then build a dummy layer
COPY Cargo.toml Cargo.lock build.rs ./
COPY crates ./crates
COPY node-plugins ./node-plugins
COPY 3rd-party ./3rd-party
COPY src ./src

# Build the release binary
#   --features default   → all node types + JS runtime
#   --target musl        → fully static binary (no glibc dependency)
#   Profile release is already configured in Cargo.toml:
#     opt-level = "z", lto = true, codegen-units = 1, strip = true
RUN cargo build --features default --release --target x86_64-unknown-linux-musl

# The binary is at target/x86_64-unknown-linux-musl/release/rust-red
# Strip is handled by the release profile (strip = true), but we verify
RUN ls -lh target/x86_64-unknown-linux-musl/release/rust-red

# ---------------------------------------------------------------------------
# Stage 2: Minimal runtime image
# ---------------------------------------------------------------------------
FROM debian:bookworm-slim AS runtime

# Install minimal runtime deps:
#   - ca-certificates: TLS root certs for HTTPS requests (rustls uses system certs)
#   - tzdata: timezone support for timestamps
#   - curl: used by the HEALTHCHECK directive
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        ca-certificates \
        tzdata \
        curl \
    && rm -rf /var/lib/apt/lists/* \
    && update-ca-certificates

# Create a non-root user to run the service
RUN groupadd --gid 1000 rustred && \
    useradd --uid 1000 --gid rustred --shell /bin/bash --create-home rustred

# Data directory for flows, config, and persistent state
RUN mkdir -p /data && chown rustred:rustred /data

# Copy the statically-linked binary from the builder
COPY --from=builder \
    /usr/src/rust-red/target/x86_64-unknown-linux-musl/release/rust-red \
    /usr/local/bin/rust-red

RUN chmod +x /usr/local/bin/rust-red

# Persist data (flows, credentials, config)
VOLUME ["/data"]

# Web UI / Admin API
EXPOSE 1880
# Embedded MQTT broker
EXPOSE 1883

WORKDIR /data

# Health check: hit the HTTP server root
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -sf http://localhost:1880/ || exit 1

# Switch to non-root user (after all root-owned setup is done)
USER rustred

ENTRYPOINT ["rust-red"]
# Default args: serve flows from /data.
# Override with: docker run rust-red:latest --help
CMD ["--flows", "/data/flows.json", "--userDir", "/data"]
