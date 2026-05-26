-- POC: Modbus sensor data table
-- Run this against your PostgreSQL instance

-- Create table for sensor readings
-- All numeric columns use DOUBLE PRECISION because tokio-postgres sends
-- f64 for all number params (avoids type mismatch with prepared statements).
CREATE TABLE IF NOT EXISTS sensor_readings (
    id SERIAL PRIMARY KEY,
    temperature DOUBLE PRECISION NOT NULL,
    humidity DOUBLE PRECISION NOT NULL,
    pressure DOUBLE PRECISION NOT NULL,
    status DOUBLE PRECISION NOT NULL DEFAULT 0,
    source TEXT DEFAULT 'modbus',
    inserted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for time-based queries
CREATE INDEX IF NOT EXISTS idx_sensor_readings_inserted_at ON sensor_readings (inserted_at DESC);

-- Verify
SELECT 'sensor_readings table created' AS status;
