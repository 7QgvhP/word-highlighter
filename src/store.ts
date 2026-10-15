/*
 * 状態の保存・読み込み・検証・移行と、状態を変更する操作。
 * vscode モジュールに依存しないため、VS Code を起動せずにテストできる。
 */
import { autoBgColor, isHexColor } from './colors';
import type { State, WordEntry } from './types';

/** globalState に保存するキー */
export const STATE_KEY = 'wordHighlighter.state';

/** 壊れたデータを退避するキーの接頭辞 */
export const CORRUPTED_KEY_PREFIX = 'wordHighlighter.state.corrupted.';

/** 現在の形式バージョン */
export const CURRENT_SCHEMA_VERSION = 1;

/** context.globalState のうち、使う部分だけを抜き出した型（テストで差し替えられるようにする） */
export interface MementoLike {
  get(key: string): unknown;
  update(key: string, value: unknown): Thenable<void> | Promise<void>;
}

/** 初期状態 */
export function defaultState(): State {
  return { schemaVersion: 1, words: [], globalEnabled: true, nextColorIndex: 0 };
}

export type ParseResult = { ok: true; state: State } | { ok: false; reason: string };

/**
 * 保存されていた生データを、移行・検証して State にする。
 * 未保存（undefined）は初期状態として扱う。
 */
export function parseState(raw: unknown): ParseResult {
  if (raw === undefined) {
    return { ok: true, state: defaultState() };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: 'データがオブジェクトではありません' };
  }
  const migrated = migrate(raw as Record<string, unknown>);
  if (!migrated.ok) {
    return migrated;
  }
  return validate(migrated.data);
}

/**
 * 古い形式のデータを、現在の形式に移行する。
 * 将来、項目を追加したときは、ここに schemaVersion ごとの変換を追加する。
 */
function migrate(
  data: Record<string, unknown>,
): { ok: true; data: Record<string, unknown> } | { ok: false; reason: string } {
  const version = data.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return { ok: false, reason: '形式バージョン（schemaVersion）がありません' };
  }
  if (version > CURRENT_SCHEMA_VERSION) {
    return { ok: false, reason: `新しい形式（schemaVersion: ${version}）のデータで、読み込めません` };
  }
  if (version < 1) {
    return { ok: false, reason: `不明な形式（schemaVersion: ${version}）です` };
  }
  // 現在は schemaVersion 1 のみ（移行処理なし）
  return { ok: true, data };
}

/** 現在の形式のデータを検証する */
function validate(data: Record<string, unknown>): ParseResult {
  const { words, globalEnabled, nextColorIndex } = data;
  if (!Array.isArray(words)) {
    return { ok: false, reason: 'words が配列ではありません' };
  }
  if (typeof globalEnabled !== 'boolean') {
    return { ok: false, reason: 'globalEnabled が真偽値ではありません' };
  }
  if (typeof nextColorIndex !== 'number' || !Number.isInteger(nextColorIndex) || nextColorIndex < 0) {
    return { ok: false, reason: 'nextColorIndex が0以上の整数ではありません' };
  }
  const ids = new Set<string>();
  const parsedWords: WordEntry[] = [];
  for (let i = 0; i < words.length; i++) {
    const w = words[i] as Record<string, unknown> | null;
    const where = `words[${i}]`;
    if (typeof w !== 'object' || w === null || Array.isArray(w)) {
      return { ok: false, reason: `${where} がオブジェクトではありません` };
    }
    if (typeof w.id !== 'string' || w.id.length === 0 || ids.has(w.id)) {
      return { ok: false, reason: `${where}.id が不正、または重複しています` };
    }
    if (typeof w.text !== 'string' || w.text.length === 0) {
      return { ok: false, reason: `${where}.text が空、または文字列ではありません` };
    }
    for (const key of ['wholeWord', 'regex', 'enabled'] as const) {
      if (typeof w[key] !== 'boolean') {
        return { ok: false, reason: `${where}.${key} が真偽値ではありません` };
      }
    }
    for (const key of ['fg', 'bg'] as const) {
      if (w[key] !== null && !isHexColor(w[key])) {
        return { ok: false, reason: `${where}.${key} が #rrggbb 形式の色ではありません` };
      }
    }
    ids.add(w.id);
    parsedWords.push({
      id: w.id,
      text: w.text,
      wholeWord: w.wholeWord as boolean,
      regex: w.regex as boolean,
      fg: normalizeColor(w.fg as string | null),
      bg: normalizeColor(w.bg as string | null),
      enabled: w.enabled as boolean,
    });
  }
  return {
    ok: true,
    state: { schemaVersion: 1, words: parsedWords, globalEnabled, nextColorIndex },
  };
}

/** 色を小文字の #rrggbb にそろえる（null はそのまま） */
function normalizeColor(color: string | null): string | null {
  return color === null ? null : color.toLowerCase();
}

// ---------------------------------------------------------------------------
// 状態を変更する操作（すべて新しい State を返し、引数は変更しない）
// ---------------------------------------------------------------------------

function cloneState(state: State): State {
  return { ...state, words: state.words.map((w) => ({ ...w })) };
}

function updateWord(state: State, id: string, change: (w: WordEntry) => void): State {
  const next = cloneState(state);
  const word = next.words.find((w) => w.id === id);
  if (word) {
    change(word);
  }
  return next;
}

/**
 * 単語を一覧の末尾に追加する。
 * 単語一致OFF・正規表現OFF・文字色なしで、背景色はパレットを順番に割り当てる。
 */
export function addWord(state: State, text: string, id: string): State {
  if (text.length === 0) {
    throw new Error('空の文字列は登録できません');
  }
  const next = cloneState(state);
  next.words.push({
    id,
    text,
    wholeWord: false,
    regex: false,
    fg: null,
    bg: autoBgColor(next.nextColorIndex),
    enabled: true,
  });
  next.nextColorIndex = next.nextColorIndex + 1;
  return next;
}

export function toggleEnabled(state: State, id: string): State {
  return updateWord(state, id, (w) => { w.enabled = !w.enabled; });
}

export function toggleWholeWord(state: State, id: string): State {
  return updateWord(state, id, (w) => { w.wholeWord = !w.wholeWord; });
}

export function toggleRegex(state: State, id: string): State {
  return updateWord(state, id, (w) => { w.regex = !w.regex; });
}

/** 文字色を設定する（null は色なし）。不正な色は無視する */
export function setFg(state: State, id: string, color: string | null): State {
  if (color !== null && !isHexColor(color)) {
    return state;
  }
  return updateWord(state, id, (w) => { w.fg = normalizeColor(color); });
}

/** 背景色を設定する（null は色なし）。不正な色は無視する */
export function setBg(state: State, id: string, color: string | null): State {
  if (color !== null && !isHexColor(color)) {
    return state;
  }
  return updateWord(state, id, (w) => { w.bg = normalizeColor(color); });
}

export function removeWord(state: State, id: string): State {
  const next = cloneState(state);
  next.words = next.words.filter((w) => w.id !== id);
  return next;
}

export function removeAll(state: State): State {
  const next = cloneState(state);
  next.words = [];
  return next;
}

/** 単語を移動する。toIndex は移動後の位置（範囲外は端に丸める） */
export function moveWord(state: State, id: string, toIndex: number): State {
  const from = state.words.findIndex((w) => w.id === id);
  if (from < 0 || !Number.isInteger(toIndex)) {
    return state;
  }
  const next = cloneState(state);
  const [word] = next.words.splice(from, 1);
  const to = Math.max(0, Math.min(toIndex, next.words.length));
  next.words.splice(to, 0, word);
  return next;
}

export function setGlobalEnabled(state: State, enabled: boolean): State {
  const next = cloneState(state);
  next.globalEnabled = enabled;
  return next;
}

// ---------------------------------------------------------------------------
// 保存先とのやり取り
// ---------------------------------------------------------------------------

/**
 * 状態の正を持つクラス。
 * 読み込み時にデータが壊れていた場合は、そのセッションでは保存を一切行わない。
 */
export class StateStore {
  private current: State = defaultState();
  private corruptedReason: string | null = null;
  private readonly listeners: Array<(state: State) => void> = [];

  constructor(private readonly memento: MementoLike) {}

  /** 保存済みのデータを読み込む */
  load(): void {
    const result = parseState(this.memento.get(STATE_KEY));
    if (result.ok) {
      this.current = result.state;
      this.corruptedReason = null;
    } else {
      // 壊れていた場合は、メモリ上で空のまま動かす（保存済みデータは上書きしない）
      this.current = defaultState();
      this.corruptedReason = result.reason;
    }
  }

  get state(): State {
    return this.current;
  }

  /** 保存データが壊れていて、保存を停止しているか */
  get corrupted(): boolean {
    return this.corruptedReason !== null;
  }

  /** 壊れていた理由（壊れていなければ null） */
  get corruptionReason(): string | null {
    return this.corruptedReason;
  }

  /** 状態が変わったときに呼ばれる関数を登録する */
  onDidChange(listener: (state: State) => void): { dispose(): void } {
    this.listeners.push(listener);
    return {
      dispose: () => {
        const i = this.listeners.indexOf(listener);
        if (i >= 0) {
          this.listeners.splice(i, 1);
        }
      },
    };
  }

  /** 状態を変更して保存する（壊れていたセッションでは保存しない） */
  async update(change: (state: State) => State): Promise<void> {
    const next = change(this.current);
    if (next === this.current) {
      return;
    }
    this.current = next;
    this.emit();
    if (!this.corrupted) {
      await this.memento.update(STATE_KEY, next);
    }
  }

  /**
   * 壊れた生データを別キーに退避してから、初期化して保存する。
   * 退避先のキーを返す。
   */
  async resetCorrupted(now: Date = new Date()): Promise<string> {
    const raw = this.memento.get(STATE_KEY);
    const backupKey = CORRUPTED_KEY_PREFIX + now.toISOString();
    await this.memento.update(backupKey, raw);
    this.current = defaultState();
    this.corruptedReason = null;
    await this.memento.update(STATE_KEY, this.current);
    this.emit();
    return backupKey;
  }

  private emit(): void {
    for (const listener of [...this.listeners]) {
      listener(this.current);
    }
  }
}
