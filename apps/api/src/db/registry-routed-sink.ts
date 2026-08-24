import { WebhookPartnerSink } from '../webhook-partner-sink.js';
import type {
  OutboxDeliverySink,
  OutboxPendingEvent,
} from './outbox-delivery.js';
import { projectOutboxEventToPartnerEvent } from './outbox-partner-projection.js';
import type { PostgresPartnerRegistry } from './partner-registry.js';

/**
 * Partner Registry で配送先を解決し、HMAC webhook で配送する OutboxDeliverySink(WP-6006)。
 *
 * - 配送先は outbox 行の tenant/pharmacy と event_type から registry が毎回解決する
 *   (grant / state の失効を即時反映。DNS 再解決込み)。
 * - 全配送先へ並列に送り(先頭の恒久失敗で後続が飢えない)、1 つでも失敗すれば sink 失敗
 *   (pending 維持、次 run で全配送先へ再送。受信側は eventId で冪等、API-013)。
 * - 配送可能な target が 1 つも無いとき: 一時停止中(SUSPENDED)の購読者が居れば pending に留め
 *   (復帰後に届く)、policy 非適合で除外した endpoint が有れば pending に留めて failures に出す。
 *   購読者が元から居ない / 退役のみなら配送済み。
 * - 配送可能な target が有るとき: それらへ配送して配送済みにする。同時に停止中 / 非適合の
 *   購読者が居ても pending には留めない(留めると生きている app へ毎 run 再送し、aggregate の
 *   後続 event を head-of-line block するため)。
 *   ponytail: この場合、停止中 / 非適合の app はその event を受け取れない。配送先ごとの
 *   delivery state table(API-012)が入るまでの既知の上限で、Plans.md に記録する。
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

export class EndpointPolicyRejectedError extends Error {
  constructor(readonly rejectedEndpointIds: readonly string[]) {
    super(
      'every candidate endpoint was rejected by the endpoint policy; delivery deferred',
    );
    this.name = 'EndpointPolicyRejectedError';
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

  async deliver(
    event: OutboxPendingEvent,
    signal?: AbortSignal,
  ): Promise<void> {
    const resolution = await this.registry.resolveDeliveryTargets(
      { tenantId: event.tenantId, pharmacyId: event.pharmacyId },
      event.eventType,
    );
    if (resolution.targets.length === 0) {
      if (resolution.rejectedEndpointIds.length > 0) {
        throw new EndpointPolicyRejectedError(resolution.rejectedEndpointIds);
      }
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
          ...(this.options.timeoutMs !== undefined
            ? { timeoutMs: this.options.timeoutMs }
            : {}),
        });
        await sink.publish(partnerEvent, signal);
      }),
    );
    const failed = resolution.targets
      .filter((_target, index) => results[index]?.status === 'rejected')
      .map((target) => target.endpointId);
    if (failed.length > 0) throw new PartialDeliveryError(failed);
  }
}
