/* app.js : 돌림판 동작
 * 글과 목록은 data.js에서 바꿔요. 이 파일은 동작만 담아요.
 *
 * 흐름
 *   1 시작: 주소에 ?items=가 있으면 그 목록으로, 없으면 data.js의 첫 주제로
 *   2 돌리기: 결과를 먼저 무작위로 고르고(crypto), 그 칸에 멈추도록 감속하며 돌린다
 *   3 결과: 크게 보여 주고, 다시 돌리기 / 빼고 돌리기 / 결과 복사
 *   4 저장: 고친 목록과 최근 결과는 이 브라우저(localStorage)에만
 */
(function () {
  'use strict';

  var KEY = 'today-you:';
  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- 저장 (막힌 브라우저에서도 멈추지 않게) ----------
  function load(k, fallback) {
    try { var v = localStorage.getItem(KEY + k); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }
  function save(k, v) { try { localStorage.setItem(KEY + k, JSON.stringify(v)); } catch (e) { /* 저장이 막혀도 계속 쓴다 */ } }

  // ---------- 상태 ----------
  var presets = PRESETS.map(function (p) { return { id: p.id, name: p.name, question: p.question, items: p.items.slice(), defaults: p.items.slice() }; });
  var shared = readShared();
  if (shared) presets.unshift(shared);
  presets.forEach(function (p) { if (p.id !== 'shared') { var mine = load('items:' + p.id, null); if (Array.isArray(mine) && mine.length >= LIMITS.min) p.items = mine; } });

  var current = presets[0];
  var excluded = [];          // 이번에 뺀 항목 (새로 고치면 다시 들어간다)
  var rotation = 0;           // 지금 돌림판 각도(도)
  var spinning = false;
  var lastWinner = null;

  // 주소의 ?items=a,b,c&title=질문 을 읽는다
  function readShared() {
    var q = new URLSearchParams(location.search);
    var raw = q.get('items');
    if (!raw) return null;
    var items = clean(raw.split(','));
    if (items.length < LIMITS.min) return null;
    var title = (q.get('title') || '').slice(0, 40) || '무엇이 나올까?';
    return { id: 'shared', name: '받은 돌림판', question: title, items: items, defaults: items.slice() };
  }
  function clean(list) {
    var out = [];
    list.forEach(function (s) {
      s = String(s).replace(/,/g, ' ').trim().slice(0, LIMITS.maxLength);
      if (s && out.indexOf(s) < 0 && out.length < LIMITS.max) out.push(s);
    });
    return out;
  }
  function active() { return current.items.filter(function (s) { return excluded.indexOf(s) < 0; }); }

  // ---------- 소리 (Web Audio로 합성, 파일 없음) ----------
  var audio = null;
  function ensureAudio() {
    if (!SPIN.sound) return null;
    try {
      if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === 'suspended') audio.resume();
    } catch (e) { audio = null; }
    return audio;
  }
  function tone(freq, dur, type, vol, when) {
    if (!audio) return;
    var t = audio.currentTime + (when || 0);
    var o = audio.createOscillator(), g = audio.createGain();
    o.type = type || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function tick() { tone(1700, 0.035, 'square', 0.05); }
  function chime() { tone(784, 0.25, 'sine', 0.16); tone(1175, 0.4, 'sine', 0.14, 0.12); }

  // ---------- 돌림판 그리기 ----------
  function polar(r, deg) { var a = (deg - 90) * Math.PI / 180; return [200 + r * Math.cos(a), 200 + r * Math.sin(a)]; }
  function drawWheel() {
    var list = active(), n = list.length, R = 192, slice = 360 / n, s = '';
    var colorOf = function (name) { return COLORS[current.items.indexOf(name) % COLORS.length]; };
    s += '<g id="spinGroup" transform="rotate(' + rotation + ' 200 200)">';
    if (n === 1) {
      s += '<circle cx="200" cy="200" r="' + R + '" fill="' + colorOf(list[0]) + '"/>';
    }
    for (var i = 0; i < n && n > 1; i++) {
      var a0 = i * slice, a1 = (i + 1) * slice, p0 = polar(R, a0), p1 = polar(R, a1);
      s += '<path d="M200 200 L' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + R + ' ' + R + ' 0 ' + (slice > 180 ? 1 : 0) + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2) + 'Z" fill="' + colorOf(list[i]) + '" stroke="#fff" stroke-width="3"/>';
    }
    for (var j = 0; j < n; j++) {
      var mid = (j + 0.5) * slice, pt = polar(R * 0.6, mid), deg = mid - 90;
      if (deg > 90) deg -= 180; // 왼쪽 칸 글자가 뒤집히지 않게
      var label = list[j], size = Math.max(13, Math.min(30, 34 - label.length * 2.2 - n * 0.9));
      s += '<text x="' + pt[0].toFixed(1) + '" y="' + pt[1].toFixed(1) + '" font-size="' + size.toFixed(1) + '" text-anchor="middle" dominant-baseline="central" transform="rotate(' + deg.toFixed(1) + ' ' + pt[0].toFixed(1) + ' ' + pt[1].toFixed(1) + ')">' + esc(label) + '</text>';
    }
    s += '</g><circle cx="200" cy="200" r="' + (R + 2) + '" fill="none" stroke="#fff" stroke-width="6"/>';
    $('wheel').innerHTML = s;
    $('wheel').setAttribute('aria-label', '돌림판: ' + list.join(', '));
  }
  function setRotation(deg) {
    var g = document.getElementById('spinGroup');
    if (g) g.setAttribute('transform', 'rotate(' + deg + ' 200 200)');
  }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  // ---------- 돌리기 ----------
  function randomInt(n) {
    var a = new Uint32Array(1);
    if (window.crypto && crypto.getRandomValues) { crypto.getRandomValues(a); return a[0] % n; }
    return Math.floor(Math.random() * n);
  }
  function spin() {
    if (spinning) return;
    var list = active();
    if (list.length < 2) { toast('항목이 두 개 이상 있어야 돌릴 수 있어요'); return; }
    ensureAudio();
    hideResult();
    spinning = true; setBusy(true);
    var n = list.length, slice = 360 / n, idx = randomInt(n);
    var jitter = (randomInt(1000) / 1000 - 0.5) * slice * 0.6;
    var target = 360 - ((idx + 0.5) * slice + jitter);               // 바늘(위쪽)이 그 칸 가운데를 가리키는 각도
    var delta = ((target - rotation) % 360 + 360) % 360 + 360 * 5;   // 다섯 바퀴 더
    var from = rotation, to = rotation + delta;
    var done = function () { rotation = to % 360; setRotation(rotation); spinning = false; setBusy(false); showResult(list[idx]); };

    if (reduceMotion) { done(); return; }
    var dur = SPIN.seconds * 1000, start = null, lastSlice = null;
    var ease = function (t) { return 1 - Math.pow(1 - t, 4); };
    function frame(now) {
      if (start === null) start = now;
      var t = Math.min(1, (now - start) / dur), deg = from + delta * ease(t);
      setRotation(deg);
      var under = Math.floor((((360 - deg) % 360) + 360) % 360 / slice);
      if (under !== lastSlice) { if (lastSlice !== null) tick(); lastSlice = under; }
      if (t < 1) requestAnimationFrame(frame); else done();
    }
    requestAnimationFrame(frame);
  }
  function setBusy(b) { $('spin').disabled = b; $('hub').disabled = b; }

  // ---------- 결과 ----------
  // 받침이 있으면 '으로', 없거나 ㄹ 받침이면 '로'
  function josaRo(word) {
    var c = word.charCodeAt(word.length - 1);
    if (c < 0xac00 || c > 0xd7a3) return '(으)로';
    var jong = (c - 0xac00) % 28;
    return jong === 0 || jong === 8 ? '로' : '으로';
  }
  function showResult(word) {
    lastWinner = word;
    $('resultWord').textContent = word;
    $('resultPost').textContent = josaRo(word) + ' 정했어요';
    $('exclude').textContent = word + ' 빼고 돌리기';
    $('exclude').disabled = active().length <= 2;
    $('result').hidden = false;
    $('again').focus({ preventScroll: true });
    chime();
    if (navigator.vibrate) navigator.vibrate(30);
    burst();
    addHistory(word);
  }
  function hideResult() { $('result').hidden = true; }
  function burst() {
    if (reduceMotion) return;
    var box = $('confetti'), html = '';
    for (var i = 0; i < 16; i++) {
      var ang = (i / 16) * Math.PI * 2, dist = 120 + randomInt(80);
      html += '<i style="--x:' + Math.round(Math.cos(ang) * dist) + 'px;--y:' + Math.round(Math.sin(ang) * dist) + 'px;background:' + COLORS[i % COLORS.length].replace('#', '#') + ';filter:saturate(2.2) brightness(.92)"></i>';
    }
    box.innerHTML = html;
    setTimeout(function () { box.innerHTML = ''; }, 1100);
  }

  // ---------- 최근 결과 ----------
  function addHistory(word) {
    var h = load('history', []);
    var d = new Date();
    h.unshift({ d: (d.getMonth() + 1) + '/' + String(d.getDate()).padStart(2, '0'), topic: current.name, word: word });
    save('history', h.slice(0, 6));
    renderHistory();
  }
  function renderHistory() {
    var h = load('history', []);
    $('history').innerHTML = h.length ? h.map(function (x) { return '<li>' + esc(x.d) + ' ' + esc(x.topic) + ' <b>' + esc(x.word) + '</b></li>'; }).join('') : '<li class="empty">아직 돌린 기록이 없어요</li>';
  }

  // ---------- 탭과 목록 ----------
  function renderTabs() {
    $('tabs').innerHTML = presets.map(function (p) {
      return '<button type="button" role="tab" class="tab" data-id="' + esc(p.id) + '" aria-selected="' + (p === current) + '">' + esc(p.name) + '</button>';
    }).join('');
  }
  function renderItems() {
    $('itemCount').textContent = current.items.length;
    $('itemsNote').textContent = current.id === 'shared' ? '받은 돌림판이에요. 고친 내용은 저장되지 않아요' : LIMITS.min + '~' + LIMITS.max + '개, 이 기기에 저장돼요';
    $('items').innerHTML = current.items.map(function (s, i) {
      var off = excluded.indexOf(s) >= 0;
      return '<li class="' + (off ? 'off' : '') + '"><span class="sw" style="background:' + COLORS[i % COLORS.length] + '"></span><span class="name">' + esc(s) + '</span>' +
        (off ? '<button type="button" class="act" data-back="' + i + '">다시 넣기</button>' : '') +
        '<button type="button" class="act del" data-del="' + i + '" aria-label="' + esc(s) + ' 지우기">×</button></li>';
    }).join('');
    var ex = excluded.length;
    $('excludedHint').hidden = !ex;
    $('excludedHint').innerHTML = ex ? esc(excluded.join(', ')) + ' 빼고 돌리는 중 <button type="button" class="text-btn" id="restoreAll">모두 다시 넣기</button>' : '';
  }
  function renderAll() {
    document.title = SITE.title + ' | ' + SITE.subtitle;
    $('siteTitle').textContent = SITE.title;
    $('subtitle').textContent = SITE.subtitle;
    $('question').textContent = current.question;
    renderTabs(); renderItems(); drawWheel(); renderShare();
  }
  function persist() { if (current.id !== 'shared') save('items:' + current.id, current.items); }
  function msg(t) { $('formMsg').textContent = t || ''; }

  // ---------- 공유 ----------
  function shareUrl() {
    var base = location.href.split('?')[0].split('#')[0];
    return base + '?title=' + encodeURIComponent(current.question) + '&items=' + current.items.map(encodeURIComponent).join(',');
  }
  function renderShare() { $('shareUrl').textContent = decodeURI(shareUrl()); }
  function copy(text, done) {
    var ok = function () { toast(done); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(ok, fallback); else fallback();
    function fallback() {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) { toast('복사가 막혔어요. 주소를 길게 눌러 복사해 주세요'); }
      ta.remove();
    }
  }

  // ---------- 시트(휴대폰) ----------
  var lastFocus = null;
  function openPanel(section) {
    if (window.matchMedia('(min-width: 1024px)').matches) { $(section).scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    lastFocus = document.activeElement;
    $('panel').classList.add('open'); $('scrim').hidden = false;
    var panel = $('panel');
    panel.scrollTop = section === 'editBlock' ? 0 : $(section).offsetTop - 44;
    $('closePanel').focus({ preventScroll: true });
  }
  function closePanel() {
    $('panel').classList.remove('open'); $('scrim').hidden = true;
    if (lastFocus) lastFocus.focus();
  }

  var toastTimer = null;
  function toast(t) {
    var el = $('toast'); el.textContent = t; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  // ---------- 이벤트 ----------
  $('spin').addEventListener('click', spin);
  $('hub').addEventListener('click', spin);
  $('again').addEventListener('click', spin);
  $('closeResult').addEventListener('click', function () { hideResult(); $('spin').focus(); });
  $('exclude').addEventListener('click', function () {
    if (lastWinner && excluded.indexOf(lastWinner) < 0) excluded.push(lastWinner);
    renderItems(); drawWheel(); spin();
  });
  $('copyResult').addEventListener('click', function () {
    copy(current.question + ' ' + lastWinner + '! (오늘은 너로)\n' + shareUrl(), '결과를 복사했어요. 채팅방에 붙여 넣어 보세요');
  });
  $('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab'); if (!b || spinning) return;
    current = presets.filter(function (p) { return p.id === b.dataset.id; })[0];
    excluded = []; hideResult(); msg(''); renderAll();
  });
  $('items').addEventListener('click', function (e) {
    var del = e.target.closest('[data-del]'), back = e.target.closest('[data-back]');
    if (spinning) return;
    if (del) {
      if (current.items.length <= LIMITS.min) { msg('항목은 ' + LIMITS.min + '개 이상 있어야 해요'); return; }
      var name = current.items[+del.dataset.del];
      current.items.splice(+del.dataset.del, 1);
      excluded = excluded.filter(function (s) { return s !== name; });
      msg(''); persist(); hideResult(); renderAll();
    } else if (back) {
      var nm = current.items[+back.dataset.back];
      excluded = excluded.filter(function (s) { return s !== nm; });
      renderItems(); drawWheel();
    }
  });
  $('excludedHint').addEventListener('click', function (e) {
    if (e.target.id === 'restoreAll') { excluded = []; renderItems(); drawWheel(); }
  });
  $('addForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var v = $('newItem').value.replace(/,/g, ' ').trim();
    if (!v) { msg('항목 이름을 적어 주세요'); return; }
    if (current.items.length >= LIMITS.max) { msg('항목은 ' + LIMITS.max + '개까지예요'); return; }
    if (current.items.indexOf(v) >= 0) { msg('이미 있는 항목이에요'); return; }
    current.items.push(v.slice(0, LIMITS.maxLength));
    $('newItem').value = ''; msg(''); persist(); hideResult(); renderAll();
    $('newItem').focus();
  });
  $('resetItems').addEventListener('click', function () {
    current.items = current.defaults.slice(); excluded = [];
    try { localStorage.removeItem(KEY + 'items:' + current.id); } catch (err) { /* 무시 */ }
    msg(''); hideResult(); renderAll(); toast('처음 목록으로 되돌렸어요');
  });
  $('copyUrl').addEventListener('click', function () { copy(shareUrl(), '주소를 복사했어요'); });
  $('nativeShare').addEventListener('click', function () {
    if (navigator.share) navigator.share({ title: SITE.title, text: current.question, url: shareUrl() }).catch(function () {});
    else copy(shareUrl(), '공유하기가 없는 브라우저라 주소를 복사했어요');
  });
  $('openEdit').addEventListener('click', function () { openPanel('editBlock'); });
  $('openShare').addEventListener('click', function () { openPanel('shareBlock'); });
  $('closePanel').addEventListener('click', closePanel);
  $('scrim').addEventListener('click', closePanel);

  document.addEventListener('keydown', function (e) {
    var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if (e.key === 'Escape') { if ($('panel').classList.contains('open')) closePanel(); else hideResult(); }
    if ((e.code === 'Space' || e.key === ' ') && !typing && !/^(BUTTON|A|SUMMARY)$/.test(document.activeElement.tagName)) { e.preventDefault(); spin(); }
  });

  renderAll();
  renderHistory();
})();
