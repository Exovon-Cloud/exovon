# @exovon/mcp-server

Official [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server for the [Exovon Cloud Platform](https://exovon.in).

Connect autonomous AI agents (Cursor, Claude Desktop, Antigravity, custom agentic workflows) to your Exovon infrastructure to deploy applications, inspect real-time logs, manage database queries, and perform rollbacks.

## Configuration

Add this to your MCP configuration file (e.g. `claude_desktop_config.json` or `mcp.json`):

```json
{
  "mcpServers": {
    "exovon": {
      "command": "npx",
      "args": ["-y", "@exovon/mcp-server@latest"],
      "env": {
        "EXOVON_API_KEY": "exo_live_your_api_key_here"
      }
    }
  }
}
```

## Available Tools

- `exovon_deploy`: Packages code, dispatches deployment pipeline, and returns edge URL
- `exovon_get_logs`: Streams compiler and runtime logs for troubleshooting
- `exovon_status`: Checks project health, region allocation, and active URLs
- `exovon_rollback`: Instantly points edge router to a previous stable deployment
- `exovon_database_query`: Executes parameterized SQL queries on ExoStore PostgreSQL

## Documentation

[https://exovon.in/docs/ai-agents](https://exovon.in/docs/ai-agents)
