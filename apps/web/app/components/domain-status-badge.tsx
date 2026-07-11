import { resolveStatus, type StatusQuery } from "../status/visual-status-registry";

/**
 * ドメイン状態バッジ(Visual Status Registry 駆動)。
 *
 * 監査 A-01 の対策: 画面側は「意味的状態キー(domain + key)」だけを渡し、ラベル・トーン・
 * 形状・ARIA は Registry が決定する。画面側に任意の色・severity・独自ラベルを選ばせない
 * (§11.4-6)。自由 label + tone を受ける従来の StatusBadge は互換のため残すが、
 * 状態がドメイン enum に対応する箇所では本コンポーネントを優先する。
 *
 * 冗長エンコード: 色(tone)+ 形状(shape, aria-hidden)+ ラベル(必須・意味の主担)。
 * shape は支援技術には読ませず(aria-hidden)、label が accessible name を担う。
 * PHI をこのコンポーネント経由でログ・計測へ渡してはならない。
 */
export function DomainStatusBadge({ query }: { readonly query: StatusQuery }) {
  const presentation = resolveStatus(query);
  return (
    <span
      className="status-badge"
      data-tone={presentation.tone}
      data-domain={query.domain}
      data-status={query.key}
      role={presentation.ariaRole}
      aria-live={presentation.ariaLive}
    >
      <span className="status-badge-shape" aria-hidden="true">
        {presentation.shape}
      </span>
      {presentation.label}
    </span>
  );
}
