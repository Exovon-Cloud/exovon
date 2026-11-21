import type { ExovonClient } from '../client';
export declare class SecretsClient {
    private client;
    constructor(client: ExovonClient);
    /**
     * Programmatically updates the environment variables for a project.
     * Note: Variables must be a flat JSON object. Maximum 100 keys, 32KB total size.
     * Pass options.merge = true to merge with existing secrets without overwriting them.
     * @param projectId The unique ID of the project
     * @param secrets Key-value object of environment variables
     * @param options Optional configuration, e.g. { merge: true }
     */
    update(projectId: string, secrets: Record<string, string>, options?: {
        merge?: boolean;
    }): Promise<{
        success: boolean;
        version?: string;
        keys?: string[];
    }>;
    /**
     * Atomically upserts one or more environment variables without removing existing variables.
     * @param projectId The unique ID of the project
     * @param secretsOrKey Object of key-value pairs OR single secret key name
     * @param value String value when secretsOrKey is a string key name
     */
    set(projectId: string, secretsOrKey: Record<string, string> | string, value?: string): Promise<{
        success: boolean;
        version?: string;
        keys?: string[];
    }>;
    /**
     * Lists configured environment variable keys.
     */
    listKeys(projectId: string): Promise<{
        keys: string[];
    }>;
    /**
     * Pulls environment variables for a project.
     */
    pull(projectId: string): Promise<{
        secrets: Record<string, string>;
    }>;
    /**
     * Deletes a specific secret key from the project's environment.
     */
    delete(projectId: string, key: string): Promise<{
        success: boolean;
    }>;
}
