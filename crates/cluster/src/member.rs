use std::net::SocketAddr;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Health status of a cluster member.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MemberState {
    /// Node has just been discovered and is awaiting first heartbeat.
    Joining,
    /// Node is alive and sending heartbeats.
    Alive,
    /// Node is suspected dead (missed heartbeats, within grace period).
    Suspect,
    /// Node has been confirmed dead or left the cluster.
    Dead,
    /// Node is this instance.
    Self_,
}

impl std::fmt::Display for MemberState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MemberState::Joining => write!(f, "joining"),
            MemberState::Alive => write!(f, "alive"),
            MemberState::Suspect => write!(f, "suspect"),
            MemberState::Dead => write!(f, "dead"),
            MemberState::Self_ => write!(f, "self"),
        }
    }
}

/// Represents a single member of the cluster.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterMember {
    /// Unique node identifier.
    pub node_id: String,
    /// Network address for cluster communication.
    pub addr: SocketAddr,
    /// Current lifecycle state.
    pub state: MemberState,
    /// Monotonically increasing incarnation number used for conflict
    /// resolution in the gossip protocol.
    pub incarnation: u64,
    /// Timestamp (UTC) of the last heartbeat received from this member.
    pub last_heartbeat: DateTime<Utc>,
    /// Timestamp (UTC) when this member first joined.
    pub joined_at: DateTime<Utc>,
    /// Arbitrary key-value metadata (e.g. version, hostname, region).
    #[serde(default)]
    pub metadata: std::collections::HashMap<String, String>,
}

impl ClusterMember {
    /// Create a new alive member.
    pub fn new(node_id: String, addr: SocketAddr) -> Self {
        let now = Utc::now();
        Self {
            node_id,
            addr,
            state: MemberState::Alive,
            incarnation: 0,
            last_heartbeat: now,
            joined_at: now,
            metadata: std::collections::HashMap::new(),
        }
    }

    /// Create a self-referential member (represents this node).
    pub fn new_self(node_id: String, addr: SocketAddr) -> Self {
        let mut m = Self::new(node_id, addr);
        m.state = MemberState::Self_;
        m
    }

    /// Record a heartbeat from this member.
    pub fn record_heartbeat(&mut self) {
        self.last_heartbeat = Utc::now();
    }

    /// Check whether this member is considered alive (Alive or Self_).
    pub fn is_alive(&self) -> bool {
        matches!(self.state, MemberState::Alive | MemberState::Self_)
    }

    /// Transition the member state to Suspect and bump the incarnation.
    pub fn mark_suspect(&mut self) {
        if self.state == MemberState::Alive {
            self.state = MemberState::Suspect;
        }
    }

    /// Transition the member state to Dead.
    pub fn mark_dead(&mut self) {
        self.state = MemberState::Dead;
    }

    /// Refute a suspect marking by incrementing incarnation.
    pub fn refute(&mut self) {
        self.incarnation += 1;
        self.state = MemberState::Alive;
        self.last_heartbeat = Utc::now();
    }
}
