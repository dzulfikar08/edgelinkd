//! Security middleware and configuration for Rust-Red
//!
//! Provides:
//! - Security headers middleware (CSP, X-Frame-Options, etc.)
//! - Rate limiting (token bucket, per-IP)
//! - Input size validation for admin API
//! - Security configuration
//! - Audit logging middleware

pub mod audit_middleware;
pub mod config;
pub mod headers;
pub mod rate_limit;

pub use audit_middleware::AuditLogLayer;
pub use config::SecurityConfig;
pub use headers::SecurityHeadersLayer;
pub use rate_limit::RateLimitLayer;
