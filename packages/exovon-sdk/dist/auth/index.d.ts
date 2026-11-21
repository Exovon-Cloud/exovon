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
import { createAuthClient, type BetterAuthClientOptions, type BetterAuthClientPlugin } from 'better-auth/client';
import { twoFactorClient, organizationClient } from 'better-auth/client/plugins';
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
export declare let activeClient: any;
/**
 * Creates and initializes an Exovon Auth Client instance
 */
export declare function createExovonAuthClient(options: ExovonAuthClientOptions): import("better-auth/client").AuthClient<{
    baseURL: string;
    fetchOptions: import("@better-auth/core").ClientFetchOption<any, any, any, any> | undefined;
    plugins: BetterAuthClientPlugin[];
}>;
export type ExovonAuthClient = ReturnType<typeof createExovonAuthClient>;
export declare const signIn: any;
export declare const signUp: any;
export declare const signOut: any;
export declare const useSession: any;
export declare const getSession: any;
export declare const twoFactor: any;
export declare const organization: any;
export { twoFactorClient, organizationClient, createAuthClient };
