# @exovon/sdk

The official Node.js / TypeScript SDK and CLI for the Exovon Cloud Platform.

## Installation
```bash
npm install @exovon/sdk
```

## CLI Usage
You can run zero-config deployments directly from your terminal:
```bash
# 1. Authenticate once (saved securely in ~/.exovon/auth.json with 0600 permissions)
npx exovon login

# 2. Check current authenticated account (zero secret leakage)
npx exovon whoami

# 3. Link current directory to an Exovon project
npx exovon link

# 4. Deploy your current directory to the edge network
npx exovon deploy

# Manage environment variables securely
npx exovon env ls
npx exovon env add DATABASE_URL "postgres://..."
npx exovon env pull .env.production
```

## Programmatic Usage

### 1. Initialization
```typescript
import { ExovonClient } from '@exovon/sdk';

const client = new ExovonClient({
  apiKey: process.env.EXOVON_API_KEY, // Or omitted to load from process.env / ~/.exovon/auth.json
  maxRetries: 3, // Auto-retries with static Idempotency-Key
});

// Verify authenticated identity (zero token or PII leakage)
const user = await client.whoami();
console.log(`Authenticated user ID: ${user.uid} (${user.tier})`);
```

### 2. Autonomous Deployments & Rollbacks
```typescript
// Deploy workspace with progress callback
const deployment = await client.deployments.deploy({
  projectId: 'my-project',
  sourceDir: './',
  framework: 'nextjs',
  buildCommand: 'npm run build',
  outputDir: '.next',
}, (status) => console.log(status));

// Fetch Crash Logs (for AI Debugging)
const { logs } = await client.deployments.getCrashLogs('my-project', 60);

// Instant Zero-Downtime Rollback
await client.deployments.rollback('my-project');
```

### 3. Agentic Infrastructure
```typescript
// Provision a PostgreSQL DB dynamically
const db = await client.infrastructure.provisionDatabase('prod', { type: 'postgres' });
```

### 4. Secrets Management
```typescript
// Introspect configured keys
const { keys } = await client.secrets.listKeys('prod');

// Update Secrets (4KB Limit)
await client.secrets.update('prod', {
    STRIPE_KEY: 'sk_live_123...'
});
```

---

## React & Next.js Core Web Vitals (Speed Insights)

Automatically collect and stream Google-standard $p75$ Core Web Vitals (LCP, INP, CLS, TTFB, FCP) directly to your Exovon project dashboard with zero configuration and zero API keys:

```tsx
// app/layout.tsx or src/App.tsx
import { SpeedInsights } from '@exovon/sdk/react'; // or { ExovonSpeedInsights }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
```

> **🔒 Zero Credentials / Security Guarantee:**
> Speed Insights executes client-side inside end-users' web browsers. Telemetry is automatically and anonymously intercepted by the Exovon Edge Router at `/_exovon/vitals` with **zero authentication credentials or API keys required**.
## 🔐 Exovon Auth Client

Lightweight, type-safe authentication for your web, mobile, and full-stack applications powered by Exovon Auth Engine:

```typescript
// 1. Initialize Auth Client
import { createExovonAuthClient, signIn, signUp, signOut, useSession } from '@exovon/sdk/auth';

export const auth = createExovonAuthClient({
  projectId: 'my-project-id', // Automatically routes to https://auth.exovon.co.in/p/my-project-id/api/auth
});

// 2. Sign Up with Email & Password
const { data, error } = await signUp.email({
  email: 'developer@example.com',
  password: 'SecurePassword123!',
  name: 'Alex Rivera',
});

// 3. Sign In with OAuth (GitHub, Google, etc.)
await signIn.social({
  provider: 'github',
  callbackURL: '/dashboard',
});

// 4. Client Session Hook in React
const { data: session, isPending } = useSession();
```

---

## License
MIT

