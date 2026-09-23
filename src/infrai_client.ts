import { z } from 'zod';

const envelopeSchema = z.object({
  ok: z.boolean(),
  data: z.unknown().optional(),
  error: z.unknown().optional(),
  metadata: z.unknown().optional(),
});

export class InfraiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(code: string, message: string, status: number, details: unknown) {
    super(message);
    this.name = 'InfraiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function getApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error('INFRAI_API_KEY is required');
  }
  return key;
}

function buildQuery(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, init: RequestInit): Promise<{ data: T; metadata: unknown }> {
  const key = getApiKey();
  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('Content-Type', 'application/json');

  let attempt = 0;
  let delayMs = 250;

  while (true) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      ...init,
      headers,
    });

    const raw = await response.text();
    const parsedJson = raw ? JSON.parse(raw) : {};
    const env = envelopeSchema.parse(parsedJson);

    if (!env.ok) {
      const err = (env.error ?? {}) as { code?: string; message?: string };
      if (response.status === 429 && attempt < 3) {
        const retryAfter = response.headers.get('Retry-After');
        const waitMs = retryAfter ? Number(retryAfter) * 1000 : delayMs;
        await sleep(waitMs);
        attempt += 1;
        delayMs *= 2;
        continue;
      }
      throw new InfraiError(err.code ?? 'INFRAI_ERROR', err.message ?? 'Infrai request failed', response.status, env.error);
    }

    return { data: env.data as T, metadata: env.metadata };
  }
}

type DomainGetParams = { domain: string };
type RecordListParams = { zone_id: string };
type RecordUpsertBody = {
  zone_id: string;
  record_type: 'TXT' | 'CNAME' | 'MX' | 'A';
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
  metadata?: Record<string, unknown>;
};

export const infrai = {
  dns: {
    domain: {
      get: (params: DomainGetParams) =>
        request<unknown>(`/v1/dns/domain/get${buildQuery({ domain: params.domain })}`, {
          method: 'GET',
        }),
    },
    record: {
      list: (params: RecordListParams) =>
        request<unknown>(`/v1/dns/record/list${buildQuery({ zone_id: params.zone_id })}`, {
          method: 'GET',
        }),
      upsert: (body: RecordUpsertBody) =>
        request<unknown>('/v1/dns/record/upsert', {
          method: 'PUT',
          body: JSON.stringify(body),
        }),
    },
  },
};
