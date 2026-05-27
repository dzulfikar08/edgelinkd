# Common Nodes

## Inject

Generates messages on a schedule or manually.

**Type**: `inject`

**Properties**:
- `payload` - value to inject (string, number, boolean, JSON, timestamp, etc.)
- `topic` - optional topic string
- `repeat` - repeat interval (seconds, or cron expression)
- `once` - inject once on deploy

**Outputs**: 1 output port

**Example**: Inject a timestamp every 5 seconds
```json
{
  "type": "inject",
  "payload": "",
  "payloadType": "date",
  "topic": "",
  "repeat": "5",
  "once": false,
  "wires": [["debug-node-id"]]
}
```

## Debug

Displays messages in the debug sidebar panel.

**Type**: `debug`

**Properties**:
- `console` - also log to server console
- `complete` - property to display (default: `payload`)
- `tosidebar` - show in debug panel
- `severity` - log level

**Inputs**: 1 input port

## Catch

Catches errors thrown by nodes in the same flow.

**Type**: `catch`

**Properties**:
- `scope` - list of node IDs to catch errors from (empty = all)
- `uncaught` - catch only uncaught errors

**Outputs**: 1 output port with `msg.error` containing the error details

## Status

Receives status updates from other nodes.

**Type**: `status`

**Properties**:
- `scope` - list of node IDs to monitor (empty = all)

## Link In / Link Out

Creates virtual wires between nodes on different tabs.

**Types**: `link in`, `link out`, `link call`

**Properties**:
- `links` - array of target link node IDs
- `mode` - "link" or "return"

## Comment

Adds a visual comment to the canvas. No runtime effect.

**Type**: `comment`
