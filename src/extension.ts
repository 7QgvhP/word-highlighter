/*
 * 拡張機能の起動、コマンドの登録、各部品の接続。
 */
import * as vscode from 'vscode';
import { randomUUID } from 'node:crypto';
import { Decorator } from './decorator';
import { compileWords, type CompileResult } from './matcher';
import { PALETTE_INFO, SidebarProvider, VIEW_ID } from './sidebar/provider';
import {
  StateStore,
  addWord,
  moveWord,
  removeAll,
  removeWord,
  setBg,
  setFg,
  setGlobalEnabled,
  toggleEnabled,
  toggleRegex,
  toggleWholeWord,
} from './store';
import type { FromWebviewMessage } from './types';

/** 全体のオン/オフを表すコンテキストキー（タイトルバーのボタンの切り替えに使う） */
const CONTEXT_GLOBAL_ENABLED = 'wordHighlighter.globalEnabled';

export function activate(context: vscode.ExtensionContext): void {
  const store = new StateStore(context.globalState);
  store.load();

  const decorator = new Decorator();
  let compiled: CompileResult = compileWords([]);

  /** 状態の変更を、装飾・コンテキストキー・サイドバーに反映する */
  const apply = (): void => {
    const state = store.state;
    compiled = compileWords(state.words);
    decorator.setWords(compiled.words, state.globalEnabled);
    void vscode.commands.executeCommand('setContext', CONTEXT_GLOBAL_ENABLED, state.globalEnabled);
    sidebar.postState();
  };

  /** 単語を登録する（入力欄・コマンド共通） */
  const register = async (text: string): Promise<{ ok: boolean; error?: string }> => {
    if (text.length === 0) {
      return { ok: false, error: '空の文字列は登録できません。' };
    }
    await store.update((s) => addWord(s, text, randomUUID()));
    return { ok: true };
  };

  const confirmDeleteAll = async (): Promise<void> => {
    if (store.state.words.length === 0) {
      void vscode.window.showInformationMessage('登録されている単語はありません。');
      return;
    }
    const answer = await vscode.window.showWarningMessage(
      `登録されている ${store.state.words.length} 個の単語をすべて削除しますか？`,
      { modal: true },
      'すべて削除',
    );
    if (answer === 'すべて削除') {
      await store.update(removeAll);
    }
  };

  const setGlobal = (enabled: boolean): Promise<void> =>
    store.update((s) => setGlobalEnabled(s, enabled));

  const handle = async (m: FromWebviewMessage): Promise<{ ok: boolean; error?: string } | void> => {
    switch (m.type) {
      case 'add':
        return register(m.text);
      case 'toggleEnabled':
        return store.update((s) => toggleEnabled(s, m.id));
      case 'toggleWholeWord':
        return store.update((s) => toggleWholeWord(s, m.id));
      case 'toggleRegex':
        return store.update((s) => toggleRegex(s, m.id));
      case 'setFg':
        return store.update((s) => setFg(s, m.id, m.color));
      case 'setBg':
        return store.update((s) => setBg(s, m.id, m.color));
      case 'delete':
        return store.update((s) => removeWord(s, m.id));
      case 'deleteAll':
        return confirmDeleteAll();
      case 'move':
        return store.update((s) => moveWord(s, m.id, m.toIndex));
      case 'ready':
        return;
    }
  };

  const sidebar = new SidebarProvider(context.extensionUri, {
    snapshot: () => ({
      type: 'state',
      state: store.state,
      invalid: compiled.invalid,
      corrupted: store.corrupted,
      ...PALETTE_INFO,
    }),
    handle,
  });

  context.subscriptions.push(
    decorator,
    sidebar,
    vscode.window.registerWebviewViewProvider(VIEW_ID, sidebar),
    store.onDidChange(apply),

    vscode.commands.registerCommand('wordHighlighter.addSelection', async () => {
      const text = textFromEditor(vscode.window.activeTextEditor);
      if (typeof text === 'string') {
        await register(text);
      } else {
        void vscode.window.showInformationMessage(text.message);
      }
    }),
    vscode.commands.registerCommand('wordHighlighter.toggleGlobal', () => setGlobal(!store.state.globalEnabled)),
    vscode.commands.registerCommand('wordHighlighter.turnOn', () => setGlobal(true)),
    vscode.commands.registerCommand('wordHighlighter.turnOff', () => setGlobal(false)),
    vscode.commands.registerCommand('wordHighlighter.deleteAll', confirmDeleteAll),

    // 編集・スクロール・表示エディタの変更は、待ち時間の後に再描画する
    vscode.workspace.onDidChangeTextDocument((e) => {
      if (vscode.window.visibleTextEditors.some((ed) => ed.document === e.document)) {
        decorator.scheduleRefresh();
      }
    }),
    vscode.window.onDidChangeTextEditorVisibleRanges(() => decorator.scheduleRefresh()),
    vscode.window.onDidChangeActiveTextEditor(() => decorator.scheduleRefresh()),
    vscode.window.onDidChangeVisibleTextEditors(() => decorator.scheduleRefresh()),
    // 言語ごとの editor.wordSeparators が変わったときも、再描画する（読み取りのみ）
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('editor.wordSeparators')) {
        decorator.scheduleRefresh();
      }
    }),
  );

  apply();

  if (store.corrupted) {
    void notifyCorrupted(store);
  }
}

export function deactivate(): void {
  // 後始末は context.subscriptions で行う
}

/**
 * エディタから登録する文字列を取り出す。
 * 選択があればその文字列、なければカーソル位置の単語。登録できないときは理由を返す。
 */
function textFromEditor(editor: vscode.TextEditor | undefined): string | { message: string } {
  if (!editor) {
    return { message: '登録する単語がありません（エディタが開かれていません）。' };
  }
  const selection = editor.selection;
  if (selection.isEmpty) {
    const range = editor.document.getWordRangeAtPosition(selection.active);
    const word = range ? editor.document.getText(range) : '';
    return word.length > 0 ? word : { message: '登録する単語がありません（カーソル位置に単語がありません）。' };
  }
  if (!selection.isSingleLine) {
    return { message: '複数行にまたがる選択は登録できません。' };
  }
  return editor.document.getText(selection);
}

/** 保存データが壊れていたことを通知する */
async function notifyCorrupted(store: StateStore): Promise<void> {
  const answer = await vscode.window.showErrorMessage(
    `word-highlighter: 保存データを読み込めませんでした（${store.corruptionReason}）。` +
      'このセッションでは、保存済みのデータを守るため、変更を保存しません。',
    'データを初期化',
  );
  if (answer !== 'データを初期化') {
    return;
  }
  const confirm = await vscode.window.showWarningMessage(
    '保存データを初期化しますか？壊れたデータは別の場所に退避します。登録内容は空になります。',
    { modal: true },
    '初期化',
  );
  if (confirm === '初期化') {
    const backupKey = await store.resetCorrupted();
    void vscode.window.showInformationMessage(`word-highlighter: 初期化しました（壊れたデータの退避先: ${backupKey}）。`);
  }
}
