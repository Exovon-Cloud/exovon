#!/usr/bin/env node

/**
 * Exovon Model Context Protocol (MCP) Server
 * Exposes deployment, logging, and database operations.
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { ExovonClient } = require('@exovon/sdk');

// Initialize SDK client (auto-loads EXOVON_API_KEY from environment or ~/.exovon/auth.json)
let client = null;
try {
  client = new ExovonClient();
} catch (err) {
  // Client will be instantiated on first call or when env is provided
}

function getClient() {
  if (!client) {
    client = new ExovonClient();
  }
  return client;
}

const server = new Server(
  {
    name: 'exovon-mcp-server',
    version: '1.4.2',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define tools according to official Exovon specification
const TOOLS = [
  {
    name: 'exovon_deploy',
    description: 'Packages code, dispatches build pipeline or fast-path static promotion, and returns deployment URL.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Target Exovon Project ID' },
        sourceDir: { type: 'string', description: 'Local path to project directory (default: current directory)' },
        framework: { type: 'string', description: 'Framework preset (nextjs, static, vite, remix, astro, docker)' },
        buildCommand: { type: 'string', description: 'Custom build command (e.g. npm run build)' },
        outputDir: { type: 'string', description: 'Build output directory (e.g. out, dist, .next)' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'exovon_get_logs',
    description: 'Streams recent compiler, container stdout, and stderr logs for a deployment.',
    inputSchema: {
      type: 'object',
      properties: {
        deployId: { type: 'string', description: 'Deployment ID' },
        limit: { type: 'number', description: 'Maximum log lines to return (default: 100)' },
      },
      required: ['deployId'],
    },
  },
  {
    name: 'exovon_status',
    description: 'Reports active project status, health, region, and live edge routing URLs.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Exovon Project ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'exovon_rollback',
    description: 'Points edge router to a previously healthy deployment with zero downtime.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Exovon Project ID' },
        targetDeploymentId: { type: 'string', description: 'Deployment ID to roll back to' },
      },
      required: ['projectId', 'targetDeploymentId'],
    },
  },
  {
    name: 'exovon_database_query',
    description: 'Executes a parameterized SQL query on the project ExoStore PostgreSQL database.',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: 'Exovon Project ID' },
        sql: { type: 'string', description: 'SQL statement to execute' },
        params: { type: 'array', description: 'Parameterized query arguments' },
      },
      required: ['projectId', 'sql'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const sdk = getClient();

  try {
    switch (name) {
      case 'exovon_deploy': {
        const result = await sdk.deployments.deploy({
          projectId: args.projectId,
          sourceDir: args.sourceDir || process.cwd(),
          framework: args.framework,
          buildCommand: args.buildCommand,
          outputDir: args.outputDir,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case 'exovon_get_logs': {
        const logs = await sdk.deployments.getLogs(args.deployId, {
          limit: args.limit || 100,
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(logs, null, 2),
            },
          ],
        };
      }

      case 'exovon_status': {
        const project = await sdk.projects.get(args.projectId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(project, null, 2),
            },
          ],
        };
      }

      case 'exovon_rollback': {
        const rollbackResult = await sdk.deployments.rollback(args.projectId, args.targetDeploymentId);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(rollbackResult, null, 2),
            },
          ],
        };
      }

      case 'exovon_database_query': {
        const queryRes = await sdk.request('/database/query', {
          method: 'POST',
          body: JSON.stringify({
            projectId: args.projectId,
            sql: args.sql,
            params: args.params || [],
          }),
        });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(queryRes, null, 2),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown Exovon MCP tool: ${name}`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error.message || String(error)}`,
        },
      ],
    };
  }
});

async function run() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

run().catch((err) => {
  console.error('Exovon MCP server failed to start:', err);
  process.exit(1);
});
