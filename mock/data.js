// モック用のダミーデータ。
// 作品名は実在のものを使っているが、巻数・発売日・ISBN・ステータスはすべてダミー。
// HTML をダブルクリックで開いても読み込めるように、JSON ではなく JS で書いている。
(function () {
  'use strict';

  const TODAY = '2026-10-29';

  const tags = [
    { id: 't1', name: '店頭', kind: 'store' },
    { id: 't2', name: 'Kindle', kind: 'store' },
    { id: 't3', name: '楽天', kind: 'store' },
    { id: 't4', name: 'Google', kind: 'store' },
    { id: 'g1', name: 'お気に入り', kind: 'general' },
    { id: 'g2', name: 'アニメ化', kind: 'general' },
    { id: 'g3', name: '読み返したい', kind: 'general' },
    { id: 'g4', name: '貸し出し中', kind: 'general' },
  ];

  // 表紙のダミーの色
  const COLORS = [
    '#3b5b92', '#8c3b3b', '#2f6b4f', '#6b4f8c', '#a0622d', '#2d6f80',
    '#6f6f22', '#803060', '#4a4a4a', '#b0473a', '#356a9c', '#5d7d3a',
  ];

  // id, 表示名, 読み仮名, 著者, 出版社, 追う判型, size, 購入済みの冊数, 購入予定の冊数,
  // 刊行済みの最新巻, 発売予定の冊数, 刊行済みの最新巻の発売日, 刊行の間隔（月）, その他
  const seriesSpecs = [
    ['s01', '葬送のフリーレン', 'そうそうのふりーれん', '山田鐘人／アベツカサ', '小学館', 'comic', 9, 13, 1, 14, 1, '2026-09-18', 4, { tags: ['g1', 'g2'], rating: 9, variant: true }],
    ['s02', '【推しの子】', 'おしのこ', '赤坂アカ／横槍メンゴ', '集英社', 'comic', 9, 16, 0, 16, 0, '2024-12-18', 3, { tracking: false, rating: 8, lastRead: 'finished', tags: ['g2'] }],
    ['s03', 'SPY×FAMILY', 'すぱいふぁみりー', '遠藤達哉', '集英社', 'comic', 9, 14, 0, 15, 1, '2026-07-04', 5, { media: 'ebook', store: 't2', rating: 8 }],
    ['s04', 'ダンジョン飯', 'だんじょんめし', '九井諒子', 'KADOKAWA', 'comic', 9, 14, 0, 14, 0, '2023-12-15', 7, { tracking: false, rating: 10, lastRead: 'finished', tags: ['g1', 'g3'] }],
    ['s05', 'チェンソーマン', 'ちぇんそーまん', '藤本タツキ', '集英社', 'comic', 9, 20, 1, 22, 1, '2026-10-03', 3, { media: 'ebook', store: 't2', rating: 7, lastRead: 'tsundoku' }],
    ['s06', 'ONE PIECE', 'わんぴーす', '尾田栄一郎', '集英社', 'comic', 9, 110, 0, 112, 0, '2026-08-04', 4, { rating: 8 }],
    ['s07', '呪術廻戦', 'じゅじゅつかいせん', '芥見下々', '集英社', 'comic', 9, 30, 0, 30, 0, '2025-12-25', 3, { tracking: false, rating: 7, lastRead: 'finished' }],
    ['s08', '古見さんは、コミュ症です。', 'こみさんはこみゅしょうです', 'オダトモヒト', '小学館', 'comic', 9, 30, 2, 33, 0, '2026-06-18', 3, { media: 'ebook', store: 't3', rating: 6, lastRead: 'tsundoku' }],
    ['s09', '黄泉のツガイ', 'よみのつがい', '荒川弘', 'スクウェア・エニックス', 'comic', 9, 10, 0, 11, 1, '2026-08-12', 5, { rating: 9 }],
    ['s10', 'ブルーロック', 'ぶるーろっく', '金城宗幸／ノ村優介', '講談社', 'comic', 9, 32, 0, 34, 1, '2026-10-16', 3, { media: 'ebook', store: 't2', rating: 7 }],
    ['s11', 'Dr.STONE', 'どくたーすとーん', '稲垣理一郎／Boichi', '集英社', 'comic', 9, 26, 0, 26, 0, '2022-07-04', 3, { tracking: false, rating: 8, lastRead: 'finished' }],
    ['s12', 'ハイキュー!!', 'はいきゅー', '古舘春一', '集英社', 'comic', 9, 45, 0, 45, 0, '2020-11-04', 3, { tracking: false, rating: 9, lastRead: 'finished', tags: ['g1'] }],
    ['s13', '怪獣8号', 'かいじゅうはちごう', '松本直也', '集英社', 'comic', 9, 15, 0, 16, 0, '2026-04-03', 4, { rating: 7, checked: null }],
    ['s14', '宇宙兄弟', 'うちゅうきょうだい', '小山宙哉', '講談社', 'comic', 9, 44, 0, 45, 0, '2025-11-21', 7, {}],
    ['s15', '天幕のジャードゥーガル', 'てんまくのじゃーどぅーがる', 'トマトスープ', '秋田書店', 'comic', 9, 5, 0, 6, 1, '2026-07-16', 6, { rating: 9, tags: ['g3'] }],
    ['s16', 'ゴールデンカムイ', 'ごーるでんかむい', '野田サトル', '集英社', 'comic', 9, 31, 0, 31, 0, '2022-07-19', 3, { tracking: false, rating: 9, lastRead: 'finished', tags: ['g4'] }],
    ['s17', 'キングダム', 'きんぐだむ', '原泰久', '集英社', 'comic', 9, 72, 3, 76, 1, '2026-10-17', 3, { rating: 8, lastRead: 'tsundoku' }],
    ['s18', 'メダリスト', 'めだりすと', 'つるまいかだ', '講談社', 'comic', 9, 13, 0, 14, 1, '2026-09-22', 4, { media: 'ebook', store: 't4', rating: 10, tags: ['g1', 'g2'] }],
    ['s19', 'ダンダダン', 'だんだだん', '龍幸伸', '集英社', 'comic', 9, 20, 0, 21, 1, '2026-09-04', 3, { media: 'ebook', store: 't2', rating: 8 }],
    ['s20', 'ちいかわ なんか小さくてかわいいやつ', 'ちいかわ', 'ナガノ', '講談社', 'comic', 9, 7, 0, 8, 0, '2026-05-23', 8, { checked: null, rating: 9 }],
    ['s21', 'BLUE GIANT', 'ぶるーじゃいあんと', '石塚真一', '小学館', 'comic', 9, 10, 0, 10, 0, '2017-08-30', 5, { tracking: false, rating: 9, lastRead: 'finished' }],
    ['s22', '違国日記', 'いこくにっき', 'ヤマシタトモコ', '祥伝社', 'comic', 9, 11, 0, 11, 0, '2023-06-08', 7, { tracking: false, rating: 10, lastRead: 'finished', tags: ['g1', 'g3'] }],
    ['s23', '86―エイティシックス―', 'えいてぃしっくす', '安里アサト', 'KADOKAWA', 'bunko', 2, 13, 0, 14, 1, '2026-08-08', 7, { rating: 9, keyword: '86' }],
    ['s24', 'ようこそ実力至上主義の教室へ', 'ようこそじつりょくしじょうしゅぎのきょうしつへ', '衣笠彰梧', 'KADOKAWA', 'bunko', 2, 11, 1, 13, 1, '2026-09-25', 4, { media: 'ebook', store: 't2', rating: 7, lastRead: 'tsundoku' }],
    ['s25', '魔法科高校の劣等生', 'まほうかこうこうのれっとうせい', '佐島勤', 'KADOKAWA', 'bunko', 2, 32, 0, 32, 0, '2020-09-10', 4, { tracking: false, rating: 6, lastRead: 'finished' }],
    ['s26', '薬屋のひとりごと', 'くすりやのひとりごと', '日向夏', '主婦の友社', 'bunko', 2, 15, 0, 16, 0, '2026-08-29', 6, { rating: 9, tags: ['g2'] }],
    ['s27', '本好きの下剋上', 'ほんずきのげこくじょう', '香月美夜', 'TOブックス', 'tankobon', 1, 33, 0, 33, 1, '2026-04-10', 4, { rating: 10, tags: ['g1'] }],
    ['s28', '転生したらスライムだった件', 'てんせいしたらすらいむだったけん', '伏瀬', 'マイクロマガジン社', 'tankobon', 1, 21, 0, 22, 0, '2026-03-30', 7, { checked: null, media: 'ebook', store: 't2', rating: 7 }],
    ['s29', 'Re:ゼロから始める異世界生活', 'りぜろからはじめるいせかいせいかつ', '長月達平', 'KADOKAWA', 'bunko', 2, 40, 1, 41, 1, '2026-09-25', 4, { media: 'ebook', store: 't2', rating: 8, lastRead: 'tsundoku' }],
    ['s30', 'ソードアート・オンライン', 'そーどあーとおんらいん', '川原礫', 'KADOKAWA', 'bunko', 2, 28, 0, 28, 0, '2024-10-10', 6, { tracking: false, rating: 7, lastRead: 'finished' }],
    ['s31', '十二国記', 'じゅうにこくき', '小野不由美', '新潮社', 'bunko', 2, 15, 0, 15, 0, '2019-11-09', 6, { tracking: false, rating: 10, lastRead: 'finished', tags: ['g1', 'g3'] }],
    ['s32', '三体', 'さんたい', '劉慈欣', '早川書房', 'tankobon', 1, 5, 0, 5, 0, '2022-05-24', 6, { tracking: false, rating: 9, lastRead: 'finished' }],
    ['s33', '鬼人幻燈抄', 'きじんげんとうしょう', '中西モトオ', '双葉社', 'bunko', 2, 9, 0, 10, 0, '2026-02-12', 3, { rating: 8, lastRead: 'tsundoku' }],
    ['s34', 'ビブリア古書堂の事件手帖', 'びぶりあこしょどうのじけんてちょう', '三上延', 'KADOKAWA', 'bunko', 2, 10, 0, 11, 1, '2026-07-25', 12, { rating: 7 }],
    ['s35', '百鬼夜行シリーズ', 'ひゃっきやこうしりーず', '京極夏彦', '講談社', 'shinsho', 3, 10, 0, 10, 0, '2023-09-14', 18, { rating: 9, lastRead: 'finished' }],
  ];

  // シリーズに入っていない本
  const standaloneSpecs = [
    { id: 'x01', title: '成瀬は天下を取りにいく', kana: 'なるせはてんかをとりにいく', author: '宮島未奈', publisher: '新潮社', size: 1, date: '2023-03-17', purchase: 'purchased', read: 'finished', media: 'paper', store: 't1', rating: 9, tags: ['g1'] },
    { id: 'x02', title: '汝、星のごとく', kana: 'なんじほしのごとく', author: '凪良ゆう', publisher: '講談社', size: 1, date: '2022-08-04', purchase: 'purchased', read: 'finished', media: 'paper', store: 't1', rating: 8, tags: [] },
    { id: 'x03', title: '同志少女よ、敵を撃て', kana: 'どうししょうじょよてきをうて', author: '逢坂冬馬', publisher: '早川書房', size: 1, date: '2021-11-17', purchase: 'purchased', read: 'tsundoku', media: 'paper', store: 't1', rating: null, tags: [] },
    { id: 'x04', title: '正欲', kana: 'せいよく', author: '朝井リョウ', publisher: '新潮社', size: 2, date: '2023-05-29', purchase: 'purchased', read: 'finished', media: 'ebook', store: 't2', rating: 7, tags: [] },
    { id: 'x05', title: 'ルックバック', kana: 'るっくばっく', author: '藤本タツキ', publisher: '集英社', size: 9, date: '2021-09-03', purchase: 'purchased', read: 'finished', media: 'ebook', store: 't2', rating: 10, tags: ['g1'] },
    { id: 'x06', title: 'かがみの孤城', kana: 'かがみのこじょう', author: '辻村深月', publisher: 'ポプラ社', size: 1, date: '2017-05-11', purchase: 'purchased', read: 'finished', media: 'paper', store: 't1', rating: 9, tags: [] },
    { id: 'x07', title: 'コンビニ人間', kana: 'こんびににんげん', author: '村田沙耶香', publisher: '文藝春秋', size: 2, date: '2018-09-04', purchase: 'planned', read: null, media: null, store: null, rating: null, tags: [] },
    { id: 'x08', title: '博士の愛した数式', kana: 'はかせのあいしたすうしき', author: '小川洋子', publisher: '新潮社', size: 2, date: '2005-11-26', purchase: 'purchased', read: 'finished', media: 'paper', store: 't3', rating: 8, tags: ['g3'] },
    { id: 'x09', title: '52ヘルツのクジラたち', kana: 'ごじゅうにへるつのくじらたち', author: '町田そのこ', publisher: '中央公論新社', size: 1, date: '2020-04-21', purchase: 'skip', read: null, media: null, store: null, rating: null, tags: [] },
    { id: 'x10', title: 'FACTFULNESS', kana: 'ふぁくとふるねす', author: 'ハンス・ロスリング', publisher: '日経BP', size: 1, date: '2019-01-11', purchase: 'purchased', read: 'reading', media: 'ebook', store: 't2', rating: null, tags: [] },
  ];

  function iso(d) {
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function addMonths(dateStr, m) {
    const d = new Date(dateStr + 'T00:00:00');
    d.setMonth(d.getMonth() + m);
    return iso(d);
  }
  // 楽天の salesDate に似せた表示用の文字列。発売前のものは「中旬頃」のような形にする
  function rawDate(date, fuzzy) {
    const [y, m, d] = date.split('-').map(Number);
    const mm = String(m).padStart(2, '0');
    if (fuzzy) return `${y}年${mm}月${d <= 10 ? '上旬' : d <= 20 ? '中旬' : '下旬'}頃`;
    return `${y}年${mm}月${String(d).padStart(2, '0')}日`;
  }
  let isbnSeq = 1000;
  const isbn = () => '978400000' + String(++isbnSeq).padStart(4, '0');
  const clampRating = (r) => Math.max(1, Math.min(10, r));

  const series = [];
  const books = [];
  const candidates = [];

  seriesSpecs.forEach((spec, i) => {
    const [id, name, kana, author, publisher, format, size, purchased, planned, published, future, last, interval, o] = spec;
    const color = COLORS[i % COLORS.length];
    const checked = o.checked === undefined ? '2026-10-20' : o.checked;
    series.push({
      id, name, kana, author, format, color,
      keyword: o.keyword || name,
      tracking: o.tracking !== false,
      lastChecked: checked,
    });

    for (let v = 1; v <= published + future; v++) {
      const date = addMonths(last, (v - published) * interval);
      const isFuture = date > TODAY;
      const base = {
        title: `${name}（${v}）`, author, publisher, size, color,
        salesDate: date, salesDateRaw: rawDate(date, isFuture), isbn: isbn(),
        seriesId: id, volume: v, source: 'rakuten',
      };
      if (v <= purchased) {
        const read = v === purchased ? (o.lastRead || 'reading') : 'finished';
        books.push(Object.assign(base, {
          id: `b-${id}-${v}`, purchase: 'purchased', read,
          media: o.media || 'paper', store: o.store || 't1',
          rating: read === 'finished' && o.rating ? clampRating(o.rating + ((v % 3) - 1)) : null,
          memo: '', tags: o.tags ? o.tags.slice() : [],
        }));
      } else if (v <= purchased + planned) {
        books.push(Object.assign(base, {
          id: `b-${id}-${v}`, purchase: 'planned', read: null, media: null, store: null,
          rating: null, memo: '', tags: [],
        }));
      } else if (checked) {
        // 発売前のものは直近の検索で見つかった（NEW）、刊行済みのものはそれより前に見つかった扱い
        candidates.push(Object.assign(base, {
          id: `c-${id}-${v}`, category: 'new', state: 'new',
          foundAt: isFuture ? checked : addMonths(checked, -1),
        }));
      }
    }

    if (o.variant) {
      const date = addMonths(last, 0);
      candidates.push({
        id: `c-${id}-${published}-sp`, title: `${name}（${published}）特装版`, author, publisher, size, color,
        salesDate: date, salesDateRaw: rawDate(date, false), isbn: isbn(),
        seriesId: id, volume: published, source: 'rakuten',
        category: 'variant', state: 'new', foundAt: checked,
      });
    }
  });

  standaloneSpecs.forEach((s, i) => {
    books.push({
      id: s.id, title: s.title, kana: s.kana, author: s.author, publisher: s.publisher, size: s.size,
      color: COLORS[(i * 5 + 3) % COLORS.length],
      salesDate: s.date, salesDateRaw: rawDate(s.date, false), isbn: isbn(),
      seriesId: null, volume: null, source: 'rakuten',
      purchase: s.purchase, read: s.read, media: s.media, store: s.store,
      rating: s.rating, memo: '', tags: s.tags.slice(),
    });
  });

  window.MOCK_DATA = { today: TODAY, tags, series, books, candidates };
})();
