# Function Nodes

## Function

Runs custom JavaScript code using QuickJS.

**Type**: `function`

**Properties**:
- `func` - JavaScript function body
- `outputs` - number of output ports
- `timeout` - execution timeout in seconds (default: 10)

**Example**: Transform payload to uppercase
```json
{
  "type": "function",
  "func": "msg.payload = msg.payload.toUpperCase();\nreturn msg;",
  "outputs": 1,
  "wires": [[]]
}
```

**Supported globals**: `msg`, `context`, `flow`, `global`, `console`, `Date`, `JSON`, `Math`, `parseInt`, `parseFloat`, `Array`, `Object`, `String`, `Number`, `Boolean`, `RegExp`, `setTimeout`, `setInterval`, `Buffer`.

## Switch

Routes messages to different output ports based on rules.

**Type**: `switch`

**Properties**:
- `rules` - array of conditions (property, comparison type, value)
- `checkall` - check all rules vs stop at first match
- `repair` - pass through original message

**Example**: Route by topic
```json
{
  "type": "switch",
  "property": "topic",
  "rules": [
    {"t": "eq", "v": "temperature"},
    {"t": "eq", "v": "humidity"}
  ],
  "checkall": false,
  "outputs": 2,
  "wires": [["temp-handler"], ["humidity-handler"]]
}
```

## Change

Modifies message properties.

**Type**: `change`

**Properties**:
- `rules` - array of operations:
  - `set` - set a property to a value
  - `change` - find/replace in a property
  - `move` - move a property
  - `delete` - delete a property

## Range

Maps a value from one range to another.

**Type**: `range`

**Properties**:
- `action` - "scale" or "clamp" or "wrap"
- `minin`, `maxin` - input range
- `minout`, `maxout` - output range

## Template

Generates text using Mustache templates.

**Type**: `template`

**Properties**:
- `field` - message property to store result (default: `payload`)
- `template` - Mustache template string
- `syntax` - "mustache" or "plain"

## Delay

Delays or rate-limits messages.

**Type**: `delay`

**Properties**:
- `pauseType` - "delay", "rate", "random", "delayV", "queue"
- `timeout` - delay duration
- `timeoutUnits` - "ms", "s", "min", "hr"
- `rate` - messages per rate period
- `nbRateUnits` - rate period
- `rateUnits` - "second", "minute", "hour"

## Trigger

Sends a message, then optionally sends a second message after a timeout.

**Type**: `trigger`

**Properties**:
- `op1` - first message payload
- `op2` - second message payload (or "reset" to cancel)
- `duration` - time between op1 and op2
- `extend` - extend delay on each incoming message
- `units` - time units

## Exec

Runs a system command.

**Type**: `exec`

**Properties**:
- `command` - command to execute
- `addpay` - append msg.payload to command
- `append` - extra arguments
- `useSpawn` - use spawn mode (streaming output)

## Filter (RBE)

Report by exception - only passes messages when the value changes.

**Type**: `rbe`

**Properties**:
- `func` - "rbe", "deadband", "narrowband"
- `gap` - deadband value
- `start` - initial value
