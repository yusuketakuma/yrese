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

function sinkWith(
  fetchImpl: typeof fetch,
  timeoutMs?: number,
  now: () => Date = fixedNow,
) {
  return new WebhookPartnerSink({
    endpointUrl: new URL('https://partner.example/hook'),
    signingSecret: 'synthetic-secret',
    fetch: fetchImpl,
    now,
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

  it('uses an intrinsic clock snapshot without reading an own Date method', async () => {
    const clock = new Date('2026-08-23T01:02:03.000Z');
    const ownToISOStringRead = vi.fn(() => {
      throw new Error('raw webhook clock method secret');
    });
    Object.defineProperty(clock, 'toISOString', {
      configurable: true,
      get: ownToISOStringRead,
    });
    const now = vi.fn(() => clock);
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));

    await sinkWith(fetchImpl, undefined, now).publish(event);

    expect(now).toHaveBeenCalledOnce();
    expect(ownToISOStringRead).not.toHaveBeenCalled();
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [, init] = fetchImpl.mock.calls[0]!;
    const headers = init?.headers as Record<string, string>;
    const body = init?.body as string;
    expect(headers[WEBHOOK_TIMESTAMP_HEADER]).toBe('2026-08-23T01:02:03.000Z');
    expect(
      verifyWebhookSignature(
        'synthetic-secret',
        headers[WEBHOOK_TIMESTAMP_HEADER]!,
        body,
        headers[WEBHOOK_SIGNATURE_HEADER]!,
      ),
    ).toBe(true);
  });

  it('normalizes invalid clock authorities before signing or fetch', async () => {
    const rawSentinel = 'raw webhook clock secret';
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
    const throwingNow = vi.fn(() => {
      throw new Error(rawSentinel);
    });

    const thrownFailure = await sinkWith(fetchImpl, undefined, throwingNow)
      .publish(event)
      .catch((error: unknown) => error);

    expect(String(thrownFailure)).toBe('Error: Webhook timestamp clock read failed');
    expect(String(thrownFailure)).not.toContain(rawSentinel);
    expect(throwingNow).toHaveBeenCalledOnce();
    expect(fetchImpl).not.toHaveBeenCalled();

    const spoofToISOString = vi.fn(() => '2026-08-23T01:02:03.000Z');
    const spoof = Object.create(Date.prototype) as Date;
    Object.defineProperty(spoof, 'toISOString', { value: spoofToISOString });

    for (const invalidClock of [new Date(Number.NaN), spoof]) {
      const invalidNow = vi.fn(() => invalidClock);
      const failure = await sinkWith(fetchImpl, undefined, invalidNow)
        .publish(event)
        .catch((error: unknown) => error);

      expect(String(failure)).toBe(
        'Error: Webhook timestamp clock returned an invalid instant',
      );
      expect(invalidNow).toHaveBeenCalledOnce();
      expect(fetchImpl).not.toHaveBeenCalled();
    }
    expect(spoofToISOString).not.toHaveBeenCalled();
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
