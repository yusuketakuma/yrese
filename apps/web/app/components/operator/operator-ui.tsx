import type { ReactNode } from "react";

export type OperatorTone =
  | "neutral"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "danger";

function classNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function OperatorPage({
  children,
  rail,
  railLabel = "補助情報",
  railSticky = true,
  className,
}: {
  readonly children: ReactNode;
  readonly rail?: ReactNode;
  readonly railLabel?: string;
  /** false のとき rail を通常フローへ戻す(内部スクロールを持つ complementary を作らない)。 */
  readonly railSticky?: boolean;
  readonly className?: string;
}) {
  return (
    <div
      className={classNames(
        "operator-page",
        rail !== undefined && "operator-page-with-rail",
        className,
      )}
    >
      <div className="operator-page-primary">{children}</div>
      {rail !== undefined ? (
        <aside
          className="operator-rail"
          aria-label={railLabel}
          tabIndex={0}
          {...(railSticky ? {} : { "data-sticky": "false" })}
        >
          {rail}
        </aside>
      ) : null}
    </div>
  );
}

/**
 * 横スクロールする表の共通ラッパ。
 * ページ本体を横スクロールさせず、スクロール領域自体をキーボードで到達可能にする。
 *
 * `role="region"` は必須。role の無い div は generic へマップされ、`aria-label` は
 * generic 上で禁止属性(axe-core `aria-prohibited-attr`)として無視される。role を
 * 落とすと、tab stop だけが増えて名前が読み上げられないスクロール領域になる。
 */
export function TableScroll({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="table-scroll" role="region" tabIndex={0} aria-label={label}>
      {children}
    </div>
  );
}

export function ScreenHeader({
  title,
  description,
  eyebrow,
  meta,
  actions,
}: {
  readonly title: string;
  readonly description?: string;
  readonly eyebrow?: string;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="screen-header">
      <div>
        {eyebrow !== undefined ? (
          <p className="screen-eyebrow">{eyebrow}</p>
        ) : null}
        <div className="screen-title-row">
          <h2 className="screen-title">{title}</h2>
          {meta}
        </div>
        {description !== undefined ? (
          <p className="screen-description">{description}</p>
        ) : null}
      </div>
      {actions !== undefined ? (
        <div className="screen-actions">{actions}</div>
      ) : null}
    </header>
  );
}

/**
 * Connected and prototype screens share this boundary banner.
 * The visible label deliberately describes capability truth, not implementation maturity.
 */
export function PrototypeBanner({
  children,
  tone = "warning",
}: {
  readonly children?: ReactNode;
  readonly tone?: OperatorTone;
}) {
  return (
    <div className="prototype-banner" data-tone={tone} role="note">
      <strong>機能境界</strong>
      <span>
        {children ??
          "この画面には未接続または未承認の機能があります。表示中の状態と実行可否を確認してください。"}
      </span>
    </div>
  );
}

export function StatusPill({
  children,
  tone = "neutral",
}: {
  readonly children: ReactNode;
  readonly tone?: OperatorTone;
}) {
  return (
    <span className="operator-status-pill" data-tone={tone}>
      {children}
    </span>
  );
}

export function MetricGrid({ children }: { readonly children: ReactNode }) {
  return (
    <div className="metric-grid" role="list" aria-label="主要指標">
      {children}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  unit,
  detail,
  tone = "neutral",
  icon,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly unit?: string;
  readonly detail?: string;
  readonly tone?: OperatorTone;
  readonly icon?: string;
}) {
  return (
    <article className="metric-card" data-tone={tone} role="listitem">
      {icon !== undefined ? (
        <span className="metric-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="metric-content">
        <p className="metric-label">{label}</p>
        <p className="metric-value">
          {value}
          {unit !== undefined ? (
            <span className="metric-unit">{unit}</span>
          ) : null}
        </p>
        {detail !== undefined ? (
          <p className="metric-detail">{detail}</p>
        ) : null}
      </div>
    </article>
  );
}

export function Panel({
  title,
  description,
  actions,
  children,
  className,
  tone = "neutral",
}: {
  readonly title?: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
  readonly tone?: OperatorTone;
}) {
  return (
    <section
      className={classNames("operator-panel", className)}
      data-tone={tone}
    >
      {title !== undefined || actions !== undefined ? (
        <header className="operator-panel-header">
          <div>
            {title !== undefined ? <h3>{title}</h3> : null}
            {description !== undefined ? <p>{description}</p> : null}
          </div>
          {actions !== undefined ? (
            <div className="operator-panel-actions">{actions}</div>
          ) : null}
        </header>
      ) : null}
      <div className="operator-panel-body">{children}</div>
    </section>
  );
}

export function RailCard({
  title,
  children,
  tone = "neutral",
  action,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly tone?: OperatorTone;
  readonly action?: ReactNode;
}) {
  return (
    <section className="rail-card" data-tone={tone}>
      <header className="rail-card-header">
        <h3>{title}</h3>
        {action}
      </header>
      <div className="rail-card-body">{children}</div>
    </section>
  );
}

export function KeyValueList({
  items,
}: {
  readonly items: readonly {
    readonly label: string;
    readonly value: ReactNode;
  }[];
}) {
  return (
    <dl className="key-value-list">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function prototypeActionLabel(
  children: ReactNode,
  actionLabel?: string,
): string {
  if (actionLabel !== undefined) return actionLabel;
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  return "この操作";
}

/**
 * 実行不能な操作。
 * native disabledを維持し、理由は常時可視テキストとして隣接表示する。
 * 無効操作をフォーカス可能なwrapperへ変換しないため、画面内のtab stopを増やさない。
 */
export function PrototypeAction({
  children,
  kind = "secondary",
  reason = "必要な機能が未接続または未承認のため実行できません",
  actionLabel,
}: {
  readonly children: ReactNode;
  readonly kind?: "primary" | "secondary" | "quiet" | "danger";
  readonly reason?: string;
  readonly actionLabel?: string;
}) {
  const label = prototypeActionLabel(children, actionLabel);
  return (
    <span className="prototype-action-shell" data-disabled-reason={reason}>
      <button
        type="button"
        className="operator-button"
        data-kind={kind}
        disabled
        aria-label={`${label}（利用不可）`}
        title={reason}
      >
        {children}
      </button>
      <small className="prototype-action-reason">利用不可: {reason}</small>
    </span>
  );
}

export function InlineNotice({
  title,
  children,
  tone = "info",
  announce,
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly tone?: OperatorTone;
  readonly announce?: "polite" | "assertive";
}) {
  return (
    <div
      className="inline-notice"
      data-tone={tone}
      {...(announce !== undefined
        ? {
            role: announce === "assertive" ? "alert" : "status",
            "aria-live": announce,
          }
        : {})}
    >
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}
