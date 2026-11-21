"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeploymentsClient = void 0;
const errors_1 = require("../errors");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
class DeploymentsClient {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Request deployment allocation and optional upload destination.
     */
    async request(options) {
        return await this.client.request('/deploy/request', {
            method: 'POST',
            body: JSON.stringify(options)
        });
    }
    /**
     * Uploads project archive to pre-signed storage URL.
     */
    async upload(zipData, uploadUrl, sizeMB) {
        const MAX_SIZE_MB = 100;
        if (Buffer.isBuffer(zipData)) {
            sizeMB = zipData.length / (1024 * 1024);
        }
        if (sizeMB && sizeMB > MAX_SIZE_MB) {
            throw new errors_1.ExovonError(`Upload exceeds ${MAX_SIZE_MB}MB safety limit. Size: ${sizeMB.toFixed(2)}MB`, 400, 'PAYLOAD_TOO_LARGE');
        }
        const headers = {
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
            throw new errors_1.ExovonError(`Failed to upload to storage: ${response.statusText}`, response.status, 'UPLOAD_FAILED');
        }
    }
    /**
     * Dispatches build pipeline or static promotion.
     */
    async start(deployId, fastPath = false) {
        return await this.client.request('/deploy/start', {
            method: 'POST',
            body: JSON.stringify({ deployId, fastPath })
        });
    }
    /**
     * Helper: Zips a local directory to a temp file on disk, applying security exclusions.
     * Returns the path to the temporary zip file.
     */
    async zipDirectory(sourceDir, onProgress) {
        if (!fs_1.default.existsSync(sourceDir)) {
            throw new errors_1.ExovonError(`Source directory not found: ${sourceDir}`, 404, 'DIR_NOT_FOUND');
        }
        const os = require('os');
        const tmpZipPath = path_1.default.join(os.tmpdir(), `exovon-deploy-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.zip`);
        const output = fs_1.default.createWriteStream(tmpZipPath);
        let mod;
        try {
            // @ts-ignore - optional dynamic import fallback
            mod = await Promise.resolve().then(() => __importStar(require('archiver')));
        }
        catch {
            mod = require('archiver');
        }
        const options = { zlib: { level: 9 } };
        let archive;
        if (mod.ZipArchive) {
            archive = new mod.ZipArchive(options);
        }
        else if (typeof mod === 'function') {
            archive = mod('zip', options);
        }
        else if (mod.default && typeof mod.default === 'function') {
            archive = mod.default('zip', options);
        }
        else if (mod.default && mod.default.ZipArchive) {
            archive = new mod.default.ZipArchive(options);
        }
        else {
            throw new errors_1.ExovonError('Failed to initialize archiver module', 500, 'ZIP_INIT_ERROR');
        }
        return new Promise((resolve, reject) => {
            output.on('close', () => resolve(tmpZipPath));
            archive.on('error', (err) => reject(new errors_1.ExovonError(`Zipping failed: ${err.message}`, 500, 'ZIP_ERROR')));
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
            const gitignorePath = path_1.default.join(sourceDir, '.gitignore');
            if (fs_1.default.existsSync(gitignorePath)) {
                try {
                    const gitignoreLines = fs_1.default.readFileSync(gitignorePath, 'utf8').split('\n');
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
                    if (count > 0)
                        detectedIgnore = `.gitignore (${count} rules)`;
                }
                catch {
                    // Ignore read failures
                }
            }
            // Parse .exovonignore if it exists (takes highest precedence)
            const ignorePath = path_1.default.join(sourceDir, '.exovonignore');
            if (fs_1.default.existsSync(ignorePath)) {
                try {
                    const lines = fs_1.default.readFileSync(ignorePath, 'utf8').split('\n');
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
                    if (exoCount > 0)
                        detectedIgnore = `.exovonignore (${exoCount} rules)`;
                }
                catch {
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
    isPrebuiltProject(sourceDir) {
        const pkgPath = path_1.default.join(sourceDir, 'package.json');
        const indexHtmlPath = path_1.default.join(sourceDir, 'index.html');
        const hasIndexHtml = fs_1.default.existsSync(indexHtmlPath);
        if (!fs_1.default.existsSync(pkgPath)) {
            return hasIndexHtml;
        }
        try {
            const pkgContent = fs_1.default.readFileSync(pkgPath, 'utf8');
            const pkg = JSON.parse(pkgContent);
            const hasBuildScript = pkg.scripts && (pkg.scripts.build || pkg.scripts['build:prod']);
            const hasFrameworkDeps = pkg.dependencies && (pkg.dependencies.next ||
                pkg.dependencies.vite ||
                pkg.dependencies.astro ||
                pkg.dependencies.nuxt ||
                pkg.dependencies['@remix-run/react']);
            if (hasBuildScript || hasFrameworkDeps || fs_1.default.existsSync(path_1.default.join(sourceDir, 'Dockerfile'))) {
                return false;
            }
        }
        catch (e) {
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
    async deploy(options, onProgress) {
        // Resolve isPrebuilt: explicit override from CLI flags takes priority over auto-detection
        const isPrebuilt = options.isPrebuilt !== undefined ? options.isPrebuilt : this.isPrebuiltProject(options.sourceDir);
        const deployOpts = { ...options, isPrebuilt };
        if (options.githubRepoFullName) {
            if (onProgress)
                onProgress('Requesting GitHub deployment...');
            const reqRes = await this.request(deployOpts);
            if (onProgress)
                onProgress('Triggering Cloud Build pipeline...');
            const startRes = await this.start(reqRes.deployId, false);
            return { deployId: reqRes.deployId, buildId: startRes.buildId };
        }
        if (isPrebuilt) {
            if (onProgress)
                onProgress('Deploying static project...');
        }
        else {
            if (onProgress)
                onProgress('Packaging workspace...');
        }
        const tmpZipPath = await this.zipDirectory(options.sourceDir, onProgress);
        try {
            const stats = fs_1.default.statSync(tmpZipPath);
            const sizeMb = stats.size / (1024 * 1024);
            if (sizeMb > 25 && onProgress) {
                onProgress(`Notice: Workspace payload is ${sizeMb.toFixed(1)}MB.`);
            }
            if (onProgress)
                onProgress(`Requesting upload URL (${sizeMb.toFixed(2)}MB)...`);
            const reqRes = await this.request(deployOpts);
            if (reqRes.requiresUpload && reqRes.gcsUploadUrl) {
                if (onProgress)
                    onProgress('Uploading payload...');
                const stream = fs_1.default.createReadStream(tmpZipPath);
                await this.upload(stream, reqRes.gcsUploadUrl, sizeMb);
            }
            if (isPrebuilt) {
                if (onProgress)
                    onProgress('Promoting to edge network...');
                const startRes = await this.start(reqRes.deployId, true);
                const resolvedUrl = (startRes.url && !startRes.url.includes('undefined'))
                    ? startRes.url
                    : `https://${options.projectId}.exovon.co.in`;
                return { deployId: reqRes.deployId, url: resolvedUrl, fastPath: true };
            }
            else {
                if (onProgress)
                    onProgress('Triggering build pipeline...');
                const startRes = await this.start(reqRes.deployId, false);
                return { deployId: reqRes.deployId, buildId: startRes.buildId, fastPath: false };
            }
        }
        finally {
            if (fs_1.default.existsSync(tmpZipPath)) {
                fs_1.default.unlinkSync(tmpZipPath);
            }
        }
    }
    /**
     * Polls the deployment status and streams logs via offset pagination.
     */
    async pollLogs(deployId, onLogUpdate, timeoutMs = 3600 * 1000 // Default 60 minutes to cover maximum plan tier
    ) {
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
                const res = await this.client.request(`/deploy/${deployId}/logs?offset=${offset}`, {
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
                }
                else if (statusUpper === 'FAILED' || statusUpper === 'TIMEOUT') {
                    return { success: false, finalStatus: statusUpper };
                }
            }
            catch (err) {
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
    async restart(projectId) {
        return await this.client.request('/deploy/restart', {
            method: 'POST',
            body: JSON.stringify({ projectId })
        });
    }
    /**
     * Promotes or rolls back a specific deployment to 100% traffic.
     */
    async promote(deployId) {
        return await this.client.request(`/deploy/${deployId}/promote`, {
            method: 'POST'
        });
    }
    /**
     * Fetches runtime crash logs for a project.
     */
    async getCrashLogs(projectId, timeframeMinutes = 60) {
        return await this.client.request(`/deploy/${projectId}/crash-logs?timeframe=${timeframeMinutes}`, {
            method: 'GET'
        });
    }
    /**
     * Lists historical deployment revisions.
     */
    async listRevisions(projectId) {
        return await this.client.request(`/deploy/${projectId}/revisions`, {
            method: 'GET'
        });
    }
    /**
     * Rolls back a project to a specific deployment revision.
     */
    async rollback(projectId, deploymentId) {
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
    async getRuntimeLogs(projectId, limit = 100) {
        return await this.client.request(`/deploy/${projectId}/runtime-logs?limit=${limit}`, {
            method: 'GET'
        });
    }
    /**
     * Retrieves build compilation logs for a deployment using offset pagination.
     * @param deployId The unique deployment ID
     * @param offset The line offset to read from (default: 0)
     */
    async getBuildLogs(deployId, offset = 0) {
        return await this.client.request(`/deploy/${deployId}/logs?offset=${offset}`, {
            method: 'GET'
        });
    }
}
exports.DeploymentsClient = DeploymentsClient;
