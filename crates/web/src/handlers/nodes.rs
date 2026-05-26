use crate::handlers::WebState;
use std::sync::Arc;
// use crate::handlers::utils::get_static_dir;
use axum::{
    Extension,
    extract::{Path, Query},
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Json},
};
use rust_red_core::runtime::paths;
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone)]
struct NodeInfo {
    name: String,
    module: String,
    version: String,
    local: bool,
    user: bool,
    types: Vec<String>,
}
type GroupedNodes = HashMap<String, NodeInfo>;

// nodes/plugins related handler
// ...existing code...

/// Get all nodes
pub async fn get_nodes(
    Extension(state): Extension<Arc<WebState>>,
    headers: HeaderMap,
) -> Result<axum::response::Response, StatusCode> {
    // Check Accept header to determine response format
    let accept_header = headers.get("accept").and_then(|h| h.to_str().ok()).unwrap_or("application/json");

    if accept_header.contains("text/html") {
        // Return HTML config for all nodes, including custom Rust nodes from registry
        let registry_guard = state.registry.read().await;
        let html_content = generate_nodes_html_with_registry(registry_guard.as_ref()).await;
        Ok(Html(html_content).into_response())
    } else {
        // Return node list in JSON format - based on actual node registry
        let registry_guard = state.registry.read().await;
        if let Some(registry) = registry_guard.as_ref() {
            // Use actual node registry
            let mut grouped_nodes: GroupedNodes = GroupedNodes::new();

            for (_, meta_node) in registry.all().iter() {
                let entry = grouped_nodes.entry(meta_node.red_id.to_string()).or_insert_with(|| NodeInfo {
                    name: meta_node.red_name.to_string(),
                    module: meta_node.module.to_string(),
                    version: meta_node.version.to_string(),
                    local: meta_node.local,
                    user: meta_node.user,
                    types: Vec::new(),
                });
                entry.types.push(meta_node.type_.to_string());
            }

            let flat_nodes: Vec<_> = grouped_nodes
                .into_iter()
                .map(|(red_id, node_info)| {
                    serde_json::json!({
                        "id": red_id,
                        "name": node_info.name,
                        "types": node_info.types,
                        "enabled": true,
                        "local": node_info.local,
                        "user": node_info.user,
                        "module": node_info.module,
                        "version": node_info.version
                    })
                })
                .collect();

            Ok(Json(serde_json::Value::Array(flat_nodes)).into_response())
        } else {
            Err(StatusCode::NOT_FOUND)
        }
    }
}

/// Generate HTML config for all nodes
pub async fn generate_nodes_html_with_registry(registry: Option<&rust_red_core::runtime::registry::RegistryHandle>) -> String {
    // Dynamically generate node HTML at runtime - read and merge all HTML files under Node-RED node directory
    let node_red_nodes_dir = paths::ui_static_dir().join("nodes");

    let mut html_content = String::new();

    if node_red_nodes_dir.exists() {
        // Handle core nodes
        let core_dir = node_red_nodes_dir.join("core");
        if core_dir.exists() {
            process_node_directory_runtime(&core_dir, &mut html_content).await;
        }

        // Handle example nodes (if any)
        let examples_dir = node_red_nodes_dir.join("examples");
        if examples_dir.exists() {
            process_node_directory_runtime(&examples_dir, &mut html_content).await;
        }
    }

    // Generate editor definitions for custom Rust nodes not covered by static HTML
    if let Some(reg) = registry {
        html_content.push_str(&generate_custom_nodes_html(reg));
    }

    if html_content.is_empty() {
        return get_fallback_nodes_html();
    }

    html_content
}

/// Custom node types that lack static HTML files and need auto-generated templates
const CUSTOM_NODE_TYPES: &[&str] = &[
    "modbus-config", "modbus read", "modbus write",
    "modbus-flex-getter", "modbus-flex-writer", "modbus-server",
    "opcua-config", "opcua read", "opcua write",
    "bacnet-config", "bacnet read", "bacnet write",
];

fn is_custom_node(module: &str, type_: &str) -> bool {
    if module != "node-red" {
        return true;
    }
    CUSTOM_NODE_TYPES.contains(&type_)
}

/// Generate HTML templates and RED.nodes.registerType() calls for custom nodes from the Rust registry
fn generate_custom_nodes_html(registry: &rust_red_core::runtime::registry::RegistryHandle) -> String {
    use rust_red_core::runtime::nodes::NodeKind;

    let mut output = String::new();

    for (_, meta) in registry.all().iter() {
        if !is_custom_node(meta.module, meta.type_) {
            continue;
        }

        let node_type = meta.type_;
        let is_global = matches!(meta.kind, NodeKind::Global);

        // Generate HTML edit form template
        let template_html = get_node_template_html(node_type, is_global);
        output.push_str(&format!(
            "\n<script type=\"text/html\" data-template-name=\"{node_type}\">\n{template_html}</script>\n"
        ));
    }

    // Generate JS registration block
    output.push_str("\n<script type=\"text/javascript\">\n(function() {\n");

    for (_, meta) in registry.all().iter() {
        if !is_custom_node(meta.module, meta.type_) {
            continue;
        }

        let node_type = meta.type_;
        let red_name = meta.red_name;
        let is_global = matches!(meta.kind, NodeKind::Global);

        let (category, color, inputs, outputs, icon, defaults, align) = get_node_editor_config(node_type, is_global);

        output.push_str(&format!(
            "    RED.nodes.registerType('{node_type}', {{\n\
             \x20       category: '{category}',\n\
             \x20       color: '{color}',\n\
             \x20       defaults: {{\n{defaults}\
             \x20       }},\n\
             \x20       inputs: {inputs},\n\
             \x20       outputs: {outputs},\n\
             \x20       icon: \"{icon}\",\n\
             \x20       align: \"{align}\",\n\
             \x20       label: function() {{ return this.name || \"{red_name}\"; }},\n\
             \x20       oneditprepare: function() {{}},\n\
             \x20       oneditsave: function() {{}}\n\
             \x20   }});\n\n",
        ));
    }

    output.push_str("})();\n</script>\n");
    output
}

/// Generate the <script type="text/html" data-template-name> form HTML for a node type
fn get_node_template_html(type_name: &str, is_global: bool) -> String {
    if is_global {
        get_global_node_template_html(type_name)
    } else {
        get_flow_node_template_html(type_name)
    }
}

fn form_row(icon: &str, label: &str, input_id: &str, placeholder: &str) -> String {
    format!(
        "    <div class=\"form-row\">\n\
         \x20       <label for=\"{input_id}\"><i class=\"fa fa-{icon}\"></i> {label}</label>\n\
         \x20       <input type=\"text\" id=\"{input_id}\" placeholder=\"{placeholder}\">\n\
         \x20   </div>\n"
    )
}

fn form_row_password(icon: &str, label: &str, input_id: &str) -> String {
    format!(
        "    <div class=\"form-row\">\n\
         \x20       <label for=\"{input_id}\"><i class=\"fa fa-{icon}\"></i> {label}</label>\n\
         \x20       <input type=\"password\" id=\"{input_id}\" placeholder=\"\">\n\
         \x20   </div>\n"
    )
}

fn form_row_number(icon: &str, label: &str, input_id: &str, placeholder: &str) -> String {
    format!(
        "    <div class=\"form-row\">\n\
         \x20       <label for=\"{input_id}\"><i class=\"fa fa-{icon}\"></i> {label}</label>\n\
         \x20       <input type=\"number\" id=\"{input_id}\" placeholder=\"{placeholder}\" style=\"width:100px;\">\n\
         \x20   </div>\n"
    )
}

fn form_row_textarea(icon: &str, label: &str, input_id: &str, placeholder: &str) -> String {
    format!(
        "    <div class=\"form-row\">\n\
         \x20       <label for=\"{input_id}\"><i class=\"fa fa-{icon}\"></i> {label}</label>\n\
         \x20       <textarea id=\"{input_id}\" rows=\"6\" placeholder=\"{placeholder}\" style=\"width:100%;\"></textarea>\n\
         \x20   </div>\n"
    )
}

fn form_row_config_node(_config_type: &str, label: &str) -> String {
    format!(
        "    <div class=\"form-row\">\n\
         \x20       <label for=\"node-input-config_node\"><i class=\"fa fa-database\"></i> {label}</label>\n\
         \x20       <input type=\"text\" id=\"node-input-config_node\" style=\"width:60%\">\n\
         \x20   </div>\n"
    )
}

fn name_row() -> String {
    form_row("tag", "Name", "node-input-name", "")
}

fn get_flow_node_template_html(type_name: &str) -> String {
    let mut html = String::new();

    match type_name {
        "postgres-query" | "sqlite-query" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row_textarea("file-code-o", "Query", "node-input-query", "SELECT * FROM table"));
            html.push_str(&form_row_number("clock-o", "Timeout (ms)", "node-input-timeout_ms", "30000"));
            html.push_str(&form_row("cog", "Output Mode", "node-input-output_mode", "rows"));
        }
        "timescaledb-query" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row_textarea("file-code-o", "Query", "node-input-query", "SELECT * FROM table"));
            html.push_str(&form_row_number("clock-o", "Timeout (ms)", "node-input-timeout_ms", "30000"));
        }
        "mssql-query" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row_textarea("file-code-o", "Query", "node-input-query", "SELECT * FROM table"));
            html.push_str(&form_row_number("clock-o", "Timeout (ms)", "node-input-timeout_ms", "30000"));
        }
        "influxdb-in" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row("edit", "Measurement", "node-input-measurement", "measurement"));
            html.push_str(&form_row("tags", "Tags (JSON)", "node-input-tag_columns", "{\"host\":\"server1\"}"));
            html.push_str(&form_row("list", "Fields (JSON)", "node-input-field_columns", "{\"value\":42}"));
            html.push_str(&form_row("clock-o", "Timestamp column", "node-input-timestamp_column", "time"));
        }
        "influxdb-out" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row_textarea("file-code-o", "Query", "node-input-query", "from(bucket: \"...\")"));
            html.push_str(&form_row_number("clock-o", "Timeout (ms)", "node-input-timeout_ms", "30000"));
        }
        "modbus read" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row("cog", "Function Code", "node-input-functionCode", "readHoldingRegisters"));
            html.push_str(&form_row_number("map-marker", "Address", "node-input-address", "0"));
            html.push_str(&form_row_number("bars", "Quantity", "node-input-quantity", "1"));
            html.push_str(&form_row("cog", "Data Type", "node-input-dataType", "uint16"));
            html.push_str(&form_row_number("clock", "Poll Interval (ms)", "node-input-pollIntervalMs", "5000"));
        }
        "modbus write" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row("cog", "Function Code", "node-input-functionCode", "writeSingleRegister"));
            html.push_str(&form_row_number("map-marker", "Address", "node-input-address", "0"));
            html.push_str(&form_row("cog", "Data Type", "node-input-dataType", "uint16"));
        }
        "modbus-flex-getter" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row("cog", "Data Type", "node-input-dataType", "uint16"));
        }
        "modbus-flex-writer" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row("cog", "Data Type", "node-input-dataType", "uint16"));
        }
        "opcua read" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row("crosshairs", "Node ID", "node-input-node_id", "ns=2;s=Temperature"));
        }
        "opcua write" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row("crosshairs", "Node ID", "node-input-node_id", "ns=2;s=Setpoint"));
        }
        "bacnet read" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row_number("map-marker", "Address", "node-input-address", "0"));
            html.push_str(&form_row_number("bars", "Quantity", "node-input-quantity", "1"));
        }
        "bacnet write" => {
            html.push_str(&name_row());
            html.push_str(&form_row_config_node(type_name, "Server"));
            html.push_str(&form_row_number("map-marker", "Address", "node-input-address", "0"));
        }
        _ => {
            // Generic template with just name
            html.push_str(&name_row());
        }
    }

    html
}

fn get_global_node_template_html(type_name: &str) -> String {
    let mut html = String::new();

    match type_name {
        "postgres-config" | "timescaledb-config" => {
            html.push_str(&name_row());
            html.push_str(&form_row("server", "Host", "node-input-host", "localhost"));
            html.push_str(&form_row_number("cog", "Port", "node-input-port", "5432"));
            html.push_str(&form_row("database", "Database", "node-input-dbname", "mydb"));
            html.push_str(&form_row("user", "User", "node-input-user", "postgres"));
            html.push_str(&form_row_password("lock", "Password", "node-input-password"));
            html.push_str(&form_row_number("cog", "Pool Size", "node-input-poolMaxSize", "10"));
            html.push_str(&form_row_number("clock", "Connect Timeout (ms)", "node-input-connectTimeoutMs", "5000"));
        }
        "sqlite-config" => {
            html.push_str(&name_row());
            html.push_str(&form_row("file", "Database path", "node-input-path", "data.db"));
        }
        "mssql-config" => {
            html.push_str(&name_row());
            html.push_str(&form_row("server", "Host", "node-input-host", "localhost"));
            html.push_str(&form_row_number("cog", "Port", "node-input-port", "1433"));
            html.push_str(&form_row("database", "Database", "node-input-database", "mydb"));
            html.push_str(&form_row("user", "User", "node-input-user", "sa"));
            html.push_str(&form_row_password("lock", "Password", "node-input-password"));
        }
        "influxdb-config" => {
            html.push_str(&name_row());
            html.push_str(&form_row("globe", "URL", "node-input-url", "http://localhost:8086"));
            html.push_str(&form_row_password("key", "Token", "node-input-token"));
            html.push_str(&form_row("cog", "Organization", "node-input-org", "my-org"));
            html.push_str(&form_row("database", "Bucket", "node-input-bucket", "my-bucket"));
        }
        "modbus-config" => {
            html.push_str(&name_row());
            html.push_str(&form_row("server", "Host", "node-input-host", "localhost"));
            html.push_str(&form_row_number("cog", "Port", "node-input-port", "502"));
            html.push_str(&form_row("exchange", "Transport", "node-input-transport", "tcp"));
            html.push_str(&form_row_number("cog", "Unit ID", "node-input-unitId", "1"));
            html.push_str(&form_row_number("clock", "Timeout (ms)", "node-input-timeoutMs", "5000"));
        }
        "modbus-server" => {
            html.push_str(&name_row());
            html.push_str(&form_row("server", "Host", "node-input-host", "127.0.0.1"));
            html.push_str(&form_row_number("cog", "Port", "node-input-port", "5020"));
            html.push_str(&form_row_number("bars", "Coil Count", "node-input-coilCount", "100"));
            html.push_str(&form_row_number("bars", "Register Count", "node-input-registerCount", "100"));
        }
        "opcua-config" => {
            html.push_str(&name_row());
            html.push_str(&form_row("globe", "Endpoint", "node-input-endpoint", "opc.tcp://localhost:4840"));
        }
        "bacnet-config" => {
            html.push_str(&name_row());
            html.push_str(&form_row_number("cog", "Device ID", "node-input-device_id", "0"));
            html.push_str(&form_row("server", "Target Host", "node-input-target_host", ""));
            html.push_str(&form_row_number("cog", "Target Port", "node-input-target_port", "47808"));
        }
        _ => {
            // Generic config template
            html.push_str(&name_row());
        }
    }

    html
}

/// Get full editor config for a node type: (category, color, inputs, outputs, icon, defaults_js, align)
fn get_node_editor_config(type_name: &str, is_global: bool) -> (&'static str, &'static str, usize, usize, &'static str, String, &'static str) {
    if is_global {
        let defaults = get_global_node_defaults(type_name);
        return ("config", "#C0DEED", 0, 0, "cog.svg", defaults, "");
    }

    let (cat, color, icon) = categorize_node_v2(type_name);
    let defaults = get_flow_node_defaults(type_name);
    (cat, color, 1, 1, icon, defaults, "left")
}

fn categorize_node_v2(type_name: &str) -> (&'static str, &'static str, &'static str) {
    match type_name {
        t if t.contains("mqtt") => ("network", "#c1975b", "bridge.svg"),
        t if t.contains("postgres") || t.contains("timescale") => ("storage", "#e2d96e", "db.svg"),
        t if t.contains("mssql") || t.contains("sqlite") => ("storage", "#e2d96e", "db.svg"),
        t if t.contains("influxdb") => ("storage", "#dbc08e", "db.svg"),
        t if t.contains("modbus") => ("modbus", "#E9967A", "serial.svg"),
        t if t.contains("opcua") => ("storage", "#c1975b", "serial.svg"),
        t if t.contains("bacnet") => ("storage", "#c1975b", "serial.svg"),
        _ => ("function", "#a6bbcf", "function.svg"),
    }
}

fn get_flow_node_defaults(type_name: &str) -> String {
    let mut d = String::from("            name: {value:\"\"},\n");

    // Map each flow node type to its config node type for the dropdown picker
    let config_type = match type_name {
        "postgres-query" => Some("postgres-config"),
        "sqlite-query" => Some("sqlite-config"),
        "mssql-query" => Some("mssql-config"),
        "timescaledb-query" => Some("timescaledb-config"),
        "influxdb-in" | "influxdb-out" => Some("influxdb-config"),
        "modbus read" | "modbus write" | "modbus-flex-getter" | "modbus-flex-writer" => Some("modbus-config"),
        "opcua read" | "opcua write" => Some("opcua-config"),
        "bacnet read" | "bacnet write" => Some("bacnet-config"),
        _ => None,
    };

    if let Some(ct) = config_type {
        d.push_str(&format!(
            "            config_node: {{value:\"\", type:\"{ct}\", required: true}},\n"
        ));
    }

    match type_name {
        "postgres-query" | "mssql-query" | "sqlite-query" => {
            d.push_str("            query: {value:\"\", required: true},\n");
            d.push_str("            timeout_ms: {value:30000},\n");
            d.push_str("            output_mode: {value:\"rows\"},\n");
        }
        "timescaledb-query" => {
            d.push_str("            query: {value:\"\", required: true},\n");
            d.push_str("            timeout_ms: {value:30000},\n");
        }
        "influxdb-in" => {
            d.push_str("            measurement: {value:\"\"},\n");
            d.push_str("            tag_columns: {value:[]},\n");
            d.push_str("            field_columns: {value:[]},\n");
            d.push_str("            timestamp_column: {value:\"\"},\n");
        }
        "influxdb-out" => {
            d.push_str("            query: {value:\"\", required: true},\n");
            d.push_str("            timeout_ms: {value:30000},\n");
        }
        "modbus read" => {
            d.push_str("            functionCode: {value:\"readHoldingRegisters\"},\n");
            d.push_str("            address: {value:0},\n");
            d.push_str("            quantity: {value:1},\n");
            d.push_str("            dataType: {value:\"uint16\"},\n");
            d.push_str("            pollIntervalMs: {value:5000},\n");
        }
        "bacnet read" => {
            d.push_str("            address: {value:0},\n");
            d.push_str("            quantity: {value:1},\n");
        }
        "modbus write" => {
            d.push_str("            functionCode: {value:\"writeSingleRegister\"},\n");
            d.push_str("            address: {value:0},\n");
            d.push_str("            dataType: {value:\"uint16\"},\n");
        }
        "modbus-flex-getter" | "modbus-flex-writer" => {
            d.push_str("            dataType: {value:\"uint16\"},\n");
        }
        "bacnet write" => {
            d.push_str("            address: {value:0},\n");
        }
        "opcua read" | "opcua write" => {
            d.push_str("            node_id: {value:\"\", required: true},\n");
        }
        _ => {}
    }

    d
}

fn get_global_node_defaults(type_name: &str) -> String {
    let mut d = String::from("            name: {value:\"\"},\n");

    match type_name {
        "postgres-config" | "timescaledb-config" => {
            d.push_str("            host: {value:\"localhost\"},\n");
            d.push_str("            port: {value:5432},\n");
            d.push_str("            dbname: {value:\"\"},\n");
            d.push_str("            user: {value:\"\"},\n");
            d.push_str("            password: {value:\"\"},\n");
            d.push_str("            poolMaxSize: {value:10},\n");
            d.push_str("            connectTimeoutMs: {value:5000},\n");
        }
        "sqlite-config" => {
            d.push_str("            path: {value:\"data.db\"},\n");
        }
        "mssql-config" => {
            d.push_str("            host: {value:\"localhost\"},\n");
            d.push_str("            port: {value:1433},\n");
            d.push_str("            database: {value:\"\"},\n");
            d.push_str("            user: {value:\"\"},\n");
            d.push_str("            password: {value:\"\"},\n");
        }
        "influxdb-config" => {
            d.push_str("            url: {value:\"http://localhost:8086\"},\n");
            d.push_str("            token: {value:\"\"},\n");
            d.push_str("            org: {value:\"\"},\n");
            d.push_str("            bucket: {value:\"\"},\n");
        }
        "modbus-config" => {
            d.push_str("            host: {value:\"localhost\"},\n");
            d.push_str("            port: {value:502},\n");
            d.push_str("            transport: {value:\"tcp\"},\n");
            d.push_str("            unitId: {value:1},\n");
            d.push_str("            timeoutMs: {value:5000},\n");
        }
        "modbus-server" => {
            d.push_str("            host: {value:\"127.0.0.1\"},\n");
            d.push_str("            port: {value:5020},\n");
            d.push_str("            coilCount: {value:100},\n");
            d.push_str("            registerCount: {value:100},\n");
        }
        "opcua-config" => {
            d.push_str("            endpoint: {value:\"opc.tcp://localhost:4840\"},\n");
        }
        "bacnet-config" => {
            d.push_str("            device_id: {value:0},\n");
            d.push_str("            target_host: {value:\"\"},\n");
            d.push_str("            target_port: {value:47808},\n");
        }
        _ => {}
    }

    d
}

/// Recursively process node directory at runtime
async fn process_node_directory_runtime(dir: &std::path::Path, html_content: &mut String) {
    use std::future::Future;
    use std::pin::Pin;

    fn process_dir_recursive<'a>(
        dir: &'a std::path::Path,
        html_content: &'a mut String,
    ) -> Pin<Box<dyn Future<Output = ()> + Send + 'a>> {
        Box::pin(async move {
            if let Ok(entries) = tokio::fs::read_dir(dir).await {
                let mut entries = entries;
                while let Ok(Some(entry)) = entries.next_entry().await {
                    let path = entry.path();

                    if path.is_dir() {
                        // Skip lib directory - they contain files for dynamic services
                        if path.file_name().and_then(|s| s.to_str()) == Some("lib") {
                            continue;
                        }

                        // Recursively process subdirectories
                        process_dir_recursive(&path, html_content).await;
                    } else if path.extension().and_then(|s| s.to_str()) == Some("html") {
                        // Handle HTML files
                        if let Ok(file_content) = tokio::fs::read_to_string(&path).await {
                            extract_node_html_content_runtime(&file_content, &path, html_content);
                        }
                    }
                }
            }
        })
    }

    process_dir_recursive(dir, html_content).await;
}

/// Extract node HTML content at runtime
fn extract_node_html_content_runtime(file_content: &str, file_path: &std::path::Path, output: &mut String) {
    // Extract module name from file path
    let module_name = extract_module_name_runtime(file_path);

    // Add red-module separator
    output.push_str(&format!("<!-- --- [red-module:{module_name}] --- -->\n"));

    // Add original file content
    output.push_str(file_content);

    // Ensure content ends with a newline
    if !file_content.ends_with('\n') {
        output.push('\n');
    }
}

/// Extract module name from file path at runtime
fn extract_module_name_runtime(file_path: &std::path::Path) -> String {
    if let Some(file_name) = file_path.file_name().and_then(|f| f.to_str()) {
        // Remove .html extension
        let name_without_ext = file_name.trim_end_matches(".html");

        // For all Node-RED core nodes, use "node-red/nodename" pattern
        // Extract node name part (remove numeric prefix)
        let node_name = if let Some(pos) = name_without_ext.find('-') {
            // Remove numeric prefix, e.g. "20-inject" -> "inject"
            &name_without_ext[pos + 1..]
        } else {
            // No prefix, use directly (e.g. "view", "rbe")
            name_without_ext
        };

        // Always use node-red/ prefix for core nodes
        format!("node-red/{node_name}")
    } else {
        "unknown".to_string()
    }
}

/// Get fallback node HTML config
fn get_fallback_nodes_html() -> String {
    r#"<script type="text/javascript">
// Node-RED node configurations (fallback)
(function() {
    // Inject node
    RED.nodes.registerType('inject',{
        category: 'common',
        color: '#a6bbcf',
        defaults: {
            name: {value:""},
            topic: {value:""},
            payload: {value:"", type:"msg"},
            payloadType: {value:"date"},
            repeat: {value:""},
            crontab: {value:""},
            once: {value:false}
        },
        inputs:0,
        outputs:1,
        icon: "inject.svg",
        label: function() {
            return this.name||this.topic||"inject";
        }
    });

    // Debug node
    RED.nodes.registerType('debug',{
        category: 'common',
        color: '#87a980',
        defaults: {
            name: {value:""},
            active: {value:true},
            console: {value:"false"},
            complete: {value:"false", required:true}
        },
        inputs:1,
        outputs:0,
        icon: "debug.svg",
        label: function() {
            return this.name||"debug";
        }
    });

    // Function node
    RED.nodes.registerType('function',{
        category: 'function',
        color: '#fdd0a2',
        defaults: {
            name: {value:""},
            func: {value:"return msg;"},
            outputs: {value:1},
            noerr: {value:0,required:true}
        },
        inputs:1,
        outputs:1,
        icon: "function.svg",
        label: function() {
            return this.name||"function";
        }
    });
})();
</script>"#
        .to_string()
}

/// Get node module info
pub async fn get_node_module(
    Extension(state): Extension<Arc<WebState>>,
    Path(module_name): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let registry_guard = state.registry.read().await;
    if let Some(registry) = registry_guard.as_ref() {
        // Lookup module info from registry
        for (_, meta_node) in registry.all().iter() {
            if meta_node.module == module_name {
                let module_info = serde_json::json!({
                    "name": meta_node.module,
                    "version": meta_node.version,
                    "enabled": true,
                    "local": meta_node.local,
                    "user": meta_node.user
                });
                return Ok(Json(module_info));
            }
        }
    }

    Err(StatusCode::NOT_FOUND)
}

/// Install node module
pub async fn install_node_module(
    Extension(_state): Extension<Arc<WebState>>,
    Json(_payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    // Node module installation is now managed by registry, just return unimplemented status here
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Enable/disable node module
pub async fn toggle_node_module(
    Extension(_state): Extension<Arc<WebState>>,
    Path(_module_name): Path<String>,
    Json(_payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    // Node module enable/disable is now managed by registry, just return unimplemented status here
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Uninstall node module
pub async fn uninstall_node_module(
    Extension(_state): Extension<Arc<WebState>>,
    Path(_module_name): Path<String>,
) -> Result<StatusCode, StatusCode> {
    // Node module uninstall is now managed by registry, just return unimplemented status here
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Get node message directory
pub async fn get_node_messages(
    Extension(state): Extension<Arc<WebState>>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, StatusCode> {
    let lang = params.get("lng").unwrap_or(&"en-US".to_string()).clone();

    log::info!("Getting node messages for language: {lang}");

    // Use static_dir from WebState
    let static_dir = &state.static_dir;

    // Try to load the locale file from the new structure
    let locale_path = static_dir.join("locales").join(&lang).join("messages.json");

    match tokio::fs::read_to_string(&locale_path).await {
        Ok(content) => match serde_json::from_str::<Value>(&content) {
            Ok(json) => Ok(Json(json)),
            Err(_) => {
                log::warn!("Invalid JSON in locale file: {}", locale_path.display());
                get_fallback_node_messages(&state, &lang).await
            }
        },
        Err(_) => {
            log::warn!("Locale file not found: {}", locale_path.display());
            // If the specific locale isn't found, try fallback strategies
            get_fallback_node_messages(&state, &lang).await
        }
    }
}

/// Get node set info
pub async fn get_node_set(
    Extension(state): Extension<Arc<WebState>>,
    Path((module_name, set_name)): Path<(String, String)>,
) -> Result<Json<Value>, StatusCode> {
    let registry_guard = state.registry.read().await;
    if let Some(registry) = registry_guard.as_ref() {
        // Lookup node set info from registry
        for (_, meta_node) in registry.all().iter() {
            if meta_node.module == module_name {
                let node_set = serde_json::json!({
                    "id": format!("{}/{}", module_name, set_name),
                    "module": module_name,
                    "set": set_name,
                    "enabled": true,
                    "nodes": [meta_node.type_]
                });
                return Ok(Json(node_set));
            }
        }
    }

    Err(StatusCode::NOT_FOUND)
}

/// Enable/disable node set
pub async fn toggle_node_set(
    Extension(_state): Extension<Arc<WebState>>,
    Path((_module_name, _set_name)): Path<(String, String)>,
    Json(_payload): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    // Node set enable/disable is now managed by registry, just return unimplemented status here
    Err(StatusCode::NOT_IMPLEMENTED)
}

/// Get node set messages
pub async fn get_node_set_messages(
    Extension(state): Extension<Arc<WebState>>,
    Path((module_name, set_name)): Path<(String, String)>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<Json<Value>, StatusCode> {
    let lang = params.get("lng").unwrap_or(&"en-US".to_string()).clone();

    log::info!("Getting node set messages for {module_name}/{set_name} in language: {lang}");

    // Use static_dir from WebState
    let static_dir = &state.static_dir;

    // Try to load the locale file from the new structure
    let locale_path = static_dir.join("locales").join(&lang).join("messages.json");

    match tokio::fs::read_to_string(&locale_path).await {
        Ok(content) => match serde_json::from_str::<Value>(&content) {
            Ok(full_locale) => {
                // Look for the specific namespace in the locale data
                // Try different namespace formats: module_name, set_name, or the combination
                let formatted_slash = format!("{module_name}/{set_name}");
                let formatted_underscore = format!("{module_name}_{set_name}");
                let possible_keys = vec![&module_name, &set_name, &formatted_slash, &formatted_underscore];

                for key in possible_keys {
                    if let Some(namespace_data) = full_locale.get(key) {
                        return Ok(Json(namespace_data.clone()));
                    }
                }

                // If no specific namespace found, return empty object
                Ok(Json(serde_json::json!({})))
            }
            Err(_) => {
                log::warn!("Invalid JSON in locale file: {}", locale_path.display());
                get_fallback_node_set_messages(&state, &module_name, &set_name, &lang).await
            }
        },
        Err(_) => {
            log::warn!("Locale file not found: {}", locale_path.display());
            // If the specific locale isn't found, try fallback strategies
            get_fallback_node_set_messages(&state, &module_name, &set_name, &lang).await
        }
    }
}

/// Get fallback node messages with fallback strategies
async fn get_fallback_node_messages(state: &WebState, requested_lang: &str) -> Result<Json<Value>, StatusCode> {
    let static_dir = &state.static_dir;

    // Strategy 1: Try primary language (e.g., 'en' for 'en-US')
    if requested_lang.contains('-') {
        let primary_lang = requested_lang.split('-').next().unwrap();
        let primary_path = static_dir.join("locales").join(primary_lang).join("messages.json");

        if let Ok(content) = tokio::fs::read_to_string(&primary_path).await
            && let Ok(json) = serde_json::from_str::<Value>(&content)
        {
            return Ok(Json(json));
        }
    }

    // Strategy 2: Try en-US as ultimate fallback
    if requested_lang != "en-US" {
        let en_us_path = static_dir.join("locales/en-US/messages.json");
        if let Ok(content) = tokio::fs::read_to_string(&en_us_path).await
            && let Ok(json) = serde_json::from_str::<Value>(&content)
        {
            return Ok(Json(json));
        }
    }

    // Strategy 3: Return hardcoded fallback
    Ok(Json(get_hardcoded_fallback_node_messages()))
}

/// Get fallback node set messages with fallback strategies  
async fn get_fallback_node_set_messages(
    state: &WebState,
    module_name: &str,
    set_name: &str,
    requested_lang: &str,
) -> Result<Json<Value>, StatusCode> {
    let static_dir = &state.static_dir;

    // Strategy 1: Try primary language (e.g., 'en' for 'en-US')
    if requested_lang.contains('-') {
        let primary_lang = requested_lang.split('-').next().unwrap();
        let primary_path = static_dir.join("locales").join(primary_lang).join("messages.json");

        if let Ok(content) = tokio::fs::read_to_string(&primary_path).await
            && let Ok(full_locale) = serde_json::from_str::<Value>(&content)
        {
            // Look for the specific namespace in the locale data
            let formatted_slash = format!("{module_name}/{set_name}");
            let formatted_underscore = format!("{module_name}_{set_name}");
            let possible_keys = vec![module_name, set_name, &formatted_slash, &formatted_underscore];

            for key in possible_keys {
                if let Some(namespace_data) = full_locale.get(key) {
                    return Ok(Json(namespace_data.clone()));
                }
            }
        }
    }

    // Strategy 2: Try en-US as ultimate fallback
    if requested_lang != "en-US" {
        let en_us_path = static_dir.join("locales/en-US/messages.json");
        if let Ok(content) = tokio::fs::read_to_string(&en_us_path).await
            && let Ok(full_locale) = serde_json::from_str::<Value>(&content)
        {
            let formatted_slash = format!("{module_name}/{set_name}");
            let formatted_underscore = format!("{module_name}_{set_name}");
            let possible_keys = vec![module_name, set_name, &formatted_slash, &formatted_underscore];

            for key in possible_keys {
                if let Some(namespace_data) = full_locale.get(key) {
                    return Ok(Json(namespace_data.clone()));
                }
            }
        }
    }

    // Strategy 3: Return hardcoded fallback
    Ok(Json(get_hardcoded_fallback_node_set_messages(module_name, set_name)))
}

/// Get hardcoded fallback node messages for when files aren't available
fn get_hardcoded_fallback_node_messages() -> Value {
    serde_json::json!({
        "node-red": {
            "common": {
                "label": {
                    "name": "Name",
                    "input": "Input",
                    "output": "Output",
                    "payload": "Payload",
                    "topic": "Topic"
                },
                "status": {
                    "connected": "connected",
                    "disconnected": "disconnected"
                }
            },
            "inject": {
                "inject": "inject",
                "label": {
                    "repeat": "repeat",
                    "payload": "payload",
                    "topic": "topic"
                }
            },
            "debug": {
                "output": "output",
                "label": {
                    "name": "name"
                }
            }
        }
    })
}

/// Get hardcoded fallback node set messages
fn get_hardcoded_fallback_node_set_messages(module_name: &str, set_name: &str) -> Value {
    serde_json::json!({
        format!("{}/{}", module_name, set_name): {
            "help": "Help text for this node set",
            "label": "Node Set Label",
            "description": "Node set description"
        }
    })
}
