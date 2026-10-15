/*
 * サイドバー（Webview ビュー）のプロバイダ。
 * Webview は表示専用で、状態を持たない。表示されるたびに、拡張機能側の現在の状態を送って描画する。
 */
import * as vscode from 'vscode';
import { BG_ALPHA, BG_PALETTE, FG_PALETTE } from '../colors';
import type { FromWebviewMessage, ToWebviewMessage } from '../types';
import { buildHtml, createNonce } from './html';

export const VIEW_ID = 'wordHighlighter.wordsView';

/** Webview からの操作を処理する側（extension.ts）が実装する */
export interface SidebarHost {
  /** 現在の状態を、Webview へ送る形で返す */
  snapshot(): Extract<ToWebviewMessage, { type: 'state' }>;
  /** Webview からの操作を処理する。登録のときは結果を返す */
  handle(message: FromWebviewMessage): Promise<{ ok: boolean; error?: string } | void>;
}

export class SidebarProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly host: SidebarHost,
  ) {}

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    const mediaUri = vscode.Uri.joinPath(this.extensionUri, 'media');
    view.webview.options = { enableScripts: true, localResourceRoots: [mediaUri] };
    view.webview.html = buildHtml({
      cspSource: view.webview.cspSource,
      nonce: createNonce(),
      scriptUri: view.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'sidebar.js')).toString(),
      styleUri: view.webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, 'sidebar.css')).toString(),
    });

    this.disposables.push(
      view.webview.onDidReceiveMessage((message: FromWebviewMessage) => this.onMessage(message)),
      // 再表示のときは、Webview の読み込み完了時に送られる ready で状態を送るが、
      // 念のため表示状態の変化でも送る
      view.onDidChangeVisibility(() => {
        if (view.visible) {
          this.postState();
        }
      }),
      view.onDidDispose(() => {
        if (this.view === view) {
          this.view = undefined;
        }
      }),
    );
  }

  /** 現在の状態を Webview に送る（表示されていなければ何もしない） */
  postState(): void {
    this.post(this.host.snapshot());
  }

  private post(message: ToWebviewMessage): void {
    if (this.view?.visible) {
      void this.view.webview.postMessage(message);
    }
  }

  private async onMessage(message: FromWebviewMessage): Promise<void> {
    if (message.type === 'ready') {
      this.postState();
      return;
    }
    try {
      const result = await this.host.handle(message);
      if (message.type === 'add' && result) {
        this.post({ type: 'addResult', ok: result.ok, error: result.error });
      }
    } catch (e) {
      void vscode.window.showErrorMessage(`word-highlighter: 操作に失敗しました（${e instanceof Error ? e.message : String(e)}）`);
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}

/** Webview へ送る、パレットなどの固定値 */
export const PALETTE_INFO = {
  bgPalette: BG_PALETTE,
  fgPalette: FG_PALETTE,
  bgAlpha: BG_ALPHA,
} as const;
