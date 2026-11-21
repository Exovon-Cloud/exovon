import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ExovonError, ExovonAPIError, ExovonAuthError, ExovonRateLimitError } from './errors';
import { DeploymentsClient } from './modules/deployments';
import { AnalyticsClient } from './modules/analytics';
import { SecretsClient } from './modules/secrets';
import { ProjectsClient } from './modules/projects';
import { InfrastructureClient } from './modules/infrastructure';
import { BillingClient } from './modules/billing';

function resolveApiKey(explicitKey?: string): string | null {
  if (explicitKey && explicitKey.trim()) {
    return explicitKey.trim();
  }
  if (typeof process !== 'undefined' && process.env?.EXOVON_API_KEY && process.env.EXOVON_API_KEY.trim()) {
    return process.env.EXOVON_API_KEY.trim();
  }
  try {
    if (typeof os !== 'undefined' && typeof os.homedir === 'function') {
      const authFile = path.join(os.homedir(), '.exovon', 'auth.json');
      if (fs.existsSync(authFile)) {
        const data = JSON.parse(fs.readFileSync(authFile, 'utf8'));
        if (data && typeof data.apiKey === 'string' && data.apiKey.trim()) {
          return data.apiKey.trim();
        }
      }
    }
  } catch {
    // Ignore fs/json parse issues
  }
  return null;
}

export interface ExovonClientOptions {
  apiKey?: string;
  region?: 'global' | string;
  baseUrl?: string; // Allow overriding for local testing
  maxRetries?: number;
}

export interface UserContext {
  uid: string;
  email?: string;
  username?: string;
  name?: string;
  tier?: string;
}

export class ExovonClient {
  private apiKey: string;
  private baseUrl: string;
  private maxRetries: number;
  
  public deployments: DeploymentsClient;
  public analytics: AnalyticsClient;
  public secrets: SecretsClient;
  public projects: ProjectsClient;
  public infrastructure: InfrastructureClient;
  public billing: BillingClient;

  constructor(options: ExovonClientOptions = {}) {
    const key = resolveApiKey(options.apiKey);
    if (!key) {
      throw new ExovonError("ExovonClient requires an 'apiKey' property, an EXOVON_API_KEY environment variable, or login via `npx exovon login` (~/.exovon/auth.json).", 400, 'MISSING_API_KEY');
    }
    
    this.apiKey = key;
    this.maxRetries = typeof options.maxRetries === 'number' && Number.isSafeInteger(options.maxRetries) && options.maxRetries >= 0
      ? options.maxRetries
      : 3;

    // Abstract the GCP routing. Default to production custom domain.
    if (options.baseUrl) {
      this.baseUrl = options.baseUrl;
    } else if (process.env.EXOVON_API_URL) {
      this.baseUrl = process.env.EXOVON_API_URL;
    } else {
      this.baseUrl = 'https://api.exovon.in';
    }

    this.deployments = new DeploymentsClient(this);
    this.analytics = new AnalyticsClient(this);
    this.secrets = new SecretsClient(this);
    this.projects = new ProjectsClient(this);
    this.infrastructure = new InfrastructureClient(this);
    this.billing = new BillingClient(this);
  }

  /**
   * Helper to sanitize tokens or sensitive credentials out of error messages.
   */
  private sanitizeErrorMessage(msg: string): string {
    return msg.replace(/exo_(live|agent|temp)_[a-zA-Z0-9_]{10,}/gi, 'exo_••••');
  }

  /**
   * Internal wrapper for fetch that throws typed errors on non-2xx responses.
   * Features:
   * - Static Idempotency-Key bound to logical operation across retries
   * - Respects upstream 'Retry-After' header (seconds or RFC 7231 date)
   * - Exponential backoff with jitter on 429 and transient 5xx errors
   * - Sanitized ExovonAPIErrors (zero token leakage)
   */
  public async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const method = (options.method || 'GET').toUpperCase();
    const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method);

    // Hardened Security: Generate ONE static idempotency key for this logical intent
    const idempotencyKey = isMutating
      ? (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.randomUUID
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`)
      : undefined;

    let attempt = 0;
    const maxAttempts = this.maxRetries + 1;

    while (attempt < maxAttempts) {
      const headers = new Headers(options.headers || {});
      headers.set('Authorization', `Bearer ${this.apiKey}`);
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }
      if (idempotencyKey && !headers.has('Idempotency-Key')) {
        headers.set('Idempotency-Key', idempotencyKey);
      }

      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        const requestId = response.headers.get('x-correlation-id') || response.headers.get('x-request-id') || undefined;

        // Success: Handle JSON vs raw text with isolated error boundaries
        if (response.ok) {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            try {
              return await response.json();
            } catch (err: any) {
              throw new ExovonAPIError(
                `Failed to parse JSON response: ${err.message}`,
                response.status,
                'PARSE_ERROR',
                requestId
              );
            }
          } else {
            try {
              return (await response.text()) as unknown as T;
            } catch (err: any) {
              throw new ExovonAPIError(
                `Failed to read response body: ${err.message}`,
                response.status,
                'PARSE_ERROR',
                requestId
              );
            }
          }
        }

        // Handle retryable status codes (429 or 5xx)
        const isRetryable = response.status === 429 || (response.status >= 500 && response.status <= 504);
        if (isRetryable && attempt < maxAttempts - 1) {
          let sleepMs = 0;
          const retryAfterHeader = response.headers.get('retry-after');

          if (retryAfterHeader) {
            const seconds = parseInt(retryAfterHeader, 10);
            if (!isNaN(seconds) && seconds > 0) {
              sleepMs = Math.min(seconds * 1000, 60000); // Cap at 60s max safety
            } else {
              const parsedDate = Date.parse(retryAfterHeader);
              if (!isNaN(parsedDate)) {
                sleepMs = Math.min(Math.max(0, parsedDate - Date.now()), 60000);
              }
            }
          }

          if (sleepMs === 0) {
            // Exponential backoff with jitter: 1s, 2s, 4s + jitter
            sleepMs = Math.min(1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500), 10000);
          }

          attempt++;
          await new Promise((resolve) => setTimeout(resolve, sleepMs));
          continue;
        }

        // Terminal response handling
        let rawBody = response.statusText;
        let humanMessage = response.statusText;
        try {
          const errorBody = await response.text();
          if (errorBody) {
            rawBody = errorBody;
            try {
              const json = JSON.parse(errorBody);
              humanMessage = json.error?.message || json.message || (typeof json.error === 'string' ? json.error : null) || response.statusText;
              if (json.error?.code && typeof json.error.code === 'string' && !humanMessage.includes(json.error.code)) {
                humanMessage = `[${json.error.code}] ${humanMessage}`;
              }
            } catch {
              humanMessage = errorBody.length > 300 ? `${errorBody.slice(0, 300)}...` : errorBody;
            }
          }
        } catch {
          // Ignore parsing errors
        }

        const sanitizedMessage = this.sanitizeErrorMessage(humanMessage || rawBody);

        if (response.status === 401 || response.status === 403) {
          throw new ExovonAuthError(sanitizedMessage, requestId);
        } else if (response.status === 429) {
          throw new ExovonRateLimitError(sanitizedMessage, undefined, requestId);
        } else {
          throw new ExovonAPIError(sanitizedMessage, response.status, `HTTP_${response.status}`, requestId);
        }
      } catch (error: any) {
        if (error instanceof ExovonError) {
          throw error;
        }

        // Network connection error
        if (attempt < maxAttempts - 1) {
          attempt++;
          const jitterSleep = Math.min(1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500), 8000);
          await new Promise((resolve) => setTimeout(resolve, jitterSleep));
          continue;
        }

        const cleanMsg = this.sanitizeErrorMessage(error.message || 'Unknown network error');
        throw new ExovonAPIError(`Network Error: ${cleanMsg}`, 0, 'NETWORK_ERROR');
      }
    }

    throw new ExovonAPIError('Request failed after maximum retry attempts', 504, 'GATEWAY_TIMEOUT');
  }

  /**
   * Fetches the identity of the currently authenticated account.
   * Returns user context without any secrets or tokens.
   */
  public async whoami(): Promise<UserContext> {
    return await this.request('/whoami', { method: 'GET' });
  }

  /**
   * Server-side deactivation of the active API key.
   */
  public async revokeApiKey(): Promise<{ success: boolean; message: string }> {
    return await this.request('/secrets/api-key', { method: 'DELETE' });
  }

  /**
   * Lightweight connection check to verify API key against backend.
   */
  public async connect(): Promise<{ success: boolean; userId: string }> {
    const user = await this.whoami();
    return { success: true, userId: user.uid };
  }
}
