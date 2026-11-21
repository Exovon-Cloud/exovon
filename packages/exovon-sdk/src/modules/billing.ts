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

export class BillingClient {
  constructor(private client: ExovonClient) {}

  /**
   * Fetches the current account-wide billing usage and quota consumption.
   * Authoritative account-level metrics for bandwidth, edge requests, and compute.
   */
  public async getUsage(): Promise<BillingUsage> {
    return await this.client.request(`/billing/usage`, {
      method: 'GET'
    });
  }
}
