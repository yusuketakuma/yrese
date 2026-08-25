"use client";

import Link from "next/link";
import { FormEvent, useMemo, useRef, useState } from "react";

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
    intent: { label: "受付を開く", href: "/", rationale: "受付・処方箋取込に関する指示と判断しました" },
  },
  {
    keywords: ["患者", "検索", "生年月日", "患者番号"],
    intent: { label: "患者検索を開く", href: "/patients", rationale: "患者の検索・選択に関する指示と判断しました" },
  },
  {
    keywords: ["処方", "薬", "用法", "用量", "日数", "疑義", "残薬"],
    intent: { label: "処方ワークスペースを開く", href: "/prescriptions", rationale: "処方内容の確認・編集に関する指示と判断しました" },
  },
  {
    keywords: ["会計", "負担金", "領収", "返金", "未収"],
    intent: { label: "会計を開く", href: "/checkout", rationale: "会計・患者負担に関する指示と判断しました" },
  },
  {
    keywords: ["請求", "レセプト", "点検", "エラー"],
    intent: { label: "請求前点検を開く", href: "/claim-check", rationale: "請求前点検に関する指示と判断しました" },
  },
  {
    keywords: ["月次", "締め", "返戻", "再請求"],
    intent: { label: "月次締めを開く", href: "/monthly-closing", rationale: "月次締め・再請求に関する指示と判断しました" },
  },
  {
    keywords: ["マスター", "薬価", "医薬品"],
    intent: { label: "マスターを開く", href: "/masters", rationale: "マスター情報に関する指示と判断しました" },
  },
  {
    keywords: ["同期", "障害", "連携", "ステータス"],
    intent: { label: "同期状態を開く", href: "/sync-status", rationale: "外部連携・同期状態に関する指示と判断しました" },
  },
];

function resolveIntent(command: string): CommandIntent | null {
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

/**
 * Operator-first command surface.
 *
 * Safety boundary: this component never mutates clinical/billing data. Natural language and
 * speech only resolve to a navigation candidate. Any clinical change remains inside the
 * destination workflow, where patient context, validation and explicit confirmation apply.
 */
export function OperatorCommandBar() {
  const [command, setCommand] = useState("");
  const [submittedCommand, setSubmittedCommand] = useState("");
  const [listening, setListening] = useState(false);
  const [speechUnavailable, setSpeechUnavailable] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const intent = useMemo(() => resolveIntent(submittedCommand), [submittedCommand]);

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
          操作を入力
        </label>
        <div className="operator-command-row">
          <input
            id="operator-command-input"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="例: 山田さんを検索 / 今日の受付を確認 / 請求エラーを見せて"
            autoComplete="off"
          />
          <button type="submit">候補を表示</button>
          <button
            type="button"
            onClick={toggleSpeech}
            aria-pressed={listening}
            aria-label={listening ? "音声入力を停止" : "音声入力を開始"}
          >
            {listening ? "音声停止" : "音声入力"}
          </button>
        </div>
      </form>

      {speechUnavailable ? (
        <p role="status" className="operator-command-note">
          このブラウザでは音声認識を利用できません。テキスト入力は利用できます。
        </p>
      ) : null}

      {submittedCommand ? (
        <div className="operator-command-preview" aria-live="polite">
          <strong>解釈結果:</strong>{" "}
          {intent ? (
            <>
              {intent.rationale}。 <Link href={intent.href}>{intent.label}</Link>
            </>
          ) : (
            "安全に自動解釈できませんでした。左の業務メニューから対象画面を選択してください。"
          )}
          <p>この入力だけで患者情報・処方・会計・請求データを変更することはありません。</p>
        </div>
      ) : null}
    </section>
  );
}
