use bytes::{Buf, BytesMut};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use super::packets::*;

#[derive(Debug)]
pub struct FixedHeader {
    pub packet_type: PacketType,
    pub flags: u8,
    pub remaining_length: usize,
}

// ---------------------------------------------------------------------------
// Reading from a full TcpStream
// ---------------------------------------------------------------------------

pub async fn read_packet(stream: &mut TcpStream, max_size: usize) -> std::io::Result<Option<(FixedHeader, BytesMut)>> {
    let header = match read_fixed_header_stream(stream).await {
        Ok(h) => h,
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) => return Err(e),
    };

    if header.remaining_length > max_size {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Packet too large"));
    }

    let mut buf = BytesMut::zeroed(header.remaining_length);
    if header.remaining_length > 0 {
        stream.read_exact(&mut buf).await?;
    }

    Ok(Some((header, buf)))
}

async fn read_fixed_header_stream(stream: &mut TcpStream) -> std::io::Result<FixedHeader> {
    let mut type_buf = [0u8; 1];
    stream.read_exact(&mut type_buf).await?;
    let byte = type_buf[0];
    let packet_type_num = (byte >> 4) & 0x0F;
    let flags = byte & 0x0F;
    let packet_type = PacketType::from_u8(packet_type_num)
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid packet type"))?;

    let remaining_length = read_remaining_length_stream(stream).await?;

    Ok(FixedHeader {
        packet_type,
        flags,
        remaining_length,
    })
}

async fn read_remaining_length_stream(stream: &mut TcpStream) -> std::io::Result<usize> {
    let mut remaining_length = 0usize;
    let mut multiplier = 1usize;
    loop {
        let mut b = [0u8; 1];
        stream.read_exact(&mut b).await?;
        let encoded_byte = b[0] as usize;
        remaining_length += (encoded_byte & 0x7F) * multiplier;
        if (encoded_byte & 0x80) == 0 {
            break;
        }
        multiplier *= 128;
        if multiplier > 128 * 128 * 128 * 128 {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Malformed remaining length"));
        }
    }
    Ok(remaining_length)
}

// ---------------------------------------------------------------------------
// Reading from a split read half
// ---------------------------------------------------------------------------

pub async fn read_packet_from(
    read_half: &mut tokio::io::ReadHalf<TcpStream>,
    max_size: usize,
) -> std::io::Result<Option<(FixedHeader, BytesMut)>> {
    let header = match read_fixed_header_half(read_half).await {
        Ok(h) => h,
        Err(e) if e.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(e) if e.kind() == std::io::ErrorKind::ConnectionReset => return Ok(None),
        Err(e) => return Err(e),
    };

    if header.remaining_length > max_size {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Packet too large"));
    }

    let mut buf = BytesMut::zeroed(header.remaining_length);
    if header.remaining_length > 0 {
        read_half.read_exact(&mut buf).await?;
    }

    Ok(Some((header, buf)))
}

async fn read_fixed_header_half(read_half: &mut tokio::io::ReadHalf<TcpStream>) -> std::io::Result<FixedHeader> {
    let mut type_buf = [0u8; 1];
    read_half.read_exact(&mut type_buf).await?;
    let byte = type_buf[0];
    let packet_type_num = (byte >> 4) & 0x0F;
    let flags = byte & 0x0F;
    let packet_type = PacketType::from_u8(packet_type_num)
        .ok_or_else(|| std::io::Error::new(std::io::ErrorKind::InvalidData, "Invalid packet type"))?;

    let mut remaining_length = 0usize;
    let mut multiplier = 1usize;
    loop {
        let mut b = [0u8; 1];
        read_half.read_exact(&mut b).await?;
        let encoded_byte = b[0] as usize;
        remaining_length += (encoded_byte & 0x7F) * multiplier;
        if (encoded_byte & 0x80) == 0 {
            break;
        }
        multiplier *= 128;
        if multiplier > 128 * 128 * 128 * 128 {
            return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "Malformed remaining length"));
        }
    }

    Ok(FixedHeader {
        packet_type,
        flags,
        remaining_length,
    })
}

// ---------------------------------------------------------------------------
// Decoding
// ---------------------------------------------------------------------------

pub fn decode_connect(buf: &mut BytesMut) -> std::io::Result<ConnectPacket> {
    // Protocol name
    let proto_len = buf.get_u16() as usize;
    if proto_len > buf.remaining() {
        return Err(std::io::Error::new(std::io::ErrorKind::InvalidData, "CONNECT: protocol name too long"));
    }
    let mut _proto_name = vec![0u8; proto_len];
    buf.copy_to_slice(&mut _proto_name);
    let proto_level = buf.get_u8();

    let connect_flags = buf.get_u8();
    let clean_start = (connect_flags & 0x02) != 0;
    let has_will = (connect_flags & 0x04) != 0;
    let will_qos = QoS::from_u8((connect_flags >> 3) & 0x03).unwrap_or(QoS::AtMostOnce);
    let will_retain = (connect_flags & 0x20) != 0;
    let has_password = (connect_flags & 0x40) != 0;
    let has_username = (connect_flags & 0x80) != 0;

    let keep_alive = buf.get_u16();

    // MQTT v5 has properties; MQTT v3.1.1 (level 4) does not
    if proto_level == 5 {
        let props_len = decode_variable_length(buf);
        if props_len > 0 {
            buf.advance(props_len);
        }
    }

    let client_id = decode_utf8_string(buf);

    let (will_topic, will_payload) = if has_will {
        if proto_level == 5 {
            let wp_len = decode_variable_length(buf);
            if wp_len > 0 { buf.advance(wp_len); }
        }
        let topic = Some(decode_utf8_string(buf));
        let len = buf.get_u16() as usize;
        let payload = buf.copy_to_bytes(len);
        (topic, Some(payload))
    } else {
        (None, None)
    };

    let username = if has_username {
        Some(decode_utf8_string(buf))
    } else {
        None
    };

    let password = if has_password {
        let len = buf.get_u16() as usize;
        let mut pass = vec![0u8; len];
        buf.copy_to_slice(&mut pass);
        Some(pass)
    } else {
        None
    };

    Ok(ConnectPacket {
        client_id,
        keep_alive,
        username,
        password,
        clean_start,
        will_topic,
        will_payload,
        will_qos,
        will_retain,
    })
}

pub fn decode_publish(buf: &mut BytesMut, header: &FixedHeader) -> std::io::Result<PublishPacket> {
    let dup = (header.flags & 0x08) != 0;
    let qos = QoS::from_u8((header.flags >> 1) & 0x03).unwrap_or(QoS::AtMostOnce);
    let retain = (header.flags & 0x01) != 0;

    let topic = decode_utf8_string(buf);
    let packet_id = if qos != QoS::AtMostOnce {
        Some(buf.get_u16())
    } else {
        None
    };

    let payload = buf.copy_to_bytes(buf.remaining());

    Ok(PublishPacket {
        topic,
        payload,
        qos,
        retain,
        dup,
        packet_id,
    })
}

pub fn decode_subscribe(buf: &mut BytesMut) -> std::io::Result<SubscribePacket> {
    let packet_id = buf.get_u16();

    let mut subscriptions = Vec::new();
    while buf.remaining() >= 3 {
        let topic_filter = decode_utf8_string(buf);
        if buf.remaining() == 0 { break; }
        let sub_options = buf.get_u8();
        let qos = QoS::from_u8(sub_options & 0x03).unwrap_or(QoS::AtMostOnce);
        let retain_handling = (sub_options >> 4) & 0x03;
        subscriptions.push(SubscriptionFilter {
            topic_filter,
            qos,
            retain_handling,
        });
    }

    Ok(SubscribePacket { packet_id, subscriptions })
}

pub fn decode_unsubscribe(buf: &mut BytesMut) -> std::io::Result<UnsubscribePacket> {
    let packet_id = buf.get_u16();

    let mut topic_filters = Vec::new();
    while buf.remaining() >= 2 {
        topic_filters.push(decode_utf8_string(buf));
    }

    Ok(UnsubscribePacket { packet_id, topic_filters })
}

// ---------------------------------------------------------------------------
// Encoding to bytes (for channel-based delivery)
// ---------------------------------------------------------------------------

/// Encode a CONNACK packet (MQTT v3.1.1 format) and return raw bytes.
pub fn encode_connack(session_present: bool, reason_code: u8) -> Vec<u8> {
    let mut buf = Vec::with_capacity(4);
    buf.push((PacketType::ConnAck as u8) << 4);
    buf.push(2); // remaining length = 2
    buf.push(if session_present { 0x01u8 } else { 0x00u8 });
    buf.push(reason_code);
    buf
}

/// Encode a PUBLISH packet and return raw bytes.
pub fn encode_publish(
    topic: &str,
    payload: &[u8],
    qos: QoS,
    dup: bool,
    retain: bool,
    packet_id: Option<u16>,
) -> Vec<u8> {
    let mut buf = Vec::with_capacity(256);
    let mut first_byte = (PacketType::Publish as u8) << 4;
    if dup { first_byte |= 0x08; }
    first_byte |= (qos as u8) << 1;
    if retain { first_byte |= 0x01; }
    buf.push(first_byte);

    let topic_bytes = topic.as_bytes();
    let mut remaining = 2 + topic_bytes.len() + payload.len();
    if qos != QoS::AtMostOnce {
        remaining += 2;
    }
    encode_remaining_length_vec(&mut buf, remaining);

    // Topic
    buf.extend_from_slice(&(topic_bytes.len() as u16).to_be_bytes());
    buf.extend_from_slice(topic_bytes);

    // Packet ID
    if qos != QoS::AtMostOnce {
        buf.extend_from_slice(&packet_id.unwrap_or(0).to_be_bytes());
    }

    // Payload
    buf.extend_from_slice(payload);

    buf
}

/// Encode a PUBACK packet and return raw bytes.
pub fn encode_puback(packet_id: u16) -> Vec<u8> {
    let mut buf = Vec::with_capacity(4);
    buf.push((PacketType::PubAck as u8) << 4);
    buf.push(2);
    buf.extend_from_slice(&packet_id.to_be_bytes());
    buf
}

/// Encode a SUBACK packet (MQTT v3.1.1 format) and return raw bytes.
pub fn encode_suback(packet_id: u16, reason_codes: &[u8]) -> Vec<u8> {
    let mut buf = Vec::with_capacity(64);
    buf.push((PacketType::SubAck as u8) << 4);
    let remaining = 2 + reason_codes.len();
    encode_remaining_length_vec(&mut buf, remaining);
    buf.extend_from_slice(&packet_id.to_be_bytes());
    buf.extend_from_slice(reason_codes);
    buf
}

/// Encode an UNSUBACK packet (MQTT v3.1.1 format) and return raw bytes.
pub fn encode_unsuback(packet_id: u16) -> Vec<u8> {
    let mut buf = Vec::with_capacity(4);
    buf.push((PacketType::UnsubAck as u8) << 4);
    buf.push(2);
    buf.extend_from_slice(&packet_id.to_be_bytes());
    buf
}

/// Encode a PINGRESP packet and return raw bytes.
pub fn encode_pingresp() -> Vec<u8> {
    vec![(PacketType::PingResp as u8) << 4, 0]
}

// ---------------------------------------------------------------------------
// Writing to full TcpStream (convenience wrappers)
// ---------------------------------------------------------------------------

pub async fn write_connack(stream: &mut TcpStream, session_present: bool, reason_code: u8) -> std::io::Result<()> {
    let bytes = encode_connack(session_present, reason_code);
    stream.write_all(&bytes).await
}

pub async fn write_connack_to<W: AsyncWriteExt + Unpin>(
    writer: &mut W,
    session_present: bool,
    reason_code: u8,
) -> std::io::Result<()> {
    let bytes = encode_connack(session_present, reason_code);
    writer.write_all(&bytes).await
}

pub async fn write_publish(
    stream: &mut TcpStream,
    topic: &str,
    payload: &[u8],
    qos: QoS,
    dup: bool,
    retain: bool,
    packet_id: Option<u16>,
) -> std::io::Result<()> {
    let bytes = encode_publish(topic, payload, qos, dup, retain, packet_id);
    stream.write_all(&bytes).await
}

pub async fn write_publish_to<W: AsyncWriteExt + Unpin>(
    writer: &mut W,
    topic: &str,
    payload: &[u8],
    qos: QoS,
    dup: bool,
    retain: bool,
    packet_id: Option<u16>,
) -> std::io::Result<()> {
    let bytes = encode_publish(topic, payload, qos, dup, retain, packet_id);
    writer.write_all(&bytes).await
}

pub async fn write_puback(stream: &mut TcpStream, packet_id: u16) -> std::io::Result<()> {
    let bytes = encode_puback(packet_id);
    stream.write_all(&bytes).await
}

pub async fn write_suback(stream: &mut TcpStream, packet_id: u16, reason_codes: &[u8]) -> std::io::Result<()> {
    let bytes = encode_suback(packet_id, reason_codes);
    stream.write_all(&bytes).await
}

pub async fn write_unsuback(stream: &mut TcpStream, packet_id: u16) -> std::io::Result<()> {
    let bytes = encode_unsuback(packet_id);
    stream.write_all(&bytes).await
}

pub async fn write_pingresp(stream: &mut TcpStream) -> std::io::Result<()> {
    let bytes = encode_pingresp();
    stream.write_all(&bytes).await
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn decode_utf8_string(buf: &mut BytesMut) -> String {
    let len = buf.get_u16() as usize;
    let bytes = buf.copy_to_bytes(len);
    String::from_utf8_lossy(&bytes).to_string()
}

fn decode_variable_length(buf: &mut BytesMut) -> usize {
    let mut value = 0usize;
    let mut multiplier = 1usize;
    loop {
        if buf.remaining() == 0 { break; }
        let byte = buf.get_u8() as usize;
        value += (byte & 0x7F) * multiplier;
        if (byte & 0x80) == 0 { break; }
        multiplier *= 128;
    }
    value
}

fn encode_remaining_length_vec(buf: &mut Vec<u8>, mut length: usize) {
    loop {
        let mut encoded_byte = (length % 128) as u8;
        length /= 128;
        if length > 0 {
            encoded_byte |= 0x80;
        }
        buf.push(encoded_byte);
        if length == 0 { break; }
    }
}
