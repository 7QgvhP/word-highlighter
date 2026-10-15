/*
 * マッチ判定と重なりの解決。
 * vscode モジュールに依存しないため、VS Code を起動せずにテストできる。
 */
import type { WordEntry } from './types';

/** 行内の範囲（開始は含む、終了は含まない。UTF-16 の位置） */
export type Span = { start: number; end: number };

/** 重なりを解決した後の、色付きの区間 */
export type Segment = Span & { fg: string | null; bg: string | null };

/** 検索の準備ができた単語 */
export type CompiledWord = {
  id: string;
  fg: string | null;
  bg: string | null;
  wholeWord: boolean;
  /** 正規表現モードのときの RegExp（g フラグ付き） */
  regex: RegExp | null;
  /** 通常モードのときの検索文字列 */
  literal: string | null;
};

/** compileWords の結果 */
export type CompileResult = {
  /** 検索対象の単語（優先度順。無効・不正なものは除く） */
  words: CompiledWord[];
  /** 不正な正規表現の単語（ID → エラー文） */
  invalid: Record<string, string>;
};

// ---------------------------------------------------------------------------
// 正規表現
// ---------------------------------------------------------------------------

/**
 * パターンに `\p{...}`、`\P{...}`、`\u{...}` が含まれるかを判定する。
 * `\\p{` のように、バックスラッシュ自体がエスケープされている場合は含まない。
 */
export function needsUnicodeFlag(pattern: string): boolean {
  for (let i = 0; i < pattern.length - 2; i++) {
    if (pattern[i] !== '\\') {
      continue;
    }
    const next = pattern[i + 1];
    if ((next === 'p' || next === 'P' || next === 'u') && pattern[i + 2] === '{') {
      return true;
    }
    // エスケープされた文字は読み飛ばす
    i++;
  }
  return false;
}

/** 正規表現のフラグを決める（`g` を基本とし、必要なときだけ `u` を追加。`i` は付けない） */
export function regexFlags(pattern: string): string {
  return needsUnicodeFlag(pattern) ? 'gu' : 'g';
}

/** 正規表現を作る。不正な場合は例外を投げる */
export function createRegex(pattern: string): RegExp {
  return new RegExp(pattern, regexFlags(pattern));
}

/** 正規表現が不正ならエラー文を、正しければ null を返す */
export function validateRegex(pattern: string): string | null {
  try {
    createRegex(pattern);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
}

// ---------------------------------------------------------------------------
// 単語境界（VS Code の isValidMatch 相当）
// ---------------------------------------------------------------------------

/** 文字の分類（VS Code の WordCharacterClass と同じ） */
const enum CharClass {
  Regular = 0,
  Whitespace = 1,
  WordSeparator = 2,
}

/** editor.wordSeparators から作る、文字の分類器 */
export class WordSeparatorClassifier {
  private readonly map = new Map<number, CharClass>();

  constructor(wordSeparators: string) {
    // VS Code と同様に、UTF-16 のコード単位で登録する
    for (let i = 0; i < wordSeparators.length; i++) {
      this.map.set(wordSeparators.charCodeAt(i), CharClass.WordSeparator);
    }
    // 空白（半角スペースとタブ）は、区切り文字とは別の分類として扱う
    this.map.set(0x20, CharClass.Whitespace);
    this.map.set(0x09, CharClass.Whitespace);
  }

  /** 区切り文字または空白か（= 単語を構成する文字ではないか） */
  isBoundaryChar(charCode: number): boolean {
    return (this.map.get(charCode) ?? CharClass.Regular) !== CharClass.Regular;
  }
}

const classifierCache = new Map<string, WordSeparatorClassifier>();

/** 分類器を取得する（同じ区切り文字の設定ではキャッシュを使う） */
export function getClassifier(wordSeparators: string): WordSeparatorClassifier {
  let classifier = classifierCache.get(wordSeparators);
  if (!classifier) {
    classifier = new WordSeparatorClassifier(wordSeparators);
    classifierCache.set(wordSeparators, classifier);
  }
  return classifier;
}

function isLineBreak(charCode: number): boolean {
  return charCode === 0x0d || charCode === 0x0a;
}

/**
 * マッチの左右が単語の境界かを判定する（VS Code の isValidMatch と同じ規則）。
 * - 左境界: 行頭、直前の文字が区切り文字・空白、またはマッチ先頭の文字が区切り文字・空白
 * - 右境界: 行末、直後の文字が区切り文字・空白、またはマッチ末尾の文字が区切り文字・空白
 */
export function isValidMatch(
  classifier: WordSeparatorClassifier,
  text: string,
  matchStart: number,
  matchLength: number,
): boolean {
  return isLeftBoundary(classifier, text, matchStart, matchLength)
    && isRightBoundary(classifier, text, matchStart, matchLength);
}

function isLeftBoundary(
  classifier: WordSeparatorClassifier,
  text: string,
  matchStart: number,
  matchLength: number,
): boolean {
  if (matchStart === 0) {
    return true;
  }
  const charBefore = text.charCodeAt(matchStart - 1);
  if (classifier.isBoundaryChar(charBefore) || isLineBreak(charBefore)) {
    return true;
  }
  if (matchLength > 0 && classifier.isBoundaryChar(text.charCodeAt(matchStart))) {
    return true;
  }
  return false;
}

function isRightBoundary(
  classifier: WordSeparatorClassifier,
  text: string,
  matchStart: number,
  matchLength: number,
): boolean {
  const matchEnd = matchStart + matchLength;
  if (matchEnd === text.length) {
    return true;
  }
  const charAfter = text.charCodeAt(matchEnd);
  if (classifier.isBoundaryChar(charAfter) || isLineBreak(charAfter)) {
    return true;
  }
  if (matchLength > 0 && classifier.isBoundaryChar(text.charCodeAt(matchEnd - 1))) {
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// 検索
// ---------------------------------------------------------------------------

/**
 * 単語を検索できる形に変換する。
 * 無効（目アイコンOFF）の単語と、不正な正規表現の単語は除く。
 */
export function compileWords(words: readonly WordEntry[]): CompileResult {
  const result: CompileResult = { words: [], invalid: {} };
  for (const w of words) {
    let regex: RegExp | null = null;
    if (w.regex) {
      try {
        regex = createRegex(w.text);
      } catch (e) {
        result.invalid[w.id] = e instanceof Error ? e.message : String(e);
        continue;
      }
    }
    if (!w.enabled || w.text.length === 0) {
      continue;
    }
    result.words.push({
      id: w.id,
      fg: w.fg,
      bg: w.bg,
      wholeWord: w.wholeWord,
      regex,
      literal: w.regex ? null : w.text,
    });
  }
  return result;
}

/**
 * 1行の中から、単語の一致範囲を列挙する。
 * 空文字への一致はスキップする。単語一致のときは、境界を満たさない一致を除く。
 * 一致した後は、その一致の末尾から次を探す（VS Code の検索と同じく、重ならない一致を順に探す）。
 */
export function findInLine(
  word: CompiledWord,
  line: string,
  classifier: WordSeparatorClassifier | null,
): Span[] {
  const spans: Span[] = [];
  const accept = (start: number, length: number): void => {
    if (!word.wholeWord || !classifier || isValidMatch(classifier, line, start, length)) {
      spans.push({ start, end: start + length });
    }
  };

  if (word.literal !== null) {
    const needle = word.literal;
    let from = 0;
    while (from <= line.length - needle.length) {
      const index = line.indexOf(needle, from);
      if (index < 0) {
        break;
      }
      accept(index, needle.length);
      from = index + needle.length;
    }
    return spans;
  }

  const regex = word.regex;
  if (!regex) {
    return spans;
  }
  regex.lastIndex = 0;
  while (regex.lastIndex <= line.length) {
    const m = regex.exec(line);
    if (!m) {
      break;
    }
    const length = m[0].length;
    if (length === 0) {
      // 空文字への一致は無限ループの原因になるため、スキップして1文字（サロゲートペアは2）進める
      const code = line.codePointAt(m.index);
      regex.lastIndex = m.index + (code !== undefined && code > 0xffff ? 2 : 1);
      continue;
    }
    accept(m.index, length);
  }
  return spans;
}

/**
 * 1行について、全単語の一致を求め、重なりを解決した区間を返す。
 * - 優先度の高い単語（words の先頭側）が、その位置を確保する
 * - 確保した位置には、確保した単語の色だけを使う（色なしでも、下の単語の色は引き継がない）
 * - 両方とも色なしの区間は、結果に含めない
 */
export function computeLineSegments(
  words: readonly CompiledWord[],
  line: string,
  classifier: WordSeparatorClassifier | null,
): Segment[] {
  if (line.length === 0 || words.length === 0) {
    return [];
  }
  // 各文字の位置を、どの単語が確保したか（-1 は未確保）
  let owner: Int32Array | null = null;
  for (let w = 0; w < words.length; w++) {
    const spans = findInLine(words[w], line, classifier);
    if (spans.length === 0) {
      continue;
    }
    if (!owner) {
      owner = new Int32Array(line.length).fill(-1);
    }
    for (const span of spans) {
      for (let i = span.start; i < span.end; i++) {
        if (owner[i] === -1) {
          owner[i] = w;
        }
      }
    }
  }
  if (!owner) {
    return [];
  }

  // 同じ色の組み合わせが続く区間をまとめる（隣り合う別単語でも、同じ色なら1区間にする）
  const segments: Segment[] = [];
  let i = 0;
  while (i < owner.length) {
    const w = owner[i];
    if (w === -1) {
      i++;
      continue;
    }
    const { fg, bg } = words[w];
    let j = i + 1;
    while (j < owner.length && owner[j] !== -1 && words[owner[j]].fg === fg && words[owner[j]].bg === bg) {
      j++;
    }
    if (fg !== null || bg !== null) {
      segments.push({ start: i, end: j, fg, bg });
    }
    i = j;
  }
  return segments;
}

/** 色の組み合わせを表すキー（装飾の共有に使う） */
export function styleKey(fg: string | null, bg: string | null): string {
  return `${fg ?? '-'}|${bg ?? '-'}`;
}

// ---------------------------------------------------------------------------
// 検索範囲
// ---------------------------------------------------------------------------

/** 表示範囲の前後に検索する行数 */
export const SEARCH_MARGIN_LINES = 300;

/**
 * 表示範囲の前後 SEARCH_MARGIN_LINES 行を、重ならない行範囲（両端を含む）にまとめる。
 */
export function searchLineRanges(
  visibleRanges: readonly { start: { line: number }; end: { line: number } }[],
  lineCount: number,
): Array<[number, number]> {
  const ranges = visibleRanges
    .map((r): [number, number] => [
      Math.max(0, r.start.line - SEARCH_MARGIN_LINES),
      Math.min(lineCount - 1, r.end.line + SEARCH_MARGIN_LINES),
    ])
    .sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1] + 1) {
      last[1] = Math.max(last[1], r[1]);
    } else {
      merged.push([r[0], r[1]]);
    }
  }
  return merged;
}
