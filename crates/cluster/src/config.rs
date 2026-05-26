use std::net::SocketAddr;
use std::time::Duration;

use serde::{Deserialize, Serialize};

/// Cluster configuration, loaded from `[cluster]` section of `rust-red.toml`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterConfig {
    /// Enable or disable clustering.
    #[serde(default)]
    pub enabled: bool,

    /// Unique identifier for this node within the cluster.
    /// If empty, a UUID will be generated at startup.
    #[serde(default)]
    pub node_id: String,

    /// Address this node binds to for cluster communication.
    /// Default: `"0.0.0.0:7980"`
    #[serde(default = "default_bind")]
    pub bind: String,

    /// Static list of peer addresses for initial discovery.
    #[serde(default)]
    pub peers: Vec<String>,

    /// Heartbeat interval in milliseconds.
    #[serde(default = "default_heartbeat_interval_ms")]
    pub heartbeat_interval_ms: u64,

    /// Time (ms) after which a node is considered failed if no heartbeat
    /// is received.
    #[serde(default = "default_failure_timeout_ms")]
    pub failure_timeout_ms: u64,

    /// Discovery mode: `"static"`, `"multicast"`, or `"dns"`.
    #[serde(default = "default_discovery_mode")]
    pub discovery_mode: String,

    /// Multicast group address (used when discovery_mode is `"multicast"`).
    #[serde(default = "default_multicast_addr")]
    pub multicast_addr: String,

    /// DNS service name to resolve for discovery (used when discovery_mode
    /// is `"dns"`).
    #[serde(default)]
    pub dns_service: String,

    /// Port used for multicast/DNS-discovered peers.
    #[serde(default = "default_cluster_port")]
    pub cluster_port: u16,
}

fn default_bind() -> String {
    "0.0.0.0:7980".to_string()
}

fn default_heartbeat_interval_ms() -> u64 {
    2000
}

fn default_failure_timeout_ms() -> u64 {
    10000
}

fn default_discovery_mode() -> String {
    "static".to_string()
}

fn default_multicast_addr() -> String {
    "239.255.0.1:7980".to_string()
}

fn default_cluster_port() -> u16 {
    7980
}

impl Default for ClusterConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            node_id: String::new(),
            bind: default_bind(),
            peers: Vec::new(),
            heartbeat_interval_ms: default_heartbeat_interval_ms(),
            failure_timeout_ms: default_failure_timeout_ms(),
            discovery_mode: default_discovery_mode(),
            multicast_addr: default_multicast_addr(),
            dns_service: String::new(),
            cluster_port: default_cluster_port(),
        }
    }
}

impl ClusterConfig {
    /// Load cluster configuration from a `config::Config` object.
    pub fn load(cfg: &config::Config) -> rust_red_core::Result<Self> {
        match cfg.get::<Self>("cluster") {
            Ok(c) => Ok(c),
            Err(config::ConfigError::NotFound(_)) => Ok(Self::default()),
            Err(e) => Err(e.into()),
        }
    }

    /// Resolve the bind address to a `SocketAddr`.
    pub fn bind_addr(&self) -> anyhow::Result<SocketAddr> {
        Ok(self.bind.parse()?)
    }

    /// Heartbeat as a `Duration`.
    pub fn heartbeat_interval(&self) -> Duration {
        Duration::from_millis(self.heartbeat_interval_ms)
    }

    /// Failure timeout as a `Duration`.
    pub fn failure_timeout(&self) -> Duration {
        Duration::from_millis(self.failure_timeout_ms)
    }

    /// Resolve all peer addresses.
    pub fn peer_addrs(&self) -> Vec<anyhow::Result<SocketAddr>> {
        self.peers.iter().map(|p| p.parse::<SocketAddr>().map_err(Into::into)).collect()
    }

    /// Ensure the config is valid, returning an error otherwise.
    pub fn validate(&self) -> anyhow::Result<()> {
        self.bind_addr()?;
        if self.heartbeat_interval_ms == 0 {
            anyhow::bail!("cluster.heartbeat_interval_ms must be > 0");
        }
        if self.failure_timeout_ms <= self.heartbeat_interval_ms {
            anyhow::bail!(
                "cluster.failure_timeout_ms ({}) must be greater than heartbeat_interval_ms ({})",
                self.failure_timeout_ms,
                self.heartbeat_interval_ms
            );
        }
        for (i, peer) in self.peers.iter().enumerate() {
            if peer.parse::<SocketAddr>().is_err() {
                anyhow::bail!("cluster.peers[{}] '{}' is not a valid socket address", i, peer);
            }
        }
        Ok(())
    }
}
