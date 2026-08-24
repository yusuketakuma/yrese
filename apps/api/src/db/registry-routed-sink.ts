import { WebhookPartnerSink } from '../webhook-partner-sink.js';
import type { OutboxDeliverySink, OutboxPendingEvent } from './outbox-delivery.js';
import { projectOutboxEventToPartnerEvent } from './outbox-partner-projection.js';
import type { PostgresPartnerRegistry } from './partner-registry.js';

/**
 * Partner Registry で配送先を解決し、HMAC webhook で配送する OutboxDeliverySink(WP-6006)。
 *
 * - 配送先は outbox 行の tenant/pharmacy と event_type から registry が毎回解決する
 *   (grant / state の失効を即時反映。DNS 再解決込み)。
 * - 全配送先へ並列に送り(先頭の恒久失敗で後続が飢えない)、1 つでも失敗すれば sink 失敗
 *   (pending 維持、次 run で全配送先へ再送。受信側は eventId で冪等、API-013)。
 * - 一時停止中(SUSPENDED)の購読者が居る event は配送済み扱いにせず pending に留める
 *   (復帰後に届く)。購読者が元から居ない / 退役のみなら配送済み。
 * - worker の timeout signal を各 fetch に伝播し、孤児 fan-out を残さない。
 * - secret は SecretResolver 経由。repository・event・error に値を残さない。
 *
 * ponytail: 配送先ごとの delivery state は持たない(API-012 の delivery state table 後)。
 */
export interface SecretResolver {
  resolve(secretRef: string): Promise<string>;
}

export interface RegistryRoutedSinkOptions {
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

export class SubscriberSuspendedError extends Error {
  constructor(readonly suspendedSubscribers: number) {
    super('a subscriber is suspended; delivery deferred');
    this.name = 'SubscriberSuspendedError';
  }
}

export class PartialDeliveryError extends Error {
  constructor(readonly failedEndpointIds: readonly string[]) {
    super('delivery failed for at least one endpoint');
    this.name = 'PartialDeliveryError';
  }
}

export class RegistryRoutedSink implements OutboxDeliverySink {
  constructor(
    private readonly registry: PostgresPartnerRegistry,
    private readonly secrets: SecretResolver,
    private readonly options: RegistryRoutedSinkOptions = {},
  ) {}

  async deliver(event: OutboxPendingEvent, signal?: AbortSignal): Promise<void> {
    const resolution = await this.registry.resolveDeliveryTargets(
      { tenantId: event.tenantId, pharmacyId: event.pharmacyId },
      event.eventType,
    );
    if (resolution.targets.length === 0) {
      if (resolution.suspendedSubscribers > 0) {
        throw new SubscriberSuspendedError(resolution.suspendedSubscribers);
      }
      return;
    }
    const partnerEvent = projectOutboxEventToPartnerEvent(event);
    const results = await Promise.allSettled(
      resolution.targets.map(async (target) => {
        const sink = new WebhookPartnerSink({
          endpointUrl: target.url,
          signingSecret: await this.secrets.resolve(target.secretRef),
          keyId: target.keyId,
          ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
          ...(this.options.now ? { now: this.options.now } : {}),
          ...(this.options.timeoutMs !== undefined ? { timeoutMs: this.options.timeoutMs } : {}),
        });
        await sink.publish(partnerEvent, signal);
      }),
    );
    const failed = resolution.targets
      .filter((_target, index) => results[index]?.status === 'rejected')
      .map((target) => target.endpointId);
    if (failed.length > 0) throw new PartialDeliveryError(failed);
    if (resolution.suspendedSubscribers > 0) {
      throw new SubscriberSuspendedError(resolution.suspendedSubscribers);
    }
  }
}
