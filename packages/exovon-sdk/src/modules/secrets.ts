import type { ExovonClient } from '../client';
import { ExovonError } from '../errors';

export class SecretsClient {
  constructor(private client: ExovonClient) {}

  /**
   * Programmatically updates the environment variables for a project.
   * Note: Variables must be a flat JSON object. Maximum 100 keys, 32KB total size.
   * Pass options.merge = true to merge with existing secrets without overwriting them.
   * @param projectId The unique ID of the project
   * @param secrets Key-value object of environment variables
   * @param options Optional configuration, e.g. { merge: true }
   */
  public async update(
    projectId: string,
    secrets: Record<string, string>,
    options?: { merge?: boolean }
  ): Promise<{ success: boolean; version?: string; keys?: string[] }> {
    // Client-side validation to prevent API spam
    const keys = Object.keys(secrets);
    if (keys.length > 100) {
      throw new ExovonError('Maximum 100 environment variables allowed per project.', 400, 'SECRETS_LIMIT_EXCEEDED');
    }

    const payloadString = JSON.stringify(secrets);
    if (Buffer.byteLength(payloadString, 'utf8') > 32768) {
      throw new ExovonError('Secrets payload exceeds the 32KB limit.', 400, 'SECRETS_PAYLOAD_TOO_LARGE');
    }

    for (const key of keys) {
      if (!/^[A-Z0-9_]+$/.test(key)) {
        throw new ExovonError(`Invalid secret key: ${key}. Only uppercase alphanumeric and underscores allowed.`, 400, 'INVALID_SECRET_KEY');
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
  public async set(
    projectId: string,
    secretsOrKey: Record<string, string> | string,
    value?: string
  ): Promise<{ success: boolean; version?: string; keys?: string[] }> {
    const secrets = typeof secretsOrKey === 'string' ? { [secretsOrKey]: value ?? '' } : secretsOrKey;
    return await this.update(projectId, secrets, { merge: true });
  }
  /**
   * Lists configured environment variable keys.
   */
  public async listKeys(projectId: string): Promise<{ keys: string[] }> {
    return await this.client.request(`/secrets/${projectId}/keys`, {
      method: 'GET'
    });
  }

  /**
   * Pulls environment variables for a project.
   */
  public async pull(projectId: string): Promise<{ secrets: Record<string, string> }> {
    return await this.client.request(`/secrets/${projectId}/pull`, {
      method: 'GET'
    });
  }


  /**
   * Deletes a specific secret key from the project's environment.
   */
  public async delete(projectId: string, key: string): Promise<{ success: boolean }> {
    return await this.client.request(`/secrets/${projectId}/${key}`, {
      method: 'DELETE'
    });
  }
}
