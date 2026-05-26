use axum::{http::StatusCode, response::Json};
use serde_json::Value;

/// Health check endpoint
pub async fn health_check() -> Result<Json<Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "status": "healthy",
        "service": "rust-red-web",
        "version": env!("CARGO_PKG_VERSION"),
    })))
}

/// Get API information
pub async fn api_info() -> Result<Json<Value>, StatusCode> {
    Ok(Json(serde_json::json!({
        "name": "Rust-Red Web API",
        "version": env!("CARGO_PKG_VERSION"),
        "description": "Node-RED compatible API for Rust-Red",
        "endpoints": {
            "admin": {
                "flows": "/api/admin/flows",
                "nodes": "/api/admin/nodes",
                "settings": "/api/admin/settings"
            },
            "editor": {
                "icons": "/api/editor/icons"
            }
        }
    })))
}
