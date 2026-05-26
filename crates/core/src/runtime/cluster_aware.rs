use std::sync::Arc;

/// Trait for determining which flows this cluster node should execute.
///
/// Implemented by the cluster crate's `ClusterPartitionerBridge` and injected
/// into the Engine when the `cluster` feature is enabled and clustering is
/// configured.
pub trait ClusterFlowPartitioner: Send + Sync {
    /// Returns `true` if this node should run the flow with the given ID.
    fn owns_flow(&self, flow_id: &str) -> bool;

    /// Returns `true` when clustering is active and partitioning is in effect.
    fn is_enabled(&self) -> bool;

    /// Returns this node's identifier within the cluster.
    fn local_node_id(&self) -> &str;
}

pub type ClusterPartitionerHandle = Arc<dyn ClusterFlowPartitioner>;
