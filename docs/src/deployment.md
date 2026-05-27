# Deployment

## Docker

### Quick Start

```bash
docker compose up -d
```

This starts Rust-RED on port 1880 (HTTP) and 1883 (MQTT). Flows are stored in `./data/`.

### Dockerfile

Build from source:

```bash
docker build -t rust-red .
```

Slim variant (core only, no network/industrial nodes):

```bash
docker build -f Dockerfile.slim -t rust-red:slim .
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RUST_LOG` | `info` | Log level |
| `RUST_RED_USER_DIR` | `/data` | Data directory |

### Volumes

Mount `/data` for persistent storage:

```bash
docker run -v ./flows:/data -p 1880:1880 rust-red
```

## systemd

Create `/etc/systemd/system/rust-red.service`:

```ini
[Unit]
Description=Rust-RED Flow Engine
After=network.target

[Service]
Type=simple
User=rustred
Group=rustred
WorkingDirectory=/opt/rust-red
ExecStart=/usr/local/bin/rust-red run --headless -c /etc/rust-red/config.toml
Restart=on-failure
RestartSec=5
TimeoutStopSec=15
KillSignal=SIGINT

[Install]
WantedBy=multi-user.target
```

```bash
sudo useradd -r -s /bin/false rustred
sudo systemctl enable rust-red
sudo systemctl start rust-red
sudo journalctl -u rust-red -f  # view logs
```

## Binary Install

```bash
# One-line install (Linux/macOS)
curl -fsSL https://github.com/dzulfikar08/rust-red/raw/master/install.sh | sh

# Or with cargo
cargo install --git https://github.com/dzulfikar08/rust-red.git
```

## Build from Source

```bash
# Full build
cargo build --release --features full

# Custom feature set
cargo build --release --features core,js,nodes_network,nodes_modbus

# The binary is at:
./target/release/rust-red
```

## Reverse Proxy (nginx)

```nginx
server {
    listen 80;
    server_name rust-red.example.com;

    location / {
        proxy_pass http://127.0.0.1:1888;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

The WebSocket upgrade headers are required for the live debug panel.

## Production Checklist

- [ ] Run with `--headless` (no browser auto-open)
- [ ] Bind to `0.0.0.0` or use a reverse proxy
- [ ] Set `RUST_LOG=info` (not `debug` or `trace`)
- [ ] Mount `/data` volume for flow persistence
- [ ] Enable authentication if exposed to the internet
- [ ] Set up health checks on `/health`
- [ ] Configure log rotation if using file logging
- [ ] Use `--features cluster` for HA setups
