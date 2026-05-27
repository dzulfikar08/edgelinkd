use std::process;
use std::sync::Arc;

// 3rd-party libs
use clap::Parser;

use rust_red_core::*;

include!(concat!(env!("OUT_DIR"), "/__use_node_plugins.rs"));

mod app;
mod cliargs;
mod commands;
mod config;
mod consts;
mod defaults;
mod env;
mod flows;
mod logging;
mod registry;
mod runner;

pub use cliargs::*;

#[tokio::main]
async fn main() -> Result<()> {
    let args = Arc::new(CliArgs::parse());

    // Handle --generate-completions and exit early
    if args.maybe_generate_completions() {
        return Ok(());
    }

    if let Err(ref err) = runner::run_app(args).await {
        log::error!("Application error: {err}");
        process::exit(-1);
    }
    Ok(())
}
