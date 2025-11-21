import supertest from 'supertest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * API client for E2E tests
 * This will be used to make requests to Next.js API routes
 */
export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  async request(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    path: string,
    body?: any,
    headers?: Record<string, string>
  ): Promise<{ status: number; body: any; headers: Record<string, string> }> {
    const url = `${this.baseUrl}${path}`;
    let req: supertest.Test;

    switch (method) {
      case 'GET':
        req = supertest(this.baseUrl).get(path);
        break;
      case 'POST':
        req = supertest(this.baseUrl).post(path);
        if (body) {
          req.send(body);
        }
        break;
      case 'PUT':
        req = supertest(this.baseUrl).put(path);
        if (body) {
          req.send(body);
        }
        break;
      case 'DELETE':
        req = supertest(this.baseUrl).delete(path);
        break;
      case 'PATCH':
        req = supertest(this.baseUrl).patch(path);
        if (body) {
          req.send(body);
        }
        break;
    }

    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        req.set(key, value);
      });
    }

    const response = await req;
    return {
      status: response.status,
      body: response.body,
      headers: response.headers as Record<string, string>,
    };
  }

  get(path: string, headers?: Record<string, string>) {
    return this.request('GET', path, undefined, headers);
  }

  post(path: string, body?: any, headers?: Record<string, string>) {
    return this.request('POST', path, body, headers);
  }

  put(path: string, body?: any, headers?: Record<string, string>) {
    return this.request('PUT', path, body, headers);
  }

  delete(path: string, headers?: Record<string, string>) {
    return this.request('DELETE', path, undefined, headers);
  }

  patch(path: string, body?: any, headers?: Record<string, string>) {
    return this.request('PATCH', path, body, headers);
  }
}

/**
 * Create an API client instance
 */
export function createApiClient(baseUrl?: string): ApiClient {
  return new ApiClient(baseUrl);
}

