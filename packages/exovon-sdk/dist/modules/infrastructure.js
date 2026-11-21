"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InfrastructureClient = void 0;
class InfrastructureClient {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Provisions a managed database instance.
     */
    async provisionDatabase(projectId, options) {
        return await this.client.request(`/infrastructure/${projectId}/database`, {
            method: 'POST',
            body: JSON.stringify(options)
        });
    }
    /**
     * Provisions a scalable object storage bucket bound to the project.
     */
    async provisionStorage(projectId, options = {}) {
        return await this.client.request(`/infrastructure/${projectId}/storage`, {
            method: 'POST',
            body: JSON.stringify(options)
        });
    }
}
exports.InfrastructureClient = InfrastructureClient;
