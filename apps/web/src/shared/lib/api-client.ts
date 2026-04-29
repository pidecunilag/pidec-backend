/**
 * Typed fetch wrapper for the PIDEC backend API.
 *
 * - Includes credentials (cookies are how we carry the Supabase session
 *   to the backend, so it can verify the JWT).
 * - Returns the parsed ApiResponse<T> envelope. Caller decides how to
 *   surface success/error.
 * - On non-JSON responses (network failure, 502 from a proxy, etc.) wraps
 *   the result as an ApiError so callers always have one shape.
 */
import type { ApiResponse, ErrorCode } from '@pidec/shared';
import { env } from '../config/env';

export interface ApiClientOptions {
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

const buildUrl = (path: string) => {
  const base = env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');
  const versionedPath = path.startsWith('/api/')
    ? path
    : `/api/v1${path.startsWith('/') ? '' : '/'}${path}`;
  return `${base}${versionedPath}`;
};

const request = async <T>(
  method: string,
  path: string,
  body?: unknown,
  opts: ApiClientOptions = {},
): Promise<ApiResponse<T>> => {
  try {
    const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;
    const payload = isFormData ? body : body !== undefined ? JSON.stringify(body) : null;

    const res = await fetch(buildUrl(path), {
      method,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(isFormData ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...opts.headers,
      },
      body: payload,
      ...(opts.signal ? { signal: opts.signal } : {}),
    });

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR' satisfies ErrorCode,
          message: `Unexpected response (${res.status})`,
        },
      };
    }

    const json = (await res.json()) as
      | ApiResponse<T>
      | {
          status?: string;
          data?: T;
          message?: string;
          error?: { code?: ErrorCode | string; message?: string; details?: unknown };
        };

    if ('success' in json) {
      return json as ApiResponse<T>;
    }

    if (json.status === 'success' && 'data' in json) {
      return { success: true, data: json.data as T };
    }

    if (json.status === 'error' || json.error) {
      return {
        success: false,
        error: {
          code: (json.error?.code ?? 'INTERNAL_ERROR') as ErrorCode | string,
          message: json.error?.message ?? json.message ?? 'Request failed',
          ...(json.error?.details !== undefined ? { details: json.error.details } : {}),
        },
      };
    }

    return {
      success: false,
      error: {
        code: 'INTERNAL_ERROR' satisfies ErrorCode,
        message: 'Unexpected response format',
      },
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err;
    }
    return {
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE' satisfies ErrorCode,
        message: 'Could not reach the server. Check your connection and try again.',
      },
    };
  }
};

export const apiClient = {
  get: <T>(path: string, opts?: ApiClientOptions) => request<T>('GET', path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: ApiClientOptions) =>
    request<T>('POST', path, body, opts),
  patch: <T>(path: string, body?: unknown, opts?: ApiClientOptions) =>
    request<T>('PATCH', path, body, opts),
  put: <T>(path: string, body?: unknown, opts?: ApiClientOptions) =>
    request<T>('PUT', path, body, opts),
  delete: <T>(path: string, opts?: ApiClientOptions) => request<T>('DELETE', path, undefined, opts),
};
