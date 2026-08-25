import type { ReactNode } from "react";

export type OperatorTone =
  | "neutral"
  | "accent"
  | "info"
  | "success"
  | "warning"
  | "danger";

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function OperatorPage({
  children,
  rail,
  className,
}: {
  readonly children: ReactNode;
  readonly rail?: ReactNode;
  readonly className?: string;
}) {
  return (
    <div
      className={classNames("operator-page", rail !== undefined && "operator-page-with-rail", className)}
    >
      <div className="operator-page-primary">{children}</div>
      {rail !== undefined ? <aside className="operator-rail">{rail}</aside> : null}
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
        {eyebrow !== undefined ? <p className="screen-eyebrow">{eyebrow}</p> : null}
        <div className="screen-title-row">
          <h2 className="screen-title">{title}</h2>
          {meta}
        </div>
        {description !== undefined ? <p className="screen-description">{description}</p> : null}
      </div>
      {actions !== undefined ? <div className="screen-actions">{actions}</div> : null}
    </header>
  );
}

export function PrototypeBanner({
  children,
  tone = "warning",
}: {
  readonly children?: ReactNode;
  readonly tone?: OperatorTone;
}) {
  return (
    <div className="prototype-banner" data-tone={tone} role="note">
      <strong>UIプロトタイプ</strong>
      <span>
        {children ??
          "合成データによる画面構成です。保存・算定・請求・外部送信は実行されません。"}
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
  return <section className="metric-grid">{children}</section>;
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
    <article className="metric-card" data-tone={tone}>
      {icon !== undefined ? (
        <span className="metric-icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <div className="metric-content">
        <p className="metric-label">{label}</p>
        <p className="metric-value">
          {value}
          {unit !== undefined ? <span className="metric-unit">{unit}</span> : null}
        </p>
        {detail !== undefined ? <p className="metric-detail">{detail}</p> : null}
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
    <section className={classNames("operator-panel", className)} data-tone={tone}>
      {title !== undefined || actions !== undefined ? (
        <header className="operator-panel-header">
          <div>
            {title !== undefined ? <h3>{title}</h3> : null}
            {description !== undefined ? <p>{description}</p> : null}
          </div>
          {actions !== undefined ? <div className="operator-panel-actions">{actions}</div> : null}
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

export function PrototypeAction({
  children,
  kind = "secondary",
  reason = "この操作はUIプロトタイプでは実行できません",
}: {
  readonly children: ReactNode;
  readonly kind?: "primary" | "secondary" | "quiet" | "danger";
  readonly reason?: string;
}) {
  return (
    <button
      type="button"
      className="operator-button"
      data-kind={kind}
      disabled
      title={reason}
    >
      {children}
    </button>
  );
}

export function IntakeCard({
  icon,
  title,
  description,
  actionLabel,
  status = "未接続",
  tone = "accent",
}: {
  readonly icon: string;
  readonly title: string;
  readonly description: string;
  readonly actionLabel: string;
  readonly status?: string;
  readonly tone?: OperatorTone;
}) {
  return (
    <article className="intake-card" data-tone={tone}>
      <div className="intake-card-heading">
        <span className="intake-icon" aria-hidden="true">
          {icon}
        </span>
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>
      <div className="intake-card-footer">
        <StatusPill tone="warning">{status}</StatusPill>
        <PrototypeAction>{actionLabel}</PrototypeAction>
      </div>
    </article>
  );
}

export function InlineNotice({
  title,
  children,
  tone = "info",
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly tone?: OperatorTone;
}) {
  return (
    <div className="inline-notice" data-tone={tone}>
      <strong>{title}</strong>
      <div>{children}</div>
    </div>
  );
}
