"use client";

import { useState, type ChangeEvent } from "react";

import {
  MasterLookupError,
  searchMasterMedications,
  searchMasterUsages,
} from "./master-lookup";

export interface MasterCodeSelection {
  /** 用法コード選択時は null(usage 参照は版 ID を持たない)。 */
  readonly masterVersionId: string | null;
  readonly itemId: string;
  readonly label: string;
}

type PickerState =
  | { readonly kind: "idle" }
  | { readonly kind: "searching" }
  | {
      readonly kind: "results";
      readonly items: readonly {
        readonly masterVersionId: string | null;
        readonly itemId: string;
        readonly label: string;
      }[];
      readonly empty: boolean;
    }
  | { readonly kind: "error"; readonly message: string };

/**
 * WP-7302: 処方下書き行の master 選択UI。検索は明示操作のみ
 * (入力ごとの自動 fetch はしない)。asOf は業務日をそのまま使う。
 */
export function MasterCodePicker({
  kind,
  asOf,
  disabled,
  selectedLabel,
  onSelect,
  onClear,
}: {
  readonly kind: "medication" | "usage";
  readonly asOf: string;
  readonly disabled?: boolean;
  /** 選択済みコードの表示名。空は「選択済み(ID不明)」。 */
  readonly selectedLabel: string;
  readonly onSelect: (selection: MasterCodeSelection) => void;
  readonly onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [state, setState] = useState<PickerState>({ kind: "idle" });
  const label = kind === "medication" ? "薬剤" : "用法";

  const search = async () => {
    setState({ kind: "searching" });
    try {
      const items =
        kind === "medication"
          ? await searchMasterMedications({ asOf, q: query }).then(
              (response) =>
                response.items.map((item) => ({
                  masterVersionId:
                    response.masterVersion?.masterVersionId ?? null,
                  itemId: item.medicationItemId,
                  label: `${item.localCode} ${item.name}`,
                })),
            )
          : (await searchMasterUsages({ asOf, q: query })).items.map(
              (item) => ({
                masterVersionId: null,
                itemId: item.usageItemId,
                label: `${item.localCode} ${item.text}`,
              }),
            );
      setState({ kind: "results", items, empty: items.length === 0 });
    } catch (error) {
      setState({
        kind: "error",
        message:
          error instanceof MasterLookupError
            ? error.message
            : "マスター検索に失敗しました。",
      });
    }
  };

  return (
    <div className="master-code-picker" data-kind={kind}>
      {selectedLabel.length > 0 ? (
        <div className="master-code-picker-selected">
          <span className="master-code-picker-label">{selectedLabel}</span>
          <button
            type="button"
            disabled={disabled}
            onClick={onClear}
            aria-label={`${label}コードの選択を解除`}
          >
            解除
          </button>
        </div>
      ) : (
        <>
          <input
            aria-label={`${label}コード検索`}
            value={query}
            maxLength={100}
            disabled={disabled || state.kind === "searching"}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setQuery(event.target.value)
            }
            placeholder={`${label}コード・名称で検索`}
            autoComplete="off"
          />
          <button
            type="button"
            disabled={disabled || state.kind === "searching"}
            onClick={() => void search()}
          >
            {state.kind === "searching" ? "検索中…" : "検索"}
          </button>
        </>
      )}
      {state.kind === "error" ? (
        <p className="master-code-picker-error" role="alert">
          {state.message}
        </p>
      ) : null}
      {state.kind === "results" ? (
        state.empty ? (
          <p className="master-code-picker-empty">
            該当する{label}コードはありません(版未適用の可能性もあります)。
          </p>
        ) : (
          <ul className="master-code-picker-results">
            {state.items.slice(0, 20).map((item) => (
              <li key={item.itemId}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onSelect(item);
                    setState({ kind: "idle" });
                    setQuery("");
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))}
            {state.items.length > 20 ? (
              <li aria-hidden="true">
                …他{state.items.length - 20}件(検索語を絞ってください)
              </li>
            ) : null}
          </ul>
        )
      ) : null}
    </div>
  );
}
