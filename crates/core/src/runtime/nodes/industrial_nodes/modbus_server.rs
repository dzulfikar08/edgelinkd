use std::sync::Arc;

use async_trait::async_trait;
use serde::Deserialize;
use tokio::sync::Mutex;
use tokio_modbus::prelude::*;
use tokio_modbus::server::tcp::Server;
use tokio_modbus::server::Service;
use tokio_util::sync::CancellationToken;

use crate::runtime::engine::Engine;
use crate::runtime::model::*;
use crate::runtime::nodes::*;
use rust_red_macro::*;

#[derive(Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
struct ModbusServerConfig {
    #[serde(default = "default_host")]
    host: String,
    #[serde(default = "default_port")]
    port: u16,
    #[serde(default = "default_coil_count")]
    coil_count: u16,
    #[serde(default = "default_register_count")]
    register_count: u16,
}

fn default_host() -> String { "127.0.0.1".to_string() }
fn default_port() -> u16 { 5020 }
fn default_coil_count() -> u16 { 100 }
fn default_register_count() -> u16 { 100 }

/// In-process Modbus simulator.
///
/// Uses `std::sync::Mutex` instead of `tokio::sync::Mutex` because the
/// `Service::call()` trait method is synchronous (returns `Ready<_>`).
/// This avoids the `try_lock` / `ServerDeviceBusy` problem — `std::sync::Mutex`
/// blocks the calling thread briefly but never fails to acquire.
/// Contention is minimal since each lock is held only for a short array slice.
#[derive(Debug, Clone)]
struct ModbusSimulator {
    coils: Arc<std::sync::Mutex<Vec<bool>>>,
    registers: Arc<std::sync::Mutex<Vec<u16>>>,
}

impl Service for ModbusSimulator {
    type Request = Request<'static>;
    type Response = Response;
    type Exception = ExceptionCode;
    type Future = std::future::Ready<Result<Self::Response, Self::Exception>>;

    fn call(&self, req: Self::Request) -> Self::Future {
        let result = match req {
            Request::ReadCoils(addr, cnt) => {
                let c = self.coils.lock().unwrap();
                let end = (addr as usize).saturating_add(cnt as usize);
                if end > c.len() {
                    return std::future::ready(Err(ExceptionCode::IllegalDataAddress));
                }
                Response::ReadCoils(c[addr as usize..end].to_vec())
            }
            Request::ReadDiscreteInputs(addr, cnt) => {
                let c = self.coils.lock().unwrap();
                let end = (addr as usize).saturating_add(cnt as usize);
                if end > c.len() {
                    return std::future::ready(Err(ExceptionCode::IllegalDataAddress));
                }
                Response::ReadDiscreteInputs(c[addr as usize..end].to_vec())
            }
            Request::ReadHoldingRegisters(addr, cnt) => {
                let r = self.registers.lock().unwrap();
                let end = (addr as usize).saturating_add(cnt as usize);
                if end > r.len() {
                    return std::future::ready(Err(ExceptionCode::IllegalDataAddress));
                }
                Response::ReadHoldingRegisters(r[addr as usize..end].to_vec())
            }
            Request::ReadInputRegisters(addr, cnt) => {
                let r = self.registers.lock().unwrap();
                let end = (addr as usize).saturating_add(cnt as usize);
                if end > r.len() {
                    return std::future::ready(Err(ExceptionCode::IllegalDataAddress));
                }
                Response::ReadInputRegisters(r[addr as usize..end].to_vec())
            }
            Request::WriteSingleCoil(addr, val) => {
                let mut c = self.coils.lock().unwrap();
                if (addr as usize) >= c.len() {
                    return std::future::ready(Err(ExceptionCode::IllegalDataAddress));
                }
                c[addr as usize] = val;
                Response::WriteSingleCoil(addr, val)
            }
            Request::WriteSingleRegister(addr, val) => {
                let mut r = self.registers.lock().unwrap();
                if (addr as usize) >= r.len() {
                    return std::future::ready(Err(ExceptionCode::IllegalDataAddress));
                }
                r[addr as usize] = val;
                Response::WriteSingleRegister(addr, val)
            }
            Request::WriteMultipleCoils(addr, bits) => {
                let mut c = self.coils.lock().unwrap();
                let end = (addr as usize).saturating_add(bits.len());
                if end > c.len() {
                    return std::future::ready(Err(ExceptionCode::IllegalDataAddress));
                }
                for (i, &bit) in bits.iter().enumerate() {
                    c[addr as usize + i] = bit;
                }
                Response::WriteMultipleCoils(addr, bits.len() as u16)
            }
            Request::WriteMultipleRegisters(addr, words) => {
                let mut r = self.registers.lock().unwrap();
                let end = (addr as usize).saturating_add(words.len());
                if end > r.len() {
                    return std::future::ready(Err(ExceptionCode::IllegalDataAddress));
                }
                for (i, &word) in words.iter().enumerate() {
                    r[addr as usize + i] = word;
                }
                Response::WriteMultipleRegisters(addr, words.len() as u16)
            }
            _ => return std::future::ready(Err(ExceptionCode::IllegalFunction)),
        };
        std::future::ready(Ok(result))
    }
}

#[derive(Debug)]
#[global_node("modbus-server", red_name = "modbus-server", module = "node-red")]
pub(crate) struct ModbusServerNode {
    base: BaseGlobalNodeState,
    coils: Arc<std::sync::Mutex<Vec<bool>>>,
    registers: Arc<std::sync::Mutex<Vec<u16>>>,
    cancel: CancellationToken,
}

impl Drop for ModbusServerNode {
    fn drop(&mut self) {
        self.cancel.cancel();
    }
}

impl ModbusServerNode {
    pub fn build(
        engine: &Engine,
        config: &RedGlobalNodeConfig,
        _options: Option<&config::Config>,
    ) -> crate::Result<Box<dyn GlobalNodeBehavior>> {
        let server_config = ModbusServerConfig::deserialize(&config.rest)?;
        let coils = Arc::new(std::sync::Mutex::new(vec![false; server_config.coil_count as usize]));
        let registers = Arc::new(std::sync::Mutex::new(vec![0u16; server_config.register_count as usize]));
        let cancel = CancellationToken::new();
        let state = BaseGlobalNodeState {
            id: config.id,
            name: config.name.clone(),
            type_str: "modbus-server",
            ordering: config.ordering,
            context: engine.get_context_manager().new_context(engine.context(), config.id.to_string()),
            disabled: config.disabled,
        };

        if !config.disabled {
            let host = server_config.host.clone();
            let port = server_config.port;
            let name = config.name.clone();
            let coils = coils.clone();
            let registers = registers.clone();
            let cancel = cancel.clone();

            // Use Handle::current() to safely spawn from sync context
            let handle = tokio::runtime::Handle::current();
            handle.spawn(async move {
                let addr = format!("{}:{}", host, port);
                let socket_addr: std::net::SocketAddr = match addr.parse() {
                    Ok(a) => a,
                    Err(e) => {
                        log::error!("[modbus-server:{}] Invalid address {}: {}", name, addr, e);
                        return;
                    }
                };

                let listener = match tokio::net::TcpListener::bind(socket_addr).await {
                    Ok(l) => l,
                    Err(e) => {
                        log::error!("[modbus-server:{}] Failed to bind {}: {}", name, addr, e);
                        return;
                    }
                };

                log::info!("[modbus-server:{}] Listening on {}", name, addr);

                let server = Server::new(listener);
                let on_connected = |stream, socket_addr| {
                    let coils = coils.clone();
                    let registers = registers.clone();
                    async move {
                        tokio_modbus::server::tcp::accept_tcp_connection(stream, socket_addr, move |_addr| {
                            Ok(Some(ModbusSimulator { coils: coils.clone(), registers: registers.clone() }))
                        })
                    }
                };

                let name_clone = name.clone();
                let serve = server.serve_until(
                    &on_connected,
                    move |err| {
                        log::warn!("[modbus-server:{}] Connection error: {}", name_clone, err);
                    },
                    cancel.cancelled_owned(),
                );

                let _ = serve.await;

                log::info!("[modbus-server:{}] Stopped", name);
            });
        }

        Ok(Box::new(ModbusServerNode {
            base: state,
            coils,
            registers,
            cancel,
        }))
    }
}

#[async_trait]
impl GlobalNodeBehavior for ModbusServerNode {
    fn get_base(&self) -> &BaseGlobalNodeState {
        &self.base
    }
}
