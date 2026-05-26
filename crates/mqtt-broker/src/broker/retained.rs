use bytes::Bytes;
use std::collections::HashMap;
use crate::protocol::packets::QoS;

#[derive(Debug, Clone)]
pub struct RetainedMessage {
    pub payload: Bytes,
    pub qos: QoS,
}

pub struct RetainedStore {
    messages: HashMap<String, RetainedMessage>,
}

impl RetainedStore {
    pub fn new() -> Self { Self { messages: HashMap::new() } }

    pub fn store(&mut self, topic: String, payload: Bytes, qos: QoS) {
        self.messages.insert(topic, RetainedMessage { payload, qos });
    }

    pub fn remove(&mut self, topic: &str) { self.messages.remove(topic); }

    pub fn match_retained(&self, filter: &str) -> Vec<(String, RetainedMessage)> {
        self.messages.iter()
            .filter(|(topic, _)| topic_matches_filter(filter, topic))
            .map(|(t, m)| (t.clone(), m.clone()))
            .collect()
    }

    pub fn len(&self) -> usize { self.messages.len() }
}

pub fn topic_matches_filter(filter: &str, topic: &str) -> bool {
    let fp: Vec<&str> = filter.split('/').collect();
    let tp: Vec<&str> = topic.split('/').collect();
    let (mut fi, mut ti) = (0, 0);
    while fi < fp.len() && ti < tp.len() {
        if fp[fi] == "#" { return true; }
        if fp[fi] == "+" || fp[fi] == tp[ti] { fi += 1; ti += 1; }
        else { return false; }
    }
    (fi == fp.len() && ti == tp.len()) || (fi < fp.len() && fp[fi] == "#")
}
