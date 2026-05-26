use bytes::Bytes;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum PacketType {
    Connect = 1,
    ConnAck = 2,
    Publish = 3,
    PubAck = 4,
    PubRec = 5,
    PubRel = 6,
    PubComp = 7,
    Subscribe = 8,
    SubAck = 9,
    Unsubscribe = 10,
    UnsubAck = 11,
    PingReq = 12,
    PingResp = 13,
    Disconnect = 14,
}

impl PacketType {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            1 => Some(Self::Connect),
            2 => Some(Self::ConnAck),
            3 => Some(Self::Publish),
            4 => Some(Self::PubAck),
            5 => Some(Self::PubRec),
            6 => Some(Self::PubRel),
            7 => Some(Self::PubComp),
            8 => Some(Self::Subscribe),
            9 => Some(Self::SubAck),
            10 => Some(Self::Unsubscribe),
            11 => Some(Self::UnsubAck),
            12 => Some(Self::PingReq),
            13 => Some(Self::PingResp),
            14 => Some(Self::Disconnect),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum QoS {
    AtMostOnce = 0,
    AtLeastOnce = 1,
    ExactlyOnce = 2,
}

impl QoS {
    pub fn from_u8(v: u8) -> Option<Self> {
        match v {
            0 => Some(Self::AtMostOnce),
            1 => Some(Self::AtLeastOnce),
            2 => Some(Self::ExactlyOnce),
            _ => None,
        }
    }
}

#[derive(Debug)]
pub struct ConnectPacket {
    pub client_id: String,
    pub keep_alive: u16,
    pub username: Option<String>,
    pub password: Option<Vec<u8>>,
    pub clean_start: bool,
    pub will_topic: Option<String>,
    pub will_payload: Option<Bytes>,
    pub will_qos: QoS,
    pub will_retain: bool,
}

#[derive(Debug)]
pub struct ConnAckPacket {
    pub session_present: bool,
    pub reason_code: u8,
}

#[derive(Debug)]
pub struct PublishPacket {
    pub topic: String,
    pub payload: Bytes,
    pub qos: QoS,
    pub retain: bool,
    pub dup: bool,
    pub packet_id: Option<u16>,
}

#[derive(Debug)]
pub struct SubscribePacket {
    pub packet_id: u16,
    pub subscriptions: Vec<SubscriptionFilter>,
}

#[derive(Debug)]
pub struct SubscriptionFilter {
    pub topic_filter: String,
    pub qos: QoS,
    pub retain_handling: u8,
}

#[derive(Debug)]
pub struct UnsubscribePacket {
    pub packet_id: u16,
    pub topic_filters: Vec<String>,
}

#[derive(Debug, Clone, Copy)]
#[repr(u8)]
pub enum SubAckReasonCode {
    GrantedQos0 = 0,
    GrantedQos1 = 1,
    GrantedQos2 = 2,
    TopicFilterInvalid = 0x8F,
    WildcardSubscriptionsNotSupported = 0xA2,
}
