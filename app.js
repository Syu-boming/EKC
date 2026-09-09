/* ===========================================================
   115年臺南市環境知識競賽 — 賽前練習題庫
   臺南市安平區新南國小 衛生組
   純靜態網頁，資料放在 data/*.json，可直接掛 GitHub Pages
   =========================================================== */
(function () {
'use strict';

/* ---------- 常數 ---------- */
var EXAM_DATE = new Date(2026, 8, 19, 10, 0, 0);   // 2026-09-19 10:00 菁英賽開始
var EXAM_N = 80;          // 正式比賽題數
var EXAM_MIN = 30;        // 正式比賽分鐘數
var LS = 'ekc.v1';
var KEYS = ['A', 'B', 'C', 'D'];

/* ---------- 全域狀態 ---------- */
var G = { data: null, explain: null, notes: null, notesLoaded: false, errata: null, sess: null, tick: null };
var app = document.getElementById('app');
var footbar = document.getElementById('footbar');
var footbarIn = document.getElementById('footbarIn');

/* ---------- 工具 ---------- */
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function el(id) { return document.getElementById(id); }
function pad(n) { return n < 10 ? '0' + n : '' + n; }
function shuffle(a) {
  for (var i = a.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}
function pct(a, b) { return b ? Math.round(a / b * 100) : 0; }

/* ---------- 進度儲存 ---------- */
var store = {
  s: { progress: {}, exams: [], pos: {}, opt: {} },
  load: function () {
    try {
      var raw = localStorage.getItem(LS);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o === 'object') {
          this.s.progress = o.progress || {};
          this.s.exams = o.exams || [];
          this.s.pos = o.pos || {};
          this.s.opt = o.opt || {};
        }
      }
    } catch (e) { /* 無痕視窗或關閉儲存時忽略 */ }
  },
  save: function () {
    try { localStorage.setItem(LS, JSON.stringify(this.s)); } catch (e) {}
  },
  mark: function (id, ok) {
    var p = this.s.progress[id] || [0, 0];
    if (ok) p[0]++; else p[1]++;
    this.s.progress[id] = p;
    this.save();
  },
  rec: function (id) { return this.s.progress[id] || [0, 0]; },
  /* 錯題定義：答錯次數 > 答對次數，或曾答錯且尚未再答對 */
  wrongIds: function () {
    var out = [];
    for (var k in this.s.progress) {
      var p = this.s.progress[k];
      if (p[1] > 0 && p[0] < p[1] + 1) out.push(+k);
      else if (p[1] > p[0]) out.push(+k);
    }
    return out.filter(function (v, i, a) { return a.indexOf(v) === i; });
  },
  reset: function () {
    this.s = { progress: {}, exams: [], pos: {}, opt: {} };
    try { localStorage.removeItem(LS); } catch (e) {}
  }
};

/* ---------- 主題色圖示 ---------- */
var TICON = ['🌡️', '⚡', '💨', '💧', '♻️', '🛒', '🦋', '⚠️', '🔊', '📜', '🎓', '🌏'];

/* ---------- 主辦單位指定影片（活動須知第陸點） ---------- */
var DEFAULT_VIDEOS = [
  { n: '無形文化資產中的傳統知識與實踐', h: '0.5' },
  { n: '綠色能源：新及再生能源對淨零推動', h: '0.5' },
  { n: '綠生活家園～「化」出環境友善的生活方式', h: '0.5' },
  { n: '臺灣2050淨零排放路徑及政策（低碳環境教育）', h: '0.5' },
  { n: '環境倫理', h: '1' },
  { n: '【InnoConnect＋ 2024 線上講堂】循環經濟×紡織，重塑生產與消費模式', h: '1' }
];

/* ---------- 載入資料 ---------- */
function boot() {
  store.load();
  applyTheme(localStorage.getItem('ekc.theme') || '');
  fetch('data/questions.json', { cache: 'default' })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (d) {
      G.data = d;
      window.addEventListener('hashchange', route);
      route();
      // 解析與重點在背景預load，不擋畫面
      fetch('data/explain.json').then(function (r) { return r.json(); })
        .then(function (x) { G.explain = x; })
        .catch(function () { G.explain = null; });
      fetch('data/errata.json').then(function (r) { return r.json(); })
        .then(function (x) { G.errata = x; })
        .catch(function () { G.errata = null; });
      fetch('data/notes.json').then(function (r) { return r.json(); })
        .then(function (x) {
          G.notes = x; G.notesLoaded = true;
          // 直接開重點速記頁時，資料是後到的，到了要重畫一次
          if (/^#\/notes/.test(location.hash) && !G.sess) route();
        })
        .catch(function () {
          G.notes = null; G.notesLoaded = true;
          if (/^#\/notes/.test(location.hash) && !G.sess) route();
        });
    })
    .catch(function (e) {
      app.innerHTML = '<div class="empty"><span class="ic">😵</span>' +
        '<b>題庫載不起來</b><p class="note">' + esc(e.message) + '<br>' +
        '請確認網路連線後重新整理頁面。</p></div>';
    });
}

function getExplain(id) {
  if (G.explain && G.explain[id]) return G.explain[id];
  return null;
}

/* ---------- 主題切換 ---------- */
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('ekc.theme', t); } catch (e) {}
}
el('themeBtn').onclick = function () {
  var cur = document.documentElement.getAttribute('data-theme');
  var dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  var next;
  if (cur === 'dark') next = 'light';
  else if (cur === 'light') next = 'dark';
  else next = dark ? 'light' : 'dark';
  applyTheme(next);
};
el('homeBtn').onclick = function () { location.hash = '#/'; };

/* ---------- 路由 ---------- */
function parseHash() {
  var h = location.hash.replace(/^#\/?/, '');
  var qi = h.indexOf('?');
  var q = {};
  if (qi >= 0) {
    h.slice(qi + 1).split('&').forEach(function (kv) {
      var p = kv.split('=');
      q[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || '');
    });
    h = h.slice(0, qi);
  }
  return { path: h.split('/').filter(Boolean), q: q };
}

function route() {
  if (G.tick) { clearInterval(G.tick); G.tick = null; }
  footbar.hidden = true; footbarIn.innerHTML = '';
  var r = parseHash();
  var p = r.path[0] || '';
  window.scrollTo(0, 0);
  switch (p) {
    case '':        pageHome(); break;
    case 'topics':  pageTopics(); break;
    case 'practice':pagePractice(r.q); break;
    case 'exam':    r.path[1] === 'run' ? pageExamRun() : pageExamSetup(); break;
    case 'wrong':   pageWrong(); break;
    case 'notes':   r.path[1] ? pageNoteTopic(+r.path[1]) : pageNotes(); break;
    case 'errata':  pageErrata(); break;
    case 'stats':   pageStats(); break;
    case 'info':    pageInfo(); break;
    default:        location.replace('#/');
  }
}

/* ===========================================================
   首頁
   =========================================================== */
function daysLeft() {
  var now = new Date();
  // 以「日曆天」計算：今天到 9/19 還有幾天，不受現在幾點影響
  var a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  var b = new Date(EXAM_DATE.getFullYear(), EXAM_DATE.getMonth(), EXAM_DATE.getDate());
  return { ms: EXAM_DATE - now, d: Math.round((b - a) / 86400000) };
}

function pageHome() {
  var d = G.data;
  var dl = daysLeft();
  var answered = Object.keys(store.s.progress).length;
  var tot = 0, ok = 0;
  for (var k in store.s.progress) { tot += store.s.progress[k][0] + store.s.progress[k][1]; ok += store.s.progress[k][0]; }
  var wn = store.wrongIds().length;

  var cd;
  if (dl.ms > 0) {
    cd = '<div class="countdown"><div class="cd-l"><b>' +
      (dl.d === 0 ? '今天就是比賽日' : '距離比賽日') + '</b>' +
      '115年9月19日（星期六）10:00 菁英賽<br>嘉南藥理大學 C 棟綜合教學大樓</div>' +
      '<div class="cd-n">' + (dl.d === 0 ? '今天' :
        (dl.d + '<span>天</span>')) + '</div></div>';
  } else {
    cd = '<div class="countdown"><div class="cd-l"><b>比賽日已過</b>' +
      '辛苦了！題庫仍可繼續當環境知識學習使用。</div>' +
      '<div class="cd-n">🎉</div></div>';
  }

  app.innerHTML = cd +
    '<h1>賽前練習題庫</h1>' +
    '<p class="lead">收錄環境部「環保知識挑戰擂台賽」官方題庫 <b>' + d.meta.count +
    '</b> 題，全部附解答與解析，依 12 個主題整理好。其中 <b>' + d.meta.newCount +
    '</b> 題是 115 年才新增的。<br>' +
    '正式比賽是 <b>80 題四選一、30 分鐘</b>，用下面的模擬考練手感最有效。</p>' +

    '<div class="tiles">' +
      tile('#/topics', '📚', '主題練習', '挑一個主題慢慢練，答完馬上看解析') +
      tile('#/exam', '⏱️', '模擬考', '80 題 30 分鐘，完全比照正式比賽') +
      tile('#/wrong', '🔁', '錯題複習', wn > 0 ? '目前有 ' + wn + ' 題待加強' : '答錯的題目會自動收進來') +
      tile('#/notes', '💡', '重點速記', '各主題核心考點＋指定影片清單') +
    '</div>' +
    (G.errata && G.errata.items ?
      '<a class="tile" href="#/errata" style="border-color:var(--acc)">' +
      '<span class="ic">⚠️</span><span class="t">題庫疑義（' +
      Object.keys(G.errata.items).length + ' 題）</span>' +
      '<span class="d">題庫本身答案有問題的題目。比賽照題庫計分，但別把錯觀念背進去</span></a>' : '') +

    '<div class="card"><h3 style="margin-top:0">我的練習進度</h3>' +
      '<div class="stat-grid">' +
        '<div class="stat"><div class="v">' + answered + '</div><div class="l">練過的題數</div></div>' +
        '<div class="stat"><div class="v">' + pct(ok, tot) + '<small style="font-size:14px">%</small></div><div class="l">累計正確率</div></div>' +
        '<div class="stat"><div class="v">' + wn + '</div><div class="l">待加強題</div></div>' +
        '<div class="stat"><div class="v">' + store.s.exams.length + '</div><div class="l">模擬考次數</div></div>' +
      '</div>' +
      '<div class="btn-row"><a class="btn" href="#/stats">看詳細紀錄</a>' +
      '<button class="btn" id="quick20">隨機快練 20 題</button></div>' +
    '</div>' +

    '<div class="card"><h3 style="margin-top:0">比賽當天提醒</h3>' +
      '<ul style="margin:6px 0 0;padding-left:20px;font-size:15.5px;line-height:1.85">' +
      '<li>要帶<b>有照片的身分證件</b>（臨時學生證／健保卡）放桌面左上角備查</li>' +
      '<li>自備 <b>2B 鉛筆＋橡皮擦</b>，<b>禁用立可白／修正帶</b></li>' +
      '<li>手機、智慧手錶、AI 眼鏡等電子產品<b>不可帶進考場</b></li>' +
      '<li>自備<b>環保杯與環保餐具</b>，大會不提供一次性餐具</li>' +
      '<li>領獎要用<b>身分證正反面影本</b>或戶口名簿影本</li>' +
      '</ul>' +
      '<div class="btn-row"><a class="btn" href="#/info">完整比賽資訊</a></div>' +
    '</div>' +

    '<p class="note">題庫來源：環境部「環保知識挑戰擂台賽」題庫（含解答）。' +
    '本站由臺南市安平區新南國小衛生組整理製作，僅供賽前練習使用。<br>' +
    '練習紀錄只存在你自己的裝置瀏覽器裡，不會上傳到任何地方。</p>';

  el('quick20').onclick = function () {
    startSession('practice', shuffle(allIds()).slice(0, 20), '隨機快練');
  };
}

function tile(href, ic, t, d) {
  return '<a class="tile" href="' + href + '"><span class="ic">' + ic + '</span>' +
    '<span class="t">' + t + '</span><span class="d">' + esc(d) + '</span></a>';
}

function allIds() {
  var a = [];
  for (var i = 0; i < G.data.q.length; i++) a.push(i);
  return a;
}

/* ===========================================================
   主題練習：選單
   =========================================================== */
var topicFilter = { lv: [], kw: '', onlyNew: false };

function pageTopics() {
  var d = G.data;
  app.innerHTML =
    '<h1>主題練習</h1>' +
    '<p class="lead">先選難度與範圍（可複選，不選＝全部），再點主題開始練。答完一題立刻看到答案與解析。</p>' +
    '<div class="card"><h3 style="margin-top:0">難度</h3><div class="chips" id="lvChips"></div>' +
    '<h3>出題範圍</h3><div class="chips" id="rgChips">' +
      '<button class="chip" data-rg="0" aria-pressed="' + (!topicFilter.onlyNew) + '">全部 ' +
        d.meta.count + ' 題</button>' +
      '<button class="chip" data-rg="1" aria-pressed="' + (topicFilter.onlyNew) + '">只練 115 年新增 ' +
        d.meta.newCount + ' 題</button>' +
    '</div>' +
    '<p class="note" style="margin-top:8px">「115年新增」＝拿 114 年題庫（2844 題）比對後，' +
    '今年才加進官方題庫的題目，通常比較貼近最新政策與時事。時間不夠時可以優先練這些。</p>' +
    '<h3>關鍵字找題目</h3>' +
    '<input id="kw" type="search" placeholder="例如：碳費、PM2.5、外來種、環評" ' +
    'style="width:100%;padding:11px 14px;border:1px solid var(--line);border-radius:11px;' +
    'background:var(--bg);color:var(--tx);font:inherit;font-size:16px">' +
    '<div id="kwOut"></div></div>' +
    '<h2>12 個主題</h2><div class="tlist" id="tlist"></div>' +
    '<div class="card" style="margin-top:14px"><h3 style="margin-top:0">全部題目</h3>' +
    '<p style="margin:0 0 4px;color:var(--tx2);font-size:15px">不分主題，依目前難度篩選隨機出題。</p>' +
    '<div class="btn-row"><button class="btn pri" id="allBtn">開始練習（全部主題）</button></div></div>';

  var lvc = el('lvChips');
  lvc.innerHTML = d.levels.map(function (n, i) {
    var c = d.q.filter(function (q) { return q[0] === i; }).length;
    return '<button class="chip" data-lv="' + i + '" aria-pressed="' +
      (topicFilter.lv.indexOf(i) >= 0) + '">' + esc(n) + '<span class="n">' + c + '</span></button>';
  }).join('');
  lvc.onclick = function (e) {
    var b = e.target.closest('[data-lv]'); if (!b) return;
    var v = +b.dataset.lv, i = topicFilter.lv.indexOf(v);
    if (i >= 0) topicFilter.lv.splice(i, 1); else topicFilter.lv.push(v);
    b.setAttribute('aria-pressed', i < 0);
    renderTopicList();
  };

  el('rgChips').onclick = function (e) {
    var b = e.target.closest('[data-rg]'); if (!b) return;
    topicFilter.onlyNew = b.dataset.rg === '1';
    [].forEach.call(this.children, function (c) { c.setAttribute('aria-pressed', c === b); });
    renderTopicList();
  };

  el('kw').value = topicFilter.kw;
  el('kw').oninput = function () { topicFilter.kw = this.value.trim(); renderKw(); };
  el('allBtn').onclick = function () {
    var ids = filterIds(-1);
    if (!ids.length) return alert('這個難度沒有題目，請改選其他難度。');
    startSession('practice', shuffle(ids), '全部主題');
  };
  renderTopicList();
  renderKw();
}

function filterIds(t) {
  var lv = topicFilter.lv, out = [];
  for (var i = 0; i < G.data.q.length; i++) {
    var q = G.data.q[i];
    if (t >= 0 && q[1] !== t) continue;
    if (lv.length && lv.indexOf(q[0]) < 0) continue;
    if (topicFilter.onlyNew && !q[6]) continue;
    out.push(i);
  }
  return out;
}

function renderTopicList() {
  var d = G.data;
  el('tlist').innerHTML = d.topics.map(function (tp, i) {
    var ids = filterIds(i);
    var done = ids.filter(function (id) { var p = store.rec(id); return p[0] + p[1] > 0; }).length;
    return '<button class="trow" data-t="' + i + '"' + (ids.length ? '' : ' disabled style="opacity:.45"') + '>' +
      '<span class="tn">' + TICON[i] + '</span>' +
      '<span class="tm"><b>' + esc(tp.n) + '</b><small>' + esc(tp.d) + '</small></span>' +
      '<span class="tg">' + ids.length + ' 題<div class="bar"><i style="width:' +
      pct(done, ids.length) + '%"></i></div></span></button>';
  }).join('');
  el('tlist').onclick = function (e) {
    var b = e.target.closest('[data-t]'); if (!b || b.disabled) return;
    var t = +b.dataset.t;
    var ids = filterIds(t);
    if (!ids.length) return;
    startSession('practice', ids, G.data.topics[t].n);
  };
}

function renderKw() {
  var out = el('kwOut'), kw = topicFilter.kw;
  if (!kw) { out.innerHTML = ''; return; }
  var hits = [];
  for (var i = 0; i < G.data.q.length && hits.length < 300; i++) {
    var q = G.data.q[i];
    if (q[2].indexOf(kw) >= 0 || q[5].indexOf(kw) >= 0 ||
        q[3].join('').indexOf(kw) >= 0) hits.push(i);
  }
  if (!hits.length) {
    out.innerHTML = '<p class="note">找不到含「' + esc(kw) + '」的題目。</p>';
    return;
  }
  out.innerHTML = '<p class="note">找到 <b>' + hits.length + '</b> 題' +
    (hits.length >= 300 ? '（只顯示前 300 題）' : '') + '</p>' +
    '<div class="btn-row"><button class="btn pri" id="kwGo">練這 ' + hits.length + ' 題</button></div>';
  el('kwGo').onclick = function () { startSession('practice', hits, '搜尋：' + kw); };
}

/* ===========================================================
   練習／考試共用的作答工作階段
   =========================================================== */
function startSession(mode, ids, title, limitSec) {
  G.sess = {
    mode: mode, ids: ids, i: 0, title: title || '',
    ans: {}, done: {}, limit: limitSec || 0,
    start: Date.now(), ended: false, review: false
  };
  location.hash = mode === 'exam' ? '#/exam/run' : '#/practice';
  if (mode !== 'exam' && location.hash === '#/practice') route();
}

function pagePractice() {
  if (!G.sess || G.sess.mode === 'exam') { location.replace('#/topics'); return; }
  renderQuestion();
}

function renderQuestion() {
  var S = G.sess, d = G.data;
  var id = S.ids[S.i], q = d.q[id];
  var picked = S.ans[id];
  var shown = S.done[id];
  var right = q[4];

  var html =
    '<div class="pbar"><i style="width:' + ((S.i + 1) / S.ids.length * 100) + '%"></i></div>' +
    '<div class="card">' +
      '<div class="qhead">' +
        '<span class="tag">' + TICON[q[1]] + ' ' + esc(d.topics[q[1]].n) + '</span>' +
        '<span class="tag lv">' + esc(d.levels[q[0]]) + '</span>' +
        (q[6] ? '<span class="tag gray">115新增</span>' : '') +
        '<span class="qnum">' + (S.i + 1) + ' / ' + S.ids.length + '</span>' +
      '</div>' +
      '<div class="qtext">' + esc(q[2]) + '</div>' +
      '<div class="opts" id="opts">' +
        q[3].map(function (o, k) {
          var cls = 'opt';
          if (shown) {
            if (k === right) cls += ' right';
            else if (k === picked) cls += ' wrong';
          } else if (k === picked) cls += ' sel';
          return '<button class="' + cls + '" data-k="' + k + '"' + (shown ? ' disabled' : '') + '>' +
            '<span class="k">' + KEYS[k] + '</span><span>' + esc(o) + '</span></button>';
        }).join('') +
      '</div>' +
      (shown ? verdictHtml(id, q, picked, right) : '') +
    '</div>' +
    '<p class="note">電腦鍵盤：<span class="kbd">1</span>～<span class="kbd">4</span> 選答案，' +
    '<span class="kbd">→</span> 下一題，<span class="kbd">←</span> 上一題。</p>';

  app.innerHTML = html;
  document.title = S.title + '｜練習題庫';

  el('opts').onclick = function (e) {
    var b = e.target.closest('[data-k]'); if (!b || b.disabled) return;
    answer(+b.dataset.k);
  };

  footbar.hidden = false;
  footbarIn.innerHTML =
    '<button class="btn" id="fPrev"' + (S.i === 0 ? ' disabled' : '') + '>← 上一題</button>' +
    '<span class="info" id="fInfo">' + sessScore() + '</span>' +
    '<button class="btn pri" id="fNext">' +
      (S.i >= S.ids.length - 1 ? '完成' : '下一題 →') + '</button>';
  el('fPrev').onclick = function () { if (S.i > 0) { S.i--; renderQuestion(); } };
  el('fNext').onclick = nextQ;
}

function verdictHtml(id, q, picked, right) {
  var ok = picked === right;
  var ana = getExplain(id);
  return '<div class="verdict ' + (ok ? 'ok' : 'ng') + '">' +
    '<div class="vh">' + (ok ? '✅ 答對了！' : '❌ 答錯了，正確答案是 ' + KEYS[right]) + '</div>' +
    '<div class="ana">' + (ana ? esc(ana) : '<span style="color:var(--tx3)">（解析載入中…）</span>') + '</div>' +
    (q[5] ? '<div class="note" style="margin-top:8px">🔑 考點：<b>' + esc(q[5]) + '</b></div>' : '') +
    '</div>' + errataHtml(id);
}

function sessScore() {
  var S = G.sess, ok = 0, n = 0;
  for (var id in S.done) { n++; if (S.ans[id] === G.data.q[id][4]) ok++; }
  return n ? '答對 ' + ok + ' / ' + n : '尚未作答';
}

function answer(k) {
  var S = G.sess, id = S.ids[S.i];
  if (S.mode === 'exam' && !S.review) {
    S.ans[id] = k;
    renderExamQ();
    return;
  }
  if (S.done[id]) return;
  S.ans[id] = k;
  S.done[id] = 1;
  store.mark(id, k === G.data.q[id][4]);
  renderQuestion();
  // 解析若還沒載完，載完後補上
  if (!G.explain) {
    fetch('data/explain.json').then(function (r) { return r.json(); })
      .then(function (x) { G.explain = x; if (G.sess === S && S.ids[S.i] === id) renderQuestion(); })
      .catch(function () {});
  }
}

function nextQ() {
  var S = G.sess;
  if (S.i >= S.ids.length - 1) { finishPractice(); return; }
  S.i++;
  renderQuestion();
}

function finishPractice() {
  var S = G.sess, ok = 0, n = 0;
  for (var id in S.done) { n++; if (S.ans[id] === G.data.q[id][4]) ok++; }
  var rate = pct(ok, n);
  footbar.hidden = true;
  app.innerHTML =
    '<div class="card score">' +
      '<div class="big">' + rate + '<small>%</small></div>' +
      '<div class="msg">' + praise(rate) + '</div>' +
      '<div class="sub">' + esc(S.title) + '｜作答 ' + n + ' 題，答對 ' + ok + ' 題</div>' +
      '<div class="btn-row" style="justify-content:center">' +
        '<a class="btn" href="#/topics">換一個主題</a>' +
        '<a class="btn" href="#/wrong">複習錯題</a>' +
        '<a class="btn pri" href="#/">回首頁</a>' +
      '</div>' +
    '</div>';
  G.sess = null;
}

function praise(r) {
  if (r >= 95) return '太厲害了，這個主題你已經很穩！';
  if (r >= 85) return '很不錯，再把錯的幾題看熟就好。';
  if (r >= 70) return '有基礎了，記得回頭把解析讀一遍。';
  if (r >= 50) return '再練一輪會進步很多，別急。';
  return '這個主題比較不熟，建議先看「重點速記」再回來練。';
}

/* ===========================================================
   模擬考
   =========================================================== */
function pageExamSetup() {
  var d = G.data;
  var hist = store.s.exams.slice(-8).reverse();
  app.innerHTML =
    '<h1>模擬考</h1>' +
    '<p class="lead">比照正式比賽：<b>' + EXAM_N + ' 題四選一、' + EXAM_MIN + ' 分鐘</b>，' +
    '作答期間不會顯示對錯，交卷後才逐題檢討。<br>建議至少完整做過兩次，抓時間感。</p>' +
    '<div class="card">' +
      '<h3 style="margin-top:0">出題難度</h3>' +
      '<div class="chips" id="exLv">' +
        '<button class="chip" data-m="all" aria-pressed="true">全部難度（最接近正式比賽）</button>' +
        '<button class="chip" data-m="easy" aria-pressed="false">只考初級＋中級</button>' +
        '<button class="chip" data-m="hard" aria-pressed="false">只考中高級＋高級</button>' +
      '</div>' +
      '<h3>出題範圍</h3>' +
      '<div class="chips" id="exR">' +
        '<button class="chip" data-r="0" aria-pressed="true">全部 ' + d.meta.count + ' 題</button>' +
        '<button class="chip" data-r="1" aria-pressed="false">只考 115 年新增 ' + d.meta.newCount + ' 題</button>' +
      '</div>' +
      '<h3>題數與時間</h3>' +
      '<div class="chips" id="exN">' +
        '<button class="chip" data-n="80" aria-pressed="true">80 題 / 30 分鐘（正式）</button>' +
        '<button class="chip" data-n="40" aria-pressed="false">40 題 / 15 分鐘</button>' +
        '<button class="chip" data-n="20" aria-pressed="false">20 題 / 8 分鐘</button>' +
      '</div>' +
      '<div class="btn-row"><button class="btn pri big wide" id="goExam">開始模擬考</button></div>' +
      '<p class="note">時間到會自動交卷。中途離開頁面這次成績就不算，請安排好時間再開始。</p>' +
    '</div>' +
    (hist.length ?
      '<h2>過去成績</h2><div class="card"><div class="scroll-x"><table class="tbl">' +
      '<tr><th>日期</th><th>題數</th><th>答對</th><th>正確率</th><th>用時</th></tr>' +
      hist.map(function (h) {
        var dt = new Date(h.ts);
        return '<tr><td>' + (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' +
          pad(dt.getHours()) + ':' + pad(dt.getMinutes()) + '</td><td>' + h.total +
          '</td><td>' + h.correct + '</td><td><b>' + pct(h.correct, h.total) + '%</b></td><td>' +
          Math.floor(h.sec / 60) + '分' + pad(h.sec % 60) + '秒</td></tr>';
      }).join('') + '</table></div></div>' : '');

  var mode = 'all', n = 80, onlyNew = false;
  el('exLv').onclick = function (e) {
    var b = e.target.closest('[data-m]'); if (!b) return;
    mode = b.dataset.m;
    [].forEach.call(this.children, function (c) { c.setAttribute('aria-pressed', c === b); });
  };
  el('exR').onclick = function (e) {
    var b = e.target.closest('[data-r]'); if (!b) return;
    onlyNew = b.dataset.r === '1';
    [].forEach.call(this.children, function (c) { c.setAttribute('aria-pressed', c === b); });
  };
  el('exN').onclick = function (e) {
    var b = e.target.closest('[data-n]'); if (!b) return;
    n = +b.dataset.n;
    [].forEach.call(this.children, function (c) { c.setAttribute('aria-pressed', c === b); });
  };
  el('goExam').onclick = function () {
    var pool = [];
    for (var i = 0; i < d.q.length; i++) {
      var lv = d.q[i][0];
      if (mode === 'easy' && lv > 1) continue;
      if (mode === 'hard' && lv < 2) continue;
      if (onlyNew && !d.q[i][6]) continue;
      pool.push(i);
    }
    if (pool.length < n) { alert('這個條件下只有 ' + pool.length + ' 題，請放寬條件。'); return; }
    var sec = n === 80 ? EXAM_MIN * 60 : (n === 40 ? 15 * 60 : 8 * 60);
    startSession('exam', shuffle(pool).slice(0, n), '模擬考', sec);
  };
}

function pageExamRun() {
  if (!G.sess || G.sess.mode !== 'exam') { location.replace('#/exam'); return; }
  renderExamQ();
  if (!G.sess.ended && G.sess.limit) {
    G.tick = setInterval(tickTimer, 500);
    tickTimer();
  }
}

function remainSec() {
  var S = G.sess;
  return Math.max(0, S.limit - Math.floor((Date.now() - S.start) / 1000));
}

function tickTimer() {
  var S = G.sess;
  if (!S || S.ended) { clearInterval(G.tick); G.tick = null; return; }
  var t = el('timer');
  var r = remainSec();
  if (t) {
    t.textContent = Math.floor(r / 60) + ':' + pad(r % 60);
    t.className = 'timer' + (r <= 60 ? ' crit' : (r <= 300 ? ' warn' : ''));
  }
  if (r <= 0) { clearInterval(G.tick); G.tick = null; submitExam(true); }
}

function renderExamQ() {
  var S = G.sess, d = G.data;
  var id = S.ids[S.i], q = d.q[id];
  var picked = S.ans[id];
  var answered = 0;
  for (var kk in S.ans) answered++;

  var head = S.review ? '' :
    '<div class="exambar"><span class="timer" id="timer">--:--</span>' +
    '<span style="font-size:14px;color:var(--tx2)">剩餘時間</span>' +
    '<span class="spacer" style="flex:1"></span>' +
    '<span style="font-size:14.5px">已作答 <b>' + answered + '</b> / ' + S.ids.length + '</span></div>';

  var vh = '';
  if (S.review) {
    vh = verdictHtml(id, q, picked, q[4]);
  }

  app.innerHTML = head +
    '<div class="card">' +
      '<div class="qhead">' +
        (S.review ? '<span class="tag">' + TICON[q[1]] + ' ' + esc(d.topics[q[1]].n) + '</span>' +
          '<span class="tag lv">' + esc(d.levels[q[0]]) + '</span>' : '<span class="tag gray">模擬考</span>') +
        '<span class="qnum">第 ' + (S.i + 1) + ' 題 / ' + S.ids.length + '</span>' +
      '</div>' +
      '<div class="qtext">' + esc(q[2]) + '</div>' +
      '<div class="opts" id="opts">' +
        q[3].map(function (o, k) {
          var cls = 'opt';
          if (S.review) {
            if (k === q[4]) cls += ' right';
            else if (k === picked) cls += ' wrong';
          } else if (k === picked) cls += ' sel';
          return '<button class="' + cls + '" data-k="' + k + '"' + (S.review ? ' disabled' : '') + '>' +
            '<span class="k">' + KEYS[k] + '</span><span>' + esc(o) + '</span></button>';
        }).join('') +
      '</div>' + vh +
    '</div>' +
    '<div class="card"><h3 style="margin-top:0;font-size:15px">答題卡（點數字可跳題）</h3>' +
      '<div class="grid-nav" id="gnav">' +
        S.ids.map(function (qid, k) {
          var c = 'gn';
          if (S.review) {
            if (S.ans[qid] === undefined) c += '';
            else c += (S.ans[qid] === d.q[qid][4] ? ' ok' : ' no');
          } else if (S.ans[qid] !== undefined) c += ' done';
          if (k === S.i) c += ' cur';
          return '<button class="' + c + '" data-i="' + k + '">' + (k + 1) + '</button>';
        }).join('') +
      '</div></div>';

  el('opts').onclick = function (e) {
    var b = e.target.closest('[data-k]'); if (!b || b.disabled) return;
    S.ans[id] = +b.dataset.k;
    if (S.i < S.ids.length - 1) { S.i++; renderExamQ(); }
    else renderExamQ();
  };
  el('gnav').onclick = function (e) {
    var b = e.target.closest('[data-i]'); if (!b) return;
    S.i = +b.dataset.i; renderExamQ(); window.scrollTo(0, 0);
  };

  footbar.hidden = false;
  footbarIn.innerHTML =
    '<button class="btn" id="fPrev"' + (S.i === 0 ? ' disabled' : '') + '>←</button>' +
    '<button class="btn" id="fNext"' + (S.i >= S.ids.length - 1 ? ' disabled' : '') + '>→</button>' +
    (S.review
      ? '<a class="btn pri" href="#/exam" style="flex:2">再考一次</a>'
      : '<button class="btn pri" id="fSub" style="flex:2">交卷</button>');
  el('fPrev').onclick = function () { if (S.i > 0) { S.i--; renderExamQ(); } };
  el('fNext').onclick = function () { if (S.i < S.ids.length - 1) { S.i++; renderExamQ(); } };
  if (el('fSub')) el('fSub').onclick = function () { submitExam(false); };
}

function submitExam(auto) {
  var S = G.sess;
  var unanswered = 0;
  S.ids.forEach(function (id) { if (S.ans[id] === undefined) unanswered++; });
  if (!auto && unanswered > 0) {
    if (!confirm('還有 ' + unanswered + ' 題沒作答，確定要交卷嗎？')) return;
  }
  if (G.tick) { clearInterval(G.tick); G.tick = null; }
  S.ended = true;
  var ok = 0;
  S.ids.forEach(function (id) {
    var c = S.ans[id] === G.data.q[id][4];
    if (c) ok++;
    if (S.ans[id] !== undefined) store.mark(id, c);
  });
  var sec = Math.min(S.limit, Math.floor((Date.now() - S.start) / 1000));
  store.s.exams.push({ ts: Date.now(), total: S.ids.length, correct: ok, sec: sec });
  if (store.s.exams.length > 50) store.s.exams = store.s.exams.slice(-50);
  store.save();
  showExamResult(ok, sec, auto, unanswered);
}

function showExamResult(ok, sec, auto, unanswered) {
  var S = G.sess, d = G.data;
  var rate = pct(ok, S.ids.length);
  var byTopic = {};
  S.ids.forEach(function (id) {
    var t = d.q[id][1];
    byTopic[t] = byTopic[t] || [0, 0];
    byTopic[t][1]++;
    if (S.ans[id] === d.q[id][4]) byTopic[t][0]++;
  });
  var weak = Object.keys(byTopic).map(function (t) {
    return { t: +t, ok: byTopic[t][0], n: byTopic[t][1], r: pct(byTopic[t][0], byTopic[t][1]) };
  }).sort(function (a, b) { return a.r - b.r; });

  footbar.hidden = true;
  app.innerHTML =
    (auto ? '<div class="card" style="border-color:var(--acc);background:var(--acc2)">' +
      '⏰ <b>時間到，系統已自動交卷。</b>正式比賽也是這樣，30 分鐘一到就收卷。</div>' : '') +
    '<div class="card score">' +
      '<div class="big">' + ok + '<small> / ' + S.ids.length + '</small></div>' +
      '<div class="msg">正確率 ' + rate + '%　' + praise(rate) + '</div>' +
      '<div class="sub">用時 ' + Math.floor(sec / 60) + ' 分 ' + pad(sec % 60) + ' 秒' +
        (unanswered ? '，未作答 ' + unanswered + ' 題' : '') + '</div>' +
      '<div class="stat-grid">' +
        '<div class="stat"><div class="v">' + ok + '</div><div class="l">答對</div></div>' +
        '<div class="stat"><div class="v">' + (S.ids.length - ok) + '</div><div class="l">答錯／未答</div></div>' +
        '<div class="stat"><div class="v">' + (S.ids.length ? (sec / S.ids.length).toFixed(1) : 0) +
          '<small style="font-size:13px">秒</small></div><div class="l">平均每題</div></div>' +
      '</div>' +
    '</div>' +
    '<h2>各主題表現</h2><div class="card"><div class="scroll-x"><table class="tbl">' +
      '<tr><th>主題</th><th>答對／題數</th><th>正確率</th></tr>' +
      weak.map(function (w) {
        return '<tr><td>' + TICON[w.t] + ' ' + esc(d.topics[w.t].n) + '</td><td>' +
          w.ok + ' / ' + w.n + '</td><td><b style="color:' +
          (w.r >= 70 ? 'var(--ok)' : 'var(--ng)') + '">' + w.r + '%</b></td></tr>';
      }).join('') +
    '</table></div>' +
    '<p class="note">正確率最低的主題就是接下來要補的地方，先去「重點速記」看那一主題再回來練。</p></div>' +
    '<div class="btn-row">' +
      '<button class="btn pri" id="reviewBtn">逐題檢討（看解析）</button>' +
      '<a class="btn" href="#/wrong">練錯題</a>' +
      '<a class="btn" href="#/exam">再考一次</a>' +
      '<a class="btn" href="#/">回首頁</a>' +
    '</div>';

  el('reviewBtn').onclick = function () {
    S.review = true; S.i = 0;
    if (!G.explain) {
      fetch('data/explain.json').then(function (r) { return r.json(); })
        .then(function (x) { G.explain = x; renderExamQ(); }).catch(function () {});
    }
    renderExamQ(); window.scrollTo(0, 0);
  };
}

/* ===========================================================
   錯題複習
   =========================================================== */
function pageWrong() {
  var ids = store.wrongIds().filter(function (id) { return G.data.q[id]; });
  if (!ids.length) {
    app.innerHTML = '<h1>錯題複習</h1>' +
      '<div class="empty"><span class="ic">🎯</span><b>目前沒有待加強的題目</b>' +
      '<p class="note">先去主題練習或模擬考，答錯的題目會自動收進這裡，<br>' +
      '再答對一次就會自動移出。</p>' +
      '<div class="btn-row" style="justify-content:center">' +
      '<a class="btn pri" href="#/topics">去主題練習</a>' +
      '<a class="btn" href="#/exam">去模擬考</a></div></div>';
    return;
  }
  var byT = {};
  ids.forEach(function (id) { var t = G.data.q[id][1]; byT[t] = (byT[t] || 0) + 1; });
  app.innerHTML = '<h1>錯題複習</h1>' +
    '<p class="lead">這裡是你答錯、還沒再答對的 <b>' + ids.length + '</b> 題。' +
    '再答對一次就會自動移出清單。<br>賽前最後兩天，把這裡清空是最有效率的做法。</p>' +
    '<div class="card"><h3 style="margin-top:0">錯題分布</h3><div class="scroll-x"><table class="tbl">' +
      Object.keys(byT).sort(function (a, b) { return byT[b] - byT[a]; }).map(function (t) {
        return '<tr><td>' + TICON[t] + ' ' + esc(G.data.topics[t].n) + '</td><td style="text-align:right">' +
          byT[t] + ' 題</td></tr>';
      }).join('') +
    '</table></div>' +
    '<div class="btn-row">' +
      '<button class="btn pri" id="wAll">全部複習（' + ids.length + ' 題）</button>' +
      '<button class="btn" id="w20">先練 20 題</button>' +
    '</div></div>';
  el('wAll').onclick = function () { startSession('practice', shuffle(ids.slice()), '錯題複習'); };
  el('w20').onclick = function () { startSession('practice', shuffle(ids.slice()).slice(0, 20), '錯題複習'); };
}

/* ===========================================================
   重點速記
   =========================================================== */
function pageNotes() {
  var d = G.data;
  var vids = (G.notes && G.notes.videos) || [];
  app.innerHTML = '<h1>重點速記</h1>' +
    '<p class="lead">命題範圍是「政府政策及時事、環境教育終身學習網指定影片、環境知識相關議題」。' +
    '下面依 12 個主題整理常考的核心觀念，看完再回去練題會快很多。</p>' +
    '<h2>指定影片（6 支，共 4 小時環教時數）</h2>' +
    '<div class="card">' +
      '<p style="margin:0 0 10px;font-size:15px;color:var(--tx2)">' +
      '主辦單位指定的影片會直接入題，考前務必看過。到「環境教育終身學習網」的' +
      '<b>知識競賽影片</b>專區觀看。</p>' +
      '<div class="btn-row" style="margin-top:0"><a class="btn pri" href="https://elearn.moenv.gov.tw/" target="_blank" rel="noopener">前往環境教育終身學習網 ↗</a></div>' +
      '<p class="note">首頁找「知識競賽影片」專區就有這 6 支。看完可認列 4 小時環境教育時數。<br>' +
      '須知寫明：影片題有爭議時<b>以環境部指定影片內容為準</b>，所以影片一定要看。</p>' +
    '</div>' +
    (vids.length ? vids : DEFAULT_VIDEOS).map(function (v, i) {
      return '<details class="acc"><summary><span style="color:var(--pri3)">' + (i + 1) + '.</span> ' +
        esc(v.n) + '　<span class="tag lv">' + v.h + ' 小時</span></summary>' +
        '<div class="body">' +
        (v.why ? '<p style="margin:0 0 10px">' + esc(v.why) + '</p>' : '') +
        (v.points && v.points.length ?
          '<b>看的時候特別記這幾點</b>（這是觀看方向的提示，不是影片的內容摘要，' +
          '影片一定要自己看）：<ul>' +
          v.points.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>' :
          '<p style="margin:0">請直接到環境教育終身學習網觀看。</p>') +
        '</div></details>';
    }).join('') +
    '<h2>各主題核心考點</h2>' +
    '<div class="tlist">' +
      d.topics.map(function (tp, i) {
        var has = G.notes && G.notes.topics && G.notes.topics[i];
        return '<a class="trow" href="#/notes/' + i + '">' +
          '<span class="tn">' + TICON[i] + '</span>' +
          '<span class="tm"><b>' + esc(tp.n) + '</b><small>' + esc(tp.d) + '</small></span>' +
          '<span class="tg">' + (has ? '重點 ' + has.items.length + ' 則' : tp.c + ' 題') + '</span></a>';
      }).join('') +
    '</div>';
}

function pageNoteTopic(t) {
  var d = G.data, tp = d.topics[t];
  if (!tp) { location.replace('#/notes'); return; }
  var note = G.notes && G.notes.topics && G.notes.topics[t];
  var body;
  if (note) {
    body = (note.intro ? '<div class="card"><p style="margin:0;font-size:15.5px;line-height:1.85">' +
        esc(note.intro) + '</p></div>' : '') +
      '<p class="note">以下重點是依<b>官方題庫的題目與解析</b>整理出來的，' +
      '所以裡面的數據跟著題庫走。題庫有些內容是幾年前寫的（例如發電結構占比、' +
      '寫成「環保署」而非現在的「環境部」），比賽是照題庫出題，' +
      '但要知道實際現況可能已經不一樣了。</p>' +
      '<h2>必背重點</h2>' +
      note.items.map(function (k) {
        return '<div class="kcard"><b>' + esc(k.h) + '</b><p>' + esc(k.b) + '</p></div>';
      }).join('') +
      (note.pairs && note.pairs.length ?
        '<h2>容易混淆的名詞</h2><div class="card"><div class="scroll-x"><table class="tbl">' +
        '<tr><th>名詞</th><th>vs</th><th>差在哪</th></tr>' +
        note.pairs.map(function (x) {
          return '<tr><td><b>' + esc(x.a) + '</b></td><td><b>' + esc(x.b) +
            '</b></td><td>' + esc(x.d) + '</td></tr>';
        }).join('') + '</table></div></div>' : '') +
      (note.traps && note.traps.length ?
        '<h2>常見陷阱</h2><div class="card"><ul style="margin:0;padding-left:20px;line-height:1.9;font-size:15.5px">' +
        note.traps.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' : '') +
      (note.numbers && note.numbers.length ?
        '<h2>要記的數字</h2><div class="card"><div class="scroll-x"><table class="tbl">' +
        note.numbers.map(function (x) {
          return '<tr><td>' + esc(x.k) + '</td><td><b>' + esc(x.v) + '</b></td></tr>';
        }).join('') + '</table></div></div>' : '');
  } else if (!G.notesLoaded) {
    body = '<div class="loading"><div class="spin"></div>重點速記載入中…</div>';
  } else {
    // 沒有整理稿時，退回用題庫的「考點」欄自動彙整
    var cnt = {};
    for (var i = 0; i < d.q.length; i++) {
      if (d.q[i][1] !== t) continue;
      var k = d.q[i][5];
      cnt[k] = (cnt[k] || 0) + 1;
    }
    var top = Object.keys(cnt).sort(function (a, b) { return cnt[b] - cnt[a]; }).slice(0, 60);
    body = '<div class="card"><p style="margin:0;font-size:15px;color:var(--tx2)">' +
      '這個主題最常出現的考點（依題庫統計）：</p><div class="chips" style="margin-top:12px">' +
      top.map(function (k) {
        return '<span class="chip" style="cursor:default">' + esc(k) + '<span class="n">' + cnt[k] + '</span></span>';
      }).join('') + '</div></div>';
  }

  app.innerHTML = '<p style="margin:18px 0 0"><a href="#/notes">← 回重點速記</a></p>' +
    '<h1>' + TICON[t] + ' ' + esc(tp.n) + '</h1>' +
    '<p class="lead">' + esc(tp.d) + '　（題庫共 ' + tp.c + ' 題）</p>' + body +
    '<div class="btn-row"><button class="btn pri big" id="practiceT">練這個主題</button>' +
    '<a class="btn big" href="#/notes">看其他主題</a></div>';
  el('practiceT').onclick = function () {
    topicFilter.lv = [];
    startSession('practice', shuffle(filterIds(t)), tp.n);
  };
}


/* ---------- 題庫疑義 ---------- */
var ECAT = {
  answer:    { n: '答案有問題', d: '題庫的答案和它自己的解析對不起來，或客觀上就是錯的' },
  dispute:   { n: '答案有爭議', d: '題庫的答案與通行說法不同，但無法完全排除題庫另有依據' },
  ambiguous: { n: '正解不唯一', d: '除了標準答案，還有別的選項也成立，選到那個會被判錯' },
  ana:       { n: '解析寫錯',   d: '答案是對的，但解析寫反或誤植，照解析讀會學到錯的' },
  defect:    { n: '題目瑕疵',   d: '選項重複、引用不存在的項目，不影響答案' }
};
var ECAT_ORDER = ['answer', 'dispute', 'ambiguous', 'ana', 'defect'];

function getErrata(id) {
  if (!G.errata || !G.errata.items) return null;
  return G.errata.items[String(id)] || null;
}

function errataHtml(id) {
  var e = getErrata(id);
  if (!e) return '';
  return '<div class="errata">' +
    '<div class="eh">⚠️ 這題題庫本身有問題（' + esc(ECAT[e.cat] ? ECAT[e.cat].n : e.cat) + '）</div>' +
    '<p>' + esc(e.why) + '</p>' +
    '<p class="ehow"><b>怎麼答：</b>' + esc(e.how) + '</p>' +
    (e.truth ? '<p class="etruth"><b>正確觀念：</b>' + esc(e.truth) + '</p>' : '') +
    '</div>';
}

function pageErrata() {
  var d = G.data;
  if (!G.errata || !G.errata.items) {
    app.innerHTML = '<h1>題庫疑義</h1><div class="loading"><div class="spin"></div>載入中…</div>';
    return;
  }
  var m = G.errata.meta || {};
  var ids = Object.keys(G.errata.items).map(Number).sort(function (a, b) { return a - b; });
  var byCat = {};
  ids.forEach(function (id) {
    var e = G.errata.items[String(id)];
    (byCat[e.cat] = byCat[e.cat] || []).push(id);
  });

  app.innerHTML = '<h1>題庫疑義</h1>' +
    '<p class="lead">逐題比對官方題庫的「答案」與「解析」後，找出 <b>' + ids.length +
    '</b> 題有問題的題目。</p>' +
    '<div class="card" style="border-color:var(--acc);background:var(--acc2)">' +
      '<b>先講最重要的：比賽是照官方答案計分。</b><br>' +
      '遇到這些題目<b>還是要照題庫作答</b>，這份清單是要讓你知道「為什麼怪」，' +
      '不要把錯的觀念背進去。練習時遇到這些題，答完會自動跳出提醒。' +
    '</div>' +
    (m.scanned ? '<p class="note">查核範圍：全題庫 ' + m.total + ' 題中已掃描 ' + m.scanned +
      ' 題' + (m.scanned < m.total ? '（其餘持續查核中）' : '') + '。</p>' : '') +
    ECAT_ORDER.filter(function (c) { return byCat[c]; }).map(function (c) {
      return '<h2>' + esc(ECAT[c].n) + '（' + byCat[c].length + ' 題）</h2>' +
        '<p class="note" style="margin-top:-6px">' + esc(ECAT[c].d) + '</p>' +
        byCat[c].map(function (id) {
          var q = d.q[id], e = G.errata.items[String(id)];
          return '<details class="acc"><summary>' +
            '<span class="tag gray">題 ' + (id + 1) + '</span> ' + esc(q[2].slice(0, 34)) +
            (q[2].length > 34 ? '…' : '') + '</summary><div class="body">' +
            '<p style="color:var(--tx);font-weight:600;margin:0 0 8px">' + esc(q[2]) + '</p>' +
            '<ul style="list-style:none;padding:0;margin:0 0 10px">' +
            q[3].map(function (o, k) {
              return '<li style="padding:3px 0' + (k === q[4] ? ';color:var(--ok);font-weight:650' : '') +
                '">(' + (k + 1) + ') ' + esc(o) + (k === q[4] ? '　← 官方答案' : '') + '</li>';
            }).join('') + '</ul>' +
            '<p><b>問題：</b>' + esc(e.why) + '</p>' +
            '<p><b>怎麼答：</b>' + esc(e.how) + '</p>' +
            (e.truth ? '<p><b>正確觀念：</b>' + esc(e.truth) + '</p>' : '') +
            '</div></details>';
        }).join('');
    }).join('') +
    '<div class="btn-row"><a class="btn pri" href="#/">回首頁</a></div>' +
    '<p class="note">發現其他怪怪的題目，跟衛生組說一聲，查證後會補進這份清單。</p>';
}

/* ===========================================================
   我的紀錄
   =========================================================== */
function pageStats() {
  var d = G.data;
  var rows = d.topics.map(function (tp, i) {
    var n = 0, ok = 0, seen = 0, total = 0;
    for (var j = 0; j < d.q.length; j++) {
      if (d.q[j][1] !== i) continue;
      total++;
      var p = store.rec(j);
      if (p[0] + p[1] > 0) { seen++; n += p[0] + p[1]; ok += p[0]; }
    }
    return { i: i, n: n, ok: ok, seen: seen, total: total };
  });
  var gTot = 0, gOk = 0, gSeen = 0;
  rows.forEach(function (r) { gTot += r.n; gOk += r.ok; gSeen += r.seen; });

  app.innerHTML = '<h1>我的紀錄</h1>' +
    '<div class="card"><div class="stat-grid">' +
      '<div class="stat"><div class="v">' + gSeen + '</div><div class="l">練過的題數</div></div>' +
      '<div class="stat"><div class="v">' + gTot + '</div><div class="l">總作答次數</div></div>' +
      '<div class="stat"><div class="v">' + pct(gOk, gTot) + '<small style="font-size:14px">%</small></div><div class="l">正確率</div></div>' +
      '<div class="stat"><div class="v">' + store.wrongIds().length + '</div><div class="l">待加強</div></div>' +
    '</div></div>' +
    '<h2>各主題掌握度</h2><div class="card"><div class="scroll-x"><table class="tbl">' +
      '<tr><th>主題</th><th>已練</th><th>正確率</th></tr>' +
      rows.map(function (r) {
        return '<tr><td>' + TICON[r.i] + ' ' + esc(d.topics[r.i].n) + '</td>' +
          '<td>' + r.seen + ' / ' + r.total + '</td>' +
          '<td>' + (r.n ? '<b style="color:' + (pct(r.ok, r.n) >= 70 ? 'var(--ok)' : 'var(--ng)') + '">' +
            pct(r.ok, r.n) + '%</b>' : '<span style="color:var(--tx3)">—</span>') + '</td></tr>';
      }).join('') +
    '</table></div></div>' +
    '<div class="btn-row"><button class="btn" id="rst">清除所有練習紀錄</button>' +
    '<a class="btn" href="#/">回首頁</a></div>' +
    '<p class="note">紀錄只存在這台裝置的瀏覽器。換裝置、清除瀏覽資料或用無痕視窗，紀錄都不會保留。</p>';

  el('rst').onclick = function () {
    if (confirm('確定要清除全部練習紀錄嗎？清掉就回不來了。')) {
      store.reset(); route();
    }
  };
}

/* ===========================================================
   比賽資訊
   =========================================================== */
function pageInfo() {
  app.innerHTML = '<h1>比賽資訊</h1>' +
    '<p class="lead">整理自主辦單位「115年臺南市環境知識競賽活動須知」（版本 115.5.18）。</p>' +

    '<div class="card"><h3 style="margin-top:0">時間與地點</h3><div class="scroll-x"><table class="tbl">' +
    '<tr><th>本市競賽</th><td>115年9月19日（星期六）<br>嘉南藥理大學 C 棟綜合教學大樓<br>臺南市仁德區二仁路一段60號</td></tr>' +
    '<tr><th>全國決賽</th><td>115年11月14日（星期六）<br>國立高雄科技大學第一校區（高雄市燕巢區大學路1號）</td></tr>' +
    '</table></div></div>' +

    '<h2>國小組當天流程</h2><div class="card"><div class="scroll-x"><table class="tbl">' +
    '<tr><th>時間</th><th>內容</th></tr>' +
    '<tr><td>09:35–09:50</td><td>入場（依入場通知書指定試場，對號入座）</td></tr>' +
    '<tr><td>09:50–10:00</td><td>競賽規則說明、核對身分證件</td></tr>' +
    '<tr><td>10:00–10:30</td><td><b>菁英賽</b>：80 題四選一，30 分鐘</td></tr>' +
    '<tr><td>10:30–11:00</td><td>現場公布題目與答案、發餐盒簽到</td></tr>' +
    '<tr><td>11:10–11:50</td><td>PK 賽（只有前 10 名同分才需要）</td></tr>' +
    '<tr><td>12:00–12:30</td><td>頒獎、合照、閉幕（T 棟大禮堂）</td></tr>' +
    '</table></div>' +
    '<p class="note">08:30–11:40 另有環保趣味活動闖關，開放家長及考生參加。</p></div>' +

    '<h2>命題範圍</h2><div class="card">' +
    '<p style="margin:0 0 8px">須知第陸點：包含<b>政府政策及時事</b>、<b>環境教育終身學習網之指定影片</b>、' +
    '以及<b>環境知識相關議題</b>。</p>' +
    '<p style="margin:0">6 支指定影片清單見 <a href="#/notes">重點速記</a>，共 4 小時環境教育時數。</p></div>' +

    '<h2>作答規定</h2><div class="card"><ul style="margin:0;padding-left:20px;line-height:1.9;font-size:15.5px">' +
    '<li>畫卡作答，自備 <b>黑色 2B 鉛筆與橡皮擦</b>；<b>不得使用修正液（帶）</b></li>' +
    '<li>可用透明墊板或透明鉛筆盒，上面不能有圖形文字</li>' +
    '<li>不得向其他參賽者借文具</li>' +
    '<li>開始作答後 5 分鐘內才能反映題目印刷不清，逾時不受理</li>' +
    '<li>考試剩 5 分鐘就不得再進考場</li>' +
    '<li>答案卡只能劃記答案，污損者取消資格</li>' +
    '<li>手機、智慧手錶、AI 眼鏡、平板等電子產品一律不得帶入座位，須關機放在指定位置</li>' +
    '</ul></div>' +

    '<h2>證件與領獎</h2><div class="card"><ul style="margin:0;padding-left:20px;line-height:1.9;font-size:15.5px">' +
    '<li>入場要帶<b>有照片的身分證件</b>，考前放在桌面左上角備查</li>' +
    '<li>國小生若身分證／健保卡照片還是嬰兒時期，須改用貼近照的<b>115年競賽專用臨時學生證</b></li>' +
    '<li>領獎要帶<b>身分證正反面影本</b>或戶口名簿影本</li>' +
    '<li>菁英賽各組前 50% 可獲頒證書；前 5 名取得全國決賽參賽權</li>' +
    '</ul></div>' +

    '<h2>要注意的日期</h2><div class="card"><div class="scroll-x"><table class="tbl">' +
    '<tr><td>9/11（五）起</td><td>環保局環境教育資訊網可查試場、座位表、入場編號</td></tr>' +
    '<tr><td>9/14（一）</td><td>主辦寄發入場通知書到報名信箱</td></tr>' +
    '<tr><td>9/16（三）前</td><td>沒收到通知書要主動打電話請主辦補寄</td></tr>' +
    '<tr><td>9/19（六）</td><td>比賽日</td></tr>' +
    '<tr><td>11/14（六）</td><td>全國決賽</td></tr>' +
    '</table></div>' +
    '<p class="note">主辦單位諮詢專線：06-2679912 或 06-2686751 #1329</p></div>' +

    '<div class="btn-row"><a class="btn pri" href="#/">回首頁</a></div>';
}

/* ---------- 鍵盤 ---------- */
document.addEventListener('keydown', function (e) {
  if (!G.sess) return;
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  var S = G.sess;
  if (e.key >= '1' && e.key <= '4') {
    var k = +e.key - 1;
    if (S.mode === 'exam' && !S.review) {
      S.ans[S.ids[S.i]] = k;
      if (S.i < S.ids.length - 1) S.i++;
      renderExamQ();
    } else if (S.mode !== 'exam') {
      answer(k);
    }
    e.preventDefault();
  } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
    if (S.mode === 'exam') { if (S.i < S.ids.length - 1) { S.i++; renderExamQ(); } }
    else nextQ();
    e.preventDefault();
  } else if (e.key === 'ArrowLeft') {
    if (S.i > 0) { S.i--; S.mode === 'exam' ? renderExamQ() : renderQuestion(); }
    e.preventDefault();
  }
});

/* ---------- 離開考試前確認 ---------- */
window.addEventListener('beforeunload', function (e) {
  if (G.sess && G.sess.mode === 'exam' && !G.sess.ended) {
    e.preventDefault(); e.returnValue = '';
  }
});

boot();
})();
