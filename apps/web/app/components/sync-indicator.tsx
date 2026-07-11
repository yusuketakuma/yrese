import type { SyncStatus, SystemMode } from "@yrese/shared-kernel";
import { canConfirmExternal, requiresHumanAttention } from "@yrese/shared-kernel";

import { DomainStatusBadge } from "./domain-status-badge";
import { SYSTEM_MODE_PRESENTATION } from "../status/visual-status-registry";

/**
 * 同期・オフライン表示群(R-OFFLINE)。
 *
 * 安全含意(H-03): ローカル保存(QUEUED/未同期)にサーバ保存(SYNCED)と同じ成功表現(✓)を
 * 使わない。競合(CONFLICT)は自動補正せず人間の解決を促す(v0.2.0 §16)。
 * 稼働状態の低下時は「何ができ・何ができないか」を明示する(非常時の見読性 UIX-001 P-19)。
 * 点滅させない・reduced-motion 尊重(globals.css)。PHI をログ・計測へ渡さない。
 */

/** 1件の同期状態を示すインジケータ。最終同期時刻を任意で併記。 */
export interface SyncIndicatorProps {
  readonly status: SyncStatus;
  /** 最終同期時刻(ISO文字列)。 */
  readonly lastSyncedAt?: string;
}

export function SyncIndicator(props: SyncIndicatorProps) {
  return (
    <span
      className="sync-indicator"
      data-sync-status={props.status}
      data-attention={requiresHumanAttention(props.status) ? "true" : "false"}
    >
      <DomainStatusBadge query={{ domain: "sync", key: props.status }} />
      {props.lastSyncedAt && (
        <span className="sync-indicator-last">最終同期: {props.lastSyncedAt}</span>
      )}
    </span>
  );
}

/**
 * オフライン/ローカル単独バナー。オンライン確認が必要なモードで、ローカル保存が
 * サーバ未反映であることと、外部確認(オン資・電子処方箋等)が不可であることを明示する。
 * NORMAL では表示しない(nullを返す)。
 */
export interface OfflineBannerProps {
  readonly mode: SystemMode;
}

export function OfflineBanner(props: OfflineBannerProps) {
  if (props.mode === "NORMAL") {
    return null;
  }
  const presentation = SYSTEM_MODE_PRESENTATION[props.mode];
  const externalOk = canConfirmExternal(props.mode);
  return (
    <div className="offline-banner" data-mode={props.mode} role="status" aria-live="polite">
      <span className="offline-banner-shape" aria-hidden="true">
        {presentation.shape}
      </span>
      <span className="offline-banner-mode">{presentation.label}</span>
      <span className="offline-banner-note">
        {externalOk
          ? "入力は保存できますが、一部の外部連携が不安定です。"
          : "外部確認(資格確認・電子処方箋・オンライン請求)は現在できません。ローカル保存分はサーバ未反映です(同期待ち)。"}
      </span>
    </div>
  );
}

/**
 * システム稼働状態バナー(稼働低下・障害・メンテの通知 — G2 リスクコミュニケーション)。
 * モードと理由・影響機能を示す。NORMAL でも任意で稼働中を静かに示せる。
 */
export interface SystemHealthBannerProps {
  readonly mode: SystemMode;
  /** 低下・障害の理由(任意)。 */
  readonly reason?: string;
  /** 影響を受ける機能の説明(任意)。 */
  readonly affected?: string;
}

export function SystemHealthBanner(props: SystemHealthBannerProps) {
  const presentation = SYSTEM_MODE_PRESENTATION[props.mode];
  const degraded = props.mode !== "NORMAL";
  return (
    <div
      className="system-health-banner"
      data-mode={props.mode}
      data-degraded={degraded ? "true" : "false"}
      role="status"
      aria-live="polite"
    >
      <span className="system-health-shape" aria-hidden="true">
        {presentation.shape}
      </span>
      <span className="system-health-mode">{presentation.label}</span>
      {props.reason && <span className="system-health-reason">{props.reason}</span>}
      {props.affected && <span className="system-health-affected">影響: {props.affected}</span>}
    </div>
  );
}

/**
 * 非常時モードバナー(LOCAL_ONLY 等の障害・災害時運用 — UIX-001 P-19 非常時の見読性)。
 * 使用可能/不可の機能を明示し、復旧手順を提示する。role=alert で確実に通知。
 */
export interface EmergencyModeBannerProps {
  readonly mode: SystemMode;
  /** 使用可能な機能(現場で続行できること)。 */
  readonly available: readonly string[];
  /** 使用不可の機能(できないこと)。 */
  readonly unavailable: readonly string[];
  /** 復旧手順・次のアクション。 */
  readonly recoverySteps?: string;
}

export function EmergencyModeBanner(props: EmergencyModeBannerProps) {
  const presentation = SYSTEM_MODE_PRESENTATION[props.mode];
  return (
    <section
      className="emergency-mode-banner"
      data-mode={props.mode}
      role="alert"
      aria-live="assertive"
    >
      <div className="emergency-mode-header">
        <span className="emergency-mode-shape" aria-hidden="true">
          {presentation.shape}
        </span>
        <span className="emergency-mode-title">非常時運用: {presentation.label}</span>
      </div>
      <div className="emergency-mode-capability">
        <div className="emergency-mode-available">
          <span className="emergency-mode-heading">使用可能</span>
          <ul>
            {props.available.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div className="emergency-mode-unavailable">
          <span className="emergency-mode-heading">使用不可</span>
          <ul>
            {props.unavailable.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      {props.recoverySteps && (
        <p className="emergency-mode-recovery">復旧手順: {props.recoverySteps}</p>
      )}
    </section>
  );
}
