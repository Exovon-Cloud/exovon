export class ExovonError extends Error {
  public status: number;
  public code: string;
  public requestId?: string;

  constructor(message: string, status: number = 500, code: string = 'EXOVON_ERROR', requestId?: string) {
    super(message);
    this.name = 'ExovonError';
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    Object.setPrototypeOf(this, ExovonError.prototype);
  }
}

export class ExovonAPIError extends ExovonError {
  constructor(message: string, status: number = 500, code: string = 'API_ERROR', requestId?: string) {
    super(message, status, code, requestId);
    this.name = 'ExovonAPIError';
    Object.setPrototypeOf(this, ExovonAPIError.prototype);
  }
}

export class ExovonAuthError extends ExovonError {
  constructor(message: string = 'Unauthorized: Invalid or revoked API Key', requestId?: string) {
    super(message, 401, 'UNAUTHORIZED', requestId);
    this.name = 'ExovonAuthError';
    Object.setPrototypeOf(this, ExovonAuthError.prototype);
  }
}

export class ExovonRateLimitError extends ExovonError {
  public retryAfter?: number;

  constructor(message: string = 'Too Many Requests', retryAfter?: number, requestId?: string) {
    super(message, 429, 'RATE_LIMITED', requestId);
    this.name = 'ExovonRateLimitError';
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, ExovonRateLimitError.prototype);
  }
}
