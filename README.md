# Exovon

Developer tools, CLI, TypeScript SDK, and Model Context Protocol (MCP) server for the Exovon Cloud Platform.

* Website: https://exovon.in
* Documentation: https://exovon.in/docs
* npm: https://www.npmjs.com/package/exovon

---

## Packages

| Package | Version | Description |
| :--- | :--- | :--- |
| [`exovon`](./packages/exovon) | [![npm](https://img.shields.io/npm/v/exovon.svg)](https://www.npmjs.com/package/exovon) | Main CLI binary and runtime wrapper |
| [`@exovon/sdk`](./packages/exovon-sdk) | [![npm](https://img.shields.io/npm/v/@exovon/sdk.svg)](https://www.npmjs.com/package/@exovon/sdk) | TypeScript / JavaScript API client |
| [`@exovon/mcp-server`](./packages/mcp-server) | [![npm](https://img.shields.io/npm/v/@exovon/mcp-server.svg)](https://www.npmjs.com/package/@exovon/mcp-server) | Model Context Protocol server for AI agents |
| [`exovon-cli`](./packages/exovon-cli) | [![npm](https://img.shields.io/npm/v/exovon-cli.svg)](https://www.npmjs.com/package/exovon-cli) | CLI alias package |
| [`create-exovon-app`](./packages/create-exovon-app) | [![npm](https://img.shields.io/npm/v/create-exovon-app.svg)](https://www.npmjs.com/package/create-exovon-app) | Project template initializer |

---

## CLI Usage

### Authentication

Authenticate the CLI against your Exovon account:

```bash
npx exovon login
```

Credentials are saved in `~/.exovon/auth.json` (mode 0600). For CI/CD environments, supply an API key directly:

```bash
export EXOVON_API_KEY="exo_live_..."
```

Verify your active session:

```bash
npx exovon whoami
```

### Deployment

Deploy a static directory (Vite, Astro, static export):

```bash
npx exovon deploy --static --output-dir dist
```

Deploy a containerized or full-stack application (Next.js, Node.js, Go, Python):

```bash
npx exovon deploy
```

Link a local directory to an existing project:

```bash
npx exovon link --project "my-project-id"
```

### Environment Variables

```bash
npx exovon env ls
npx exovon env set DATABASE_URL "postgres://..."
npx exovon env rm DATABASE_URL
npx exovon env pull .env.local
```

### Logs & Telemetry

Stream real-time compiler and runtime container logs:

```bash
npx exovon logs <deploymentId>
```

Roll back traffic to an earlier deployment:

```bash
npx exovon rollback <deploymentId>
```

---

## Model Context Protocol (MCP) Server

Connect Exovon tools to AI coding agents (Antigravity, Cursor, Claude Desktop):

```json
{
  "mcpServers": {
    "exovon": {
      "command": "npx",
      "args": ["-y", "@exovon/mcp-server"],
      "env": {
        "EXOVON_API_KEY": "exo_live_..."
      }
    }
  }
}
```

Exposed MCP tools:
* `exovon_deploy`: Trigger build pipeline or fast-path static promotion.
* `exovon_get_logs`: Fetch compiler and container runtime stdout/stderr.
* `exovon_status`: Retrieve project deployment status, region, and edge routing URLs.
* `exovon_rollback`: Point edge routing to a previous deployment.
* `exovon_database_query`: Execute parameterized SQL against ExoStore PostgreSQL.

---

## TypeScript SDK

```typescript
import { ExovonClient } from "@exovon/sdk";

const client = new ExovonClient({
  apiKey: process.env.EXOVON_API_KEY,
});

// List projects
const projects = await client.projects.list();

// Stream deployment logs
const logs = await client.deployments.getLogs("deploy_id");
```

---

## License

Apache-2.0
