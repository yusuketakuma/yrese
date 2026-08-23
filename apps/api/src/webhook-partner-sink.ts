import { createHmac, timingSafeEqual } from 'node:crypto';

import type { PartnerEvent } from '@yrese/contracts';

import type { PartnerEventSink } from './db/outbox-partner-projection.js';

/**
 * HMAC 署名付き webhook sink(WP-6005 の最小形、SSOT: API-012 §2 PROPOSED)。
 *
 * - header: `x-yrese-event-id`(受信側冪等鍵)、`x-yrese-timestamp`(ISO 8601)、
 *   `x-yrese-signature`(`v1=<hex>`、HMAC-SHA256 over `${timestamp}.${body}`)。
 * - 成功は 2xx のみ。timeout・非 2xx・network error は失敗として throw し、
 *   worker が pending のまま残す(at-least-once)。
 * - endpoint と secret は呼び出し側が注入する。Partner Registry(WP-6006)が
 *   landing するまで設定値で良い。secret を log・error message に出さない。
 *
 * ponytail: 鍵 rotation(新旧 2 鍵併記)と rate limit は未実装。API-012 の
 * security review 後に Partner Registry と一緒に入れる。
 */
export const WEBHOOK_SIGNATURE_VERSION = 'v1';
export const WEBHOOK_EVENT_ID_HEADER = 'x-yrese-event-id';
export const WEBHOOK_TIMESTAMP_HEADER = 'x-yrese-timestamp';
export const WEBHOOK_SIGNATURE_HEADER = 'x-yrese-signature';

export interface WebhookPartnerSinkOptions {
  readonly endpointUrl: URL;
  readonly signingSecret: string;
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

export class WebhookDeliveryError extends Error {
  constructor(
    readonly eventId: string,
    readonly reason: 'non_2xx' | 'network' | 'timeout',
    readonly status?: number,
  ) {
    super(`webhook delivery failed (${reason})`);
    this.name = 'WebhookDeliveryError';
  }
}

export function signWebhookPayload(secret: string, timestamp: string, body: string): string {
  const digest = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  return `${WEBHOOK_SIGNATURE_VERSION}=${digest}`;
}

/** 受信側の検証補助(SDK / contract test 用)。定数時間比較。 */
export function verifyWebhookSignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): boolean {
  const expected = Buffer.from(signWebhookPayload(secret, timestamp, body));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export class WebhookPartnerSink implements PartnerEventSink {
  private readonly endpointUrl: URL;
  private readonly signingSecret: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  private readonly timeoutMs: number;

  constructor(options: WebhookPartnerSinkOptions) {
    if (options.endpointUrl.protocol !== 'https:') {
      throw new RangeError('webhook endpoint must use https');
    }
    if (options.signingSecret.length === 0) {
      throw new RangeError('webhook signing secret must be non-empty');
    }
    this.endpointUrl = options.endpointUrl;
    this.signingSecret = options.signingSecret;
    this.fetchImpl = options.fetch ?? fetch;
    this.now = options.now ?? (() => new Date());
    this.timeoutMs = options.timeoutMs ?? 10_000;
  }

  async publish(event: PartnerEvent): Promise<void> {
    const body = JSON.stringify(event);
    const timestamp = this.now().toISOString();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(this.endpointUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          [WEBHOOK_EVENT_ID_HEADER]: event.eventId,
          [WEBHOOK_TIMESTAMP_HEADER]: timestamp,
          [WEBHOOK_SIGNATURE_HEADER]: signWebhookPayload(this.signingSecret, timestamp, body),
        },
        body,
        signal: controller.signal,
      });
    } catch (error) {
      const reason = controller.signal.aborted ? 'timeout' : 'network';
      throw new WebhookDeliveryError(event.eventId, reason);
    } finally {
      clearTimeout(timer);
    }
    if (response.status < 200 || response.status >= 300) {
      throw new WebhookDeliveryError(event.eventId, 'non_2xx', response.status);
    }
  }
}
