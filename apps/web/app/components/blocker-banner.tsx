import type { BlockerType } from "@yrese/shared-kernel";

/**
 * BLOCKER 表示バナー(WP-3006 / SCR-013 の基礎部品)。
 *
 * fail-closed の可視化: 操作が止まっている事実・種別・理由・次のアクションを
 * すべて必須で表示する(理由なしの停止表示を作らせない)。
 * blockerType は shared-kernel の BlockerType のみ(台帳外種別の表示は型で拒否)。
 */

export interface BlockerBannerProps {
  readonly blockerType: BlockerType;
  /** 停止している業務上の理由(日本語) */
  readonly reason: string;
  /** 利用者が次に取るべきアクション */
  readonly nextAction: string;
}

export function BlockerBanner({ blockerType, reason, nextAction }: BlockerBannerProps) {
  return (
    <div className="blocker-banner" role="alert" data-blocker-type={blockerType}>
      <p className="blocker-banner-title">
        処理停止(BLOCKED): {blockerType}
      </p>
      <p className="blocker-banner-reason">{reason}</p>
      <p className="blocker-banner-next-action">次のアクション: {nextAction}</p>
    </div>
  );
}
