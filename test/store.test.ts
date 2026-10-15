import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  STATE_KEY,
  StateStore,
  addWord,
  defaultState,
  moveWord,
  parseState,
  removeAll,
  removeWord,
  setBg,
  setFg,
  toggleEnabled,
  toggleRegex,
  toggleWholeWord,
  type MementoLike,
} from '../src/store';
import { BG_PALETTE } from '../src/colors';

/** globalState の代わりに使う、メモリ上の保存先 */
class MemoryMemento implements MementoLike {
  readonly data = new Map<string, unknown>();
  writes = 0;
  get(key: string): unknown {
    return this.data.get(key);
  }
  async update(key: string, value: unknown): Promise<void> {
    this.writes++;
    this.data.set(key, structuredClone(value));
  }
}

const validWord = {
  id: 'a', text: 'foo', wholeWord: false, regex: false, fg: null, bg: '#FFEB3B', enabled: true,
};

describe('parseState (v1.0.0)', () => {
  test('未保存なら初期状態', () => {
    const r = parseState(undefined);
    assert.equal(r.ok, true);
    assert.deepEqual(r.ok && r.state, defaultState());
  });

  test('正しいデータを読み込み、色を小文字にそろえる', () => {
    const r = parseState({ schemaVersion: 1, words: [validWord], globalEnabled: false, nextColorIndex: 3 });
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.state.words[0].bg, '#ffeb3b');
      assert.equal(r.state.globalEnabled, false);
      assert.equal(r.state.nextColorIndex, 3);
    }
  });

  test('前後の空白を含む単語を読み込める', () => {
    const r = parseState({ schemaVersion: 1, words: [{ ...validWord, text: ' x ' }], globalEnabled: true, nextColorIndex: 0 });
    assert.equal(r.ok && r.state.words[0].text, ' x ');
  });

  const broken: Array<[string, unknown]> = [
    ['文字列', 'abc'],
    ['配列', []],
    ['schemaVersion なし', { words: [], globalEnabled: true, nextColorIndex: 0 }],
    ['新しい schemaVersion', { schemaVersion: 2, words: [], globalEnabled: true, nextColorIndex: 0 }],
    ['words が配列でない', { schemaVersion: 1, words: {}, globalEnabled: true, nextColorIndex: 0 }],
    ['globalEnabled なし', { schemaVersion: 1, words: [], nextColorIndex: 0 }],
    ['nextColorIndex が負', { schemaVersion: 1, words: [], globalEnabled: true, nextColorIndex: -1 }],
    ['空の単語', { schemaVersion: 1, words: [{ ...validWord, text: '' }], globalEnabled: true, nextColorIndex: 0 }],
    ['ID の重複', { schemaVersion: 1, words: [validWord, validWord], globalEnabled: true, nextColorIndex: 0 }],
    ['不正な色', { schemaVersion: 1, words: [{ ...validWord, fg: 'red' }], globalEnabled: true, nextColorIndex: 0 }],
    ['真偽値でない', { schemaVersion: 1, words: [{ ...validWord, regex: 'no' }], globalEnabled: true, nextColorIndex: 0 }],
  ];
  for (const [name, raw] of broken) {
    test(`壊れたデータを検出する: ${name}`, () => {
      assert.equal(parseState(raw).ok, false);
    });
  }
});

describe('状態の操作 (v1.0.0)', () => {
  test('新規登録は末尾に追加し、背景色をパレットから順に割り当てる', () => {
    let s = defaultState();
    s = addWord(s, 'one', '1');
    s = addWord(s, 'two', '2');
    assert.deepEqual(s.words.map((w) => w.text), ['one', 'two']);
    assert.deepEqual(s.words[0], {
      id: '1', text: 'one', wholeWord: false, regex: false, fg: null, bg: BG_PALETTE[0], enabled: true,
    });
    assert.equal(s.words[1].bg, BG_PALETTE[1]);
    assert.equal(s.nextColorIndex, 2);
  });

  test('パレットの末尾の次は先頭に戻る', () => {
    const s = addWord({ ...defaultState(), nextColorIndex: BG_PALETTE.length }, 'x', '1');
    assert.equal(s.words[0].bg, BG_PALETTE[0]);
  });

  test('空文字は登録できない', () => {
    assert.throws(() => addWord(defaultState(), '', '1'));
  });

  test('トグル・色の変更・削除', () => {
    let s = addWord(addWord(defaultState(), 'a', '1'), 'b', '2');
    s = toggleEnabled(s, '1');
    s = toggleWholeWord(s, '1');
    s = toggleRegex(s, '1');
    s = setFg(s, '1', '#AABBCC');
    s = setBg(s, '1', null);
    assert.deepEqual(s.words[0], {
      id: '1', text: 'a', wholeWord: true, regex: true, fg: '#aabbcc', bg: null, enabled: false,
    });
    // 不正な色は無視する
    assert.equal(setFg(s, '1', 'blue'), s);
    s = removeWord(s, '1');
    assert.deepEqual(s.words.map((w) => w.id), ['2']);
    s = removeAll(s);
    assert.deepEqual(s.words, []);
  });

  test('並べ替え（toIndex は移動後の位置）', () => {
    let s = defaultState();
    for (const id of ['a', 'b', 'c', 'd']) {
      s = addWord(s, id, id);
    }
    const order = (st: typeof s) => st.words.map((w) => w.id).join('');
    assert.equal(order(moveWord(s, 'd', 0)), 'dabc');
    assert.equal(order(moveWord(s, 'a', 3)), 'bcda');
    assert.equal(order(moveWord(s, 'a', 1)), 'bacd');
    assert.equal(order(moveWord(s, 'c', 99)), 'abdc');
    assert.equal(order(moveWord(s, 'zz', 0)), 'abcd');
  });

  test('操作は元の状態を変更しない', () => {
    const s = addWord(defaultState(), 'a', '1');
    toggleEnabled(s, '1');
    assert.equal(s.words[0].enabled, true);
  });
});

describe('StateStore (v1.0.0)', () => {
  test('変更を保存し、再読み込みで復元できる', async () => {
    const memento = new MemoryMemento();
    const store = new StateStore(memento);
    store.load();
    let notified = 0;
    store.onDidChange(() => notified++);
    await store.update((s) => addWord(s, 'foo', '1'));
    await store.update((s) => ({ ...s, globalEnabled: false }));
    assert.equal(notified, 2);

    const reloaded = new StateStore(memento);
    reloaded.load();
    assert.equal(reloaded.corrupted, false);
    assert.deepEqual(reloaded.state.words.map((w) => w.text), ['foo']);
    assert.equal(reloaded.state.globalEnabled, false);
  });

  test('データが壊れていたら、空で動かし、保存を一切行わない', async () => {
    const memento = new MemoryMemento();
    const raw = { schemaVersion: 1, words: 'broken' };
    memento.data.set(STATE_KEY, raw);
    const store = new StateStore(memento);
    store.load();
    assert.equal(store.corrupted, true);
    assert.equal(store.state.words.length, 0);

    await store.update((s) => addWord(s, 'foo', '1'));
    assert.deepEqual(store.state.words.map((w) => w.text), ['foo']);
    assert.equal(memento.writes, 0);
    assert.deepEqual(memento.data.get(STATE_KEY), raw);
  });

  test('「データを初期化」で、壊れた生データを別キーに退避してから初期化する', async () => {
    const memento = new MemoryMemento();
    const raw = { schemaVersion: 1, words: 'broken' };
    memento.data.set(STATE_KEY, raw);
    const store = new StateStore(memento);
    store.load();
    const backupKey = await store.resetCorrupted(new Date('2026-01-02T03:04:05.000Z'));
    assert.equal(backupKey, 'wordHighlighter.state.corrupted.2026-01-02T03:04:05.000Z');
    assert.deepEqual(memento.data.get(backupKey), raw);
    assert.deepEqual(memento.data.get(STATE_KEY), defaultState());
    assert.equal(store.corrupted, false);

    // 初期化した後は保存する
    await store.update((s) => addWord(s, 'foo', '1'));
    assert.equal((memento.data.get(STATE_KEY) as { words: unknown[] }).words.length, 1);
  });
});
