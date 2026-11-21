import type { ExovonClient } from '../client';
export interface BillingUsage {
    plan: string;
    bandwidthUsed: number;
    originBytes?: number;
    originBandwidthUsed?: number;
    cachedBytes?: number;
    cachedBandwidthUsed?: number;
    requestsUsed: number;
    edgeRequests?: number;
    buildSecondsUsed?: number;
    computeDurationMs?: number;
    projectsCount?: number;
    currentSpendUsd?: number;
    remainingTokens?: number | null;
    limitsReached?: boolean;
}
export declare class BillingClient {
    private client;
    constructor(client: ExovonClient);
    /**
     * Fetches the current account-wide billing usage and quota consumption.
     * Authoritative account-level metrics for bandwidth, edge requests, and compute.
     */
    getUsage(): Promise<BillingUsage>;
}
