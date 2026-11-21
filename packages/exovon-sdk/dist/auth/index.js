"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAuthClient = exports.organizationClient = exports.twoFactorClient = exports.organization = exports.twoFactor = exports.getSession = exports.useSession = exports.signOut = exports.signUp = exports.signIn = exports.activeClient = void 0;
exports.createExovonAuthClient = createExovonAuthClient;
const client_1 = require("better-auth/client");
Object.defineProperty(exports, "createAuthClient", { enumerable: true, get: function () { return client_1.createAuthClient; } });
const plugins_1 = require("better-auth/client/plugins");
Object.defineProperty(exports, "twoFactorClient", { enumerable: true, get: function () { return plugins_1.twoFactorClient; } });
Object.defineProperty(exports, "organizationClient", { enumerable: true, get: function () { return plugins_1.organizationClient; } });
// Global active client singleton
exports.activeClient = null;
/**
 * Creates and initializes an Exovon Auth Client instance
 */
function createExovonAuthClient(options) {
    if (!options || !options.projectId) {
        throw new Error('ExovonAuthClient requires a valid "projectId".');
    }
    const projectId = options.projectId.trim();
    const baseURL = options.baseURL || `https://auth.exovon.co.in/p/${projectId}/api/auth`;
    const plugins = [
        (0, plugins_1.twoFactorClient)(),
        (0, plugins_1.organizationClient)(),
        ...(options.plugins || []),
    ];
    const rawClient = (0, client_1.createAuthClient)({
        baseURL,
        fetchOptions: options.fetchOptions,
        plugins,
    });
    const client = new Proxy(rawClient, {
        get(target, prop, receiver) {
            if (prop === 'projectId')
                return projectId;
            if (prop === 'baseURL')
                return baseURL;
            if (prop === 'options')
                return options;
            return Reflect.get(target, prop, receiver);
        },
    });
    exports.activeClient = client;
    return client;
}
// Re-export standard Better Auth client methods delegation proxies
const createClientProxy = (propName) => {
    return new Proxy(((...args) => {
        if (!exports.activeClient) {
            throw new Error(`Exovon Auth client not initialized. Call createExovonAuthClient({ projectId: '...' }) first.`);
        }
        const target = exports.activeClient[propName];
        if (typeof target === 'function') {
            return target(...args);
        }
        return target;
    }), {
        get(_target, subProp, receiver) {
            if (!exports.activeClient) {
                throw new Error(`Exovon Auth client not initialized. Call createExovonAuthClient({ projectId: '...' }) before accessing ${String(propName)}.${String(subProp)}.`);
            }
            const root = exports.activeClient[propName];
            if (root && typeof root === 'object' && subProp in root) {
                const val = root[subProp];
                return typeof val === 'function' ? val.bind(root) : val;
            }
            return Reflect.get(root ?? {}, subProp, receiver);
        },
        apply(_target, thisArg, argArray) {
            if (!exports.activeClient) {
                throw new Error(`Exovon Auth client not initialized. Call createExovonAuthClient({ projectId: '...' }) first.`);
            }
            const target = exports.activeClient[propName];
            if (typeof target === 'function') {
                return target.apply(thisArg, argArray);
            }
            throw new Error(`${String(propName)} is not a callable function.`);
        },
    });
};
exports.signIn = createClientProxy('signIn');
exports.signUp = createClientProxy('signUp');
exports.signOut = createClientProxy('signOut');
exports.useSession = createClientProxy('useSession');
exports.getSession = createClientProxy('getSession');
exports.twoFactor = createClientProxy('twoFactor');
exports.organization = createClientProxy('organization');
