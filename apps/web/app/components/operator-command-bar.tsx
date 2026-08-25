"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useMemo, useRef, useState } from "react";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<{ readonly 0: { readonly transcript: string } }> }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
    SpeechRecognition?: SpeechRecognitionConstructor;
  }
}

interface CommandIntent {
  readonly label: string;
  readonly href: string;
  readonly rationale: string;
}

const INTENTS: readonly {
  readonly keywords: readonly string[];
  readonly intent: CommandIntent;
}[] = [
  {
    keywords: ["受付", "処方箋", "qr", "電子処方箋", "取り込"],
    intent: { label: "受付を開く", href: "/", rationale: "受付・処方箋取込に関する指示" },
  },
  {
    keywords: ["患者", "検索", "生年月日", "患者番号"],
    intent: { label: "患者検索を開く", href: "/patients", rationale: "患者検索・患者選択に関する指示" },
  },
  {
    keywords: ["処方", "薬", "用法", "用量", "日数", "疑義", "残薬"],
    intent: { label: "処方入力を開く", href: "/prescriptions", rationale: "処方内容の確認・編集に関する指示" },
  },
  {
    keywords: ["会計", "負担金", "領収", "返金", "未収"],
    intent: { label: "会計を開く", href: "/checkout", rationale: "会計・患者負担に関する指示" },
  },
  {
    keywords: ["請求", "レセプト", "点検", "エラー"],
    intent: { label: "請求前点検を開く", href: "/claim-check", rationale: "請求前点検に関する指示" },
  },
  {
    keywords: ["月次", "締め", "返戻", "再請求"],
    intent: { label: "月次締めを開く", href: "/monthly-closing", rationale: "月次締め・返戻に関する指示" },
  },
  {
    keywords: ["マスター", "薬価", "医薬品"],
    intent: { label: "マスターを開く", href: "/masters", rationale: "マスター情報に関する指示" },
  },
  {
    keywords: ["同期", "障害", "連携", "ステータス"],
    intent: { label: "同期状態を開く", href: "/sync-status", rationale: "外部連携・同期状態に関する指示" },
  },
  {
    keywords: ["管理", "ユーザー", "権限", "設定"],
    intent: { label: "管理・設定を開く", href: "/admin", rationale: "管理・設定に関する指示" },
  },
];

export function resolveOperatorIntent(command: string): CommandIntent | null {
  const normalized = command.trim().toLowerCase();
  if (!normalized) return null;

  let best: { score: number; intent: CommandIntent } | null = null;
  for (const candidate of INTENTS) {
    const score = candidate.keywords.reduce(
      (sum, keyword) => sum + (normalized.includes(keyword.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > 0 && (best === null || score > best.score)) {
      best = { score, intent: candidate.intent };
    }
  }
  return best?.intent ?? null;
}

export function OperatorCommandBar() {
  const [command, setCommand] = useState("");
  const [submittedCommand, setSubmittedCommand] = useState("");
  const [listening, setListening] = useState(false);
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const intent = useMemo(() => resolveOperatorIntent(submittedCommand), [submittedCommand]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmittedCommand(command.trim());
  }

  function toggleSpeech() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSpeechUnavailable(true);
      return;
    }

    setSpeechUnavailable(false);
    const recognition = new Recognition();
    recognition.lang = "ja-JP";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      setCommand(transcript);
      setSubmittedCommand(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  return (
    <section className="operator-command" aria-label="自然言語クイック操作">
      <form onSubmit={submit} className="operator-command-form">
        <label htmlFor="operator-command-input" className="operator-command-label">
          自然言語で画面を探す
        </label>
        <div className="operator-command-row">
          <span className="operator-command-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            id="operator-command-input"
            value={command}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCommand(event.target.value)}
            placeholder="自然言語で指示してください（例：山田さんを検索して）"
            autoComplete="off"
          />
          <button type="submit" className="operator-command-submit">
            候補
          </button>
          <button
            type="button"
            className="operator-command-voice"
            onClick={toggleSpeech}
            aria-pressed={listening}
            aria-label={listening ? "音声入力を停止" : "音声入力を開始"}
          >
            {listening ? "停止" : "音声"}
          </button>
        </div>
      </form>

      {speechUnavailable ? (
        <p role="status" className="operator-command-note">
          このブラウザでは音声認識を利用できません。テキスト入力を利用してください。
        </p>
      ) : null}

      {submittedCommand ? (
        <div className="operator-command-preview" aria-live="polite">
          {intent ? (
            <>
              <strong>{intent.rationale}</strong>
              <Link href={intent.href}>{intent.label}</Link>
            </>
          ) : (
            <span>安全に解釈できません。左の業務メニューから対象画面を選択してください。</span>
          )}
          <small>この入力だけで患者・処方・会計・請求データは変更されません。</small>
        </div>
      ) : null}
    </section>
  );
}
