// サイドバー（登録単語）の画面。
// 状態は持たず、拡張機能側から送られた状態をそのまま描画する。操作はメッセージで拡張機能側へ送る。
(function () {
  'use strict';

  const vscode = acquireVsCodeApi();

  const bannersEl = document.getElementById('banners');
  const inputEl = document.getElementById('new-word');
  const addButton = document.getElementById('add-button');
  const addErrorEl = document.getElementById('add-error');
  const countEl = document.getElementById('count');
  const deleteAllButton = document.getElementById('delete-all');
  const listEl = document.getElementById('list');
  const emptyEl = document.getElementById('empty');

  /** 拡張機能側から最後に受け取った state メッセージ */
  let current = null;
  /** 表示中のパレット要素 */
  let paletteEl = null;
  /** ドラッグ中の単語の ID */
  let dragId = null;

  // ---- アイコン（Codicons 相当の形を SVG で描く） ----
  const ICONS = {
    eye: '<svg viewBox="0 0 16 16"><path d="M8 3C4.5 3 1.7 5.3 1 8c.7 2.7 3.5 5 7 5s6.3-2.3 7-5c-.7-2.7-3.5-5-7-5zm0 9c-2.8 0-5.1-1.7-5.9-4C2.9 5.7 5.2 4 8 4s5.1 1.7 5.9 4c-.8 2.3-3.1 4-5.9 4zm0-6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zm0 4a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"/></svg>',
    eyeClosed: '<svg viewBox="0 0 16 16"><path d="M1.4 5.3l.9-.5C3.4 6.7 5.6 8 8 8s4.6-1.3 5.7-3.2l.9.5a7.8 7.8 0 0 1-1.6 2l1.4 1.5-.7.7-1.5-1.5c-.6.4-1.3.8-2 1l.6 2-.9.3-.6-2a7.7 7.7 0 0 1-2.6 0l-.6 2-.9-.3.6-2c-.7-.2-1.4-.6-2-1L2.7 9.7 2 9l1.4-1.5a7.8 7.8 0 0 1-2-2.2z"/></svg>',
    gripper: '<svg viewBox="0 0 16 16"><path d="M5 3h2v2H5zm4 0h2v2H9zM5 7h2v2H5zm4 0h2v2H9zm-4 4h2v2H5zm4 0h2v2H9z"/></svg>',
    close: '<svg viewBox="0 0 16 16"><path d="M8 7.3l3.6-3.6.7.7L8.7 8l3.6 3.6-.7.7L8 8.7l-3.6 3.6-.7-.7L7.3 8 3.7 4.4l.7-.7z"/></svg>',
    warning: '<svg viewBox="0 0 16 16"><path d="M7.6 1.5h.8l6.5 12-.4.8H1.5l-.4-.8zM8 2.9L2.3 13.3h11.4zM7.5 6h1v4h-1zm0 5h1v1h-1z"/></svg>',
  };

  function el(tag, className, attrs) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    if (attrs) {
      for (const [key, value] of Object.entries(attrs)) {
        node.setAttribute(key, value);
      }
    }
    return node;
  }

  function iconButton(icon, title, onClick, extraClass) {
    const b = el('button', 'icon-button' + (extraClass ? ' ' + extraClass : ''), { type: 'button', title: title, 'aria-label': title });
    b.innerHTML = ICONS[icon];
    if (onClick) {
      b.addEventListener('click', onClick);
    }
    return b;
  }

  /** #rrggbb を rgba() に変換する（背景色の透明度の適用に使う） */
  function rgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
  }

  /** 単語のプレビュー（文字色・背景色）を要素に適用する */
  function applyPreview(node, fg, bg) {
    node.style.color = fg || '';
    node.style.backgroundColor = bg ? rgba(bg, current.bgAlpha) : '';
  }

  // ---- 描画 ----

  function render() {
    if (!current) {
      return;
    }
    closePalette();
    const state = current.state;

    bannersEl.textContent = '';
    if (current.corrupted) {
      const b = el('div', 'banner error');
      b.textContent = '保存データを読み込めなかったため、このセッションでは変更を保存しません。';
      bannersEl.appendChild(b);
    }
    if (!state.globalEnabled) {
      const b = el('div', 'banner');
      b.textContent = '全体オフ(ハイライトは無効です)';
      bannersEl.appendChild(b);
    }

    countEl.textContent = String(state.words.length);
    deleteAllButton.disabled = state.words.length === 0;
    emptyEl.style.display = state.words.length === 0 ? '' : 'none';

    listEl.textContent = '';
    state.words.forEach(function (word, index) {
      listEl.appendChild(renderRow(word, index));
    });
  }

  function renderRow(word, index) {
    const row = el('li', 'word-row' + (word.enabled ? '' : ' disabled'));
    row.dataset.id = word.id;
    row.dataset.index = String(index);

    // 並べ替えハンドル（ここをつかんだときだけドラッグできる）
    const handle = iconButton('gripper', 'ドラッグして並べ替え', null, 'drag-handle');
    handle.addEventListener('mousedown', function () { row.draggable = true; });
    handle.addEventListener('mouseup', function () { row.draggable = false; });
    row.appendChild(handle);

    // 目アイコン
    row.appendChild(iconButton(
      word.enabled ? 'eye' : 'eyeClosed',
      word.enabled ? '有効（クリックで無効にする）' : '無効（クリックで有効にする）',
      function () { send({ type: 'toggleEnabled', id: word.id }); },
    ));

    // 単語（設定した色で表示して、プレビューを兼ねる）。
    // 色は文字の部分（.word-text）にだけ付け、欄の余白には付けない（エディタ上の見た目にそろえる）
    const cell = el('span', 'word-cell');
    const text = el('span', 'word-text', { title: word.text });
    text.textContent = word.text;
    applyPreview(text, word.fg, word.bg);
    cell.appendChild(text);
    row.appendChild(cell);

    // 不正な正規表現の警告
    const error = current.invalid[word.id];
    if (error) {
      const w = el('span', 'icon-button warning', { title: '不正な正規表現のため、無効になっています: ' + error, role: 'img', 'aria-label': '不正な正規表現' });
      w.innerHTML = ICONS.warning;
      row.appendChild(w);
    }

    // 単語一致・正規表現のトグル
    row.appendChild(toggleButton('<span class="whole-word">ab</span>', '単語単位で検索する', word.wholeWord, function () {
      send({ type: 'toggleWholeWord', id: word.id });
    }));
    row.appendChild(toggleButton('.*', '正規表現を使用する', word.regex, function () {
      send({ type: 'toggleRegex', id: word.id });
    }));

    // 文字色・背景色のボタン
    const fgButton = el('button', 'color-button', { type: 'button', title: '文字色', 'aria-label': '文字色' });
    fgButton.textContent = 'A';
    if (word.fg) {
      fgButton.style.color = word.fg;
    } else {
      fgButton.classList.add('no-color');
    }
    fgButton.addEventListener('click', function (e) {
      e.stopPropagation();
      openPalette(fgButton, 'fg', word);
    });
    row.appendChild(fgButton);

    const bgButton = el('button', 'color-button', { type: 'button', title: '背景色', 'aria-label': '背景色' });
    const swatch = el('span', 'swatch' + (word.bg ? '' : ' no-color'));
    if (word.bg) {
      swatch.style.backgroundColor = rgba(word.bg, current.bgAlpha);
    }
    bgButton.appendChild(swatch);
    bgButton.addEventListener('click', function (e) {
      e.stopPropagation();
      openPalette(bgButton, 'bg', word);
    });
    row.appendChild(bgButton);

    // 削除（確認なし）
    row.appendChild(iconButton('close', '削除', function () { send({ type: 'delete', id: word.id }); }, 'delete-button'));

    setupDrag(row, word.id);
    return row;
  }

  function toggleButton(html, title, checked, onClick) {
    const b = el('button', 'toggle' + (checked ? ' checked' : ''), {
      type: 'button', title: title, 'aria-label': title, 'aria-pressed': String(checked),
    });
    b.innerHTML = html;
    b.addEventListener('click', onClick);
    return b;
  }

  // ---- パレット ----

  function openPalette(anchor, kind, word) {
    const wasOpenFor = paletteEl && paletteEl.dataset.key;
    closePalette();
    const key = kind + ':' + word.id;
    if (wasOpenFor === key) {
      return; // 同じボタンをもう一度押したら閉じるだけ
    }
    const isBg = kind === 'bg';
    const palette = isBg ? current.bgPalette : current.fgPalette;
    const selected = isBg ? word.bg : word.fg;
    const choose = function (color) {
      closePalette();
      send({ type: isBg ? 'setBg' : 'setFg', id: word.id, color: color });
    };

    const p = el('div', 'palette', { role: 'dialog', 'aria-label': isBg ? '背景色' : '文字色' });
    p.dataset.key = key;
    const title = el('div', 'palette-title');
    title.textContent = isBg ? '背景色' : '文字色';
    p.appendChild(title);

    const grid = el('div', 'palette-grid');
    palette.forEach(function (color) {
      const s = el('button', 'palette-swatch' + (color === selected ? ' selected' : ''), { type: 'button', title: color, 'aria-label': color });
      if (isBg) {
        s.style.backgroundColor = rgba(color, current.bgAlpha);
      } else {
        s.textContent = 'A';
        s.style.color = color;
        s.style.backgroundColor = 'transparent';
      }
      s.addEventListener('click', function () { choose(color); });
      grid.appendChild(s);
    });
    p.appendChild(grid);

    const actions = el('div', 'palette-actions');
    // 色なし
    const none = el('button', 'palette-action', { type: 'button' });
    const noneSwatch = el('span', 'swatch no-color');
    none.appendChild(noneSwatch);
    none.appendChild(document.createTextNode('色なし'));
    if (selected === null) {
      none.classList.add('selected');
    }
    none.addEventListener('click', function () { choose(null); });
    actions.appendChild(none);

    // カスタム色（OS 標準のカラーピッカー）
    const custom = el('label', 'palette-action', { title: 'カスタム色を選ぶ' });
    const customSwatch = el('span', 'swatch');
    const picker = el('input', null, { type: 'color', 'aria-label': 'カスタム色' });
    picker.value = selected || (isBg ? '#ffeb3b' : '#d32f2f');
    customSwatch.style.backgroundColor = isBg ? rgba(picker.value, current.bgAlpha) : picker.value;
    picker.addEventListener('input', function () {
      customSwatch.style.backgroundColor = isBg ? rgba(picker.value, current.bgAlpha) : picker.value;
    });
    picker.addEventListener('change', function () { choose(picker.value.toLowerCase()); });
    custom.appendChild(picker);
    custom.appendChild(customSwatch);
    custom.appendChild(document.createTextNode('カスタム'));
    if (selected !== null && palette.indexOf(selected) < 0) {
      custom.classList.add('selected');
    }
    actions.appendChild(custom);
    p.appendChild(actions);

    p.addEventListener('click', function (e) { e.stopPropagation(); });
    document.body.appendChild(p);
    paletteEl = p;

    // ボタンの下に表示し、はみ出す場合は上や左にずらす
    const a = anchor.getBoundingClientRect();
    const rect = p.getBoundingClientRect();
    let left = Math.min(a.right - rect.width, window.innerWidth - rect.width - 4);
    left = Math.max(4, left);
    let top = a.bottom + 2;
    if (top + rect.height > window.innerHeight - 4) {
      top = Math.max(4, a.top - rect.height - 2);
    }
    p.style.left = left + 'px';
    p.style.top = top + 'px';
  }

  function closePalette() {
    if (paletteEl) {
      paletteEl.remove();
      paletteEl = null;
    }
  }

  document.addEventListener('click', closePalette);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      closePalette();
    }
  });
  window.addEventListener('blur', function () {
    // カスタム色のピッカーを開いている間は、閉じない
    if (!(document.activeElement && document.activeElement.type === 'color')) {
      closePalette();
    }
  });

  // ---- 並べ替え（ドラッグ&ドロップ） ----

  function clearDropMarks() {
    listEl.querySelectorAll('.drop-before, .drop-after').forEach(function (r) {
      r.classList.remove('drop-before', 'drop-after');
    });
  }

  function setupDrag(row, id) {
    row.addEventListener('dragstart', function (e) {
      dragId = id;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', id);
      closePalette();
    });
    row.addEventListener('dragend', function () {
      dragId = null;
      row.draggable = false;
      row.classList.remove('dragging');
      clearDropMarks();
    });
    row.addEventListener('dragover', function (e) {
      if (dragId === null) {
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      clearDropMarks();
      row.classList.add(before ? 'drop-before' : 'drop-after');
    });
    row.addEventListener('drop', function (e) {
      if (dragId === null) {
        return;
      }
      e.preventDefault();
      const r = row.getBoundingClientRect();
      const before = e.clientY < r.top + r.height / 2;
      const words = current.state.words;
      const from = words.findIndex(function (w) { return w.id === dragId; });
      let to = Number(row.dataset.index) + (before ? 0 : 1);
      // 移動元を取り除いた後の位置に直す
      if (from < to) {
        to -= 1;
      }
      const movedId = dragId;
      clearDropMarks();
      if (from >= 0 && from !== to) {
        send({ type: 'move', id: movedId, toIndex: to });
      }
    });
  }

  // ---- 入力欄 ----

  function showAddError(message) {
    addErrorEl.textContent = message || '';
    inputEl.classList.toggle('invalid', !!message);
  }

  function submit() {
    const text = inputEl.value;
    if (text.length === 0) {
      showAddError('空の文字列は登録できません。');
      return;
    }
    send({ type: 'add', text: text });
  }

  addButton.addEventListener('click', submit);
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.isComposing) {
      e.preventDefault();
      submit();
    }
  });
  inputEl.addEventListener('input', function () { showAddError(''); });

  deleteAllButton.addEventListener('click', function () { send({ type: 'deleteAll' }); });

  // ---- 拡張機能側とのやり取り ----

  function send(message) {
    vscode.postMessage(message);
  }

  window.addEventListener('message', function (event) {
    const message = event.data;
    if (message.type === 'state') {
      current = message;
      render();
    } else if (message.type === 'addResult') {
      if (message.ok) {
        inputEl.value = '';
        showAddError('');
      } else {
        showAddError(message.error || '登録できませんでした。');
      }
    }
  });

  send({ type: 'ready' });
})();
