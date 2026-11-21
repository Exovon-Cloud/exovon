import type { ExovonClient } from '../client';
export declare class InfrastructureClient {
    private client;
    constructor(client: ExovonClient);
    /**
     * Provisions a managed database instance.
     */
    provisionDatabase(projectId: string, options: {
        type: 'postgres' | 'redis';
        size?: string;
    }): Promise<{
        success: boolean;
        connectionString: string;
    }>;
    /**
     * Provisions a scalable object storage bucket bound to the project.
     */
    provisionStorage(projectId: string, options?: {
        publicRead?: boolean;
    }): Promise<{
        success: boolean;
        bucketName: string;
    }>;
}
