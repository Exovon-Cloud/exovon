"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingClient = void 0;
class BillingClient {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Fetches the current account-wide billing usage and quota consumption.
     * Authoritative account-level metrics for bandwidth, edge requests, and compute.
     */
    async getUsage() {
        return await this.client.request(`/billing/usage`, {
            method: 'GET'
        });
    }
}
exports.BillingClient = BillingClient;
