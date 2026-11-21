# exovon

The official Command Line Interface (CLI) and developer toolkit for the [Exovon Cloud Platform](https://exovon.in).

## Quickstart

Run directly without installation:

```bash
npx exovon --help
```

Or install globally:

```bash
npm install -g exovon
```

## Authentication

Authenticate your terminal session (credentials saved securely in `~/.exovon/auth.json` with 0600 POSIX permissions):

```bash
npx exovon login
```

Alternatively, provide your API key via environment variable:

```bash
export EXOVON_API_KEY="exo_live_..."
```

## Commands

- `npx exovon deploy [--project <id>] [--prebuilt]` — Deploy current directory to edge network
- `npx exovon projects ls` — List your projects across regions
- `npx exovon logs <deployId>` — Stream real-time container and build logs
- `npx exovon rollback <deployId>` — Roll back to an earlier healthy deployment
- `npx exovon env ls` — List encrypted environment variables
- `npx exovon env set <key> <val>` — Set an environment variable
- `npx exovon env rm <key>` — Remove an environment variable
- `npx exovon env pull [.env]` — Pull environment variables to a local file
- `npx exovon whoami` — Display active tenant session metadata
- `npx exovon logout` — Clear stored credentials

## Programmatic Usage

You can also import Exovon as a TypeScript / JavaScript SDK:

```typescript
import { ExovonClient } from 'exovon';

const client = new ExovonClient(); // Automatically loads EXOVON_API_KEY or ~/.exovon/auth.json
const projects = await client.projects.list();
console.log(projects);
```

For modular React telemetry and auth components, install `@exovon/sdk`:

```bash
npm install @exovon/sdk
```

## Documentation

- Official Docs: [https://exovon.in/docs](https://exovon.in/docs)
- SDK Guide: [https://exovon.in/docs/sdk](https://exovon.in/docs/sdk)
- Dashboard: [https://exovon.in/dashboard](https://exovon.in/dashboard)

## License

Apache-2.0
