# Industrial Nodes

## Modbus

Rust-RED supports Modbus TCP and Serial/RTU protocols with read, write, flex getter/writer, and server nodes.

### Modbus Config (Connection)

Shared connection configuration for all Modbus nodes.

**Type**: `modbus-config`

**Properties**:
- `transport` - "tcp" or "serial"/"rtu"
- `host` - TCP host (TCP mode)
- `port` - TCP port (default: 502)
- `serial_port` - serial device path (RTU mode, e.g., `/dev/ttyUSB0`)
- `baud_rate` - baud rate (default: 9600)
- `data_bits` - data bits (5-8, default: 8)
- `stop_bits` - stop bits (1 or 2, default: 1)
- `parity` - "none", "even", "odd"
- `unit_id` - Modbus slave address (1-247)
- `auto_connect` - auto-connect on first request (default: true)
- `reconnect_timeout` - reconnect delay in ms
- `command_delay` - minimum delay between requests in ms
- `parallel_unit_ids` - allow concurrent requests (default: false)

### Modbus Read

Reads from Modbus devices on a schedule.

**Type**: `modbus-read`

**Properties**:
- `server` - Modbus config node ID
- `fc` - function code: "FC1" (coils), "FC2" (discrete inputs), "FC3" (holding registers), "FC4" (input registers)
- `unitid` - unit/slave address override
- `address` - starting register/coil address
- `quantity` - number of registers/coils to read
- `poll_rate` - poll interval in seconds

### Modbus Write

Writes to Modbus devices.

**Type**: `modbus-write`

**Properties**:
- `server` - Modbus config node ID
- `fc` - function code: "FC5" (single coil), "FC6" (single register), "FC15" (multiple coils), "FC16" (multiple registers)
- `unitid` - unit/slave address override
- `address` - starting register/coil address
- `quantity` - number of registers/coils

### Modbus Flex Getter / Writer

Dynamic Modbus operations where parameters come from the message.

**Types**: `modbus-flex-getter`, `modbus-flex-writer`

**Properties**:
- `server` - Modbus config node ID

**Message properties**:
- `msg.payload.fc` - function code
- `msg.payload.unitid` - slave address
- `msg.payload.address` - start address
- `msg.payload.quantity` - count
- `msg.payload.value` - value to write (writer only)

### Modbus Server

Runs a Modbus TCP slave server.

**Type**: `modbus-server`

**Properties**:
- `port` - listen port (default: 10502)
- `coils` - initial coil values
- `holding_registers` - initial register values

## OPC-UA

### OPC-UA Config

**Type**: `opcua-config`

**Properties**:
- `endpoint` - OPC-UA server URL
- `security_mode` - "none", "sign", "signAndEncrypt"
- `security_policy` - security policy

### OPC-UA Read / Write

**Types**: `opcua-read`, `opcua-write`

**Properties**:
- `server` - OPC-UA config node ID
- `nodeId` - OPC-UA node ID
- `datatype` - expected data type

## BACnet

### BACnet Config

**Type**: `bacnet-config`

**Properties**:
- `host` - BACnet device IP
- `port` - UDP port (default: 47808)

### BACnet Read / Write

**Types**: `bacnet-read`, `bacnet-write`

**Properties**:
- `server` - BACnet config node ID
- `object_type` - BACnet object type
- `object_instance` - object instance number
- `property` - property identifier
