/*
 * エディタへの装飾の適用。
 * 装飾の種類（TextEditorDecorationType）は (文字色, 背景色) の組み合わせごとに共有し、
 * 使われなくなったものは破棄する。
 */
import * as vscode from 'vscode';
import { BG_ALPHA, toRgba } from './colors';
import {
  computeLineSegments,
  getClassifier,
  searchLineRanges,
  styleKey,
  type CompiledWord,
} from './matcher';

/** 編集・スクロールなどのときの再描画の待ち時間（ミリ秒） */
export const REFRESH_DELAY_MS = 150;

export class Decorator implements vscode.Disposable {
  /** 色の組み合わせのキー → 装飾の種類 */
  private readonly types = new Map<string, vscode.TextEditorDecorationType>();
  private words: readonly CompiledWord[] = [];
  private enabled = true;
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** 検索対象の単語と、全体のオン/オフを設定して、すぐに再描画する */
  setWords(words: readonly CompiledWord[], enabled: boolean): void {
    this.words = words;
    this.enabled = enabled;
    this.refreshNow();
  }

  /** 待ち時間の後に再描画する（待ち時間中に再度呼ばれたら、待ち直す） */
  scheduleRefresh(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.refreshNow();
    }, REFRESH_DELAY_MS);
  }

  /** 表示中のすべてのエディタを、すぐに再描画する */
  refreshNow(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
      this.timer = undefined;
    }
    if (!this.enabled || this.words.length === 0) {
      // 全体オフ、または単語がないときは、すべての装飾を解除する
      this.disposeTypes(new Set());
      return;
    }

    const editors = vscode.window.visibleTextEditors;
    const rangesPerEditor = editors.map((editor) => this.computeRanges(editor));
    const usedKeys = new Set<string>();
    for (const ranges of rangesPerEditor) {
      for (const key of ranges.keys()) {
        usedKeys.add(key);
      }
    }
    // 先に、使われなくなった種類を破棄する（破棄すると全エディタから装飾が消える）
    this.disposeTypes(usedKeys);

    editors.forEach((editor, i) => {
      const ranges = rangesPerEditor[i];
      for (const [key, type] of this.types) {
        editor.setDecorations(type, ranges.get(key) ?? []);
      }
      for (const [key, list] of ranges) {
        if (!this.types.has(key)) {
          const [fg, bg] = list.style;
          const type = vscode.window.createTextEditorDecorationType({
            color: fg ?? undefined,
            backgroundColor: bg ? toRgba(bg, BG_ALPHA) : undefined,
            rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
          });
          this.types.set(key, type);
          // 前のエディタには、この種類の範囲はない（あればそこで作られている）ため、
          // このエディタにだけ適用すればよい。後のエディタには、上のループで適用される
          editor.setDecorations(type, list);
        }
      }
    });
  }

  /** 1つのエディタについて、色の組み合わせごとの範囲を求める */
  private computeRanges(editor: vscode.TextEditor): Map<string, StyledRanges> {
    const result = new Map<string, StyledRanges>();
    const document = editor.document;
    const separators = vscode.workspace
      .getConfiguration('editor', document)
      .get<string>('wordSeparators', '');
    const classifier = getClassifier(separators);

    for (const [startLine, endLine] of searchLineRanges(editor.visibleRanges, document.lineCount)) {
      for (let line = startLine; line <= endLine; line++) {
        const text = document.lineAt(line).text;
        for (const seg of computeLineSegments(this.words, text, classifier)) {
          const key = styleKey(seg.fg, seg.bg);
          let list = result.get(key);
          if (!list) {
            list = Object.assign([] as vscode.Range[], { style: [seg.fg, seg.bg] as const });
            result.set(key, list);
          }
          list.push(new vscode.Range(line, seg.start, line, seg.end));
        }
      }
    }
    return result;
  }

  /** keep に含まれない装飾の種類を破棄する */
  private disposeTypes(keep: Set<string>): void {
    for (const [key, type] of this.types) {
      if (!keep.has(key)) {
        type.dispose();
        this.types.delete(key);
      }
    }
  }

  dispose(): void {
    if (this.timer !== undefined) {
      clearTimeout(this.timer);
    }
    this.disposeTypes(new Set());
  }
}

/** 色の組み合わせを持つ範囲の一覧 */
type StyledRanges = vscode.Range[] & { style: readonly [string | null, string | null] };
