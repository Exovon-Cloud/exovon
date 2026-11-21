"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExovonRateLimitError = exports.ExovonAuthError = exports.ExovonAPIError = exports.ExovonError = void 0;
class ExovonError extends Error {
    status;
    code;
    requestId;
    constructor(message, status = 500, code = 'EXOVON_ERROR', requestId) {
        super(message);
        this.name = 'ExovonError';
        this.status = status;
        this.code = code;
        this.requestId = requestId;
        Object.setPrototypeOf(this, ExovonError.prototype);
    }
}
exports.ExovonError = ExovonError;
class ExovonAPIError extends ExovonError {
    constructor(message, status = 500, code = 'API_ERROR', requestId) {
        super(message, status, code, requestId);
        this.name = 'ExovonAPIError';
        Object.setPrototypeOf(this, ExovonAPIError.prototype);
    }
}
exports.ExovonAPIError = ExovonAPIError;
class ExovonAuthError extends ExovonError {
    constructor(message = 'Unauthorized: Invalid or revoked API Key', requestId) {
        super(message, 401, 'UNAUTHORIZED', requestId);
        this.name = 'ExovonAuthError';
        Object.setPrototypeOf(this, ExovonAuthError.prototype);
    }
}
exports.ExovonAuthError = ExovonAuthError;
class ExovonRateLimitError extends ExovonError {
    retryAfter;
    constructor(message = 'Too Many Requests', retryAfter, requestId) {
        super(message, 429, 'RATE_LIMITED', requestId);
        this.name = 'ExovonRateLimitError';
        this.retryAfter = retryAfter;
        Object.setPrototypeOf(this, ExovonRateLimitError.prototype);
    }
}
exports.ExovonRateLimitError = ExovonRateLimitError;
