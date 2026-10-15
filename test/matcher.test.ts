import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  compileWords,
  computeLineSegments,
  findInLine,
  getClassifier,
  regexFlags,
  searchLineRanges,
  validateRegex,
  type CompiledWord,
} from '../src/matcher';
import type { WordEntry } from '../src/types';

/** VS Code の editor.wordSeparators の既定値 */
const DEFAULT_SEPARATORS = '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?';
const classifier = getClassifier(DEFAULT_SEPARATORS);

let idCounter = 0;
function entry(text: string, opts: Partial<WordEntry> = {}): WordEntry {
  return {
    id: `w${idCounter++}`,
    text,
    wholeWord: false,
    regex: false,
    fg: null,
    bg: '#ffeb3b',
    enabled: true,
    ...opts,
  };
}

function compileOne(text: string, opts: Partial<WordEntry> = {}): CompiledWord {
  const result = compileWords([entry(text, opts)]);
  assert.equal(result.words.length, 1, `コンパイルできること: ${text}`);
  return result.words[0];
}

/** 一致した文字列の一覧を返す */
function matches(text: string, line: string, opts: Partial<WordEntry> = {}): string[] {
  const word = compileOne(text, opts);
  return findInLine(word, line, classifier).map((s) => line.slice(s.start, s.end));
}

/** 一致した開始位置の一覧を返す */
function starts(text: string, line: string, opts: Partial<WordEntry> = {}): number[] {
  const word = compileOne(text, opts);
  return findInLine(word, line, classifier).map((s) => s.start);
}

describe('通常モード (v1.0.0)', () => {
  test('文字列リテラルとして検索する', () => {
    assert.deepEqual(starts('a.c', 'abc a.c a.c'), [4, 8]);
    assert.deepEqual(starts('(x)', 'f(x) + (x)'), [1, 7]);
  });

  test('大文字小文字を区別する', () => {
    assert.deepEqual(starts('foo', 'Foo foo FOO'), [4]);
  });

  test('前後の空白も含めて検索する', () => {
    assert.deepEqual(starts(' x ', 'a x b x'), [1]);
  });

  test('一致した後は、その末尾から次を探す（重ならない）', () => {
    assert.deepEqual(starts('aa', 'aaaa'), [0, 2]);
    assert.deepEqual(starts('aa', 'aaa'), [0]);
  });

  test('日本語も検索できる', () => {
    assert.deepEqual(starts('日本', '日本語と日本'), [0, 4]);
  });
});

describe('正規表現モード (v1.0.0)', () => {
  test('JavaScript の正規表現で検索する', () => {
    assert.deepEqual(matches('\\d+', 'a1 b22 c333', { regex: true }), ['1', '22', '333']);
  });

  test('大文字小文字を区別する（i を付けない）', () => {
    assert.deepEqual(matches('foo', 'Foo foo', { regex: true }), ['foo']);
  });

  test('\\- のような不要なエスケープを含むパターンを受け付ける', () => {
    assert.equal(validateRegex('foo\\-bar'), null);
    assert.equal(regexFlags('foo\\-bar'), 'g');
    assert.deepEqual(matches('foo\\-bar', 'x foo-bar', { regex: true }), ['foo-bar']);
  });

  test('\\p{...}、\\P{...}、\\u{...} を含むときだけ u を付ける', () => {
    assert.equal(regexFlags('\\p{Script=Han}+'), 'gu');
    assert.equal(regexFlags('\\P{L}'), 'gu');
    assert.equal(regexFlags('\\u{1F600}'), 'gu');
    assert.equal(regexFlags('abc'), 'g');
    assert.equal(regexFlags('\\u3042'), 'g');
    // バックスラッシュ自体がエスケープされている場合は付けない
    assert.equal(regexFlags('\\\\p{x}'), 'g');
    assert.deepEqual(matches('\\p{Script=Han}+', 'これは漢字です', { regex: true }), ['漢字']);
  });

  test('不正な正規表現はエラー文を返す', () => {
    assert.notEqual(validateRegex('('), null);
    assert.notEqual(validateRegex('[a-'), null);
    // u が付くパターンでは、不要なエスケープもエラーになる
    assert.notEqual(validateRegex('\\p{L}\\-'), null);
  });

  test('空文字への一致はスキップする（無限ループしない）', () => {
    assert.deepEqual(matches('^', 'abc', { regex: true }), []);
    assert.deepEqual(matches('x*', 'abc', { regex: true }), []);
    assert.deepEqual(matches('a*', 'baab a', { regex: true }), ['aa', 'a']);
    assert.deepEqual(matches('(?=a)', 'aaa', { regex: true }), []);
    // サロゲートペアの途中で止まらない
    assert.deepEqual(matches('\\u{1F600}?', 'x😀y', { regex: true }), ['😀']);
    assert.deepEqual(matches('b?', '😀b😀', { regex: true }), ['b']);
  });
});

describe('単語一致（VS Code の検索の単語一致と同じ） (v1.0.0)', () => {
  const ww = { wholeWord: true };

  test('foo は foo_bar、foobar には一致せず、foo-bar、foo.bar には一致する', () => {
    assert.deepEqual(starts('foo', 'foo_bar', ww), []);
    assert.deepEqual(starts('foo', 'foobar', ww), []);
    assert.deepEqual(starts('foo', 'barfoo', ww), []);
    assert.deepEqual(starts('foo', 'foo-bar', ww), [0]);
    assert.deepEqual(starts('foo', 'foo.bar', ww), [0]);
    assert.deepEqual(starts('foo', 'bar.foo', ww), [4]);
    assert.deepEqual(starts('foo', 'foo', ww), [0]);
    assert.deepEqual(starts('foo', ' foo\t', ww), [1]);
    assert.deepEqual(starts('foo', '(foo)', ww), [1]);
  });

  test('区切り文字で始まる・終わる単語（.foo、foo.）', () => {
    // マッチの先頭が区切り文字なら、直前が単語の文字でも左境界になる
    assert.deepEqual(starts('.foo', 'x.foo', ww), [1]);
    assert.deepEqual(starts('.foo', 'x.foobar', ww), []);
    assert.deepEqual(starts('.foo', 'a .foo b', ww), [2]);
    // マッチの末尾が区切り文字なら、直後が単語の文字でも右境界になる
    assert.deepEqual(starts('foo.', 'foo.bar', ww), [0]);
    assert.deepEqual(starts('foo.', 'xfoo.bar', ww), []);
  });

  test('日本語は、前後が区切り文字・空白・行頭行末のときだけ一致する', () => {
    assert.deepEqual(starts('日本', '日本語', ww), []);
    assert.deepEqual(starts('日本', '東日本', ww), []);
    assert.deepEqual(starts('日本', '日本', ww), [0]);
    assert.deepEqual(starts('日本', 'これは 日本 です', ww), [4]);
    assert.deepEqual(starts('日本', '(日本)', ww), [1]);
    assert.deepEqual(starts('日本', '日本,日本.', ww), [0, 3]);
  });

  test('日本語の句読点・全角空白は、既定の区切り文字に含まれないため境界にならない', () => {
    // editor.wordSeparators の既定値には「、」「。」、全角空白（U+3000）が含まれない
    assert.deepEqual(starts('日本', '日本、', ww), []);
    assert.deepEqual(starts('日本', '。日本', ww), []);
    assert.deepEqual(starts('日本', '3000日本3000', ww), []);
  });

  test('区切り文字の設定（言語ごとの値）に従う', () => {
    const custom = getClassifier('、。');
    const word = compileOne('日本', ww);
    assert.deepEqual(findInLine(word, '日本、日本語。日本', custom).map((s) => s.start), [0, 7]);
    // - を区切り文字にしない設定では、foo-bar の foo は一致しない
    const noHyphen = getClassifier('.');
    const foo = compileOne('foo', ww);
    assert.deepEqual(findInLine(foo, 'foo-bar foo.bar', noHyphen).map((s) => s.start), [8]);
  });

  test('境界を満たさない一致の末尾から、次を探す', () => {
    assert.deepEqual(starts('foo', 'foofoo foo', ww), [7]);
  });

  test('正規表現と単語一致が両方ONの場合は、正規表現の結果に境界判定を適用する', () => {
    const both = { wholeWord: true, regex: true };
    assert.deepEqual(matches('fo+', 'fo foo foobar xfoo foo-1', both), ['fo', 'foo', 'foo']);
    assert.deepEqual(matches('\\w+_id', 'user_id a.user_id user_idx', both), ['user_id', 'user_id']);
    assert.deepEqual(matches('日本', '日本語 日本', both), ['日本']);
  });
});

describe('compileWords (v1.0.0)', () => {
  test('無効な単語と、不正な正規表現の単語を除き、不正なものを報告する', () => {
    const ok = entry('a');
    const disabled = entry('b', { enabled: false });
    const bad = entry('(', { regex: true });
    const badDisabled = entry('[', { regex: true, enabled: false });
    const result = compileWords([ok, disabled, bad, badDisabled]);
    assert.deepEqual(result.words.map((w) => w.id), [ok.id]);
    assert.deepEqual(Object.keys(result.invalid).sort(), [bad.id, badDisabled.id].sort());
  });

  test('正規表現モードでなければ、正規表現として不正な文字列も通常検索する', () => {
    const result = compileWords([entry('(')]);
    assert.equal(result.words.length, 1);
    assert.deepEqual(Object.keys(result.invalid), []);
  });
});

describe('重なりの分割 (v1.0.0)', () => {
  const Y = '#ffeb3b';
  const C = '#00bcd4';
  const R = '#d32f2f';

  function segments(words: WordEntry[], line: string) {
    return computeLineSegments(compileWords(words).words, line, classifier)
      .map((s) => ({ text: line.slice(s.start, s.end), fg: s.fg, bg: s.bg }));
  }

  test('重ならない部分は、それぞれの単語の色を使う', () => {
    assert.deepEqual(segments([entry('foo', { bg: Y }), entry('bar', { bg: C })], 'foo bar'), [
      { text: 'foo', fg: null, bg: Y },
      { text: 'bar', fg: null, bg: C },
    ]);
  });

  test('重なった区間は、一覧で上にある単語の設定だけを使う', () => {
    // foobar（上）と bar（下）: bar の部分も foobar の色
    assert.deepEqual(segments([entry('foobar', { bg: Y }), entry('bar', { bg: C, fg: R })], 'foobar'), [
      { text: 'foobar', fg: null, bg: Y },
    ]);
    // 並びを逆にすると、bar の部分が bar の色になる
    assert.deepEqual(segments([entry('bar', { bg: C, fg: R }), entry('foobar', { bg: Y })], 'foobar'), [
      { text: 'foo', fg: null, bg: Y },
      { text: 'bar', fg: R, bg: C },
    ]);
  });

  test('部分的な重なりは、重ならない部分をそれぞれの色にする', () => {
    assert.deepEqual(segments([entry('abc', { bg: Y }), entry('cde', { bg: C })], 'abcde'), [
      { text: 'abc', fg: null, bg: Y },
      { text: 'de', fg: null, bg: C },
    ]);
  });

  test('優先度の高い単語の「色なし」は、下の単語の色を引き継がない', () => {
    // 上の単語は文字色だけ（背景色なし）。重なった区間に下の背景色は付かない
    assert.deepEqual(segments([entry('bc', { fg: R, bg: null }), entry('abcd', { bg: Y })], 'abcd'), [
      { text: 'a', fg: null, bg: Y },
      { text: 'bc', fg: R, bg: null },
      { text: 'd', fg: null, bg: Y },
    ]);
    // 上の単語が両方とも色なしなら、その区間は装飾しない
    assert.deepEqual(segments([entry('bc', { fg: null, bg: null }), entry('abcd', { bg: Y })], 'abcd'), [
      { text: 'a', fg: null, bg: Y },
      { text: 'd', fg: null, bg: Y },
    ]);
  });

  test('無効な単語は位置を確保しない', () => {
    assert.deepEqual(segments([entry('bc', { bg: C, enabled: false }), entry('abcd', { bg: Y })], 'abcd'), [
      { text: 'abcd', fg: null, bg: Y },
    ]);
  });

  test('同じ単語を二重登録した場合は、上のものが反映される', () => {
    assert.deepEqual(segments([entry('x', { bg: C }), entry('x', { bg: Y })], 'x'), [
      { text: 'x', fg: null, bg: C },
    ]);
  });

  test('一致がなければ空', () => {
    assert.deepEqual(segments([entry('zzz')], 'abc'), []);
    assert.deepEqual(segments([entry('a')], ''), []);
  });
});

describe('検索範囲 (v1.0.0)', () => {
  const r = (start: number, end: number) => ({ start: { line: start }, end: { line: end } });

  test('表示範囲の前後300行を、ドキュメントの範囲内で検索する', () => {
    assert.deepEqual(searchLineRanges([r(1000, 1050)], 5000), [[700, 1350]]);
    assert.deepEqual(searchLineRanges([r(10, 20)], 100), [[0, 99]]);
  });

  test('重なる・隣接する範囲はまとめる（折りたたみで表示範囲が複数ある場合）', () => {
    assert.deepEqual(searchLineRanges([r(1500, 1510), r(1000, 1010)], 5000), [[700, 1810]]);
    assert.deepEqual(searchLineRanges([r(0, 10), r(2000, 2010)], 5000), [[0, 310], [1700, 2310]]);
  });
});
