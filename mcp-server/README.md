# Dillweed MCP Server

An MCP (Model Context Protocol) server that exposes the Dillweed Namespace's
capability resolution, lookup, and verification as standard MCP tools. Any
MCP-compatible agent framework can resolve Dillweed capabilities without
writing custom HTTP calls.

## Tools

| Tool | Description |
|------|-------------|
| `dillweed_resolve` | Resolve a capability URI through DillClaw (e.g. `dillweed://review.spec.read`). Returns the capability record with trust score, trust signals, and signature verification status. |
| `dillweed_lookup` | Look up a capability record by dot-notation name in the Registry. Returns the full record without scoring. |
| `dillweed_verify` | Verify the DNSO Ed25519 signature on a capability record. |
| `dillweed_health` | Check the DillClaw Resolver's operational health. |

## Requirements

- Node.js 20 or later
- A running DillClaw Resolver (default: `http://localhost:9474`)
- A running Dillweed Registry (default: `http://localhost:9475`)

## Installation

```bash
cd mcp-server
npm install
```

## Configuration

The server reads two environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DILLCLAW_RESOLVER_URL` | `http://localhost:9474` | DillClaw Resolver base URL |
| `DILLWEED_REGISTRY_URL` | `http://localhost:9475` | Dillweed Registry base URL |

When a public resolver becomes available (e.g. `https://resolver.dillweed.com`),
change `DILLCLAW_RESOLVER_URL` to point at it. No code changes required.

## Usage with Claude Code

Add the server to your Claude Code MCP configuration at `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "dillweed": {
      "command": "node",
      "args": ["/path/to/dillweed-namespace/mcp-server/server.js"],
      "env": {
        "DILLCLAW_RESOLVER_URL": "http://localhost:9474",
        "DILLWEED_REGISTRY_URL": "http://localhost:9475"
      }
    }
  }
}
```

Claude Code will then have access to the four Dillweed tools in any session.

## Usage with other MCP clients

The server uses the standard stdio transport. Any MCP client that supports
stdio-based servers can connect:

```bash
node server.js
```

The server communicates via stdin/stdout using the MCP JSON-RPC protocol.

## Example: resolving a capability

Once connected, an MCP client can call:

```json
{
  "tool": "dillweed_resolve",
  "arguments": {
    "query": "dillweed://review.spec.read"
  }
}
```

Response:

```json
{
  "status": "resolved",
  "results": [
    {
      "rank": 1,
      "capability": {
        "name": "review.spec.read",
        "description": "Allows the Dillweed Protocol Steward Agent to read...",
        "trust_tier": "verified",
        "signature": "dnso_v1_Z1gYgzs37Ozni..."
      },
      "trust_score": 0.59,
      "trust_signals": [
        "dnso_verified",
        "sig_valid",
        "sig_verified",
        "endpoint_unchecked"
      ]
    }
  ]
}
```

## Architecture

```
MCP Client (Claude Code, NanoClaw, etc.)
    ↓ stdio (MCP JSON-RPC)
Dillweed MCP Server
    ↓ HTTP
DillClaw Resolver (:9474)     — resolve, health
Dillweed Registry (:9475)     — lookup, verify
    ↓
Ed25519 signature verification against DNSO trust root
```

The MCP server is a thin protocol adapter. It adds no business logic — all
trust decisions, signature verification, and scoring are handled by the
Resolver and Registry.

## License

Apache License, Version 2.0.
