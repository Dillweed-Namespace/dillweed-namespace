#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
//  Dillweed MCP Server
//
//  Exposes the Dillweed Namespace's DillClaw Resolver and Registry as MCP
//  tools, allowing any MCP-compatible agent framework to resolve, look up,
//  and verify capability records.
//
//  Environment variables:
//    DILLCLAW_RESOLVER_URL  — DillClaw Resolver base URL
//                             (default: http://localhost:9474)
//    DILLWEED_REGISTRY_URL  — Dillweed Registry base URL
//                             (default: http://localhost:9475)
//
//  Usage (stdio transport):
//    node server.js
//
//  In Claude Code's MCP config (~/.claude/mcp.json):
//    {
//      "mcpServers": {
//        "dillweed": {
//          "command": "node",
//          "args": ["/path/to/dillweed-mcp-server/server.js"],
//          "env": {
//            "DILLCLAW_RESOLVER_URL": "http://localhost:9474",
//            "DILLWEED_REGISTRY_URL": "http://localhost:9475"
//          }
//        }
//      }
//    }
// ─────────────────────────────────────────────────────────────────────────────

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const RESOLVER_URL = (process.env.DILLCLAW_RESOLVER_URL || 'http://localhost:9474').replace(/\/+$/, '');
const REGISTRY_URL = (process.env.DILLWEED_REGISTRY_URL || 'http://localhost:9475').replace(/\/+$/, '');

// ── Tool definitions ─────────────────────────────────────────────────────────

const tools = [
  {
    name: 'dillweed_resolve',
    description:
      'Resolve a Dillweed capability URI through the DillClaw Resolver. ' +
      'Returns the capability record with trust score, trust signals, and ' +
      'signature verification status. The query must use the dillweed:// ' +
      'or dllwd:// URI scheme (e.g. "dillweed://review.spec.read").',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            'Capability URI to resolve (e.g. "dillweed://review.spec.read"). ' +
            'Must start with "dillweed://" or "dllwd://".',
        },
        version_pref: {
          type: 'string',
          description:
            'Optional version preference filter (e.g. ">=1.0.0", "^2.0"). ' +
            'When set, only records matching this semver range are returned.',
        },
        allow_unsigned: {
          type: 'boolean',
          description:
            'If true, include records with missing signatures in results. ' +
            'Defaults to false (only signed records returned).',
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'dillweed_lookup',
    description:
      'Look up a capability record by its dot-notation name in the Dillweed ' +
      'Registry. Returns the full record including description, endpoint, ' +
      'protocol, schemas, trust tier, permissions, version, and signature. ' +
      'Unlike resolve, this is a direct registry query without scoring.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Dot-notation capability name (e.g. "review.spec.read"). ' +
            'Do not include the dillweed:// scheme prefix.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'dillweed_verify',
    description:
      'Verify the DNSO Ed25519 cryptographic signature on a capability record. ' +
      'Returns whether the signature is present, valid, and which algorithm ' +
      'and public key were used for verification.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description:
            'Dot-notation capability name to verify (e.g. "review.spec.read").',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'dillweed_health',
    description:
      'Check the operational health of the DillClaw Resolver. Returns the ' +
      'resolver version, registry source (local or remote), DNSO key status, ' +
      'cache statistics, and uptime.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

// ── HTTP helper ──────────────────────────────────────────────────────────────

async function httpRequest(url, options = {}) {
  const { method = 'GET', body } = options;
  const headers = { 'Content-Type': 'application/json' };

  try {
    const fetchOptions = { method, headers };
    if (body) fetchOptions.body = JSON.stringify(body);

    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      data: {
        status: 'error',
        error_code: 'CONNECTION_FAILED',
        message: `Failed to connect to ${url}: ${error.message}`,
      },
    };
  }
}

// ── Tool handlers ────────────────────────────────────────────────────────────

async function handleResolve(args) {
  const { query, version_pref, allow_unsigned } = args;

  if (!query) {
    return { error: 'Missing required parameter: query' };
  }

  if (!query.startsWith('dillweed://') && !query.startsWith('dllwd://')) {
    return {
      error: `Query must start with "dillweed://" or "dllwd://". Got: "${query}"`,
      suggestion: query.includes('.')
        ? `Try "dillweed://${query}"`
        : null,
    };
  }

  const body = { query };
  if (version_pref) body.version_pref = version_pref;
  if (allow_unsigned) body.allow_unsigned = allow_unsigned;

  const result = await httpRequest(`${RESOLVER_URL}/resolve`, {
    method: 'POST',
    body,
  });

  return result.data;
}

async function handleLookup(args) {
  const { name } = args;

  if (!name) {
    return { error: 'Missing required parameter: name' };
  }

  const result = await httpRequest(
    `${REGISTRY_URL}/lookup/${encodeURIComponent(name)}`
  );

  return result.data;
}

async function handleVerify(args) {
  const { name } = args;

  if (!name) {
    return { error: 'Missing required parameter: name' };
  }

  const result = await httpRequest(
    `${REGISTRY_URL}/verify/${encodeURIComponent(name)}`
  );

  return result.data;
}

async function handleHealth() {
  const result = await httpRequest(`${RESOLVER_URL}/health`);
  return result.data;
}

// ── Tool dispatch ────────────────────────────────────────────────────────────

const toolHandlers = {
  dillweed_resolve: handleResolve,
  dillweed_lookup: handleLookup,
  dillweed_verify: handleVerify,
  dillweed_health: handleHealth,
};

// ── MCP server setup ─────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'dillweed-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Execute a tool
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  const handler = toolHandlers[name];
  if (!handler) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: `Unknown tool: ${name}`,
            available: Object.keys(toolHandlers),
          }),
        },
      ],
      isError: true,
    };
  }

  try {
    const result = await handler(args || {});
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error.message,
            tool: name,
          }),
        },
      ],
      isError: true,
    };
  }
});

// ── Start ────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Server is now running on stdio — the MCP client manages the lifecycle.
}

main().catch((error) => {
  console.error('Dillweed MCP Server failed to start:', error);
  process.exit(1);
});
