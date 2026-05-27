# Database Nodes

## PostgreSQL

Read from and write to PostgreSQL databases.

### PostgreSQL Config

**Type**: `postgres-config`

**Properties**:
- `host` - database host (default: `localhost`)
- `port` - database port (default: `5432`)
- `database` - database name
- `user` - username
- `password` - password
- `sslmode` - SSL mode: "disable", "prefer", "require"
- `max_connections` - connection pool size

### PostgreSQL In

**Type**: `postgres-in`

**Properties**:
- `server` - config node ID
- `query` - SQL query (supports `$1`, `$2` parameterized placeholders)
- `params` - parameter values from message properties

**Output**: `msg.payload` contains query results as an array of objects.

### PostgreSQL Out

**Type**: `postgres-out`

**Properties**:
- `server` - config node ID
- `query` - SQL insert/update/delete
- `params` - parameter mapping

## SQLite

Local SQLite database support.

### SQLite Config

**Type**: `sqlite-config`

**Properties**:
- `filename` - database file path (or `:memory:` for in-memory)

### SQLite In / Out

**Types**: `sqlite-in`, `sqlite-out`

Same interface as PostgreSQL nodes but using SQLite syntax.

## TimescaleDB

TimescaleDB (PostgreSQL extension) support.

**Types**: `timescaledb-config`, `timescaledb-in`, `timescaledb-out`

Same interface as PostgreSQL nodes with TimescaleDB-specific optimizations.

## MSSQL

Microsoft SQL Server support.

**Types**: `mssql-config`, `mssql-in`, `mssql-out`

### MSSQL Config

**Properties**:
- `host` - server host
- `port` - server port (default: `1433`)
- `database` - database name
- `user` - username
- `password` - password
- `encrypt` - encrypt connection

## InfluxDB

InfluxDB time-series database support.

### InfluxDB In

**Type**: `influxdb-in`

**Properties**:
- `server` - InfluxDB config
- `query` - InfluxQL or Flux query
- `precision` - timestamp precision

### InfluxDB Out

**Type**: `influxdb-out`

**Properties**:
- `server` - InfluxDB config
- `measurement` - measurement name
- `tags` - tag keys
- `fields` - field keys

**Input**: `msg.payload` contains the data point(s) to write.
