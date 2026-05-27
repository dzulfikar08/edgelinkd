# Sequence Nodes

## Split

Splits a message payload into individual messages.

**Type**: `split`

**Properties**:
- `splt` - split character/string (default: `\n`)
- `spltType` - "str", "bin", "len"
- `arraySplt` - split array into chunks of this size
- `addname` - property to store the key name (for objects)

**Behavior**:
- **String**: splits by separator into substrings
- **Array**: splits into individual elements (or chunks)
- **Object**: splits into key-value pairs
- **Buffer**: splits by byte sequence

Sets `msg.parts` for reassembly by the Join node.

## Join

Joins sequences of messages back into a single message.

**Type**: `join`

**Properties**:
- `mode` - "auto", "custom", "reduce"
- `build` - output type: "string", "array", "object", "merged"
- `property` - property to accumulate
- `key` - key property for object output
- `joiner` - join string (for string output)
- `count` - number of messages to wait for
- `timeout` - timeout in seconds
- `reduceRight` - reduce in reverse order
- `reduceExp` - reduce expression
- `reduceInit` - initial value
- `reduceFixup` - fixup expression

## Sort

Sorts message sequences.

**Type**: `sort`

**Properties**:
- `as_num` - sort numerically
- `target` - target property to sort
- `targetName` - property name for sorting
- `msgKey` - message key for sorting
- `msgKeyExp` - expression for sort key
- `order` - "ascending" or "descending"

## Batch

Creates batches of messages.

**Type**: `batch`

**Properties**:
- `mode` - "count", "interval", "concat"
- `count` - number of messages per batch
- `overlap` - number of overlapping messages
- `interval` - time interval in seconds
- `concatTopics` - topics to concatenate
