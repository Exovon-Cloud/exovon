import type { ExovonClient } from '../client';
export interface ProjectInfo {
    id: string;
    projectId: string;
    name: string;
    subdomain: string;
    customDomain?: string | null;
    framework?: string;
    status: string;
    createdAt?: string | null;
    updatedAt?: string | null;
}
export declare class ProjectsClient {
    private client;
    constructor(client: ExovonClient);
    /**
     * Lists all projects belonging to the authenticated account.
     */
    list(): Promise<{
        projects: ProjectInfo[];
    }>;
    /**
     * Permanently deletes a project and tears down all associated Edge Nodes,
     * DNS records, GCS artifacts, and Secret Manager versions.
     * WARNING: This is irreversible.
     * @param projectId The unique ID of the project
     */
    delete(projectId: string): Promise<{
        success: boolean;
    }>;
    /**
     * Returns the health status, uptime, custom domains, and active SSL certs for a project.
     */
    status(projectId: string): Promise<{
        status: string;
        url: string;
        domains: string[];
        ssl: string;
    }>;
    /**
     * Automatically binds a custom domain to the project.
     */
    addDomain(projectId: string, domain: string): Promise<{
        success: boolean;
        domain: string;
    }>;
    /**
     * Returns the required DNS CNAME/TXT records for the bound domains.
     */
    getDnsRecords(projectId: string): Promise<{
        records: Array<{
            type: string;
            name: string;
            value: string;
        }>;
    }>;
}
