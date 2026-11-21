---
name: exovon-deploy
description: Deploy web projects, check compiler logs, roll back traffic, and query ExoStore PostgreSQL on Exovon.
---

# Exovon Deployment and Management

Use this skill when deploying web applications to Exovon, inspecting live build logs, or querying the project's ExoStore PostgreSQL database.

## Deployment Workflow

1. Authenticate or verify credentials:
   Ensure `EXOVON_API_KEY` is present in the environment or active session in `~/.exovon/auth.json`.

2. Call deployment tool:
   Invoke `exovon_deploy` passing:
   - `projectId`: Target Exovon project ID.
   - `sourceDir`: Directory containing the web application.
   - `framework`: `nextjs`, `vite`, `static`, `remix`, `astro`, or `docker`.

3. Stream build logs:
   Call `exovon_get_logs` with the returned `deployId` to monitor compiler and container outputs.

4. Check health:
   Call `exovon_status` with `projectId` to confirm edge URL and container routing health.
