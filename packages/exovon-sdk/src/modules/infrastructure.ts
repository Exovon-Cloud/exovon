import type { ExovonClient } from '../client';

export class InfrastructureClient {
  constructor(private client: ExovonClient) {}

  /**
   * Provisions a managed database instance.
   */
  public async provisionDatabase(projectId: string, options: { type: 'postgres' | 'redis'; size?: string }): Promise<{ success: boolean; connectionString: string }> {
    return await this.client.request(`/infrastructure/${projectId}/database`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  }

  /**
   * Provisions a scalable object storage bucket bound to the project.
   */
  public async provisionStorage(projectId: string, options: { publicRead?: boolean } = {}): Promise<{ success: boolean; bucketName: string }> {
    return await this.client.request(`/infrastructure/${projectId}/storage`, {
      method: 'POST',
      body: JSON.stringify(options)
    });
  }
}
