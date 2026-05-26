//! Rust-Red WASM Guest SDK (no_std)
//!
//! This crate provides the building blocks for writing WASM node plugins:
//! - `export_node!` macro — generates the required WASM exports
//! - `WasmNodeHandler` trait — implement this for your plugin
//! - Helper functions: `send()`, `set_status()`, `log()`

#![no_std]

extern crate alloc;

pub mod types;

pub use types::{ProcessResult, WasmMessage, WasmNodeInfo, WasmValue};

// Re-export postcard for macro usage
pub extern crate postcard;

use alloc::vec::Vec;

// ---------------------------------------------------------------------------
// Panic handler — required for no_std on wasm32-unknown-unknown
// ---------------------------------------------------------------------------

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

// ---------------------------------------------------------------------------
// Global allocator — bump allocator using wasm memory_grow
// ---------------------------------------------------------------------------

/// Heap pointer for the global allocator. Starts after 64KB (1 page) of stack/data.
static mut ALLOC_HEAP_PTR: usize = 65536;

struct WasmBumpAllocator;

unsafe impl core::alloc::GlobalAlloc for WasmBumpAllocator {
    unsafe fn alloc(&self, layout: core::alloc::Layout) -> *mut u8 {
        let align = layout.align();
        let size = layout.size();
        if size == 0 {
            return align as *mut u8;
        }

        let current = ALLOC_HEAP_PTR;
        let aligned = (current + align - 1) & !(align - 1);
        let new_ptr = aligned + size;

        // Ensure enough WASM memory pages
        let needed_pages = (new_ptr + 65535) / 65536;
        let current_pages = core::arch::wasm32::memory_size(0);
        if needed_pages > current_pages {
            let extra = needed_pages - current_pages;
            if core::arch::wasm32::memory_grow::<0>(extra) == usize::MAX {
                return core::ptr::null_mut();
            }
        }

        ALLOC_HEAP_PTR = new_ptr;
        aligned as *mut u8
    }

    unsafe fn dealloc(&self, _ptr: *mut u8, _layout: core::alloc::Layout) {
        // Bump allocator — no deallocation
    }
}

#[global_allocator]
static GLOBAL_ALLOC: WasmBumpAllocator = WasmBumpAllocator;

// ---------------------------------------------------------------------------
// Host imports — extern "C" declarations for functions provided by the host
// ---------------------------------------------------------------------------

extern "C" {
    /// Log a message at the given level (0=error, 1=warn, 2=info, 3=debug, 4=trace).
    fn host_log(level: u32, msg_ptr: u32, msg_len: u32);

    /// Send a message to the given output port.
    fn host_send_msg(port: u32, msg_ptr: u32, msg_len: u32);

    /// Set node status (fill color, shape, text).
    fn host_set_status(fill: u32, shape: u32, text_ptr: u32, text_len: u32);

    /// Sleep for the given number of milliseconds (async in host).
    fn host_sleep_ms(ms: u64);

    /// Report an error to the host.
    fn host_report_error(msg_ptr: u32, msg_len: u32);
}

// ---------------------------------------------------------------------------
// Memory helpers (guest side)
// ---------------------------------------------------------------------------

/// Bump pointer for host-visible memory region.
/// Starts right after the GlobalAlloc region.
static mut HEAP_PTR: u32 = 0;

/// Ensure WASM memory has at least `needed` bytes total.
unsafe fn ensure_memory(needed: u32) -> bool {
    let needed_pages = ((needed as usize) + 65535) / 65536;
    let current_pages = core::arch::wasm32::memory_size(0);
    if needed_pages > current_pages {
        let extra = needed_pages - current_pages;
        core::arch::wasm32::memory_grow::<0>(extra) != usize::MAX
    } else {
        true
    }
}

/// Initialize HEAP_PTR on first use to skip past GlobalAlloc region.
unsafe fn init_heap_ptr() -> u32 {
    if HEAP_PTR == 0 {
        // Start after 128KB, leaving room for GlobalAlloc
        HEAP_PTR = 131_072;
    }
    HEAP_PTR
}

/// Allocate `size` bytes in guest linear memory. Returns a pointer.
#[no_mangle]
pub extern "C" fn rust_red_alloc(size: u32) -> u32 {
    unsafe {
        let ptr = init_heap_ptr();
        let aligned = (size + 7) & !7;
        let new_heap = ptr + aligned;

        if !ensure_memory(new_heap) {
            return 0;
        }

        HEAP_PTR = new_heap;
        ptr
    }
}

/// Read bytes from guest linear memory at the given pointer.
#[inline]
pub fn read_from_host(ptr: u32, len: u32) -> Vec<u8> {
    unsafe {
        let slice = core::slice::from_raw_parts(ptr as *const u8, len as usize);
        slice.to_vec()
    }
}

/// Write bytes to guest linear memory, returns the pointer.
pub fn write_to_host(data: &[u8]) -> u32 {
    unsafe {
        let ptr = init_heap_ptr();
        let aligned = ((data.len() as u32) + 7) & !7;
        let new_heap = ptr + aligned;

        if !ensure_memory(new_heap) {
            return 0;
        }

        core::ptr::copy_nonoverlapping(data.as_ptr(), ptr as *mut u8, data.len());
        HEAP_PTR = new_heap;
        ptr
    }
}

// ---------------------------------------------------------------------------
// Result length tracking (for host to know how much to read back)
// ---------------------------------------------------------------------------

#[doc(hidden)]
pub static mut LAST_RESULT_LEN: u32 = 0;

#[no_mangle]
pub extern "C" fn rust_red_result_len() -> u32 {
    unsafe { LAST_RESULT_LEN }
}

// ---------------------------------------------------------------------------
// Helper functions for plugin authors
// ---------------------------------------------------------------------------

/// Send a message to an output port (from within `process()`).
pub fn send(port: u32, msg: &WasmMessage) {
    let bytes = postcard::to_allocvec(msg).unwrap_or_default();
    unsafe {
        host_send_msg(port, bytes.as_ptr() as u32, bytes.len() as u32);
    }
}

/// Set node status indicator.
pub fn set_status(fill: &str, shape: &str, text: &str) {
    let fill_code = match fill {
        "red" => 0,
        "green" => 1,
        "yellow" => 2,
        "grey" => 3,
        "blue" => 4,
        _ => 3,
    };
    let shape_code = match shape {
        "ring" => 0,
        "dot" => 1,
        _ => 1,
    };
    unsafe {
        host_set_status(fill_code, shape_code, text.as_ptr() as u32, text.len() as u32);
    }
}

/// Log a message from the plugin.
pub fn log(level: &str, msg: &str) {
    let level_code = match level {
        "error" => 0,
        "warn" => 1,
        "info" => 2,
        "debug" => 3,
        "trace" => 4,
        _ => 2,
    };
    unsafe {
        host_log(level_code, msg.as_ptr() as u32, msg.len() as u32);
    }
}

/// Report an error to the host.
pub fn report_error(msg: &str) {
    unsafe {
        host_report_error(msg.as_ptr() as u32, msg.len() as u32);
    }
}

// ---------------------------------------------------------------------------
// WasmNodeHandler trait
// ---------------------------------------------------------------------------

/// Trait that WASM plugin authors implement.
pub trait WasmNodeHandler: Default + 'static {
    /// Return node metadata (type, ports, etc.).
    fn info() -> WasmNodeInfo;

    /// Called when the node starts. Optional.
    fn on_start(_config: WasmMessage) {}

    /// Process an incoming message, return the output.
    fn process(msg: WasmMessage) -> ProcessResult;

    /// Called when the node stops. Optional.
    fn on_stop() {}
}

// ---------------------------------------------------------------------------
// export_node! macro
// ---------------------------------------------------------------------------

/// Main entry point macro — generates all the required WASM exports.
///
/// Generates:
/// - `rust_red_node_info() -> u32`
/// - `rust_red_on_start(config_ptr, config_len) -> u32`
/// - `rust_red_process_msg(msg_ptr, msg_len) -> u32`
/// - `rust_red_on_stop() -> u32`
#[macro_export]
macro_rules! export_node {
    ($handler:ty) => {
        static mut NODE_STATE: Option<$handler> = None;

        #[no_mangle]
        pub extern "C" fn rust_red_node_info() -> u32 {
            let info = <$handler>::info();
            let bytes = $crate::postcard::to_allocvec(&info).unwrap_or_default();
            let len = bytes.len() as u32;
            let ptr = $crate::write_to_host(&bytes);
            unsafe {
                $crate::LAST_RESULT_LEN = len;
            }
            ptr
        }

        #[no_mangle]
        pub extern "C" fn rust_red_on_start(config_ptr: u32, config_len: u32) -> u32 {
            let config_bytes = $crate::read_from_host(config_ptr, config_len);
            let config: $crate::WasmMessage = match $crate::postcard::from_bytes(&config_bytes) {
                Ok(v) => v,
                Err(_) => $crate::WasmMessage {
                    msg_id: alloc::string::String::new(),
                    payload: $crate::WasmValue::Null,
                    topic: core::option::Option::None,
                    extra: alloc::collections::BTreeMap::new(),
                },
            };
            unsafe {
                NODE_STATE = Some(<$handler>::default());
            }
            <$handler>::on_start(config);
            0
        }

        #[no_mangle]
        pub extern "C" fn rust_red_process_msg(msg_ptr: u32, msg_len: u32) -> u32 {
            let msg_bytes = $crate::read_from_host(msg_ptr, msg_len);
            let msg: $crate::WasmMessage = match $crate::postcard::from_bytes(&msg_bytes) {
                Ok(m) => m,
                Err(_) => {
                    return 0;
                }
            };
            let result = <$handler>::process(msg);
            let result_bytes = $crate::postcard::to_allocvec(&result).unwrap_or_default();
            let len = result_bytes.len() as u32;
            let ptr = $crate::write_to_host(&result_bytes);
            unsafe {
                $crate::LAST_RESULT_LEN = len;
            }
            ptr
        }

        #[no_mangle]
        pub extern "C" fn rust_red_on_stop() -> u32 {
            <$handler>::on_stop();
            unsafe {
                NODE_STATE = core::option::Option::None;
            }
            0
        }
    };
}
