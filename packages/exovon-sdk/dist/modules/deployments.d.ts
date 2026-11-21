import type { ExovonClient } from '../client';
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
export declare class DeploymentsClient {
    private client;
    constructor(client: ExovonClient);
    /**
     * Request deployment allocation and optional upload destination.
     */
    request(options: DeployRequestOptions): Promise<DeployRequestResult>;
    /**
     * Uploads project archive to pre-signed storage URL.
     */
    upload(zipData: Buffer | NodeJS.ReadableStream, uploadUrl: string, sizeMB?: number): Promise<void>;
    /**
     * Dispatches build pipeline or static promotion.
     */
    start(deployId: string, fastPath?: boolean): Promise<{
        success: boolean;
        deployId: string;
        buildId?: string;
        url?: string;
    }>;
    /**
     * Helper: Zips a local directory to a temp file on disk, applying security exclusions.
     * Returns the path to the temporary zip file.
     */
    private zipDirectory;
    /**
     * Helper: Determines if a local project directory is a pure static / pre-built workspace.
     * Used for auto-detection when --static/--dynamic is not explicitly specified.
     */
    isPrebuiltProject(sourceDir: string): boolean;
    /**
     * Orchestrates the entire deployment lifecycle locally:
     * 1. Detects Fast-Path vs Build-Path (or uses explicit override)
     * 2. Zips the directory
     * 3. Requests upload URL
     * 4. Uploads zip safely
     * 5. Promotes instantly (Fast-Path) or triggers Cloud Build (Build-Path)
     */
    deploy(options: LocalDeployOptions, onProgress?: (step: string) => void): Promise<{
        deployId: string;
        buildId?: string;
        url?: string;
        fastPath?: boolean;
    }>;
    /**
     * Polls the deployment status and streams logs via offset pagination.
     */
    pollLogs(deployId: string, onLogUpdate?: (log: string) => void, timeoutMs?: number): Promise<{
        success: boolean;
        finalStatus: string;
    }>;
    /**
     * Triggers a zero-downtime restart for a dynamic Edge Node project.
     */
    restart(projectId: string): Promise<{
        success: boolean;
        revision: string;
    }>;
    /**
     * Promotes or rolls back a specific deployment to 100% traffic.
     */
    promote(deployId: string): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Fetches runtime crash logs for a project.
     */
    getCrashLogs(projectId: string, timeframeMinutes?: number): Promise<{
        logs: string;
    }>;
    /**
     * Lists historical deployment revisions.
     */
    listRevisions(projectId: string): Promise<{
        revisions: Array<{
            deployId: string;
            status: string;
            createdAt: string;
        }>;
    }>;
    /**
     * Rolls back a project to a specific deployment revision.
     */
    rollback(projectId: string, deploymentId?: string): Promise<{
        success: boolean;
        deployId: string;
        message: string;
    }>;
    /**
     * Retrieves live runtime console and HTTP access logs from Cloud Logging for a project.
     * Scoped strictly to the authenticated owner's Cloud Run service.
     * @param projectId The unique ID of the project
     * @param limit Maximum number of log entries to retrieve (default: 100)
     */
    getRuntimeLogs(projectId: string, limit?: number): Promise<RuntimeLogsResponse>;
    /**
     * Retrieves build compilation logs for a deployment using offset pagination.
     * @param deployId The unique deployment ID
     * @param offset The line offset to read from (default: 0)
     */
    getBuildLogs(deployId: string, offset?: number): Promise<BuildLogsResponse>;
}
