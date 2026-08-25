"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  resolveOperatorIntent,
  shouldFocusOperatorCommand,
} from "./operator-command-policy";

export {
  resolveOperatorIntent,
  shouldFocusOperatorCommand,
} from "./operator-command-policy";

export interface OperatorQuickLink {
  readonly label: string;
  readonly href: string;
}

export const OPERATOR_QUICK_LINKS: readonly OperatorQuickLink[] = [
  { label: "受付", href: "/" },
  { label: "患者検索", href: "/patients" },
  { label: "処方入力", href: "/prescriptions" },
  { label: "会計", href: "/checkout" },
  { label: "請求前点検", href: "/claim-check" },
] as const;

function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

/**
 * 自然言語は既存画面の候補提示だけに使い、患者・処方・会計・請求データを変更しない。
 * 患者名・薬剤名・処方内容などのPHI入力は促さず、弱い一致や複数の強い意図は棄却する。
 * ブラウザ組込み音声認識は処理先・保持・リージョンを保証できないため無効化する。
 */
export function OperatorCommandBar() {
  const [command, setCommand] = useState("");
  const [submittedCommand, setSubmittedCommand] = useState("");
  const pathname = usePathname();
  const sectionRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const intent = useMemo(() => resolveOperatorIntent(submittedCommand), [submittedCommand]);

  useEffect(() => {
    setCommand("");
    setSubmittedCommand("");

    function handleShortcut(event: KeyboardEvent) {
      const targetIsTextEntry = isTextEntryTarget(event.target);
      if (
        shouldFocusOperatorCommand({
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          isComposing: event.isComposing,
          targetIsTextEntry,
          targetIsCommandInput: event.target === inputRef.current,
        })
      ) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        return;
      }

      if (
        event.key === "Escape" &&
        !event.isComposing &&
        sectionRef.current?.contains(document.activeElement)
      ) {
        event.preventDefault();
        setCommand("");
        setSubmittedCommand("");
        inputRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [pathname]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmittedCommand(command.trim());
  }

  function clearCommand() {
    setCommand("");
    setSubmittedCommand("");
  }

  return (
    <section ref={sectionRef} className="operator-command" aria-label="業務画面クイック検索">
      <form onSubmit={submit} className="operator-command-form" role="search">
        <label htmlFor="operator-command-input" className="operator-command-label">
          業務名で画面を探す
        </label>
        <div className="operator-command-row">
          <span className="operator-command-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            ref={inputRef}
            id="operator-command-input"
            value={command}
            onChange={(event: ChangeEvent<HTMLInputElement>) => {
              const nextCommand = event.target.value;
              setCommand(nextCommand);
              if (!nextCommand.trim()) setSubmittedCommand("");
            }}
            placeholder="患者名は入れず業務名で検索（例：月次締め）"
            title="患者名・薬剤名・処方内容などの個人情報は入力しないでください"
            maxLength={80}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            aria-keyshortcuts="/ Control+K Meta+K"
            aria-describedby="operator-command-help operator-voice-status"
          />
          <kbd className="operator-command-shortcut" aria-hidden="true">
            Ctrl/⌘ K
          </kbd>
          <button type="submit" className="operator-command-submit">
            候補
          </button>
          <button
            type="button"
            className="operator-command-voice"
            disabled
            aria-describedby="operator-voice-status"
            title="承認済み音声処理境界の接続前のため利用できません"
          >
            音声
          </button>
        </div>
        <span id="operator-command-help" className="visually-hidden">
          患者名、薬剤名、処方内容などの個人情報は入力せず、患者検索、会計、月次締めなどの業務名を入力してください。スラッシュまたはControl K、MacではCommand Kで入力欄へ移動し、Escapeキーで入力と候補を消去できます。ほかの入力欄を編集中はショートカットを奪いません。
        </span>
        <span id="operator-voice-status" className="visually-hidden">
          音声入力は、処理先・保持・リージョンを確認した承認済み音声処理境界の接続前のため利用できません。
        </span>
      </form>

      <nav className="operator-command-suggestions" aria-label="主要業務へのショートカット">
        <span className="operator-command-shortcut-hint">
          <kbd aria-hidden="true">/</kbd>
          業務名で検索
        </span>
        {OPERATOR_QUICK_LINKS.map((item) => (
          <Link href={item.href} key={item.href} onClick={clearCommand}>
            {item.label}
          </Link>
        ))}
      </nav>

      {submittedCommand ? (
        <div className="operator-command-preview" aria-live="polite">
          {intent ? (
            <>
              <strong>{intent.rationale}</strong>
              <Link href={intent.href} onClick={clearCommand}>
                {intent.label}
              </Link>
            </>
          ) : (
            <span>
              安全に一意判定できません。患者名や処方内容ではなく、「患者検索」「請求前点検」のような業務名を入力するか、業務メニューから選択してください。
            </span>
          )}
          <small>この入力だけで患者・処方・会計・請求データは変更されません。</small>
        </div>
      ) : null}
    </section>
  );
}
