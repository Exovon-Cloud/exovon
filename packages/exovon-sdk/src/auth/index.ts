/**
 * Exovon Auth Client SDK
 * 
 * Lightweight, type-safe client wrapper around Better Auth
 * designed specifically for the Exovon Cloud infrastructure.
 * 
 * Features:
 * - Auto-configures project multi-tenant baseURL: https://auth.exovon.co.in/p/:projectId/api/auth
 * - Pre-configured with two-factor and organization plugins
 * - Direct re-exports of standard client operations: signIn, signUp, signOut, useSession, getSession, twoFactor, organization
 * - Strongly typed configuration and session definitions
 */

import {
  createAuthClient,
  type BetterAuthClientOptions,
  type BetterAuthClientPlugin,
} from 'better-auth/client';
import {
  twoFactorClient,
  organizationClient,
} from 'better-auth/client/plugins';

export interface ExovonAuthClientOptions {
  /**
   * The Exovon Project ID (e.g., 'proj_abc123' or 'my-project')
   */
  projectId: string;
  /**
   * Custom authentication gateway base URL.
   * Defaults to: `https://auth.exovon.co.in/p/${projectId}/api/auth`
   */
  baseURL?: string;
  /**
   * Custom fetch options or headers passed to underlying HTTP transport
   */
  fetchOptions?: BetterAuthClientOptions['fetchOptions'];
  /**
   * Additional Better Auth client plugins
   */
  plugins?: BetterAuthClientPlugin[];
}

export interface ClientUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image?: string | null;
  role?: string | null;
  banned?: boolean | null;
  banReason?: string | null;
  banExpires?: number | null;
  twoFactorEnabled?: boolean | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: any;
}

export interface ClientSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: Date | string;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  [key: string]: any;
}

export interface ExovonSessionResponse {
  user: ClientUser;
  session: ClientSession;
}

// Global active client singleton
export let activeClient: any = null;

/**
 * Creates and initializes an Exovon Auth Client instance
 */
export function createExovonAuthClient(options: ExovonAuthClientOptions) {
  if (!options || !options.projectId) {
    throw new Error('ExovonAuthClient requires a valid "projectId".');
  }

  const projectId = options.projectId.trim();
  const baseURL = options.baseURL || `https://auth.exovon.co.in/p/${projectId}/api/auth`;

  const plugins: BetterAuthClientPlugin[] = [
    twoFactorClient(),
    organizationClient(),
    ...(options.plugins || []),
  ];

  const rawClient = createAuthClient({
    baseURL,
    fetchOptions: options.fetchOptions,
    plugins,
  });

  const client = new Proxy(rawClient, {
    get(target, prop, receiver) {
      if (prop === 'projectId') return projectId;
      if (prop === 'baseURL') return baseURL;
      if (prop === 'options') return options;
      return Reflect.get(target, prop, receiver);
    },
  });

  activeClient = client;

  return client;
}

export type ExovonAuthClient = ReturnType<typeof createExovonAuthClient>;

// Re-export standard Better Auth client methods delegation proxies
const createClientProxy = <T = any>(propName: string): T => {
  return new Proxy(
    ((...args: any[]) => {
      if (!activeClient) {
        throw new Error(
          `Exovon Auth client not initialized. Call createExovonAuthClient({ projectId: '...' }) first.`
        );
      }
      const target = (activeClient as any)[propName];
      if (typeof target === 'function') {
        return target(...args);
      }
      return target;
    }) as any,
    {
      get(_target, subProp, receiver) {
        if (!activeClient) {
          throw new Error(
            `Exovon Auth client not initialized. Call createExovonAuthClient({ projectId: '...' }) before accessing ${String(
              propName
            )}.${String(subProp)}.`
          );
        }
        const root = (activeClient as any)[propName];
        if (root && typeof root === 'object' && subProp in root) {
          const val = root[subProp];
          return typeof val === 'function' ? val.bind(root) : val;
        }
        return Reflect.get(root ?? {}, subProp, receiver);
      },
      apply(_target, thisArg, argArray) {
        if (!activeClient) {
          throw new Error(
            `Exovon Auth client not initialized. Call createExovonAuthClient({ projectId: '...' }) first.`
          );
        }
        const target = (activeClient as any)[propName];
        if (typeof target === 'function') {
          return target.apply(thisArg, argArray);
        }
        throw new Error(`${String(propName)} is not a callable function.`);
      },
    }
  );
};

export const signIn = createClientProxy<any>('signIn');
export const signUp = createClientProxy<any>('signUp');
export const signOut = createClientProxy<any>('signOut');
export const useSession = createClientProxy<any>('useSession');
export const getSession = createClientProxy<any>('getSession');
export const twoFactor = createClientProxy<any>('twoFactor');
export const organization = createClientProxy<any>('organization');

// Re-export plugins and helpers
export { twoFactorClient, organizationClient, createAuthClient };
