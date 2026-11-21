#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const { execSync } = require('child_process');
let _sdk = null;
function getSdk() {
  if (!_sdk) {
    try {
      _sdk = require('../dist/index.js');
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND' && (err.message.includes('../dist/index.js') || err.message.includes('dist/index.js'))) {
        console.error('\x1b[31mError:\x1b[0m @exovon/sdk build artifacts not found (dist/index.js is missing).');
        console.error('Please run \x1b[36mnpm run build\x1b[0m inside packages/exovon-sdk before running this command.\n');
        process.exit(1);
      }
      throw err;
    }
  }
  return _sdk;
}

const ExovonClient = new Proxy(function () {}, {
  construct(_, args) {
    const { ExovonClient: RealClient } = getSdk();
    return new RealClient(...args);
  },
  get(_, prop) {
    const { ExovonClient: RealClient } = getSdk();
    return RealClient[prop];
  }
});

const EXIT_CODES = {
  SUCCESS: 0,
  GENERAL_ERROR: 1,
  AUTH_ERROR: 2,
  USER_INPUT_ERROR: 3,
  NETWORK_TIMEOUT: 4,
};

const BANNER = `
  \x1b[36m███████╗██╗  ██╗ ██████╗ ██╗   ██╗ ██████╗ ███╗   ██╗\x1b[0m
  \x1b[36m██╔════╝╚██╗██╔╝██╔═══██╗██║   ██║██╔═══██╗████╗  ██║\x1b[0m
  \x1b[36m█████╗   ╚███╔╝ ██║   ██║██║   ██║██║   ██║██╔██╗ ██║\x1b[0m
  \x1b[36m██╔══╝   ██╔██╗ ██║   ██║╚██╗ ██╔╝██║   ██║██║╚██╗██║\x1b[0m
  \x1b[36m███████╗██╔╝ ██╗╚██████╔╝ ╚████╔╝ ╚██████╔╝██║ ╚████║\x1b[0m
  \x1b[36m╚══════╝╚═╝  ╚═╝ ╚═════╝   ╚═══╝   ╚═════╝ ╚═╝  ╚═══╝\x1b[0m
  \x1b[90mExovon CLI v1.4.3 • exovon.in\x1b[0m
`;

const HELP_TEXT = `
  USAGE:
    npx exovon <command> [options]

  COMMANDS:
    login              Authenticate with your Exovon API key
    whoami             Show the currently authenticated account
    logout             Revoke server session and remove stored credentials
    link               Link current directory to an Exovon project
    unlink             Remove project link from current directory
    deploy             Deploy current project to the edge network
    rollback           Roll back project to previous healthy deployment
    env                Manage project environment variables (add, ls, rm, pull)
    logs               Inspect runtime container stdout/stderr or build logs

  DEPLOY OPTIONS:
    --project <id>         Target project ID (optional if linked)
    --static               Force static fast-path deployment
    --dynamic              Force Cloud Build container pipeline
    --framework <fw>       Specify framework: static, nextjs, vite, astro, nuxt, remix, docker
    --source-dir <path>    Source directory to deploy (default: current directory)
    --root-dir <path>      Alias for --source-dir (monorepos)
    --build-command <cmd>  Custom build command (default: npm run build)
    --output-dir <dir>     Build output directory (default: dist)
    --json                 Output machine-readable JSON to stdout
    --help, -h             Show this help message

  LOGS OPTIONS:
    --project, -p <id>     Target project ID (auto-detected if directory is linked)
    --deployment, -d <id>  Target specific deployment ID (for build logs)
    --build                View build compilation logs instead of live runtime logs
    --follow, -f           Stream / tail live logs continuously
    --limit, -n <number>   Number of log entries to retrieve (default: 100)
    --json                 Output structured JSON logs to stdout

  ROLLBACK OPTIONS:
    npx exovon rollback [--project <id>] [--deployment <depId>]

  ENV OPTIONS:
    npx exovon env ls [--project <id>]
    npx exovon env add <key> <value> [--project <id>]
    npx exovon env rm <key> [--project <id>]
    npx exovon env pull [filename] [--project <id>]
`;

// Helper: Credentials Path Resolution
function getAuthPaths() {
  const configDir = path.join(os.homedir(), '.exovon');
  const authFile = path.join(configDir, 'auth.json');
  return { configDir, authFile };
}

// Helper: Read stored API key directly from ~/.exovon/auth.json
function getStoredApiKey() {
  const { authFile } = getAuthPaths();
  if (fs.existsSync(authFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(authFile, 'utf8'));
      if (data && data.apiKey && typeof data.apiKey === 'string') {
        return data.apiKey.trim();
      }
    } catch {
      // Corrupt file, return null
    }
  }
  return null;
}

// Helper: Resolve Active API Key (Env -> File -> Null)
function resolveApiKey() {
  if (process.env.EXOVON_API_KEY && process.env.EXOVON_API_KEY.trim()) {
    return process.env.EXOVON_API_KEY.trim();
  }
  return getStoredApiKey();
}

// Helper: POSIX 0600 / Windows NTFS Hardened Auth Storage
function saveAuthCredentials(apiKey) {
  const { configDir, authFile } = getAuthPaths();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  // POSIX: atomic 0600 write
  fs.writeFileSync(authFile, JSON.stringify({ apiKey, updatedAt: new Date().toISOString() }, null, 2), {
    mode: 0o600,
    flag: 'w',
  });

  // Explicitly enforce 0600 permissions even if the file already existed with broader mode
  if (process.platform !== 'win32') {
    try {
      fs.chmodSync(authFile, 0o600);
    } catch (err) {
      // Propagate critical permission failures, ignore only unsupported filesystem errors
      if (err.code !== 'ENOSYS' && err.code !== 'ENOTSUP') {
        console.warn(`\x1b[33mWarning:\x1b[0m Could not restrict auth file permissions (${err.message}). Ensure ${authFile} is protected.`);
      }
    }
  }

  // Windows: Strip inheritance and grant exclusive user access via icacls
  if (process.platform === 'win32') {
    try {
      execSync(`icacls "${authFile}" /inheritance:r /grant:r "%USERNAME%:(F)"`, { stdio: 'ignore' });
    } catch (err) {
      console.warn(`\x1b[33mWarning:\x1b[0m Could not restrict auth file ACLs (${err.message}). Ensure ${authFile} is protected.`);
    }
  }
}

// Helper: Remove Auth File
function removeAuthCredentials() {
  const { authFile } = getAuthPaths();
  if (fs.existsSync(authFile)) {
    fs.unlinkSync(authFile);
  }
}

// Helper: Resolve Linked Project ID from .exovon/project.json
function getLinkedProjectId(sourceDir = process.cwd()) {
  const projectFilePath = path.join(sourceDir, '.exovon', 'project.json');
  if (fs.existsSync(projectFilePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(projectFilePath, 'utf8'));
      return data.projectId || null;
    } catch {
      return null;
    }
  }
  return null;
}

// Helper: Save Project Link & Safe .gitignore Guard
function saveLinkedProject(projectId, sourceDir = process.cwd()) {
  const exovonDir = path.join(sourceDir, '.exovon');
  if (!fs.existsSync(exovonDir)) {
    fs.mkdirSync(exovonDir, { recursive: true, mode: 0o755 });
  }
  const projectFilePath = path.join(exovonDir, 'project.json');
  fs.writeFileSync(projectFilePath, JSON.stringify({ projectId, linkedAt: new Date().toISOString() }, null, 2), 'utf8');

  // Hardened: Safe .gitignore update with newline boundary verification
  const gitignorePath = path.join(sourceDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, 'utf8');
    const isIgnored = /(^|\n)\.exovon(\/|\s|$)/m.test(content);
    if (!isIgnored) {
      const prefix = content.length > 0 && !content.endsWith('\n') && !content.endsWith('\r') ? '\n' : '';
      fs.appendFileSync(gitignorePath, `${prefix}.exovon\n`, 'utf8');
    }
  } else {
    fs.writeFileSync(gitignorePath, '.exovon\n', 'utf8');
  }
}

// Helper: Remove Linked Project
function removeLinkedProject(sourceDir = process.cwd()) {
  const projectFilePath = path.join(sourceDir, '.exovon', 'project.json');
  if (fs.existsSync(projectFilePath)) {
    fs.unlinkSync(projectFilePath);
    return true;
  }
  return false;
}

// Helper: Prompt for Secret with Terminal Masking (No echo in TTY mode)
function promptSecret(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    if (stdin.isTTY) {
      process.stderr.write(query);
      let secret = '';
      const onData = (char) => {
        char = String(char);
        switch (char) {
          case '\n':
          case '\r':
          case '\u0004':
            stdin.removeListener('data', onData);
            stdin.setRawMode(false);
            stdin.pause();
            process.stderr.write('\n');
            resolve(secret.trim());
            break;
          case '\u0003': // Ctrl+C: Restore terminal raw mode before exit
            stdin.removeListener('data', onData);
            stdin.setRawMode(false);
            stdin.pause();
            process.stderr.write('\n');
            process.exit(EXIT_CODES.USER_INPUT_ERROR);
            break;
          case '\u007f': // Backspace
          case '\b':
            if (secret.length > 0) secret = secret.slice(0, -1);
            break;
          default:
            secret += char;
            break;
        }
      };
      stdin.setRawMode(true);
      stdin.resume();
      stdin.on('data', onData);
    } else {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(query, (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    }
  });
}

// Helper: Interactive text prompt
function promptText(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stderr,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// Helper: Standard Project Resolution Hierarchy
// 1. Explicit CLI flag (--project or -p)
// 2. Local directory context (.exovon/project.json)
// 3. Interactive prompt (if TTY and not headless JSON)
// 4. Fallback error
async function resolveProjectTarget(client, explicitProjectId, isJson) {
  if (explicitProjectId) {
    return explicitProjectId;
  }

  const linkedId = getLinkedProjectId();
  if (linkedId) {
    return linkedId;
  }

  if (process.stdin.isTTY && !isJson) {
    try {
      process.stderr.write('\x1b[90mResolving projects in your account...\x1b[0m\n');
      const { projects } = await client.projects.list();
      if (!projects || projects.length === 0) {
        throw new Error('No projects found in your Exovon account. Deploy a project first.');
      }
      if (projects.length === 1) {
        const only = projects[0];
        const projId = only.projectId || only.id;
        process.stderr.write(`\x1b[36mAuto-selected project:\x1b[0m \x1b[1m${projId}\x1b[0m\n\n`);
        return projId;
      }

      process.stderr.write('\n\x1b[1mSelect a project to inspect logs:\x1b[0m\n');
      projects.slice(0, 15).forEach((p, idx) => {
        const domain = p.customDomain || (p.subdomain ? `${p.subdomain}.exovon.co.in` : 'no domain');
        process.stderr.write(`  \x1b[36m${idx + 1})\x1b[0m \x1b[1m${p.name || p.projectId || p.id}\x1b[0m \x1b[90m(${domain})\x1b[0m\n`);
      });

      const answer = await promptText(`\nEnter selection (1-${Math.min(projects.length, 15)}) [default 1]: `);
      const selectedIdx = answer ? parseInt(answer, 10) - 1 : 0;
      if (isNaN(selectedIdx) || selectedIdx < 0 || selectedIdx >= projects.length) {
        throw new Error('Invalid project selection.');
      }
      const chosen = projects[selectedIdx];
      const selectedId = chosen.projectId || chosen.id;
      process.stderr.write(`Selected: \x1b[1m${selectedId}\x1b[0m\n\n`);
      return selectedId;
    } catch (err) {
      throw err;
    }
  }

  throw new Error('No project specified. Provide "--project <id>" or link this directory with "npx exovon link --project <id>".');
}

// Helper: ANSI Color-coded Log Formatter
function formatLogEntry(entry) {
  const ts = entry.timestamp ? new Date(entry.timestamp).toISOString() : new Date().toISOString();
  const timeStr = `\x1b[90m${ts}\x1b[0m`;

  let sevColor = '\x1b[36m';
  const sev = (entry.severity || 'INFO').toUpperCase();
  if (sev === 'ERROR' || sev === 'CRITICAL' || sev === 'EMERGENCY') {
    sevColor = '\x1b[31;1m';
  } else if (sev === 'WARN' || sev === 'WARNING') {
    sevColor = '\x1b[33m';
  } else if (sev === 'DEBUG') {
    sevColor = '\x1b[90m';
  }
  const sevTag = `${sevColor}[${sev.padEnd(5)}]\x1b[0m`;

  if (entry.httpRequest) {
    const hr = entry.httpRequest;
    const method = hr.method || 'GET';
    const path = hr.path || '/';
    const status = hr.status || 200;
    let statusColor = '\x1b[32m';
    if (status >= 500) statusColor = '\x1b[31;1m';
    else if (status >= 400) statusColor = '\x1b[33m';
    else if (status >= 300) statusColor = '\x1b[36m';

    const lat = hr.latency ? ` \x1b[90m(${hr.latency})\x1b[0m` : '';
    const ip = hr.remoteIp ? ` \x1b[90m- ${hr.remoteIp}\x1b[0m` : '';
    const msg = entry.message && entry.message !== `${method} ${status}` ? ` | ${entry.message}` : '';

    return `${timeStr} ${sevTag} \x1b[1m${method}\x1b[0m ${path} ${statusColor}${status}\x1b[0m${lat}${ip}${msg}`;
  }

  return `${timeStr} ${sevTag} ${entry.message || ''}`;
}

// Helper: Safe exit ensuring asynchronous stdout streams are fully flushed
function exitSuccess() {
  if (process.stdout.writableNeedDrain || (process.stdout.writableLength && process.stdout.writableLength > 0)) {
    process.stdout.once('drain', () => process.exit(EXIT_CODES.SUCCESS));
  } else {
    process.exit(EXIT_CODES.SUCCESS);
  }
}

// Helper: Clean Output Handler (JSON to stdout, messages to stderr in JSON mode)
function emitOutput(data, isJson, humanMessage) {
  if (isJson) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n');
  } else if (humanMessage) {
    console.log(humanMessage);
  }
}

function emitError(message, exitCode = EXIT_CODES.GENERAL_ERROR, isJson = false) {
  if (isJson) {
    process.stdout.write(JSON.stringify({ error: message, code: exitCode }, null, 2) + '\n', () => {
      process.exit(exitCode);
    });
  } else {
    console.error(`\x1b[31mERROR:\x1b[0m ${message}`);
    process.exit(exitCode);
  }
}

// MAIN ENTRY POINT
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const isJson = args.includes('--json');

  // Handle Help
  if (args.includes('--help') || args.includes('-h') || !command) {
    if (!isJson) {
      console.log(BANNER);
      console.log(HELP_TEXT);
    }
    exitSuccess();
    return;
  }

  // Print Approach B Wordmark only in interactive human TTY mode
  if (!isJson && process.stdout.isTTY) {
    console.log(BANNER);
  }

  // Handle LOGIN
  if (command === 'login') {
    let keyToVerify = '';
    const keyIdx = args.indexOf('--key');
    if (keyIdx !== -1 && args[keyIdx + 1]) {
      keyToVerify = args[keyIdx + 1].trim();
    } else {
      keyToVerify = await promptSecret('Enter your Exovon API Key (exo_live_...): ');
    }

    if (!keyToVerify) {
      emitError('API key cannot be empty.', EXIT_CODES.USER_INPUT_ERROR, isJson);
      return;
    }

    if (!/^exo_(live|agent|temp)_[a-zA-Z0-9_]{10,}$/.test(keyToVerify)) {
      emitError('Invalid API Key format. Expected format: exo_live_<userId>_<keyId>_<secret>', EXIT_CODES.USER_INPUT_ERROR, isJson);
      return;
    }

    if (!isJson) console.log('Validating API key against Exovon Cloud...');
    const testClient = new ExovonClient({ apiKey: keyToVerify });
    try {
      const user = await testClient.whoami();
      saveAuthCredentials(keyToVerify);
      const identity = user.username || user.email || user.uid;
      emitOutput(
        { success: true, user: { uid: user.uid, username: user.username, email: user.email, tier: user.tier } },
        isJson,
        `\x1b[32m✔ Successfully authenticated!\x1b[0m Logged in as \x1b[1m${identity}\x1b[0m.`
      );
      exitSuccess();
      return;
    } catch (err) {
      emitError(`Authentication failed: ${err.message}`, EXIT_CODES.AUTH_ERROR, isJson);
      return;
    }
  }

  // Handle WHOAMI
  if (command === 'whoami') {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      emitError('Not logged in. Run "npx exovon login" or set EXOVON_API_KEY.', EXIT_CODES.AUTH_ERROR, isJson);
      return;
    }
    const client = new ExovonClient({ apiKey });
    try {
      const user = await client.whoami();
      const identity = user.username || user.email || user.uid;
      emitOutput(
        { status: 'authenticated', user: { uid: user.uid, username: user.username, email: user.email, tier: user.tier } },
        isJson,
        `Logged in as \x1b[1m${identity}\x1b[0m${user.tier ? ` (${user.tier})` : ''}`
      );
      exitSuccess();
      return;
    } catch (err) {
      emitError(`Failed to fetch user identity: ${err.message}`, EXIT_CODES.AUTH_ERROR, isJson);
      return;
    }
  }

  // Handle LOGOUT (Server-Side Revocation of stored key + Local POSIX Unlink)
  if (command === 'logout') {
    const storedKey = getStoredApiKey();
    const envKey = process.env.EXOVON_API_KEY && process.env.EXOVON_API_KEY.trim();

    if (storedKey) {
      try {
        const client = new ExovonClient({ apiKey: storedKey });
        await client.revokeApiKey();
      } catch {
        // Continue to local deletion even if remote key was already deleted
      }
      removeAuthCredentials();
    } else {
      removeAuthCredentials();
    }

    if (envKey && !storedKey) {
      emitOutput(
        { success: true, message: 'EXOVON_API_KEY is active in your environment variables and was not revoked.' },
        isJson,
        '\x1b[33mNotice:\x1b[0m No stored login credentials found in ~/.exovon/auth.json. EXOVON_API_KEY is currently set in your shell environment. Unset it to completely log out.'
      );
    } else {
      let msg = '\x1b[32m✔ Logged out successfully.\x1b[0m Local session credentials revoked and removed.';
      if (envKey) {
        msg += ' \x1b[33m(Notice: EXOVON_API_KEY is still active in your shell environment)\x1b[0m';
      }
      emitOutput(
        { success: true, message: 'Logged out successfully' },
        isJson,
        msg
      );
    }
    exitSuccess();
    return;
  }

  // Handle LINK
  if (command === 'link') {
    let projectId = '';
    const projIdx = args.indexOf('--project');
    if (projIdx !== -1 && args[projIdx + 1] && !args[projIdx + 1].startsWith('--')) {
      projectId = args[projIdx + 1].trim();
    } else {
      emitError('Usage: npx exovon link --project <id>', EXIT_CODES.USER_INPUT_ERROR, isJson);
      return;
    }

    saveLinkedProject(projectId);
    emitOutput(
      { success: true, projectId },
      isJson,
      `\x1b[32m✔ Linked\x1b[0m current directory to project: \x1b[1m${projectId}\x1b[0m (saved in .exovon/project.json)`
    );
    exitSuccess();
    return;
  }

  // Handle UNLINK
  if (command === 'unlink') {
    const unlinked = removeLinkedProject();
    emitOutput(
      { success: true, unlinked },
      isJson,
      unlinked ? '\x1b[32m✔ Unlinked\x1b[0m project from current directory.' : 'No project was linked.'
    );
    exitSuccess();
    return;
  }

  // Verify Auth for all operational commands below
  const apiKey = resolveApiKey();
  if (!apiKey) {
    emitError('Not logged in. Run "npx exovon login" or export EXOVON_API_KEY.', EXIT_CODES.AUTH_ERROR, isJson);
    return;
  }

  const client = new ExovonClient({ apiKey });

  // Handle ENV command
  if (command === 'env') {
    await handleEnvCommand(client, args.slice(1), isJson);
    return;
  }

  // Handle DEPLOY command
  if (command === 'deploy') {
    await handleDeployCommand(client, args.slice(1), isJson);
    return;
  }

  // Handle ROLLBACK command
  if (command === 'rollback') {
    await handleRollbackCommand(client, args.slice(1), isJson);
    return;
  }

  // Handle LOGS command
  if (command === 'logs') {
    await handleLogsCommand(client, args.slice(1), isJson);
    return;
  }

  emitError(`Unknown command: "${command}". Run "npx exovon --help" for available commands.`, EXIT_CODES.USER_INPUT_ERROR, isJson);
}

// ROLLBACK COMMAND HANDLER
async function handleRollbackCommand(client, args, isJson) {
  let projectId = '';
  let deploymentId = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project':
        projectId = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '';
        break;
      case '--deployment':
        deploymentId = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '';
        break;
    }
  }

  if (!projectId) {
    projectId = getLinkedProjectId();
  }

  if (!projectId) {
    emitError('No project specified. Provide "--project <id>" or link this directory with "npx exovon link --project <id>".', EXIT_CODES.USER_INPUT_ERROR, isJson);
    return;
  }

  try {
    const res = await client.deployments.rollback(projectId, deploymentId || undefined);
    const successMsg = deploymentId
      ? `\x1b[32m✔ Rollback initiated\x1b[0m for project \x1b[1m${projectId}\x1b[0m to deployment \x1b[36m${deploymentId}\x1b[0m!`
      : `\x1b[32m✔ Rollback initiated\x1b[0m for project \x1b[1m${projectId}\x1b[0m! Traffic restored to previous healthy deployment.`;
    emitOutput(res, isJson, successMsg);
    exitSuccess();
    return;
  } catch (err) {
    emitError(err.message, EXIT_CODES.GENERAL_ERROR, isJson);
    return;
  }
}

// DEPLOY COMMAND HANDLER
async function handleDeployCommand(client, args, isJson) {
  let projectId = '';
  let buildCommand = 'npm run build';
  let outputDir = 'dist';
  let sourceDir = process.cwd();
  let forceStatic = false;
  let forceDynamic = false;
  let framework = '';

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project':       projectId = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : ''; break;
      case '--build-command': buildCommand = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : ''; break;
      case '--output-dir':    outputDir = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : ''; break;
      case '--source-dir':
      case '--root-dir':      sourceDir = args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : ''; break;
      case '--static':        forceStatic = true; break;
      case '--dynamic':       forceDynamic = true; break;
      case '--framework':     framework = (args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : '').toLowerCase(); break;
    }
  }

  // Auto-resolve project ID from local .exovon/project.json if omitted
  if (!projectId) {
    projectId = getLinkedProjectId(sourceDir);
  }

  if (!projectId) {
    emitError(
      'No project specified. Provide "--project <id>" or link this directory with "npx exovon link --project <id>".',
      EXIT_CODES.USER_INPUT_ERROR,
      isJson
    );
    return;
  }

  if (!fs.existsSync(sourceDir)) {
    emitError(`Source directory does not exist: ${sourceDir}`, EXIT_CODES.USER_INPUT_ERROR, isJson);
    return;
  }

  const deployType = forceStatic ? 'static' : (forceDynamic ? 'dynamic' : undefined);

  try {
    if (!isJson) {
      console.log(`Analyzing workspace in: \x1b[1m${sourceDir}\x1b[0m...`);
    }

    const deployOptions = {
      projectId,
      sourceDir,
      framework: framework || undefined,
      buildCommand: buildCommand || undefined,
      outputDir: outputDir || undefined,
      type: deployType,
    };

    if (deployType === 'static') {
      deployOptions.isPrebuilt = true;
    } else if (deployType === 'dynamic') {
      deployOptions.isPrebuilt = false;
    }

    const { deployId, fastPath, url } = await client.deployments.deploy(
      deployOptions,
      (step) => {
        if (!isJson) console.log(`[Deploy] ${step}`);
      }
    );

    const targetUrl = url || `https://${projectId}.exovon.co.in`;

    if (fastPath) {
      emitOutput(
        { status: 'READY', deployId, url: targetUrl, fastPath: true },
        isJson,
        `\n\x1b[32m✔ Fast-path static deployment promoted to Edge CDN in < 1s!\x1b[0m\nURL: \x1b[36m${targetUrl}\x1b[0m`
      );
      exitSuccess();
      return;
    }

    if (!isJson) {
      console.log(`Deployment initiated: \x1b[36m${deployId}\x1b[0m`);
      console.log('Streaming build logs...\n');
    }

    const pollRes = await client.deployments.pollLogs(deployId, (logLine) => {
      if (!isJson) process.stdout.write(logLine);
    });

    if (pollRes.success) {
      emitOutput(
        { status: 'READY', deployId, url: targetUrl },
        isJson,
        `\n\n\x1b[32m✔ Deployment completed successfully!\x1b[0m\nURL: \x1b[36m${targetUrl}\x1b[0m`
      );
      exitSuccess();
      return;
    } else {
      emitError(`Deployment failed with status: ${pollRes.finalStatus}`, EXIT_CODES.GENERAL_ERROR, isJson);
      return;
    }
  } catch (error) {
    const isTimeout = error.message && (error.message.includes('TIMEOUT') || error.message.includes('timeout'));
    emitError(error.message, isTimeout ? EXIT_CODES.NETWORK_TIMEOUT : EXIT_CODES.GENERAL_ERROR, isJson);
    return;
  }
}

// ENV COMMAND HANDLER
async function handleEnvCommand(client, args, isJson) {
  const subCommand = args[0];
  let projectId = '';

  for (let i = 1; i < args.length; i++) {
    if (args[i] === '--project') {
      projectId = args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : '';
      break;
    }
  }

  if (!projectId) {
    projectId = getLinkedProjectId();
  }

  if (!projectId) {
    emitError(
      'No project specified. Provide "--project <id>" or link this directory with "npx exovon link --project <id>".',
      EXIT_CODES.USER_INPUT_ERROR,
      isJson
    );
    return;
  }

  try {
    if (subCommand === 'ls') {
      const { keys } = await client.secrets.listKeys(projectId);
      emitOutput(
        { projectId, keys: keys || [] },
        isJson,
        (!keys || keys.length === 0)
          ? `No environment variables configured for project: ${projectId}`
          : `Environment variables for \x1b[1m${projectId}\x1b[0m:\n${keys.map(k => `  - ${k}: ********`).join('\n')}`
      );
      exitSuccess();
      return;
    } else if (subCommand === 'add') {
      const key = args[1];
      const value = args[2];
      if (!key || !value || key === '--project') {
        emitError('Usage: npx exovon env add <key> <value> [--project <id>]', EXIT_CODES.USER_INPUT_ERROR, isJson);
        return;
      }
      await client.secrets.update(projectId, { [key]: value }, { merge: true });
      emitOutput(
        { success: true, key, projectId },
        isJson,
        `\x1b[32m✔ Secret ${key} successfully updated for project ${projectId}.\x1b[0m`
      );
      exitSuccess();
      return;
    } else if (subCommand === 'rm') {
      const key = args[1];
      if (!key || key === '--project') {
        emitError('Usage: npx exovon env rm <key> [--project <id>]', EXIT_CODES.USER_INPUT_ERROR, isJson);
        return;
      }
      await client.secrets.delete(projectId, key);
      emitOutput(
        { success: true, key, projectId },
        isJson,
        `\x1b[32m✔ Secret ${key} successfully removed from project ${projectId}.\x1b[0m`
      );
      exitSuccess();
      return;
    } else if (subCommand === 'pull') {
      let filename = '.env.local';
      if (args[1] && args[1] !== '--project' && !args[1].startsWith('--')) {
        filename = args[1];
      }
      const { secrets } = await client.secrets.pull(projectId);
      if (!secrets || Object.keys(secrets).length === 0) {
        emitOutput(
          { success: true, count: 0, filename },
          isJson,
          `No environment variables configured to pull for project ${projectId}.`
        );
        exitSuccess();
        return;
      }
      let content = '';
      for (const [k, v] of Object.entries(secrets)) {
        const escaped = String(v)
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\r/g, '\\r')
          .replace(/\n/g, '\\n');
        content += `${k}="${escaped}"\n`;
      }
      fs.writeFileSync(path.join(process.cwd(), filename), content, 'utf8');
      emitOutput(
        { success: true, count: Object.keys(secrets).length, filename },
        isJson,
        `\x1b[32m✔ Successfully wrote ${Object.keys(secrets).length} variables to ${filename}\x1b[0m`
      );
      exitSuccess();
      return;
    } else {
      emitError(`Unknown env subcommand: "${subCommand}". Available: add, ls, rm, pull`, EXIT_CODES.USER_INPUT_ERROR, isJson);
      return;
    }
  } catch (err) {
    emitError(err.message, EXIT_CODES.GENERAL_ERROR, isJson);
    return;
  }
}

// LOGS COMMAND HANDLER
async function handleLogsCommand(client, args, isJson) {
  let explicitProjectId = '';
  let deploymentId = '';
  let isBuild = false;
  let isFollow = false;
  let limit = 100;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--project' || arg === '-p') {
      explicitProjectId = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : '';
    } else if (arg === '--deployment' || arg === '-d') {
      deploymentId = args[i + 1] && !args[i + 1].startsWith('-') ? args[++i] : '';
    } else if (arg === '--build') {
      isBuild = true;
    } else if (arg === '--follow' || arg === '-f') {
      isFollow = true;
    } else if (arg === '--limit' || arg === '-n') {
      const parsed = parseInt(args[i + 1], 10);
      if (!isNaN(parsed) && parsed > 0) {
        limit = parsed;
        i++;
      }
    }
  }

  // If deploymentId passed, default to build logs
  if (deploymentId) {
    isBuild = true;
  }

  let projectId = '';
  if (!deploymentId || !isBuild) {
    try {
      projectId = await resolveProjectTarget(client, explicitProjectId, isJson);
    } catch (err) {
      emitError(err.message, EXIT_CODES.USER_INPUT_ERROR, isJson);
      return;
    }
  } else {
    projectId = explicitProjectId || getLinkedProjectId() || '';
  }

  try {
    if (isBuild) {
      let targetDeployId = deploymentId;
      if (!targetDeployId) {
        if (!isJson) console.log(`\x1b[90mResolving latest deployment for project \x1b[1m${projectId}\x1b[0m...\x1b[0m`);
        const { revisions } = await client.deployments.listRevisions(projectId);
        if (!revisions || revisions.length === 0) {
          emitError(`No deployments found for project "${projectId}".`, EXIT_CODES.USER_INPUT_ERROR, isJson);
          return;
        }
        targetDeployId = revisions[0].deployId;
      }

      if (!isJson) {
        console.log(`\x1b[36mBuild logs for deployment:\x1b[0m \x1b[1m${targetDeployId}\x1b[0m${projectId ? ` (Project: ${projectId})` : ''}\n`);
      }

      if (isFollow) {
        const pollRes = await client.deployments.pollLogs(targetDeployId, (chunk) => {
          if (!isJson) process.stdout.write(chunk);
        });
        if (isJson) {
          emitOutput({ deployId: targetDeployId, success: pollRes.success, finalStatus: pollRes.finalStatus }, isJson);
        } else {
          console.log(`\n\x1b[90mBuild finished with status: \x1b[1m${pollRes.finalStatus}\x1b[0m`);
        }
        exitSuccess();
        return;
      } else {
        const res = await client.deployments.getBuildLogs(targetDeployId, 0);
        if (isJson) {
          emitOutput({ deployId: targetDeployId, status: res.status, content: res.newContent }, isJson);
        } else {
          if (res.newContent) {
            process.stdout.write(res.newContent);
            if (!res.newContent.endsWith('\n')) console.log('');
          } else {
            console.log('\x1b[90mNo build logs available yet for this deployment.\x1b[0m');
          }
          console.log(`\n\x1b[90mDeployment Status: \x1b[1m${res.status}\x1b[0m`);
        }
        exitSuccess();
        return;
      }
    }

    // Runtime Logs (Default)
    if (!isJson) {
      console.log(`\x1b[36mRuntime logs for project:\x1b[0m \x1b[1m${projectId}\x1b[0m (last ${limit} entries)\n`);
    }

    const { logs } = await client.deployments.getRuntimeLogs(projectId, limit);

    if (isJson && !isFollow) {
      emitOutput({ projectId, logs: logs || [] }, isJson);
      exitSuccess();
      return;
    }

    const chronologicalLogs = (logs || []).slice().reverse();
    const seenIds = new Set();

    for (const entry of chronologicalLogs) {
      if (entry.id) seenIds.add(entry.id);
      if (!isJson) {
        console.log(formatLogEntry(entry));
      } else {
        console.log(JSON.stringify(entry));
      }
    }

    if (chronologicalLogs.length === 0 && !isFollow && !isJson) {
      console.log(`\x1b[90mNo runtime logs recorded in the current window for svc-${projectId}.\x1b[0m`);
    }

    if (!isFollow) {
      exitSuccess();
      return;
    }

    if (!isJson) {
      console.log('\n\x1b[90m--- Streaming live runtime logs (Ctrl+C to exit) ---\x1b[0m\n');
    }

    let running = true;
    process.on('SIGINT', () => {
      running = false;
      if (!isJson) console.log('\n\x1b[90mLog stream closed.\x1b[0m');
      process.exit(0);
    });

    while (running) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const pollData = await client.deployments.getRuntimeLogs(projectId, 50);
        const newEntries = (pollData.logs || []).slice().reverse();
        for (const entry of newEntries) {
          if (!seenIds.has(entry.id)) {
            seenIds.add(entry.id);
            if (seenIds.size > 2000) {
              const firstKey = seenIds.values().next().value;
              seenIds.delete(firstKey);
            }
            if (!isJson) {
              console.log(formatLogEntry(entry));
            } else {
              console.log(JSON.stringify(entry));
            }
          }
        }
      } catch (pollErr) {
        // Suppress transient network hiccups while polling
      }
    }
  } catch (err) {
    emitError(err.message, EXIT_CODES.GENERAL_ERROR, isJson);
    return;
  }
}

main();


