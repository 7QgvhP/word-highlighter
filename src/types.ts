/** 登録された単語1件 */
export type WordEntry = {
  /** 一意ID */
  id: string;
  /** 登録文字列（前後の空白も保持、空文字は不可） */
  text: string;
  /** 単語一致 */
  wholeWord: boolean;
  /** 正規表現 */
  regex: boolean;
  /** 文字色（#rrggbb、不透明）。null は色なし */
  fg: string | null;
  /** 背景色（#rrggbb、描画時に固定の透明度を適用）。null は色なし */
  bg: string | null;
  /** 目アイコン（有効/無効） */
  enabled: boolean;
};

/** 保存する状態の全体 */
export type State = {
  schemaVersion: 1;
  /** 並び順 = 優先度（上が優先） */
  words: WordEntry[];
  /** 拡張機能全体のオン/オフ */
  globalEnabled: boolean;
  /** 背景色の自動割り当て用カウンタ */
  nextColorIndex: number;
};

/** Webview へ送るメッセージ */
export type ToWebviewMessage =
  | {
      type: 'state';
      state: State;
      /** 不正な正規表現の単語（ID → エラー文） */
      invalid: Record<string, string>;
      /** 保存データが壊れていて、保存を停止しているか */
      corrupted: boolean;
      bgPalette: readonly string[];
      fgPalette: readonly string[];
      bgAlpha: number;
    }
  | { type: 'addResult'; ok: boolean; error?: string };

/** Webview から受け取るメッセージ */
export type FromWebviewMessage =
  | { type: 'ready' }
  | { type: 'add'; text: string }
  | { type: 'toggleEnabled'; id: string }
  | { type: 'toggleWholeWord'; id: string }
  | { type: 'toggleRegex'; id: string }
  | { type: 'setFg'; id: string; color: string | null }
  | { type: 'setBg'; id: string; color: string | null }
  | { type: 'delete'; id: string }
  | { type: 'deleteAll' }
  | { type: 'move'; id: string; toIndex: number };
