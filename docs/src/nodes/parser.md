# Parser Nodes

## CSV

Parses CSV strings or generates CSV from objects.

**Type**: `csv`

**Properties**:
- `temp` - column template (comma-separated headers)
- `sep` - field separator (default: `,`)
- `quo` - quote character (default: `"`)
- `mul` - parse multiple CSV records
- `hdr` - first line contains headers
- `hdrin` - input contains headers
- `ret` - line ending: `\n`, `\r\n`
- `thin` - output as array of rows vs array of objects

## JSON

Parses JSON strings or stringifies objects.

**Type**: `json`

**Properties**:
- `action` - "": auto-detect, "obj": parse to object, "str": stringify
- `property` - property to convert (default: `payload`)

## XML

Parses XML strings or generates XML from objects.

**Type**: `xml`

**Properties**:
- `property` - property to convert (default: `payload`)
- `action` - "" auto-detect, "xml2js": parse, "js2xml": generate

## YAML

Parses YAML strings or generates YAML from objects.

**Type**: `yaml`

**Properties**:
- `property` - property to convert (default: `payload`)
- `action` - auto-detect, "object", "string"

## HTML

Extracts data from HTML using CSS selectors.

**Type**: `html`

**Properties**:
- `property` - property containing HTML (default: `payload`)
- `out` - output format: "html", "text", "attr"
- `tag` - CSS selector
- `ret` - return: "html" or "text"
