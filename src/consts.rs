pub const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const GIT_HASH: &str = env!("RUST_RED_BUILD_GIT_HASH");

#[allow(dead_code)]
pub const BUILD_TIME: &str = env!("RUST_RED_BUILD_TIME");

pub const DEFAULT_HOME_DIR_NAME: &str = ".rust-red";
