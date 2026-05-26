"""
Minimal Modbus TCP Simulator - raw socket implementation.
Responds to FC3 (Read Holding Registers) with simulated sensor data.
No external dependencies needed.

Usage:
    python modbus_simulator.py
"""

import struct
import socket
import time
import math
import random

def make_registers():
    """Generate simulated sensor register values."""
    elapsed = time.time()
    temperature = int((20 + 5 * math.sin(elapsed * 0.1) + random.uniform(-0.5, 0.5)) * 10)
    humidity = int((60 + 10 * math.sin(elapsed * 0.05) + random.uniform(-1, 1)) * 10)
    pressure = int(1013 + 5 * math.sin(elapsed * 0.02) + random.uniform(-1, 1))
    status = random.choice([0, 1, 2, 3])
    # Registers at address 0-3 (0-based, as per Modbus convention)
    return [temperature, humidity, pressure, status] + [0] * 96


def handle_request(data, unit_id):
    """Parse Modbus TCP request and return response."""
    if len(data) < 7:
        return None

    # MBAP header: transaction_id(2) + protocol_id(2) + length(2) + unit_id(1)
    transaction_id = struct.unpack('>H', data[0:2])[0]
    protocol_id = struct.unpack('>H', data[2:4])[0]
    req_unit_id = data[6]

    if protocol_id != 0:
        return None

    if len(data) < 8:
        return None

    function_code = data[7]

    if function_code == 0x03:  # Read Holding Registers
        if len(data) < 12:
            return None
        start_addr = struct.unpack('>H', data[8:10])[0]
        quantity = struct.unpack('>H', data[10:12])[0]

        registers = make_registers()

        # Clamp to available registers
        if start_addr + quantity > len(registers):
            quantity = len(registers) - start_addr
        if quantity < 0:
            quantity = 0

        byte_count = quantity * 2
        # Build response: MBAP header + FC + byte count + register values
        resp_data = bytes([function_code, byte_count])
        for i in range(quantity):
            resp_data += struct.pack('>H', registers[start_addr + i] & 0xFFFF)

        resp_length = len(resp_data) + 1  # +1 for unit_id
        header = struct.pack('>HHH', transaction_id, 0, resp_length)
        return header + bytes([req_unit_id]) + resp_data

    elif function_code == 0x04:  # Read Input Registers
        if len(data) < 12:
            return None
        start_addr = struct.unpack('>H', data[8:10])[0]
        quantity = struct.unpack('>H', data[10:12])[0]

        registers = make_registers()
        if start_addr + quantity > len(registers):
            quantity = len(registers) - start_addr
        if quantity < 0:
            quantity = 0

        byte_count = quantity * 2
        resp_data = bytes([function_code, byte_count])
        for i in range(quantity):
            resp_data += struct.pack('>H', registers[start_addr + i] & 0xFFFF)

        resp_length = len(resp_data) + 1
        header = struct.pack('>HHH', transaction_id, 0, resp_length)
        return header + bytes([req_unit_id]) + resp_data

    elif function_code == 0x01:  # Read Coils
        if len(data) < 12:
            return None
        start_addr = struct.unpack('>H', data[8:10])[0]
        quantity = struct.unpack('>H', data[10:12])[0]

        byte_count = (quantity + 7) // 8
        coil_bytes = bytes([random.choice([0, 1]) for _ in range(byte_count)])

        resp_data = bytes([function_code, byte_count]) + coil_bytes
        resp_length = len(resp_data) + 1
        header = struct.pack('>HHH', transaction_id, 0, resp_length)
        return header + bytes([req_unit_id]) + resp_data

    return None


def main():
    HOST = '0.0.0.0'
    PORT = 5020

    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.bind((HOST, PORT))
    sock.listen(5)

    print(f"Modbus TCP Simulator running on {HOST}:{PORT}")
    print("Register map (0-based):")
    print("  Address 0: Temperature (x10, e.g. 245 = 24.5C)")
    print("  Address 1: Humidity (x10, e.g. 652 = 65.2%)")
    print("  Address 2: Pressure (hPa)")
    print("  Address 3: Status flags")
    print()
    print("Supported function codes: FC01 (Read Coils), FC03 (Read Holding Registers), FC04 (Read Input Registers)")
    print("Press Ctrl+C to stop")
    print()

    sock.settimeout(1.0)
    try:
        while True:
            try:
                conn, addr = sock.accept()
            except socket.timeout:
                continue
            conn.settimeout(5.0)
            try:
                data = conn.recv(260)
                if data:
                    resp = handle_request(data, 1)
                    if resp:
                        conn.sendall(resp)
                        fc = data[7] if len(data) > 7 else 0
                        start = struct.unpack('>H', data[8:10])[0] if len(data) > 9 else 0
                        qty = struct.unpack('>H', data[10:12])[0] if len(data) > 11 else 0
                        regs = make_registers()
                        vals = regs[start:start+qty]
                        print(f"  FC{fc:02d} addr={start} qty={qty} -> {vals}")
            except Exception:
                pass
            finally:
                conn.close()
    except KeyboardInterrupt:
        print("\nStopped.")
    finally:
        sock.close()


if __name__ == "__main__":
    main()
