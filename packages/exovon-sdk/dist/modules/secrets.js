"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SecretsClient = void 0;
const errors_1 = require("../errors");
class SecretsClient {
    client;
    constructor(client) {
        this.client = client;
    }
    /**
     * Programmatically updates the environment variables for a project.
     * Note: Variables must be a flat JSON object. Maximum 100 keys, 32KB total size.
     * Pass options.merge = true to merge with existing secrets without overwriting them.
     * @param projectId The unique ID of the project
     * @param secrets Key-value object of environment variables
     * @param options Optional configuration, e.g. { merge: true }
     */
    async update(projectId, secrets, options) {
        // Client-side validation to prevent API spam
        const keys = Object.keys(secrets);
        if (keys.length > 100) {
            throw new errors_1.ExovonError('Maximum 100 environment variables allowed per project.', 400, 'SECRETS_LIMIT_EXCEEDED');
        }
        const payloadString = JSON.stringify(secrets);
        if (Buffer.byteLength(payloadString, 'utf8') > 32768) {
            throw new errors_1.ExovonError('Secrets payload exceeds the 32KB limit.', 400, 'SECRETS_PAYLOAD_TOO_LARGE');
        }
        for (const key of keys) {
            if (!/^[A-Z0-9_]+$/.test(key)) {
                throw new errors_1.ExovonError(`Invalid secret key: ${key}. Only uppercase alphanumeric and underscores allowed.`, 400, 'INVALID_SECRET_KEY');
            }
        }
        return await this.client.request('/secrets/update', {
            method: 'POST',
            body: JSON.stringify({ projectId, secrets, merge: options?.merge ?? false })
        });
    }
    /**
     * Atomically upserts one or more environment variables without removing existing variables.
     * @param projectId The unique ID of the project
     * @param secretsOrKey Object of key-value pairs OR single secret key name
     * @param value String value when secretsOrKey is a string key name
     */
    async set(projectId, secretsOrKey, value) {
        const secrets = typeof secretsOrKey === 'string' ? { [secretsOrKey]: value ?? '' } : secretsOrKey;
        return await this.update(projectId, secrets, { merge: true });
    }
    /**
     * Lists configured environment variable keys.
     */
    async listKeys(projectId) {
        return await this.client.request(`/secrets/${projectId}/keys`, {
            method: 'GET'
        });
    }
    /**
     * Pulls environment variables for a project.
     */
    async pull(projectId) {
        return await this.client.request(`/secrets/${projectId}/pull`, {
            method: 'GET'
        });
    }
    /**
     * Deletes a specific secret key from the project's environment.
     */
    async delete(projectId, key) {
        return await this.client.request(`/secrets/${projectId}/${key}`, {
            method: 'DELETE'
        });
    }
}
exports.SecretsClient = SecretsClient;
