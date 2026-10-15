/** 背景色の固定の透明度（設定項目にはしない） */
export const BG_ALPHA = 0.4;

/**
 * 背景色のパレット（16色）。
 * 新規登録時はこの順に循環して割り当てるため、隣り合う色が似ないように並べている。
 * BG_ALPHA の透明度で描画されることを前提に、ライト・ダークどちらでも色味がわかる色を選んでいる。
 */
export const BG_PALETTE: readonly string[] = [
  '#ffeb3b', // 黄
  '#00bcd4', // シアン
  '#e91e63', // ピンク
  '#4caf50', // 緑
  '#ff9800', // オレンジ
  '#2196f3', // 青
  '#9c27b0', // 紫
  '#cddc39', // ライム
  '#f44336', // 赤
  '#009688', // ティール
  '#3f51b5', // 藍
  '#8bc34a', // 黄緑
  '#03a9f4', // 水色
  '#673ab7', // 濃い紫
  '#795548', // 茶
  '#9e9e9e', // 灰
];

/** 文字色のパレット（16色）。不透明で描画する */
export const FG_PALETTE: readonly string[] = [
  '#d32f2f', // 赤
  '#f57c00', // オレンジ
  '#fbc02d', // 黄
  '#388e3c', // 緑
  '#00897b', // ティール
  '#0288d1', // 青
  '#3949ab', // 藍
  '#8e24aa', // 紫
  '#d81b60', // ピンク
  '#6d4c41', // 茶
  '#ff5252', // 明るい赤
  '#ffd740', // 明るい黄
  '#69f0ae', // 明るい緑
  '#40c4ff', // 明るい青
  '#ffffff', // 白
  '#000000', // 黒
];

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

/** `#rrggbb` 形式の色か */
export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** `#rrggbb` を `rgba(r, g, b, alpha)` に変換する */
export function toRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** カウンタの値から、自動割り当てする背景色を返す */
export function autoBgColor(index: number): string {
  return BG_PALETTE[((index % BG_PALETTE.length) + BG_PALETTE.length) % BG_PALETTE.length];
}
