import { describe, expect, it, vi } from 'vitest';

import type { PartnerEvent } from '@yrese/contracts';

import {
  WEBHOOK_EVENT_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  WebhookDeliveryError,
  WebhookPartnerSink,
  verifyWebhookSignature,
} from './webhook-partner-sink.js';

const event: PartnerEvent = {
  eventId: 'outbox-0001',
  eventType: 'reception.created',
  schemaVersion: 1,
  occurredAt: '2026-08-23T00:00:00.000Z',
  auditEventId: 'audit-0001',
  aggregate: { type: 'reception', id: 'reception-000001' },
};

const fixedNow = () => new Date('2026-08-23T01:02:03.000Z');

function sinkWith(fetchImpl: typeof fetch, timeoutMs?: number) {
  return new WebhookPartnerSink({
    endpointUrl: new URL('https://partner.example/hook'),
    signingSecret: 'synthetic-secret',
    fetch: fetchImpl,
    now: fixedNow,
    ...(timeoutMs === undefined ? {} : { timeoutMs }),
  });
}

describe('WebhookPartnerSink', () => {
  it('posts the event with idempotency, timestamp, and a verifiable HMAC signature', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    await sinkWith(fetchImpl).publish(event);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe('https://partner.example/hook');
    expect(init?.method).toBe('POST');
    const headers = init?.headers as Record<string, string>;
    const body = init?.body as string;
    expect(headers[WEBHOOK_EVENT_ID_HEADER]).toBe('outbox-0001');
    expect(headers[WEBHOOK_TIMESTAMP_HEADER]).toBe('2026-08-23T01:02:03.000Z');
    expect(JSON.parse(body)).toEqual(event);
    expect(
      verifyWebhookSignature('synthetic-secret', headers[WEBHOOK_TIMESTAMP_HEADER]!, body, headers[WEBHOOK_SIGNATURE_HEADER]!),
    ).toBe(true);
    expect(
      verifyWebhookSignature('other-secret', headers[WEBHOOK_TIMESTAMP_HEADER]!, body, headers[WEBHOOK_SIGNATURE_HEADER]!),
    ).toBe(false);
    expect(body).not.toContain('synthetic-secret');
  });

  it('treats non-2xx, network errors, and timeouts as delivery failures without leaking the secret', async () => {
    const non2xx = vi.fn<typeof fetch>(async () => new Response('nope', { status: 500 }));
    await expect(sinkWith(non2xx).publish(event)).rejects.toMatchObject({
      name: 'WebhookDeliveryError',
      reason: 'non_2xx',
      status: 500,
    });

    const network = vi.fn<typeof fetch>(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(sinkWith(network).publish(event)).rejects.toMatchObject({ reason: 'network' });

    const hanging = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const failure = await sinkWith(hanging, 5).publish(event).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(WebhookDeliveryError);
    expect((failure as WebhookDeliveryError).reason).toBe('timeout');
    expect(String(failure)).not.toContain('synthetic-secret');
  });

  it('refuses non-https endpoints and empty secrets at construction', () => {
    expect(
      () =>
        new WebhookPartnerSink({
          endpointUrl: new URL('http://partner.example/hook'),
          signingSecret: 'x',
        }),
    ).toThrow(RangeError);
    expect(
      () =>
        new WebhookPartnerSink({
          endpointUrl: new URL('https://partner.example/hook'),
          signingSecret: '',
        }),
    ).toThrow(RangeError);
  });
});
