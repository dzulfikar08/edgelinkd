use serde::Deserialize;
use std::sync::Arc;

use crate::runtime::flow::Flow;
use crate::runtime::model::*;
use crate::runtime::nodes::*;
use rust_red_macro::*;

#[cfg(feature = "nodes_yaml")]
use serde_yaml_ng as yaml;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Default)]
enum YamlAction {
    #[serde(rename = "")]
    #[default]
    Auto,

    #[serde(rename = "str")]
    Stringify,

    #[serde(rename = "obj")]
    Parse,
}

/// YAML Parser Node
///
/// This node is compatible with Node-RED's YAML parser node. It can:
/// - Parse YAML strings to objects
/// - Convert objects to YAML strings
/// - Automatically detect input type and perform appropriate conversion
///
/// Configuration:
/// - `property`: The message property to operate on (default: "payload")
/// - `action`: The action to perform: "" (auto), "str" (stringify), "obj" (parse)
///
/// Behavior:
/// - String input: Parse YAML to object using `yaml.load()`
/// - Object input: Convert to YAML string using `yaml.dump()`
/// - Buffer input: Convert to UTF-8 string before parsing
/// - Other types: Pass through unchanged
#[derive(Debug)]
#[flow_node("yaml", red_name = "YAML")]
struct YamlNode {
    base: BaseFlowNodeState,
    config: YamlNodeConfig,
}

impl YamlNode {
    fn build(
        _flow: &Flow,
        state: BaseFlowNodeState,
        config: &RedFlowNodeConfig,
        _options: Option<&config::Config>,
    ) -> crate::Result<Box<dyn FlowNodeBehavior>> {
        let yaml_config = YamlNodeConfig::deserialize(&config.rest)?;

        let node = YamlNode { base: state, config: yaml_config };
        Ok(Box::new(node))
    }
}

#[derive(Deserialize, Debug)]
struct YamlNodeConfig {
    /// Property name to operate on (default: "payload")
    #[serde(default = "default_property")]
    property: String,

    /// Action to perform: auto, str (stringify), or obj (parse)
    #[serde(default)]
    action: YamlAction,

    /// Number of outputs (usually 1)
    #[serde(default = "default_outputs")]
    #[allow(dead_code)]
    outputs: usize,
}

fn default_property() -> String {
    "payload".to_string()
}

fn default_outputs() -> usize {
    1
}

#[cfg(feature = "nodes_yaml")]
impl YamlNode {
    async fn process_yaml(&self, msg: MsgHandle) -> crate::Result<()> {
        let mut msg_guard = msg.write().await;

        // Get the value from the specified property using nav-property access
        if !msg_guard.contains_nav(&self.config.property) {
            // If property doesn't exist, just pass through
            drop(msg_guard);
            return self.fan_out_one(Envelope { port: 0, msg }, CancellationToken::new()).await;
        }

        let property_value = msg_guard.get_nav(&self.config.property).cloned();

        if let Some(value) = property_value {
            // Check if this value should be processed
            if !self.should_process(&value) {
                // Just pass through without processing
                drop(msg_guard);
                return self.fan_out_one(Envelope { port: 0, msg }, CancellationToken::new()).await;
            }

            let result = match self.config.action {
                YamlAction::Auto => {
                    // Auto-detect: if string or buffer, try to parse; if object/array/bool/number, stringify
                    match &value {
                        Variant::String(s) => self.parse_yaml_string(s),
                        Variant::Bytes(bytes) => {
                            // Handle byte arrays (like Node.js Buffer)
                            match String::from_utf8(bytes.clone()) {
                                Ok(utf8_string) => self.parse_yaml_string(&utf8_string),
                                Err(_) => Err(crate::RustRedError::InvalidOperation(
                                    "Buffer contains invalid UTF-8".to_string(),
                                )
                                .into()),
                            }
                        }
                        Variant::Array(_) | Variant::Object(_) | Variant::Bool(_) | Variant::Number(_) => {
                            self.stringify_value(&value)
                        }
                        Variant::Null | Variant::Date(_) | Variant::Regexp(_) => {
                            // Pass through without processing
                            Ok(value)
                        }
                    }
                }
                YamlAction::Parse => {
                    // Force parsing string to object
                    match &value {
                        Variant::String(s) => self.parse_yaml_string(s),
                        Variant::Bytes(bytes) => {
                            // Handle byte arrays
                            match String::from_utf8(bytes.clone()) {
                                Ok(utf8_string) => self.parse_yaml_string(&utf8_string),
                                Err(_) => Err(crate::RustRedError::InvalidOperation(
                                    "Buffer contains invalid UTF-8".to_string(),
                                )
                                .into()),
                            }
                        }
                        Variant::Object(_)
                        | Variant::Array(_)
                        | Variant::Bool(_)
                        | Variant::Number(_)
                        | Variant::Null
                        | Variant::Date(_)
                        | Variant::Regexp(_) => {
                            // Already an object or other type, pass through
                            Ok(value)
                        }
                    }
                }
                YamlAction::Stringify => {
                    // Force stringifying object to YAML string
                    self.stringify_value(&value)
                }
            };

            match result {
                Ok(new_value) => {
                    let _ = msg_guard.set_nav(&self.config.property, new_value, true);
                }
                Err(e) => {
                    drop(msg_guard);
                    return Err(e);
                }
            }
        }

        drop(msg_guard);
        self.fan_out_one(Envelope { port: 0, msg }, CancellationToken::new()).await
    }

    fn parse_yaml_string(&self, s: &str) -> crate::Result<Variant> {
        match yaml::from_str::<yaml::Value>(s) {
            Ok(yaml_value) => Ok(yaml_value_to_variant(yaml_value)),
            Err(e) => Err(crate::RustRedError::InvalidOperation(format!("YAML parse error: {e}")).into()),
        }
    }

    fn stringify_value(&self, value: &Variant) -> crate::Result<Variant> {
        if let Variant::String(s) = value
            && yaml::from_str::<yaml::Value>(s).is_ok()
        {
            return Ok(Variant::String(s.clone()));
        }
        let yaml_value = variant_to_yaml_value(value);
        match yaml::to_string(&yaml_value) {
            Ok(yaml_string) => Ok(Variant::String(yaml_string)),
            Err(e) => Err(crate::RustRedError::InvalidOperation(format!("YAML stringify error: {e}")).into()),
        }
    }

    /// Check if a value should be processed based on its type
    fn should_process(&self, value: &Variant) -> bool {
        match self.config.action {
            YamlAction::Auto => {
                // Process strings (parse), objects/arrays (stringify), bytes (parse), bool/number (stringify)
                match value {
                    Variant::String(_) => true,
                    Variant::Object(_) | Variant::Array(_) => true,
                    Variant::Bool(_) | Variant::Number(_) => true,
                    Variant::Bytes(_) => true,
                    Variant::Null | Variant::Date(_) | Variant::Regexp(_) => false,
                }
            }
            YamlAction::Parse => {
                // Only process strings and byte arrays
                matches!(value, Variant::String(_) | Variant::Bytes(_))
            }
            YamlAction::Stringify => {
                // Process any value that can be serialized
                !matches!(value, Variant::Date(_) | Variant::Regexp(_))
            }
        }
    }
}

#[cfg(not(feature = "nodes_yaml"))]
impl YamlNode {
    async fn process_yaml(&self, _msg: MsgHandle) -> crate::Result<()> {
        log::error!("YAML node is not available. Please enable the 'nodes_yaml' feature.");
        Err(crate::RustRedError::InvalidOperation("YAML node requires 'nodes_yaml' feature to be enabled".to_string())
            .into())
    }
}

/// Convert a YAML value to a Variant
#[cfg(feature = "nodes_yaml")]
fn yaml_value_to_variant(yaml_value: yaml::Value) -> Variant {
    match yaml_value {
        yaml::Value::Null => Variant::Null,
        yaml::Value::Bool(b) => Variant::Bool(b),
        yaml::Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Variant::Number(serde_json::Number::from(i))
            } else if let Some(u) = n.as_u64() {
                Variant::Number(serde_json::Number::from(u))
            } else if let Some(f) = n.as_f64() {
                if let Some(json_num) = serde_json::Number::from_f64(f) {
                    Variant::Number(json_num)
                } else {
                    Variant::Null // Invalid float
                }
            } else {
                Variant::Null // Unknown number type
            }
        }
        yaml::Value::String(s) => Variant::String(s),
        yaml::Value::Sequence(seq) => {
            let variants: Vec<Variant> = seq.into_iter().map(yaml_value_to_variant).collect();
            Variant::Array(variants)
        }
        yaml::Value::Mapping(map) => {
            use std::collections::BTreeMap;
            let mut btree_map = BTreeMap::new();
            for (k, v) in map {
                let key = match k {
                    yaml::Value::String(s) => s,
                    yaml::Value::Number(n) => n.to_string(),
                    yaml::Value::Bool(b) => b.to_string(),
                    yaml::Value::Null => "null".to_string(),
                    _ => format!("{k:?}"), // Fallback for complex keys
                };
                btree_map.insert(key, yaml_value_to_variant(v));
            }
            Variant::Object(btree_map)
        }
        yaml::Value::Tagged(tagged) => {
            // For tagged values, just use the inner value
            yaml_value_to_variant(tagged.value)
        }
    }
}

/// Convert a Variant to a YAML value
#[cfg(feature = "nodes_yaml")]
fn variant_to_yaml_value(variant: &Variant) -> yaml::Value {
    match variant {
        Variant::Null => yaml::Value::Null,
        Variant::Bool(b) => yaml::Value::Bool(*b),
        Variant::Number(n) => {
            if let Some(i) = n.as_i64() {
                yaml::Value::Number(yaml::Number::from(i))
            } else if let Some(u) = n.as_u64() {
                yaml::Value::Number(yaml::Number::from(u))
            } else if let Some(f) = n.as_f64() {
                yaml::Value::Number(yaml::Number::from(f))
            } else {
                yaml::Value::Null
            }
        }
        Variant::String(s) => yaml::Value::String(s.clone()),
        Variant::Array(arr) => {
            let yaml_seq: Vec<yaml::Value> = arr.iter().map(variant_to_yaml_value).collect();
            yaml::Value::Sequence(yaml_seq)
        }
        Variant::Object(obj) => {
            let mut yaml_map = yaml::Mapping::new();
            for (k, v) in obj {
                let yaml_key = yaml::Value::String(k.clone());
                let yaml_value = variant_to_yaml_value(v);
                yaml_map.insert(yaml_key, yaml_value);
            }
            yaml::Value::Mapping(yaml_map)
        }
        Variant::Date(d) => {
            // Convert SystemTime to ISO 8601 string
            match d.duration_since(std::time::UNIX_EPOCH) {
                Ok(duration) => {
                    let timestamp = duration.as_secs();
                    // Simple ISO 8601 format - could use chrono for better formatting
                    yaml::Value::String(format!("{timestamp}Z"))
                }
                Err(_) => yaml::Value::Null,
            }
        }
        Variant::Regexp(r) => {
            // Convert regex to string representation
            yaml::Value::String(format!("/{r}/"))
        }
        Variant::Bytes(bytes) => {
            // Convert bytes to base64 string for YAML
            use base64::{Engine as _, engine::general_purpose};
            let base64_string = general_purpose::STANDARD.encode(bytes);
            yaml::Value::String(base64_string)
        }
    }
}

#[async_trait::async_trait]
impl FlowNodeBehavior for YamlNode {
    fn get_base(&self) -> &BaseFlowNodeState {
        &self.base
    }

    async fn run(self: Arc<Self>, stop_token: CancellationToken) {
        while !stop_token.is_cancelled() {
            let node = self.clone();

            with_uow(node.as_ref(), stop_token.clone(), |node, msg| async move { node.process_yaml(msg).await }).await;
        }
    }
}
