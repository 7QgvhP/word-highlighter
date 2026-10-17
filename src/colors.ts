/** 背景色の固定の透明度（設定項目にはしない） */
export const BG_ALPHA = 0.4;

/**
 * 背景色のパレット（16色）。
 * 新規登録時はこの順に循環して割り当てるため、隣り合う色が似ないように並べている。
 * BG_ALPHA の透明度で描画されることを前提に、ダークテーマの黒い背景でも目立つ明るい色を選んでいる。
 */
export const BG_PALETTE: readonly string[] = [
  '#fff176', // 黄
  '#4dd0e1', // シアン
  '#f06292', // ピンク
  '#81c784', // 緑
  '#ffb74d', // オレンジ
  '#64b5f6', // 青
  '#ba68c8', // 紫
  '#dce775', // ライム
  '#e57373', // 赤
  '#4db6ac', // ティール
  '#7986cb', // 藍
  '#aed581', // 黄緑
  '#4fc3f7', // 水色
  '#9575cd', // 濃い紫
  '#a1887f', // 茶
  '#e0e0e0', // 灰
];

/** 文字色のパレット（16色）。不透明で描画する。ダークテーマの黒い背景でも目立つ明るい色を選んでいる */
export const FG_PALETTE: readonly string[] = [
  '#ff8a80', // 赤
  '#ffb74d', // オレンジ
  '#fff176', // 黄
  '#81c784', // 緑
  '#4db6ac', // ティール
  '#64b5f6', // 青
  '#9fa8da', // 藍
  '#ce93d8', // 紫
  '#f48fb1', // ピンク
  '#bcaaa4', // 茶
  '#ff5252', // 明るい赤
  '#ffd740', // 明るい黄
  '#69f0ae', // 明るい緑
  '#40c4ff', // 明るい青
  '#ffffff', // 白
  '#ea80fc', // 明るい紫
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
