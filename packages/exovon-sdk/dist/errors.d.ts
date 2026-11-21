export declare class ExovonError extends Error {
    status: number;
    code: string;
    requestId?: string;
    constructor(message: string, status?: number, code?: string, requestId?: string);
}
export declare class ExovonAPIError extends ExovonError {
    constructor(message: string, status?: number, code?: string, requestId?: string);
}
export declare class ExovonAuthError extends ExovonError {
    constructor(message?: string, requestId?: string);
}
export declare class ExovonRateLimitError extends ExovonError {
    retryAfter?: number;
    constructor(message?: string, retryAfter?: number, requestId?: string);
}
