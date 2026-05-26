//! AI Assistant integration for Rust-Red.
//!
//! Provides context-aware AI assistance that can interact with different LLM
//! backends (local WASM, OpenAI-compatible APIs like Ollama/LM Studio, and
//! Anthropic Claude) to help users build, debug, and understand their flows.
//!
//! # Feature Flag
//!
//! This module is gated behind the `ai` feature flag.
//!
//! # Architecture
//!
//! - [`config`] - Configuration structs loaded from `[ai]` in `rust-red.toml`
//! - [`provider`] - [`AiProvider`] trait and concrete implementations
//! - [`context`] - Flow context builder that gathers runtime information

pub mod config;
pub mod context;
pub mod provider;

pub use config::AiConfig;
pub use context::FlowContextBuilder;
pub use provider::AiProvider;
