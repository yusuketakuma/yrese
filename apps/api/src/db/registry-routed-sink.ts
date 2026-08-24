import { WebhookPartnerSink } from '../webhook-partner-sink.js';
import type { OutboxDeliverySink, OutboxPendingEvent } from './outbox-delivery.js';
import { projectOutboxEventToPartnerEvent } from './outbox-partner-projection.js';
import type { PostgresPartnerRegistry } from './partner-registry.js';

/**
 * Partner Registry で配送先を解決し、HMAC webhook で配送する OutboxDeliverySink(WP-6006)。
 *
 * - 配送先は outbox 行の tenant/pharmacy と event_type から registry が毎回解決する
 *   (grant / state の失効を即時反映。API-012 §2 の再送規律と同じ評価)。
 * - 配送先ゼロは「配送済み」として扱う(購読者がいない event を pending に残さない)。
 * - 複数配送先の一部失敗は sink 失敗(pending 維持、次 run で全配送先へ再送)。
 *   受信側は eventId で冪等(API-013)。
 * - secret は SecretResolver 経由で値を得る。repository・event・error に値を残さない。
 *
 * ponytail: 配送先ごとの delivery state は持たない(API-012 の delivery state table 後)。
 * 失敗した配送先だけを再送する最適化はそこで入れる。
 */
export interface SecretResolver {
  resolve(secretRef: string): Promise<string>;
}

export interface RegistryRoutedSinkOptions {
  readonly fetch?: typeof fetch;
  readonly now?: () => Date;
  readonly timeoutMs?: number;
}

export class RegistryRoutedSink implements OutboxDeliverySink {
  constructor(
    private readonly registry: PostgresPartnerRegistry,
    private readonly secrets: SecretResolver,
    private readonly options: RegistryRoutedSinkOptions = {},
  ) {}

  async deliver(event: OutboxPendingEvent): Promise<void> {
    const targets = await this.registry.resolveDeliveryTargets(
      { tenantId: event.tenantId, pharmacyId: event.pharmacyId },
      event.eventType,
    );
    if (targets.length === 0) return;
    const partnerEvent = projectOutboxEventToPartnerEvent(event);
    for (const target of targets) {
      const sink = new WebhookPartnerSink({
        endpointUrl: target.url,
        signingSecret: await this.secrets.resolve(target.secretRef),
        keyId: target.keyId,
        ...(this.options.fetch ? { fetch: this.options.fetch } : {}),
        ...(this.options.now ? { now: this.options.now } : {}),
        ...(this.options.timeoutMs !== undefined ? { timeoutMs: this.options.timeoutMs } : {}),
      });
      await sink.publish(partnerEvent);
    }
  }
}
