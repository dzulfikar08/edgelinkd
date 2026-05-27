# Storage Nodes

## File

Writes data to files on the filesystem.

**Type**: `file`

**Properties**:
- `filename` - file path (or `msg.filename`)
- `appendNewline` - append newline after each write
- `overwriteFile` - "true" overwrite, "false" append, "delete" delete
- `createDir` - create parent directories if needed
- `encoding` - file encoding (default: "none" = binary)

**Input**: `msg.payload` contains the data to write.

## File In

Reads file contents.

**Type**: `file in`

**Properties**:
- `filename` - file path (or `msg.filename`)
- `format` - output format: "utf8", "lines", "stream"
- `chunk` - chunk size for streaming (bytes)
- `encoding` - file encoding

**Output**: `msg.payload` contains the file contents.

## Watch

Watches a file or directory for changes.

**Type**: `watch`

**Properties**:
- `files` - comma-separated list of paths or glob patterns
- `recursive` - watch subdirectories

**Output**: `msg.payload` contains the changed file path, `msg.topic` is the event type (e.g., "change", "rename").
