import type { ExovonClient } from '../client';
import { ExovonError } from '../errors';
import fs from 'fs';
import path from 'path';

export interface DeployRequestOptions {
  projectId: string;
  framework?: string;
  buildCommand?: string;
  outputDir?: string;
  rootDir?: string;
  githubRepoFullName?: string;
  isPrebuilt?: boolean;
}

export interface DeployRequestResult {
  deployId: string;
  requiresUpload: boolean;
  gcsUploadUrl?: string;
  expiresAt?: string;
}

export interface LocalDeployOptions extends DeployRequestOptions {
  sourceDir: string;
}

export interface RuntimeLogEntry {
  id: string;
  timestamp: string;
  severity: string;
  message: string;
  httpRequest?: {
    method?: string;
    path?: string;
    status?: number;
    latency?: string;
    userAgent?: string;
    remoteIp?: string;
    referer?: string;
  } | null;
  host?: string;
}

export interface RuntimeLogsResponse {
  logs: RuntimeLogEntry[];
}

export interface BuildLogsResponse {
  status: string;
  newContent: string;
  nextOffset: number;
}

export class DeploymentsClient {
  constructor(private client: ExovonClient) {}

  /**
   * Request deployment allocation and optional upload destination.
   */
  public async request(options: DeployRequestOptions): Promise<DeployRequestResult> {
    return await this.client.request('/deploy/request', {
      method: 'POST',
      body: JSON.stringify(options)
    });
  }

  /**
   * Uploads project archive to pre-signed storage URL.
   */
  public async upload(zipData: Buffer | NodeJS.ReadableStream, uploadUrl: string, sizeMB?: number): Promise<void> {
    const MAX_SIZE_MB = 100;
    
    if (Buffer.isBuffer(zipData)) {
      sizeMB = zipData.length / (1024 * 1024);
    }
    
    if (sizeMB && sizeMB > MAX_SIZE_MB) {
      throw new ExovonError(`Upload exceeds ${MAX_SIZE_MB}MB safety limit. Size: ${sizeMB.toFixed(2)}MB`, 400, 'PAYLOAD_TOO_LARGE');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/zip'
    };

    if (Buffer.isBuffer(zipData)) {
      headers['Content-Length'] = zipData.length.toString();
    }

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      // @ts-ignore - Node.js fetch accepts Streams with duplex half
      body: zipData,
      duplex: 'half'
    });

    if (!response.ok) {
      throw new ExovonError(`Failed to upload to storage: ${response.statusText}`, response.status, 'UPLOAD_FAILED');
    }
  }

  /**
   * Dispatches build pipeline or static promotion.
   */
  public async start(deployId: string, fastPath: boolean = false): Promise<{ success: boolean; deployId: string; buildId?: string; url?: string }> {
    return await this.client.request('/deploy/start', {
      method: 'POST',
      body: JSON.stringify({ deployId, fastPath })
    });
  }

  /**
   * Helper: Zips a local directory to a temp file on disk, applying security exclusions.
   * Returns the path to the temporary zip file.
   */
  private async zipDirectory(sourceDir: string, onProgress?: (msg: string) => void): Promise<string> {
    if (!fs.existsSync(sourceDir)) {
      throw new ExovonError(`Source directory not found: ${sourceDir}`, 404, 'DIR_NOT_FOUND');
    }

    const os = require('os');
    const tmpZipPath = path.join(os.tmpdir(), `exovon-deploy-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.zip`);
    const output = fs.createWriteStream(tmpZipPath);

    let mod: any;
    try {
      // @ts-ignore - optional dynamic import fallback
      mod = await import('archiver');
    } catch {
      mod = require('archiver');
    }

    const options = { zlib: { level: 9 } };
    let archive: any;
    if (mod.ZipArchive) {
      archive = new mod.ZipArchive(options);
    } else if (typeof mod === 'function') {
      archive = mod('zip', options);
    } else if (mod.default && typeof mod.default === 'function') {
      archive = mod.default('zip', options);
    } else if (mod.default && mod.default.ZipArchive) {
      archive = new mod.default.ZipArchive(options);
    } else {
      throw new ExovonError('Failed to initialize archiver module', 500, 'ZIP_INIT_ERROR');
    }

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve(tmpZipPath));
      archive.on('error', (err: any) => reject(new ExovonError(`Zipping failed: ${err.message}`, 500, 'ZIP_ERROR')));

      archive.pipe(output);

      // Default security & heavy build cache exclusions
      const ignore = [
        '.env*',
        '*.log',
        '.DS_Store',
        'Thumbs.db',
        'node_modules/**',
        '**/node_modules/**',
        '.git/**',
        '**/.git/**',
        '.next/**',
        '**/.next/**',
        '.turbo/**',
        '**/.turbo/**',
        '.cache/**',
        '**/.cache/**',
        '.output/**',
        '**/.output/**',
        'build/**',
        '**/build/**',
        'coverage/**',
        '**/.exovon/**',
        '.exovon-shadow/**'
      ];

      // Auto-ignore dist/out unless deploying prebuilt directory
      if (!sourceDir.endsWith('dist') && !sourceDir.endsWith('dist/') && !sourceDir.endsWith('out') && !sourceDir.endsWith('out/')) {
        ignore.push('dist/**', '**/dist/**', 'out/**', '**/out/**');
      }

      let detectedIgnore = 'built-in defaults (.next, node_modules)';

      // Parse .gitignore if present to auto-exclude user-ignored files
      const gitignorePath = path.join(sourceDir, '.gitignore');
      if (fs.existsSync(gitignorePath)) {
        try {
          const gitignoreLines = fs.readFileSync(gitignorePath, 'utf8').split('\n');
          let count = 0;
          for (const line of gitignoreLines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('!')) {
              ignore.push(trimmed);
              if (trimmed.endsWith('/')) {
                ignore.push(`${trimmed}**`);
              }
              count++;
            }
          }
          if (count > 0) detectedIgnore = `.gitignore (${count} rules)`;
        } catch {
          // Ignore read failures
        }
      }

      // Parse .exovonignore if it exists (takes highest precedence)
      const ignorePath = path.join(sourceDir, '.exovonignore');
      if (fs.existsSync(ignorePath)) {
        try {
          const lines = fs.readFileSync(ignorePath, 'utf8').split('\n');
          let exoCount = 0;
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
              ignore.push(trimmed);
              if (trimmed.endsWith('/')) {
                ignore.push(`${trimmed}**`);
              }
              exoCount++;
            }
          }
          if (exoCount > 0) detectedIgnore = `.exovonignore (${exoCount} rules)`;
        } catch {
          // Ignore read failures
        }
      }

      if (onProgress) {
        onProgress(`Packaging workspace (using ${detectedIgnore})...`);
      }

      archive.glob('**/*', {
        cwd: sourceDir,
        ignore: ignore,
        dot: true
      });

      archive.finalize();
    });
  }

  /**
   * Helper: Determines if a local project directory is a pure static / pre-built workspace.
   * Used for auto-detection when --static/--dynamic is not explicitly specified.
   */
  public isPrebuiltProject(sourceDir: string): boolean {
    const pkgPath = path.join(sourceDir, 'package.json');
    const indexHtmlPath = path.join(sourceDir, 'index.html');
    const hasIndexHtml = fs.existsSync(indexHtmlPath);

    if (!fs.existsSync(pkgPath)) {
      return hasIndexHtml;
    }

    try {
      const pkgContent = fs.readFileSync(pkgPath, 'utf8');
      const pkg = JSON.parse(pkgContent);
      
      const hasBuildScript = pkg.scripts && (pkg.scripts.build || pkg.scripts['build:prod']);
      const hasFrameworkDeps = pkg.dependencies && (
        pkg.dependencies.next || 
        pkg.dependencies.vite || 
        pkg.dependencies.astro ||
        pkg.dependencies.nuxt ||
        pkg.dependencies['@remix-run/react']
      );

      if (hasBuildScript || hasFrameworkDeps || fs.existsSync(path.join(sourceDir, 'Dockerfile'))) {
        return false;
      }
    } catch (e) {
      // Ignored
    }

    return hasIndexHtml;
  }

  /**
   * Orchestrates the entire deployment lifecycle locally:
   * 1. Detects Fast-Path vs Build-Path (or uses explicit override)
   * 2. Zips the directory
   * 3. Requests upload URL
   * 4. Uploads zip safely
   * 5. Promotes instantly (Fast-Path) or triggers Cloud Build (Build-Path)
   */
  public async deploy(
    options: LocalDeployOptions,
    onProgress?: (step: string) => void
  ): Promise<{ deployId: string; buildId?: string; url?: string; fastPath?: boolean }> {
    // Resolve isPrebuilt: explicit override from CLI flags takes priority over auto-detection
    const isPrebuilt = options.isPrebuilt !== undefined ? options.isPrebuilt : this.isPrebuiltProject(options.sourceDir);
    const deployOpts: DeployRequestOptions = { ...options, isPrebuilt };

    if (options.githubRepoFullName) {
      if (onProgress) onProgress('Requesting GitHub deployment...');
      const reqRes = await this.request(deployOpts);
      if (onProgress) onProgress('Triggering Cloud Build pipeline...');
      const startRes = await this.start(reqRes.deployId, false);
      return { deployId: reqRes.deployId, buildId: startRes.buildId };
    }

    if (isPrebuilt) {
      if (onProgress) onProgress('Deploying static project...');
    } else {
      if (onProgress) onProgress('Packaging workspace...');
    }

    const tmpZipPath = await this.zipDirectory(options.sourceDir, onProgress);
    
    try {
      const stats = fs.statSync(tmpZipPath);
      const sizeMb = stats.size / (1024 * 1024);
      
      if (sizeMb > 25 && onProgress) {
        onProgress(`Notice: Workspace payload is ${sizeMb.toFixed(1)}MB.`);
      }

      if (onProgress) onProgress(`Requesting upload URL (${sizeMb.toFixed(2)}MB)...`);
      const reqRes = await this.request(deployOpts);
      
      if (reqRes.requiresUpload && reqRes.gcsUploadUrl) {
        if (onProgress) onProgress('Uploading payload...');
        const stream = fs.createReadStream(tmpZipPath);
        await this.upload(stream, reqRes.gcsUploadUrl, sizeMb);
      }
      
      if (isPrebuilt) {
        if (onProgress) onProgress('Promoting to edge network...');
        const startRes = await this.start(reqRes.deployId, true);
        const resolvedUrl = (startRes.url && !startRes.url.includes('undefined'))
          ? startRes.url
          : `https://${options.projectId}.exovon.co.in`;
        return { deployId: reqRes.deployId, url: resolvedUrl, fastPath: true };
      } else {
        if (onProgress) onProgress('Triggering build pipeline...');
        const startRes = await this.start(reqRes.deployId, false);
        return { deployId: reqRes.deployId, buildId: startRes.buildId, fastPath: false };
      }
    } finally {
      if (fs.existsSync(tmpZipPath)) {
        fs.unlinkSync(tmpZipPath);
      }
    }
  }

  /**
   * Polls the deployment status and streams logs via offset pagination.
   */
  public async pollLogs(
    deployId: string,
    onLogUpdate?: (log: string) => void,
    timeoutMs: number = 3600 * 1000 // Default 60 minutes to cover maximum plan tier
  ): Promise<{ success: boolean; finalStatus: string }> {
    let offset = 0;
    const startTime = Date.now();
    const BUILD_TIMEOUT = timeoutMs;
    const AWAITING_BUILD_TIMEOUT = 300 * 1000; // 5 minutes awaiting worker allocation
    let isBuilding = false;

    while (true) {
      const elapsed = Date.now() - startTime;
      
      if (!isBuilding && elapsed > AWAITING_BUILD_TIMEOUT) {
        return { success: false, finalStatus: 'TIMEOUT_AWAITING_BUILD' };
      }
      if (isBuilding && elapsed > BUILD_TIMEOUT) {
        return { success: false, finalStatus: 'TIMEOUT_BUILDING' };
      }

      try {
        const res = await this.client.request<{ status: string; newContent: string; nextOffset: number }>(`/deploy/${deployId}/logs?offset=${offset}`, {
          method: 'GET'
        });

        if (res.newContent && onLogUpdate) {
          onLogUpdate(res.newContent);
        }
        offset = res.nextOffset || offset;

        const statusUpper = res.status ? res.status.toUpperCase() : '';

        if (statusUpper === 'BUILDING' || statusUpper === 'PROVISIONING' || statusUpper === 'AWAITING_START') {
          isBuilding = true;
        }

        if (statusUpper === 'SUCCESS' || statusUpper === 'READY') {
          return { success: true, finalStatus: statusUpper };
        } else if (statusUpper === 'FAILED' || statusUpper === 'TIMEOUT') {
          return { success: false, finalStatus: statusUpper };
        }

      } catch (err: any) {
        if (err.status !== 404) {
          // Ignore 404s temporarily if Cloud Build hasn't flushed logs yet
          console.error('Polling error:', err.message);
        }
      }

      // 3s interval
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  /**
   * Triggers a zero-downtime restart for a dynamic Edge Node project.
   */
  public async restart(projectId: string): Promise<{ success: boolean; revision: string }> {
    return await this.client.request('/deploy/restart', {
      method: 'POST',
      body: JSON.stringify({ projectId })
    });
  }

  /**
   * Promotes or rolls back a specific deployment to 100% traffic.
   */
  public async promote(deployId: string): Promise<{ success: boolean; message: string }> {
    return await this.client.request(`/deploy/${deployId}/promote`, {
      method: 'POST'
    });
  }

  /**
   * Fetches runtime crash logs for a project.
   */
  public async getCrashLogs(projectId: string, timeframeMinutes: number = 60): Promise<{ logs: string }> {
    return await this.client.request(`/deploy/${projectId}/crash-logs?timeframe=${timeframeMinutes}`, {
      method: 'GET'
    });
  }

  /**
   * Lists historical deployment revisions.
   */
  public async listRevisions(projectId: string): Promise<{ revisions: Array<{ deployId: string, status: string, createdAt: string }> }> {
    return await this.client.request(`/deploy/${projectId}/revisions`, {
      method: 'GET'
    });
  }

  /**
   * Rolls back a project to a specific deployment revision.
   */
  public async rollback(projectId: string, deploymentId?: string): Promise<{ success: boolean; deployId: string; message: string }> {
    return await this.client.request(`/deploy/${projectId}/rollback`, {
      method: 'POST',
      body: JSON.stringify(deploymentId ? { deploymentId } : {})
    });
  }

  /**
   * Retrieves live runtime console and HTTP access logs from Cloud Logging for a project.
   * Scoped strictly to the authenticated owner's Cloud Run service.
   * @param projectId The unique ID of the project
   * @param limit Maximum number of log entries to retrieve (default: 100)
   */
  public async getRuntimeLogs(projectId: string, limit: number = 100): Promise<RuntimeLogsResponse> {
    return await this.client.request(`/deploy/${projectId}/runtime-logs?limit=${limit}`, {
      method: 'GET'
    });
  }

  /**
   * Retrieves build compilation logs for a deployment using offset pagination.
   * @param deployId The unique deployment ID
   * @param offset The line offset to read from (default: 0)
   */
  public async getBuildLogs(deployId: string, offset: number = 0): Promise<BuildLogsResponse> {
    return await this.client.request(`/deploy/${deployId}/logs?offset=${offset}`, {
      method: 'GET'
    });
  }
}
