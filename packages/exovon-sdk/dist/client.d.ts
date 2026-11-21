import { DeploymentsClient } from './modules/deployments';
import { AnalyticsClient } from './modules/analytics';
import { SecretsClient } from './modules/secrets';
import { ProjectsClient } from './modules/projects';
import { InfrastructureClient } from './modules/infrastructure';
import { BillingClient } from './modules/billing';
export interface ExovonClientOptions {
    apiKey?: string;
    region?: 'global' | string;
    baseUrl?: string;
    maxRetries?: number;
}
export interface UserContext {
    uid: string;
    email?: string;
    username?: string;
    name?: string;
    tier?: string;
}
export declare class ExovonClient {
    private apiKey;
    private baseUrl;
    private maxRetries;
    deployments: DeploymentsClient;
    analytics: AnalyticsClient;
    secrets: SecretsClient;
    projects: ProjectsClient;
    infrastructure: InfrastructureClient;
    billing: BillingClient;
    constructor(options?: ExovonClientOptions);
    /**
     * Helper to sanitize tokens or sensitive credentials out of error messages.
     */
    private sanitizeErrorMessage;
    /**
     * Internal wrapper for fetch that throws typed errors on non-2xx responses.
     * Features:
     * - Static Idempotency-Key bound to logical operation across retries
     * - Respects upstream 'Retry-After' header (seconds or RFC 7231 date)
     * - Exponential backoff with jitter on 429 and transient 5xx errors
     * - Sanitized ExovonAPIErrors (zero token leakage)
     */
    request<T = any>(endpoint: string, options?: RequestInit): Promise<T>;
    /**
     * Fetches the identity of the currently authenticated account.
     * Returns user context without any secrets or tokens.
     */
    whoami(): Promise<UserContext>;
    /**
     * Server-side deactivation of the active API key.
     */
    revokeApiKey(): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Lightweight connection check to verify API key against backend.
     */
    connect(): Promise<{
        success: boolean;
        userId: string;
    }>;
}
