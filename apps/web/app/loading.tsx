import { LoadingState } from "./components/loading-state";

/**
 * 全ルート共通の読込中表示(App Router loading.tsx / 監査 S-01)。
 * Suspense 境界の待機中に、真っ白ではなく読込中であることを支援技術にも伝える
 * (LoadingState は role=status / aria-busy / aria-live=polite)。
 */
export default function Loading() {
  return <LoadingState label="読み込み中…" />;
}
