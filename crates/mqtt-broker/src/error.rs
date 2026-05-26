use thiserror::Error;

#[derive(Debug, Error)]
pub enum BrokerError {
    #[error("Authentication failed for client '{0}'")]
    AuthenticationFailed(String),
    #[error("Protocol error: {0}")]
    ProtocolError(String),
    #[error("Connection closed")]
    ConnectionClosed,
    #[error("Io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Other(#[from] anyhow::Error),
}

pub type BrokerResult<T> = Result<T, BrokerError>;
