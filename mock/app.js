// book-tracker の UI 確認用モック。
// データはすべて data.js のダミーで、変更はページを開いている間だけメモリに残る。
(function () {
  'use strict';

  // ---------- 見せかけのログインの確認 ----------
  try {
    if (sessionStorage.getItem('mock.login') !== '1') {
      location.replace('index.html');
      return;
    }
  } catch (e) {
    // 保存領域が使えない環境では確認をとばす
  }

  const D = window.MOCK_DATA;
  const TODAY = D.today;

  // ---------- 表示の好みの保存（使えなくても動くようにする） ----------
  const pref = {
    get(key, def) {
      try {
        const v = localStorage.getItem(key);
        return v === null ? def : v;
      } catch (e) {
        return def;
      }
    },
    set(key, v) {
      try { localStorage.setItem(key, v); } catch (e) { /* 何もしない */ }
    },
  };

  const LABEL = {
    purchase: { purchased: '購入済み', planned: '購入予定', skip: '買わない' },
    read: { tsundoku: '積読', reading: '読書中', finished: '読了' },
    media: { paper: '紙媒体', ebook: '電子書籍' },
    format: { any: 'すべて', tankobon: '単行本', bunko: '文庫', shinsho: '新書', comic: 'コミック' },
    size: { 1: '単行本', 2: '文庫', 3: '新書', 9: 'コミック' },
    category: { new: '新刊', backlist: '既刊', variant: '別版' },
  };

  const SORTS = [
    ['date-desc', '発売日（新しい順）'],
    ['date-asc', '発売日（古い順）'],
    ['az', 'A–Z順'],
    ['aiu', 'あいうえお順'],
  ];

  const ICON = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4-4"/>',
    back: '<path d="M15 18l-6-6 6-6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4z"/>',
    track: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
    filter: '<path d="M4 5h16l-6 8v5l-4 2v-7z"/>',
    chevron: '<path d="M6 9l6 6 6-6"/>',
  };
  const svg = (paths, size) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

  const state = {
    ui: pref.get('mock.ui', 'a'),
    view: {
      shelf: pref.get('mock.view.shelf', 'grid'),
      series: pref.get('mock.view.series', 'grid'),
    },
    volOrder: pref.get('mock.vol.order', 'desc'), // シリーズページの巻の並び（発売日の新しい順／古い順）
    candsOpen: pref.get('mock.cands.open', '1') === '1', // シリーズページの新刊候補を開いているか
    sort: 'date-desc',
    q: '',
    filters: { read: new Set(), purchase: new Set(), media: new Set(), tracking: false, tags: new Set(), tagMode: 'and' },
    screen: 'shelf',
    layers: [], // { type: 'series' | 'book', id, carry, edit, draft, node }
    entries: [],
    shelfShown: 0,
    loading: false,
    dialogClose: null,
  };

  // ---------- 小さな道具 ----------
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isPC = () => window.matchMedia('(min-width: 900px)').matches;
  const fmtDate = (iso) => (iso ? iso.replace(/-/g, '/') : '–');
  const norm = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  const debounce = (fn, ms) => {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  };
  const depthOf = (el) => {
    const layer = el.closest('.layer');
    return layer ? Number(layer.dataset.depth) : -1;
  };

  // ---------- データの取り出しと集計 ----------
  const seriesById = (id) => D.series.find((s) => s.id === id);
  const bookById = (id) => D.books.find((b) => b.id === id);
  const tagName = (id) => (D.tags.find((t) => t.id === id) || {}).name;
  const booksOf = (sid) => D.books.filter((b) => b.seriesId === sid).sort((a, b) => (a.volume ?? 0) - (b.volume ?? 0));
  const candidatesOf = (sid) =>
    D.candidates.filter((c) => c.seriesId === sid && c.state === 'new').sort((a, b) => b.salesDate.localeCompare(a.salesDate));
  const pendingCount = () => D.candidates.filter((c) => c.state === 'new' && seriesById(c.seriesId)).length;

  // シリーズの集計の値は保存せず、その都度計算する（要件定義書 3.5）
  function seriesStats(s) {
    const books = booksOf(s.id);
    const owned = books.filter((b) => b.purchase === 'purchased');
    const latestOwned = owned.reduce((m, b) => (!m || (b.volume ?? 0) > (m.volume ?? 0) ? b : m), null);
    let published = null;
    if (s.lastChecked) {
      const known = books.concat(D.candidates.filter((c) => c.seriesId === s.id && c.state !== 'dismissed' && c.category !== 'variant'));
      published = known.filter((x) => x.salesDate <= TODAY).reduce((m, x) => Math.max(m, x.volume ?? 0), 0) || null;
    }
    const rated = books.filter((b) => b.rating != null);
    return {
      books,
      latestOwned,
      ownedMax: latestOwned ? latestOwned.volume : null,
      published,
      planned: books.filter((b) => b.purchase === 'planned').length,
      avg: rated.length ? rated.reduce((sum, b) => sum + b.rating, 0) / rated.length / 2 : null,
      pending: candidatesOf(s.id).length,
      cover: latestOwned || books[books.length - 1],
    };
  }
  const volLabel = (st) => `${st.ownedMax ?? '–'}/${st.published ?? '–'}`;
  const volText = (b) => (b.volume != null ? `${b.volume}巻` : '巻数なし');

  // ---------- 絞り込み ----------
  function filterCount() {
    const f = state.filters;
    return f.read.size + f.purchase.size + f.media.size + (f.tracking ? 1 : 0) + f.tags.size;
  }
  const filterActive = () => !!state.q.trim() || filterCount() > 0;

  function bookMatches(b) {
    const f = state.filters;
    const s = b.seriesId ? seriesById(b.seriesId) : null;
    const q = norm(state.q);
    if (q && !norm([b.title, b.author, s && s.name].join(' ')).includes(q)) return false;
    if (f.read.size && !(b.purchase === 'purchased' && f.read.has(b.read))) return false;
    if (f.purchase.size && !f.purchase.has(b.purchase)) return false;
    if (f.media.size && !(b.media && f.media.has(b.media))) return false;
    if (f.tracking && !(s && s.tracking)) return false;
    if (f.tags.size) {
      const hits = [...f.tags].map((t) => b.tags.includes(t) || b.store === t);
      if (f.tagMode === 'and' ? !hits.every(Boolean) : !hits.some(Boolean)) return false;
    }
    return true;
  }

  // 「積読 3」のように、読書状態だけで絞っているときはその名前を出す
  function matchLabel(n) {
    const f = state.filters;
    const onlyRead = f.read.size === 1 && filterCount() === 1 && !state.q.trim();
    return onlyRead ? `${LABEL.read[[...f.read][0]]} ${n}` : `該当 ${n}`;
  }

  // ---------- 本棚の並び ----------
  function shelfEntries() {
    const active = filterActive();
    const entries = [];
    D.series.forEach((s) => {
      const books = booksOf(s.id);
      if (!books.length) return;
      const matched = active ? books.filter(bookMatches).length : null;
      if (active && !matched) return;
      const st = seriesStats(s);
      entries.push({ kind: 'series', s, st, matched, name: s.name, kana: s.kana, date: (st.latestOwned || books[books.length - 1]).salesDate });
    });
    D.books.filter((b) => !b.seriesId).forEach((b) => {
      if (active && !bookMatches(b)) return;
      entries.push({ kind: 'book', b, name: b.title, kana: b.kana || b.title, date: b.salesDate });
    });
    return sortEntries(entries);
  }

  // 先頭の記号を読み飛ばし、最初の文字が英字なら英字グループにする（要件定義書 3.6）
  const stripHead = (name) => name.normalize('NFKC').replace(/^[^\p{L}\p{N}]+/u, '');
  const groupOf = (name) => (/^[A-Za-z]/.test(stripHead(name)) ? 'en' : 'ja');
  function sortEntries(list) {
    const cmpIn = (a, b, g) =>
      g === 'en' ? stripHead(a.name).toLowerCase().localeCompare(stripHead(b.name).toLowerCase()) : a.kana.localeCompare(b.kana, 'ja');
    const byGroup = (order) => (a, b) => {
      const ga = groupOf(a.name);
      const gb = groupOf(b.name);
      return ga !== gb ? order.indexOf(ga) - order.indexOf(gb) : cmpIn(a, b, ga);
    };
    switch (state.sort) {
      case 'date-asc': return list.sort((a, b) => a.date.localeCompare(b.date));
      case 'az': return list.sort(byGroup(['en', 'ja']));
      case 'aiu': return list.sort(byGroup(['ja', 'en']));
      default: return list.sort((a, b) => b.date.localeCompare(a.date));
    }
  }

  // ---------- 部品 ----------
  function coverHTML(item, size) {
    if (!item) return `<div class="cover cover-${size}"></div>`;
    const s = item.seriesId ? seriesById(item.seriesId) : null;
    return `<div class="cover cover-${size}" style="--c:${item.color}"><span class="cover-title">${esc(s ? s.name : item.title)}</span>${
      item.volume != null ? `<span class="cover-vol">${item.volume}</span>` : ''
    }</div>`;
  }

  function starsHTML(r) {
    const v = (r || 0) / 2;
    return `<span class="stars" aria-label="評価 ${v.toFixed(1)}">${[1, 2, 3, 4, 5]
      .map((i) => `<span class="star"><span class="star-fill" style="width:${Math.max(0, Math.min(1, v - (i - 1))) * 100}%"></span></span>`)
      .join('')}</span>`;
  }

  function starsInputHTML(r) {
    const v = (r || 0) / 2;
    return `<span class="stars stars-input" role="group" aria-label="評価を選ぶ">${[1, 2, 3, 4, 5]
      .map((i) => {
        const fill = Math.max(0, Math.min(1, v - (i - 1)));
        return `<span class="star"><span class="star-fill" style="width:${fill * 100}%"></span>` +
          `<button class="half half-l" data-action="set-field" data-field="rating" data-v="${i * 2 - 1}" aria-label="${i - 0.5}"></button>` +
          `<button class="half half-r" data-action="set-field" data-field="rating" data-v="${i * 2}" aria-label="${i}"></button></span>`;
      })
      .join('')}</span>`;
  }

  const purchaseHTML = (p) => `<span class="st st-${p}">${LABEL.purchase[p]}</span>`;

  const viewSeg = (screen, small) => `<div class="seg${small ? ' seg-sm' : ''}" role="group" aria-label="表示の切り替え">
      <button data-action="view" data-screen="${screen}" data-v="grid" aria-pressed="${state.view[screen] === 'grid'}" title="グリッド">${svg(ICON.grid, 18)}</button>
      <button data-action="view" data-screen="${screen}" data-v="list" aria-pressed="${state.view[screen] === 'list'}" title="リスト">${svg(ICON.list, 18)}</button>
    </div>`;

  const choiceBtn = (field, v, label, on) =>
    `<button class="chip" data-action="set-field" data-field="${field}" data-v="${v}" aria-pressed="${on}">${esc(label)}</button>`;

  const textField = (label, field, value, hint) => `<label class="field"><span class="field-label">${label}</span>
      <input class="input" data-field="${field}" value="${esc(value)}">${hint ? `<span class="none" style="font-size:12px">${hint}</span>` : ''}</label>`;

  // ---------- サイドメニュー・上部のバー ----------
  const TITLES = { shelf: '本棚', register: '本の登録', candidates: '新刊候補', settings: '設定' };

  function renderSidebar() {
    const n = pendingCount();
    const item = (screen, extra) =>
      `<button class="${state.screen === screen ? 'active' : ''}" data-action="nav" data-screen="${screen}"><span>${TITLES[screen]}</span>${extra || ''}</button>`;
    $('#sidebar').innerHTML = `<div class="brand">book-tracker<small>モック</small></div>
      <nav class="nav">${item('shelf')}${item('register')}${item('candidates', n ? `<span class="badge">${n}</span>` : '')}${item('settings')}</nav>
      <div class="sidebar-foot"><button class="btn btn-sm" data-action="logout">ログアウト</button></div>`;
  }

  function renderTopbar() {
    $('#topbar').innerHTML = `<button class="icon-btn menu-btn" data-action="drawer" aria-label="メニューを開く">${svg(ICON.menu, 22)}</button>
      <h1>${TITLES[state.screen]}</h1>
      <div class="ui-switch"><span>UI案</span><div class="seg seg-sm" role="group" aria-label="UI案の切り替え">
        <button data-action="ui" data-v="a" aria-pressed="${state.ui === 'a'}" title="A：全画面で重ねる">A</button>
        <button data-action="ui" data-v="b" aria-pressed="${state.ui === 'b'}" title="B：PCは横のパネル、スマホはボトムシート">B</button>
      </div></div>`;
    document.title = `${TITLES[state.screen]} - book-tracker モック`;
  }

  function renderScreen() {
    if (state.screen === 'shelf') {
      renderShelf();
      return;
    }
    $('#main').innerHTML = `<div class="placeholder">
        <p><strong>${TITLES[state.screen]}</strong>の画面は、今回のモックの対象外です。</p>
        <p>今回の範囲は「本棚 → シリーズページ → ブックページ」です。</p>
        <button class="btn" data-action="nav" data-screen="shelf">本棚に戻る</button>
      </div>`;
  }

  // ---------- 本棚 ----------
  function chipsHTML(grouped) {
    const f = state.filters;
    const chip = (group, v, label, on) =>
      `<button class="chip" data-action="chip" data-group="${group}" data-v="${v}" aria-pressed="${on}">${esc(label)}</button>`;
    const tagChips = (kind) => D.tags.filter((t) => t.kind === kind).map((t) => chip('tags', t.id, t.name, f.tags.has(t.id)));
    const groups = [
      ['読書状態', Object.entries(LABEL.read).map(([v, l]) => chip('read', v, l, f.read.has(v)))],
      ['購入状況', Object.entries(LABEL.purchase).map(([v, l]) => chip('purchase', v, l, f.purchase.has(v)))],
      ['媒体', Object.entries(LABEL.media).map(([v, l]) => chip('media', v, l, f.media.has(v)))],
      ['シリーズ', [chip('tracking', '1', '追跡中', f.tracking)]],
      ['購入場所', tagChips('store')],
      ['タグ', tagChips('general').concat(
        f.tags.size > 1 ? [`<button class="chip" data-action="tag-mode">${f.tagMode === 'and' ? 'タグ：すべて含む（AND）' : 'タグ：どれか含む（OR）'}</button>`] : [],
      )],
    ];
    const clear = filterCount() ? '<button class="chip chip-clear" data-action="chip-clear">クリア</button>' : '';
    if (grouped) {
      return groups.map(([h, cs]) => `<div class="filter-group"><h4>${h}</h4><div class="chips">${cs.join('')}</div></div>`).join('') +
        (clear ? `<div class="chips">${clear}</div>` : '');
    }
    return clear + groups.map(([, cs]) => cs.join('')).join('<span class="chip-sep"></span>');
  }

  function renderShelf() {
    $('#main').innerHTML = `
      <div class="toolbar">
        <label class="search">${svg(ICON.search, 18)}<input id="q" type="search" placeholder="タイトル・著者・シリーズ名で検索" value="${esc(state.q)}" autocomplete="off"></label>
        <select id="sort" aria-label="並べ替え">${SORTS.map(([v, l]) => `<option value="${v}"${state.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select>
        ${viewSeg('shelf')}
        ${state.ui === 'b' ? `<button class="btn" data-action="open-filter" id="filter-btn">${svg(ICON.filter, 16)}<span></span></button>` : ''}
      </div>
      ${state.ui === 'a' ? `<div class="chips" id="chips">${chipsHTML(false)}</div>` : ''}
      <div class="shelf-sub"><span id="shelf-count"></span><button class="btn btn-ghost btn-sm" data-action="bulk-search">全体一括で新刊を検索</button></div>
      <div id="shelf-box"></div>
      <div id="shelf-more"></div>`;
    updateFilterButton();
    updateShelfItems(false);
  }

  function updateFilterButton() {
    const btn = $('#filter-btn');
    if (btn) btn.querySelector('span').textContent = filterCount() ? `絞り込み（${filterCount()}）` : '絞り込み';
  }

  // keep が true なら、表示済みの件数を保つ（編集したあとにスクロール位置を崩さないため）
  function updateShelfItems(keep) {
    const box = $('#shelf-box');
    if (!box) return;
    const prev = state.shelfShown;
    state.entries = shelfEntries();
    state.shelfShown = 0;
    state.loading = false;
    $('#shelf-count').textContent = `${state.entries.length}件`;
    $('#shelf-more').innerHTML = '';
    if (!state.entries.length) {
      box.className = '';
      box.innerHTML = emptyHTML();
      return;
    }
    const grid = state.view.shelf === 'grid';
    box.className = grid ? 'grid' : 'list';
    box.innerHTML = grid ? '' : '<div class="list-head"><span>タイトル</span><span>著者</span><span>巻数</span><span>発売日</span><span>購入状況</span><span>評価</span><span>追跡</span><span>前回の確認日</span><span>候補</span></div>';
    appendShelf(keep ? Math.max(prev, perScreen() * 2) : perScreen() * 2);
    checkMore();
  }

  function emptyHTML() {
    const q = state.q.trim();
    if (q) {
      return `<div class="empty"><p>「${esc(q)}」に一致する本は本棚にありません</p>
        <a class="btn" href="https://www.google.com/search?q=${encodeURIComponent(q)}" target="_blank" rel="noopener">ブラウザで検索</a></div>`;
    }
    return '<div class="empty"><p>条件に合う本はありません</p></div>';
  }

  // 1画面に入る件数。グリッドは段単位で数える（要件定義書 4.6）
  function perScreen() {
    const box = $('#shelf-box');
    const vh = window.innerHeight;
    if (state.view.shelf === 'grid') {
      const cols = getComputedStyle(box).gridTemplateColumns.split(' ').filter(Boolean).length || 3;
      const tileH = (box.clientWidth / cols) * 1.5 + 48;
      return cols * Math.max(1, Math.round(vh / tileH));
    }
    return Math.max(1, Math.round(vh / (box.clientWidth >= 760 ? 50 : 66)));
  }

  function appendShelf(n) {
    const end = Math.min(state.entries.length, state.shelfShown + n);
    const html = state.entries.slice(state.shelfShown, end).map((e) => (state.view.shelf === 'grid' ? entryTile(e) : entryRow(e))).join('');
    $('#shelf-box').insertAdjacentHTML('beforeend', html);
    state.shelfShown = end;
  }

  // まだ見ていない分が画面1枚分を切ったら、次の2枚分を読み込む
  function checkMore() {
    if (state.screen !== 'shelf' || state.loading || state.shelfShown >= state.entries.length) return;
    const box = $('#shelf-box');
    if (!box) return;
    if (box.getBoundingClientRect().bottom - window.innerHeight < window.innerHeight) loadMore();
  }

  function loadMore() {
    state.loading = true;
    const entries = state.entries;
    $('#shelf-more').innerHTML = skeletonHTML();
    // 実際の通信の待ち時間に似せて、少し遅らせる
    setTimeout(() => {
      if (state.entries !== entries || !$('#shelf-more')) return; // 途中で条件が変わったら捨てる
      state.loading = false;
      $('#shelf-more').innerHTML = '';
      appendShelf(perScreen() * 2);
      checkMore();
    }, 300);
  }

  function skeletonHTML() {
    if (state.view.shelf === 'grid') {
      const cols = getComputedStyle($('#shelf-box')).gridTemplateColumns.split(' ').filter(Boolean).length || 3;
      return `<div class="grid" style="margin-top:16px">${'<div class="tile skel"><div class="cover"></div><span class="skel-bar" style="width:60%"></span></div>'.repeat(cols)}</div>`;
    }
    return `<div class="list" style="margin-top:8px">${'<div class="row skel"><span class="c-title"><span class="skel-bar" style="width:50%;height:14px"></span></span><span class="c-vol"><span class="skel-bar" style="width:40px"></span></span></div>'.repeat(2)}</div>`;
  }

  function entryTile(e) {
    if (e.kind === 'series') {
      return `<button class="tile" data-action="open-series" data-id="${e.s.id}" aria-label="${esc(e.s.name)}">
          <span class="tile-cover">${coverHTML(e.st.cover, 'md')}${e.matched != null ? `<span class="badge-count">${esc(matchLabel(e.matched))}</span>` : ''}</span>
          <span class="tile-meta"><span class="tile-vol">${volLabel(e.st)}</span><span>${fmtDate(e.date)}</span></span>
        </button>`;
    }
    return `<button class="tile" data-action="open-book" data-id="${e.b.id}" aria-label="${esc(e.b.title)}">
        <span class="tile-cover">${coverHTML(e.b, 'md')}</span>
        <span class="tile-meta"><span>${fmtDate(e.date)}</span></span>
      </button>`;
  }

  function entryRow(e) {
    if (e.kind === 'series') {
      const { s, st } = e;
      return `<button class="row" data-action="open-series" data-id="${s.id}">
          <span class="c-title">${esc(s.name)}${s.tracking ? `<span class="track-ico" title="追跡中">${svg(ICON.track, 14)}</span>` : ''}${
            e.matched != null ? `<span class="match">${esc(matchLabel(e.matched))}</span>` : ''}</span>
          <span class="c-author">${esc(s.author)}</span>
          <span class="c-vol">${volLabel(st)}</span>
          <span class="c-date">${fmtDate(e.date)}</span>
          <span class="c-purchase">${st.planned ? `<span class="st st-planned">予定${st.planned}冊</span>` : ''}</span>
          <span class="c-rating">${st.avg != null ? `★${st.avg.toFixed(1)}` : ''}</span>
          <span class="c-track">${s.tracking ? '追跡中' : 'オフ'}</span>
          <span class="c-checked">${s.lastChecked ? fmtDate(s.lastChecked) : '未確認'}</span>
          <span class="c-pending">${st.pending || ''}</span>
        </button>`;
    }
    const b = e.b;
    return `<button class="row" data-action="open-book" data-id="${b.id}">
        <span class="c-title">${esc(b.title)}</span>
        <span class="c-author">${esc(b.author)}</span>
        <span class="c-vol"></span>
        <span class="c-date">${fmtDate(b.salesDate)}</span>
        <span class="c-purchase">${purchaseHTML(b.purchase)}</span>
        <span class="c-rating">${b.rating != null ? `★${(b.rating / 2).toFixed(1)}` : ''}</span>
        <span class="c-track"></span><span class="c-checked"></span><span class="c-pending"></span>
      </button>`;
  }

  function refreshFilters() {
    const chips = $('#chips');
    if (chips) {
      const left = chips.scrollLeft;
      chips.innerHTML = chipsHTML(false);
      chips.scrollLeft = left;
    }
    const panel = $('#filter-panel');
    if (panel) panel.innerHTML = chipsHTML(true);
    updateFilterButton();
    updateShelfItems(false);
  }

  // ---------- 重ねるページ（シリーズページ・ブックページ） ----------
  // 案A：全画面、案B：PCは右のパネル・スマホはボトムシート
  const layerMode = () => (state.ui === 'a' ? 'full' : isPC() ? 'panel' : 'sheet');

  function openLayer(layer) {
    if (state.layers.length >= 2) return; // 重ねるのは2枚まで（要件定義書 4.7）
    state.layers.push(Object.assign({ carry: false, edit: false, draft: null }, layer));
    history.pushState({ depth: state.layers.length }, '');
    mountLayer(state.layers.length - 1);
    syncChrome();
  }

  // 本棚から開くとき。案BのPCでは一覧が見えたままなので、パネルの中身を差し替える
  function openFromShelf(layer) {
    if (layerMode() === 'panel' && state.layers.length) {
      if (state.layers.length > 1) history.back();
      Object.assign(state.layers[0], { carry: false, edit: false, draft: null }, layer);
      refreshLayer(0, false);
      return;
    }
    openLayer(layer);
  }

  function mountLayer(i) {
    const L = state.layers[i];
    const node = document.createElement('section');
    node.className = `layer layer-${layerMode()}`;
    node.dataset.depth = i;
    node.style.zIndex = 100 + i * 2;
    L.node = node;
    node.innerHTML = layerInner(L, i);
    $('#layers').appendChild(node);
    node.getBoundingClientRect(); // 位置を確定させてからアニメーションさせる
    node.classList.add('open');
  }

  function refreshLayer(i, keepScroll) {
    const L = state.layers[i];
    if (!L || !L.node) return;
    const body = L.node.querySelector('.layer-body');
    const top = body ? body.scrollTop : 0;
    L.node.innerHTML = layerInner(L, i);
    if (keepScroll !== false) L.node.querySelector('.layer-body').scrollTop = top;
  }

  function unmountTop() {
    const L = state.layers.pop();
    if (!L || !L.node) return;
    const node = L.node;
    node.classList.remove('open', 'full');
    setTimeout(() => node.remove(), 260);
  }

  // 戻るボタン・戻るジェスチャーで、一番上のページを閉じる
  window.addEventListener('popstate', () => {
    const depth = (history.state && history.state.depth) || 0;
    while (state.layers.length > depth) unmountTop();
    syncChrome();
  });
  const closeTop = () => { if (state.layers.length) history.back(); };
  const closeAll = () => { if (state.layers.length) history.go(-state.layers.length); };

  function syncChrome() {
    const mode = layerMode();
    const open = state.layers.length > 0;
    document.documentElement.classList.toggle('locked', open && mode !== 'panel');
    $('#app').classList.toggle('with-panel', open && mode === 'panel');
    // 幕は一番上のシートのすぐ下に置き、後ろのページ（シートを重ねたときは下のシート）を押せないようにする
    const backdrop = $('#sheet-backdrop');
    backdrop.classList.toggle('show', open && mode === 'sheet');
    backdrop.style.zIndex = open ? 100 + (state.layers.length - 1) * 2 - 1 : '';
    setTimeout(checkMore, 300); // パネルの開け閉めで一覧の幅が変わるため
  }

  // 案や画面幅が変わったときに、今の方式で作り直す
  function rebuildLayers() {
    state.layers.forEach((L) => L.node && L.node.remove());
    state.layers.forEach((L, i) => mountLayer(i));
    syncChrome();
  }

  function layerInner(L, i) {
    const mode = layerMode();
    const entity = L.type === 'series' ? seriesById(L.id) : bookById(L.id);
    const backIcon = mode === 'full' || i > 0 ? ICON.back : ICON.close;
    const title = !entity ? '' : L.edit ? (L.type === 'series' ? 'シリーズ情報の編集' : 'ブックページの編集') : L.type === 'series' ? entity.name : entity.title;
    const head = `${mode === 'sheet' ? '<div class="sheet-handle" data-drag></div>' : ''}
      <header class="layer-head"${mode === 'sheet' ? ' data-drag' : ''}>
        <button class="icon-btn" data-action="close-top" aria-label="閉じる">${svg(backIcon, 22)}</button>
        <h2>${esc(title)}</h2>
        ${entity && !L.edit ? `<button class="btn btn-sm" data-action="edit">${svg(ICON.edit, 14)}編集</button>` : ''}
      </header>`;
    if (!entity) return `${head}<div class="layer-body"><p class="none">削除しました</p></div>`;
    const body = L.type === 'series' ? (L.edit ? seriesEditHTML(L) : seriesHTML(L)) : L.edit ? bookEditHTML(L) : bookHTML(L);
    return `${head}<div class="layer-body">${body}</div>`;
  }

  // ---------- シリーズページ ----------
  function seriesHTML(L) {
    const s = seriesById(L.id);
    const st = seriesStats(s);
    const carry = L.carry && filterActive();
    const dir = state.volOrder === 'asc' ? 1 : -1;
    const books = (carry ? st.books.filter(bookMatches) : st.books)
      .slice()
      .sort((a, b) => dir * (a.salesDate.localeCompare(b.salesDate) || (a.volume ?? 0) - (b.volume ?? 0)));
    const cands = candidatesOf(s.id);
    const orderSeg = `<div class="seg seg-sm" role="group" aria-label="巻の並び">
        <button data-action="vol-order" data-v="desc" aria-pressed="${state.volOrder === 'desc'}">新しい順</button>
        <button data-action="vol-order" data-v="asc" aria-pressed="${state.volOrder === 'asc'}">古い順</button>
      </div>`;
    // 候補が多いと巻の一覧が遠くなるので、見出しを押して畳めるようにする
    const candsHead = cands.length
      ? `<button class="fold" data-action="toggle-cands" aria-expanded="${state.candsOpen}"><h3>新刊候補<span class="count">未判定 ${cands.length}件</span></h3>${svg(ICON.chevron, 18)}</button>`
      : '<h3>新刊候補<span class="count">未判定 0件</span></h3>';
    return `
      <dl class="info">
        <dt>著者</dt><dd>${esc(s.author)}</dd>
        <dt>巻数</dt><dd>${volLabel(st)} <span class="none">（所持している最新巻／刊行済みの最新巻）</span></dd>
        <dt>追う判型</dt><dd>${LABEL.format[s.format]}</dd>
        <dt>追跡</dt><dd>${s.tracking ? 'オン' : 'オフ'}</dd>
        <dt>前回の確認日</dt><dd>${s.lastChecked ? fmtDate(s.lastChecked) : '未確認'}</dd>
        ${st.avg != null ? `<dt>評価</dt><dd>${starsHTML(st.avg * 2)}<span class="rating-num">${st.avg.toFixed(1)}</span></dd>` : ''}
      </dl>
      <div class="page-actions">
        <button class="btn btn-primary" data-action="search-new">新刊を検索</button>
        <button class="btn" data-action="add-book" data-series="${s.id}">${svg(ICON.plus, 16)}本を登録</button>
      </div>
      <div class="section-head">${candsHead}</div>
      ${cands.length && state.candsOpen ? cands.map((c) => candHTML(c, s)).join('') : ''}
      <div class="section-head"><h3>登録している巻<span class="count">${books.length}冊</span></h3><div class="section-tools">${orderSeg}${viewSeg('series', true)}</div></div>
      ${carry ? `<div class="carry" style="margin:0 0 12px"><span>本棚の絞り込みを引き継いでいます（${books.length}/${st.books.length}冊）</span><button class="btn btn-ghost btn-sm" data-action="carry-off">解除</button></div>` : ''}
      ${volumesHTML(books)}`;
  }

  function volumesHTML(books) {
    if (!books.length) return '<p class="none">条件に合う巻はありません</p>';
    if (state.view.series === 'grid') {
      return `<div class="vgrid">${books.map((b) => {
        const owned = b.purchase === 'purchased';
        return `<button class="tile${owned ? '' : ' is-dim'}" data-action="open-book" data-id="${b.id}">
            <span class="tile-cover">${coverHTML(b, 'v')}${owned ? '' : '<span class="tag-unowned">未購入</span>'}</span>
            <span class="tile-meta"><span class="tile-vol">${volText(b)}</span></span>
          </button>`;
      }).join('')}</div>`;
    }
    return `<div class="list vlist">${books.map((b) =>
      `<button class="vrow" data-action="open-book" data-id="${b.id}"><span class="v-no">${volText(b)}</span><span class="v-date">${fmtDate(b.salesDate)}</span>${purchaseHTML(b.purchase)}</button>`,
    ).join('')}</div>`;
  }

  function candHTML(c, s) {
    // そのシリーズの直近の検索で初めて見つかったものに NEW を付ける（要件定義書 3.7.8）
    const isNew = c.foundAt === s.lastChecked;
    return `<div class="cand">${coverHTML(c, 'sm')}
        <div>
          <div class="cand-title">${esc(c.title)}${isNew ? '<span class="tag-new">NEW</span>' : ''}</div>
          <div class="cand-meta"><span>${esc(c.salesDateRaw)}</span><span class="label-cat${c.category === 'variant' ? ' label-variant' : ''}">${LABEL.category[c.category]}</span></div>
        </div>
        <div class="cand-btns">
          <button class="btn btn-sm" data-action="cand-dismiss" data-id="${c.id}">対象外</button>
          <button class="btn btn-sm btn-primary" data-action="cand-add" data-id="${c.id}">本棚に追加</button>
        </div>
      </div>`;
  }

  function seriesEditHTML(L) {
    const d = L.draft;
    return `<p class="edit-note">シリーズ情報を編集しています。［保存］を押すまで反映されません。</p>
      ${textField('表示名', 'name', d.name)}
      ${textField('読み仮名', 'kana', d.kana, '並べ替えに使います')}
      ${textField('検索キーワード', 'keyword', d.keyword, '新刊検索に使います')}
      ${textField('著者', 'author', d.author)}
      <div class="field"><span class="field-label">追う判型</span><div class="choice">${Object.entries(LABEL.format).map(([v, l]) => choiceBtn('format', v, l, d.format === v)).join('')}</div></div>
      <div class="field"><span class="field-label">追跡</span><div class="toggle-row">
        <button class="toggle" data-action="set-field" data-field="tracking" data-v="${!d.tracking}" aria-pressed="${d.tracking}" aria-label="追跡"></button><span>${d.tracking ? 'オン' : 'オフ'}</span>
      </div></div>
      <div class="form-btns"><button class="btn" data-action="cancel-edit">キャンセル</button><button class="btn btn-primary" data-action="save-series">保存</button></div>
      <div class="danger-zone"><button class="btn btn-danger" data-action="delete-series">シリーズを削除</button></div>`;
  }

  // ---------- ブックページ ----------
  function bookHTML(L) {
    const b = bookById(L.id);
    const s = b.seriesId ? seriesById(b.seriesId) : null;
    const purchased = b.purchase === 'purchased';
    const tagNames = b.tags.map(tagName).filter(Boolean);
    return `
      <div class="bp-top">${coverHTML(b, 'lg')}
        <dl class="info">
          <dt>著者</dt><dd>${esc(b.author)}</dd>
          <dt>出版社</dt><dd>${esc(b.publisher)}</dd>
          <dt>発売日</dt><dd>${esc(b.salesDateRaw)}</dd>
          <dt>判型</dt><dd>${LABEL.size[b.size] || 'その他'}</dd>
          <dt>ISBN</dt><dd>${esc(b.isbn || 'なし')}</dd>
          <dt>シリーズ</dt><dd>${s ? `${esc(s.name)}${b.volume != null ? `　${b.volume}巻` : ''}` : 'なし'}</dd>
        </dl>
      </div>
      <div class="section-head"><h3>ステータス</h3></div>
      <dl class="info">
        <dt>購入状況</dt><dd>${purchaseHTML(b.purchase)}</dd>
        <dt>読書状態</dt><dd>${purchased ? LABEL.read[b.read] : '<span class="none">未購入</span>'}</dd>
        ${purchased ? `<dt>媒体</dt><dd>${LABEL.media[b.media] || '–'}</dd><dt>購入場所</dt><dd>${esc(tagName(b.store) || '–')}</dd>` : ''}
        <dt>評価</dt><dd>${b.rating != null ? `${starsHTML(b.rating)}<span class="rating-num">${(b.rating / 2).toFixed(1)}</span>` : '<span class="none">未評価</span>'}</dd>
        <dt>タグ</dt><dd>${tagNames.length ? `<span class="tags">${tagNames.map((n) => `<span class="tagchip">${esc(n)}</span>`).join('')}</span>` : '<span class="none">なし</span>'}</dd>
        <dt>メモ</dt><dd>${b.memo ? esc(b.memo).replace(/\n/g, '<br>') : '<span class="none">なし</span>'}</dd>
      </dl>
      ${s ? `<div class="page-actions"><button class="btn" data-action="add-book" data-series="${s.id}" data-vol="${b.volume != null ? b.volume + 1 : ''}">${svg(ICON.plus, 16)}次の巻を登録</button></div>` : ''}`;
  }

  function bookEditHTML(L) {
    const d = L.draft;
    const purchased = d.purchase === 'purchased';
    const stores = D.tags.filter((t) => t.kind === 'store');
    const generals = D.tags.filter((t) => t.kind === 'general');
    const choices = (field, labels) => `<div class="choice">${Object.entries(labels).map(([v, l]) => choiceBtn(field, v, l, d[field] === v)).join('')}</div>`;
    return `<p class="edit-note">ブックページを編集しています。［保存］を押すまで反映されません。</p>
      <div class="field"><span class="field-label">シリーズ</span>
        <select class="select" data-field="seriesId"><option value="">なし</option>${D.series.map((s) => `<option value="${s.id}"${d.seriesId === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      </div>
      <label class="field"><span class="field-label">巻数</span><input class="input" type="number" min="0" step="1" inputmode="numeric" data-field="volume" value="${d.volume ?? ''}" style="max-width:120px"></label>
      <div class="field"><span class="field-label">購入状況</span>${choices('purchase', LABEL.purchase)}</div>
      ${purchased ? `
        <div class="field"><span class="field-label">読書状態</span>${choices('read', LABEL.read)}</div>
        <div class="field"><span class="field-label">媒体</span>${choices('media', LABEL.media)}</div>
        <div class="field"><span class="field-label">購入場所</span>
          <select class="select" data-field="store"><option value="">選んでください</option>${stores.map((t) => `<option value="${t.id}"${d.store === t.id ? ' selected' : ''}>${esc(t.name)}</option>`).join('')}</select>
        </div>` : '<p class="none" style="margin:-6px 0 16px;font-size:13px">読書状態・媒体・購入場所は、購入済みのときだけ選べます</p>'}
      <div class="field"><span class="field-label">評価</span><div class="toggle-row">${starsInputHTML(d.rating)}
        <span class="rating-num">${d.rating != null ? (d.rating / 2).toFixed(1) : '未評価'}</span>
        ${d.rating != null ? '<button class="btn btn-ghost btn-sm" data-action="set-field" data-field="rating" data-v="null">消す</button>' : ''}
      </div></div>
      <div class="field"><span class="field-label">タグ</span><div class="choice">${generals.map((t) => `<button class="chip" data-action="toggle-tag" data-id="${t.id}" aria-pressed="${d.tags.includes(t.id)}">${esc(t.name)}</button>`).join('')}</div></div>
      <label class="field"><span class="field-label">メモ</span><textarea class="textarea" data-field="memo">${esc(d.memo)}</textarea></label>
      <div class="form-btns"><button class="btn" data-action="cancel-edit">キャンセル</button><button class="btn btn-primary" data-action="save-book">保存</button></div>
      <div class="danger-zone"><button class="btn btn-danger" data-action="delete-book">この本を削除</button></div>`;
  }

  // 購入済みに切り替えたら、同じシリーズで最後に購入した本の媒体と購入場所を入れる（要件定義書 3.2）
  function onPurchaseChange(L) {
    const d = L.draft;
    if (d.purchase !== 'purchased') return;
    if (!d.read) d.read = 'tsundoku';
    if (!d.media || !d.store) {
      const last = D.books
        .filter((b) => d.seriesId && b.seriesId === d.seriesId && b.id !== d.id && b.purchase === 'purchased')
        .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))[0];
      d.media = d.media || (last ? last.media : 'paper');
      d.store = d.store || (last ? last.store : null);
    }
  }

  // データを変えたあとに、開いているページと本棚を作り直す
  function afterDataChange() {
    state.layers.forEach((L, i) => {
      const exists = L.type === 'series' ? seriesById(L.id) : bookById(L.id);
      if (exists) refreshLayer(i);
    });
    renderSidebar();
    if (state.screen === 'shelf') updateShelfItems(true);
  }

  // ---------- ダイアログ・トースト ----------
  function openDialog(html, onClose) {
    const d = $('#dialog');
    d.innerHTML = `<div class="dialog-box">${html}</div>`;
    d.classList.add('open');
    state.dialogClose = onClose || null;
  }
  function closeDialog(value) {
    const d = $('#dialog');
    d.classList.remove('open');
    d.innerHTML = '';
    const cb = state.dialogClose;
    state.dialogClose = null;
    if (cb) cb(value);
  }
  // message は HTML として入れるので、呼び出し側でエスケープする
  function ask(title, message, buttons) {
    return new Promise((resolve) => {
      openDialog(`<h3>${esc(title)}</h3>${message ? `<p>${message}</p>` : ''}
        <div class="dialog-btns">${buttons.map((b) => `<button class="btn ${b.kind || ''}" data-action="dialog" data-v="${b.value}">${esc(b.label)}</button>`).join('')}</div>`, resolve);
    });
  }
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
  }

  // ---------- 操作 ----------
  const actions = {
    drawer() { $('#app').classList.toggle('drawer-open'); },
    'drawer-close'() { $('#app').classList.remove('drawer-open'); },

    nav(el) {
      closeAll();
      state.screen = el.dataset.screen;
      $('#app').classList.remove('drawer-open');
      renderSidebar();
      renderTopbar();
      renderScreen();
      window.scrollTo(0, 0);
    },

    logout() {
      try { sessionStorage.removeItem('mock.login'); } catch (e) { /* 何もしない */ }
      location.href = 'index.html';
    },

    ui(el) {
      state.ui = el.dataset.v;
      pref.set('mock.ui', state.ui);
      renderTopbar();
      if (state.screen === 'shelf') renderShelf();
      rebuildLayers();
      toast(state.ui === 'a' ? 'UI案A：ページを全画面で重ねます' : 'UI案B：PCは右のパネル、スマホはボトムシートで開きます');
    },

    view(el) {
      const { screen, v } = el.dataset;
      state.view[screen] = v;
      pref.set(`mock.view.${screen}`, v);
      document.querySelectorAll(`[data-action="view"][data-screen="${screen}"]`).forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === v));
      if (screen === 'shelf') updateShelfItems(false);
      else state.layers.forEach((L, i) => { if (L.type === 'series' && !L.edit) refreshLayer(i); });
    },

    chip(el) {
      const { group, v } = el.dataset;
      const f = state.filters;
      if (group === 'tracking') f.tracking = !f.tracking;
      else if (f[group].has(v)) f[group].delete(v);
      else f[group].add(v);
      refreshFilters();
    },
    'chip-clear'() {
      const f = state.filters;
      [f.read, f.purchase, f.media, f.tags].forEach((s) => s.clear());
      f.tracking = false;
      refreshFilters();
    },
    'tag-mode'() {
      state.filters.tagMode = state.filters.tagMode === 'and' ? 'or' : 'and';
      refreshFilters();
    },
    'open-filter'() {
      openDialog(`<h3>絞り込み</h3><div id="filter-panel" style="margin-top:12px">${chipsHTML(true)}</div>
        <div class="dialog-btns"><button class="btn btn-primary" data-action="dialog">閉じる</button></div>`);
    },

    dialog(el) { closeDialog(el.dataset.v); },

    async 'bulk-search'() {
      const targets = D.series.filter((s) => s.tracking);
      const ok = await ask('全体一括で新刊を検索', `追跡中の ${targets.length} シリーズを順番に検索します。シリーズの数だけ時間がかかります。`, [
        { label: '検索する', value: 'ok', kind: 'btn-primary' },
        { label: 'キャンセル', value: '' },
      ]);
      if (ok !== 'ok') return;
      let done = 0;
      let cancelled = false;
      openDialog(`<h3>新刊を検索しています</h3><p id="bulk-text">0/${targets.length}件</p><div class="progress"><span id="bulk-bar"></span></div>
        <div class="dialog-btns"><button class="btn" data-action="dialog" data-v="cancel">中止</button></div>`, () => { cancelled = true; });
      const step = () => {
        if (cancelled) {
          toast('中止しました。本来はここで新刊候補の画面を開きます（モックの対象外）');
          return;
        }
        done++;
        $('#bulk-text').textContent = `${done}/${targets.length}件`;
        $('#bulk-bar').style.width = `${(done / targets.length) * 100}%`;
        if (done < targets.length) {
          setTimeout(step, 90);
        } else {
          state.dialogClose = null;
          closeDialog();
          toast('検索が終わりました。本来はここで新刊候補の画面を開きます（モックの対象外）');
        }
      };
      setTimeout(step, 90);
    },

    'open-series'(el) { openFromShelf({ type: 'series', id: el.dataset.id, carry: filterActive() }); },
    'open-book'(el) {
      if (el.closest('.layer')) openLayer({ type: 'book', id: el.dataset.id });
      else openFromShelf({ type: 'book', id: el.dataset.id });
    },
    'close-top'() { closeTop(); },

    'vol-order'(el) {
      state.volOrder = el.dataset.v;
      pref.set('mock.vol.order', state.volOrder);
      state.layers.forEach((L, i) => { if (L.type === 'series' && !L.edit) refreshLayer(i); });
    },
    'toggle-cands'(el) {
      state.candsOpen = !state.candsOpen;
      pref.set('mock.cands.open', state.candsOpen ? '1' : '0');
      refreshLayer(depthOf(el));
    },

    'carry-off'(el) {
      const i = depthOf(el);
      state.layers[i].carry = false;
      refreshLayer(i);
    },

    'search-new'() { toast('新刊を検索しました（モックでは結果は変わりません）'); },

    'add-book'(el) {
      const s = seriesById(el.dataset.series);
      const vol = el.dataset.vol;
      toast(`本の登録画面を開きます（初期値：${s.name}${vol ? `、${vol}巻` : ''}）。本の登録はモックの対象外です`);
    },

    'cand-add'(el) {
      const c = D.candidates.find((x) => x.id === el.dataset.id);
      if (!c) return;
      c.state = 'added';
      D.books.push({
        id: `b-${c.id}`, title: c.title, author: c.author, publisher: c.publisher, size: c.size, color: c.color,
        salesDate: c.salesDate, salesDateRaw: c.salesDateRaw, isbn: c.isbn, seriesId: c.seriesId, volume: c.volume, source: c.source,
        purchase: 'planned', read: null, media: null, store: null, rating: null, memo: '', tags: [],
      });
      afterDataChange();
      toast('本棚に追加しました（購入状況：購入予定）');
    },

    async 'cand-dismiss'(el) {
      const c = D.candidates.find((x) => x.id === el.dataset.id);
      if (!c) return;
      const ans = await ask('対象外にします', `「${esc(c.title)}」を対象外にして、以後は表示しません。理由を選べます（任意）。`, [
        { label: '理由なしで対象外にする', value: 'none', kind: 'btn-primary' },
        { label: 'コミカライズ', value: 'comicalize' },
        { label: '別作品', value: 'other' },
        { label: '別版', value: 'variant' },
        { label: 'キャンセル', value: '' },
      ]);
      if (!ans) return;
      c.state = 'dismissed';
      c.dismissReason = ans === 'none' ? null : ans;
      afterDataChange();
      toast('対象外にしました（設定の「対象外一覧」で確認できます）');
    },

    edit(el) {
      const i = depthOf(el);
      const L = state.layers[i];
      const src = L.type === 'series' ? seriesById(L.id) : bookById(L.id);
      L.draft = JSON.parse(JSON.stringify(src));
      L.edit = true;
      refreshLayer(i, false);
    },
    'cancel-edit'(el) {
      const i = depthOf(el);
      state.layers[i].edit = false;
      refreshLayer(i, false);
    },

    'set-field'(el) {
      const i = depthOf(el);
      const L = state.layers[i];
      const field = el.dataset.field;
      let v = el.dataset.v;
      if (v === 'true') v = true;
      else if (v === 'false') v = false;
      else if (v === 'null') v = null;
      else if (field === 'rating') v = Number(v);
      L.draft[field] = v;
      if (field === 'purchase') onPurchaseChange(L);
      refreshLayer(i);
    },
    'toggle-tag'(el) {
      const i = depthOf(el);
      const d = state.layers[i].draft;
      const id = el.dataset.id;
      d.tags = d.tags.includes(id) ? d.tags.filter((t) => t !== id) : d.tags.concat(id);
      refreshLayer(i);
    },

    'save-series'(el) {
      const i = depthOf(el);
      const L = state.layers[i];
      const d = L.draft;
      if (!String(d.name).trim()) { toast('表示名を入れてください'); return; }
      Object.assign(seriesById(L.id), { name: d.name.trim(), kana: d.kana, keyword: d.keyword, author: d.author, format: d.format, tracking: d.tracking });
      L.edit = false;
      afterDataChange();
      toast('シリーズ情報を保存しました');
    },
    'save-book'(el) {
      const i = depthOf(el);
      const L = state.layers[i];
      const d = L.draft;
      if (d.purchase === 'purchased' && !d.store) { toast('購入場所を選んでください'); return; }
      const purchased = d.purchase === 'purchased';
      Object.assign(bookById(L.id), {
        seriesId: d.seriesId || null,
        volume: d.volume === '' || d.volume == null ? null : Number(d.volume),
        purchase: d.purchase,
        read: purchased ? d.read : null,
        media: purchased ? d.media : null,
        store: purchased ? d.store : null,
        rating: d.rating,
        tags: d.tags,
        memo: d.memo,
      });
      L.edit = false;
      afterDataChange();
      toast('保存しました');
    },

    async 'delete-series'(el) {
      const s = seriesById(state.layers[depthOf(el)].id);
      const n = booksOf(s.id).length;
      const ans = await ask(`「${s.name}」を削除します`, `登録した本（${n}冊）も削除しますか？`, [
        { label: 'はい（本も削除する）', value: 'all', kind: 'btn-danger' },
        { label: 'いいえ（本は「シリーズなし」に戻す）', value: 'keep' },
        { label: 'キャンセル', value: '' },
      ]);
      if (!ans) return;
      if (ans === 'all') {
        D.books = D.books.filter((b) => b.seriesId !== s.id);
      } else {
        D.books.forEach((b) => {
          if (b.seriesId === s.id) Object.assign(b, { seriesId: null, kana: b.kana || s.kana });
        });
      }
      D.candidates = D.candidates.filter((c) => c.seriesId !== s.id);
      D.series = D.series.filter((x) => x.id !== s.id);
      closeAll();
      afterDataChange();
      toast(ans === 'all' ? 'シリーズと本を削除しました' : 'シリーズを削除し、本は「シリーズなし」に戻しました');
    },
    async 'delete-book'(el) {
      const b = bookById(state.layers[depthOf(el)].id);
      const ans = await ask('この本を削除します', `「${esc(b.title)}」を本棚から削除します。新刊検索で、また候補に出るようになります。`, [
        { label: '削除する', value: 'ok', kind: 'btn-danger' },
        { label: 'キャンセル', value: '' },
      ]);
      if (ans !== 'ok') return;
      D.books = D.books.filter((x) => x.id !== b.id);
      D.candidates = D.candidates.filter((c) => c.isbn !== b.isbn);
      closeTop();
      afterDataChange();
      toast('削除しました');
    },
  };

  // ---------- イベント ----------
  document.addEventListener('click', (e) => {
    if (e.target.id === 'dialog') { closeDialog(null); return; } // ダイアログの外を押したら閉じる
    const el = e.target.closest('[data-action]');
    if (!el || !actions[el.dataset.action]) return;
    e.preventDefault();
    actions[el.dataset.action](el, e);
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'q') {
      state.q = t.value;
      clearTimeout(state.qTimer);
      state.qTimer = setTimeout(() => updateShelfItems(false), 150);
      return;
    }
    if (t.dataset.field) {
      const L = state.layers[depthOf(t)];
      if (L && L.draft) L.draft[t.dataset.field] = t.dataset.field === 'seriesId' ? t.value || null : t.value;
    }
  });

  document.addEventListener('change', (e) => {
    if (e.target.id === 'sort') {
      state.sort = e.target.value;
      updateShelfItems(false);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if ($('#dialog').classList.contains('open')) closeDialog(null);
    else if ($('#app').classList.contains('drawer-open')) $('#app').classList.remove('drawer-open');
    else closeTop();
  });

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { ticking = false; checkMore(); });
  }, { passive: true });

  let lastPC = isPC();
  window.addEventListener('resize', debounce(() => {
    const pc = isPC();
    if (pc !== lastPC) {
      lastPC = pc;
      $('#app').classList.remove('drawer-open');
      if (state.layers.length && state.ui === 'b') rebuildLayers();
      else syncChrome();
    }
    checkMore();
  }, 150));

  // ボトムシート：つまんで下に引くと閉じる、上に引くと全画面
  let drag = null;
  document.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || e.target.closest('button')) return;
    const node = handle.closest('.layer-sheet');
    if (!node) return;
    drag = { node, y: e.clientY, dy: 0 };
    node.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  });
  document.addEventListener('pointermove', (e) => {
    if (!drag) return;
    drag.dy = e.clientY - drag.y;
    drag.node.style.transform = `translateY(${Math.max(0, drag.dy)}px)`;
  });
  const endDrag = () => {
    if (!drag) return;
    const { node, dy } = drag;
    drag = null;
    node.classList.remove('dragging');
    node.style.transform = '';
    const full = node.classList.contains('full');
    if (full ? dy > 220 : dy > 90) closeTop();
    else if (full && dy > 40) node.classList.remove('full');
    else if (!full && dy < -40) node.classList.add('full');
  };
  document.addEventListener('pointerup', endDrag);
  document.addEventListener('pointercancel', endDrag);

  // ---------- 開始 ----------
  history.replaceState({ depth: 0 }, '');
  renderSidebar();
  renderTopbar();
  renderScreen();
})();
