/* M Calc – giao diện, lịch sử, cập nhật. Created by Mondiro */
(function () {
  'use strict';
  const E = window.MEngine;
  const REPO = 'satthupc00/M_Calculator';
  const MAX_HIST = 200, MAX_LEN = 120;
  const $ = id => document.getElementById(id);
  const app = $('app'), exprEl = $('expr'), resEl = $('result'), pad = $('pad'), hlist = $('hlist');
  const Cap = window.Capacitor;
  const isNative = !!(Cap && Cap.isNativePlatform && Cap.isNativePlatform());
  const Updater = isNative ? Cap.registerPlugin('Updater') : null;
  const AppPlugin = isNative && Cap.Plugins ? Cap.Plugins.App : null;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('mcalc.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('mcalc.' + k, JSON.stringify(v)); } catch (e) { /* bỏ qua */ } }
  };

  let expr = store.get('expr', '');
  let justEval = false;
  let history = store.get('history', []);
  let vibrateOn = store.get('vibrate', true);
  // chế độ đổi tiền: nhập Nhân dân tệ, hiện tiền Việt ở góc trên
  let fxOn = store.get('fxOn', false);
  let fxDir = store.get('fxDir', 'cny');          // 'cny': nhập Tệ -> xem VND · 'vnd': nhập VND -> xem Tệ
  let fxRate = store.get('fxRate', 4000);

  /* ---------- bàn phím ---------- */
  const KEYS = [
    ['√', 'fn sci', '√'], ['C', 'c'], ['( )', 'fn', '()'], ['%', 'fn'], ['÷', 'op'],
    ['x<sup>2</sup>', 'fn sci', 'sq'], ['7'], ['8'], ['9'], ['×', 'op'],
    ['π', 'fn sci', 'π'], ['4'], ['5'], ['6'], ['−', 'op'],
    ['x<sup>y</sup>', 'fn sci', '^'], ['1'], ['2'], ['3'], ['+', 'op'],
    ['n!', 'fn sci', '!'], ['000', 'sm', '000'], ['0'], ['.'], ['=', 'eq']
  ];
  const LABEL = { '√': 'Căn bậc hai', C: 'Xoá hết', '()': 'Ngoặc', '%': 'Phần trăm', '÷': 'Chia', sq: 'Bình phương', '×': 'Nhân', 'π': 'Pi',
    '−': 'Trừ', '^': 'Luỹ thừa', '+': 'Cộng', '!': 'Giai thừa', '000': 'Ba số 0', '.': 'Dấu thập phân', '=': 'Bằng' };
  pad.innerHTML = KEYS.map(([label, cls, key]) => {
    const k = key || label;
    return `<button type="button" class="k ${cls || ''}" data-k="${k}" aria-label="${LABEL[k] || k}"><span>${label}</span></button>`;
  }).join('');

  pad.addEventListener('pointerdown', e => {
    const b = e.target.closest('.k'); if (!b) return;
    e.preventDefault();
    b.classList.add('down');
    buzz();
    press(b.dataset.k);
  });
  const up = () => pad.querySelectorAll('.k.down').forEach(b => setTimeout(() => b.classList.remove('down'), 70));
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up); pad.addEventListener('pointerleave', up);
  // bấm bằng bàn phím/Enter khi focus vào phím (truy cập)
  pad.addEventListener('click', e => { if (e.detail === 0) { const b = e.target.closest('.k'); if (b) press(b.dataset.k); } });

  function buzz() { if (vibrateOn && navigator.vibrate) navigator.vibrate(8); }

  const last = () => expr.slice(-1);
  const isOp = c => E.OPS.includes(c);
  const endsOperand = () => /[\d.)%!π]$/.test(expr);
  const curNumber = () => (expr.match(/[\d.]+$/) || [''])[0];

  function press(k) {
    if (justEval) {
      justEval = false;
      if (/^[\d.]$/.test(k) || k === 'π' || k === '√') expr = '';
    }
    const L = last();
    if (/^\d$/.test(k)) {
      if (/[)%!π]$/.test(expr)) expr += '×';
      const n = curNumber();
      if (n === '0') expr = expr.slice(0, -1);
      if (n.replace('.', '').length >= 15) return shake();
      expr += k;
    } else if (k === '.') {
      const n = curNumber();
      if (n.includes('.')) return shake();
      if (/[)%!π]$/.test(expr)) expr += '×';
      expr += n ? '.' : '0.';
    } else if (isOp(k)) {
      if (!expr) { if (k === '−') expr = '−'; else return shake(); }
      else if (L === '(' || L === '√') { if (k === '−') expr += '−'; else return shake(); }
      else if (isOp(L)) {
        if (k === '−' && '×÷^'.includes(L)) expr += '−';
        else if (expr.length === 1) return;
        else { expr = expr.replace(/[+−×÷^]+$/, ''); expr += k; }
      } else expr += k;
    } else if (k === '%' || k === '!') {
      if (!/[\d)π]$/.test(expr)) return shake();
      expr += k;
    } else if (k === 'sq') {
      if (!endsOperand()) return shake();
      expr += '^2';
    } else if (k === '√' || k === 'π') {
      expr += k;
    } else if (k === '()') {
      const open = (expr.match(/\(/g) || []).length - (expr.match(/\)/g) || []).length;
      if (open > 0 && endsOperand()) expr += ')';
      else expr += endsOperand() ? '×(' : '(';
    } else if (k === '000') {
      const n = curNumber();
      if (!n || n === '0' || /[)%!π]$/.test(expr)) return shake();   // 000 chỉ đi sau một số
      if (n.replace('.', '').length + 3 > 15) return shake();
      expr += '000';
    } else if (k === 'C') {
      expr = '';
    } else if (k === '=') {
      return equals();
    }
    if (expr.length > MAX_LEN) { expr = expr.slice(0, MAX_LEN); shake(); }
    render();
  }

  function equals() {
    if (!expr) return;
    const r = E.evaluate(expr, true);
    if (!r.ok) {
      resEl.textContent = E.ERR[r.error] || 'Sai định dạng';
      resEl.className = 'result err';
      return shake();
    }
    const hasCalc = /[+−×÷^%!√π(]/.test(expr.replace(/^−/, ''));
    if (justEval && !hasCalc) return;                       // bấm = lặp lại: không lưu trùng
    if (hasCalc || fxOn) addHistory(expr, r.value);
    const s = String(r.value);
    expr = s.includes('e') ? '' : s.replace('-', '−');
    justEval = true;
    render(s.includes('e') ? E.formatNumber(r.value) : null);
    updateFx(r.value);
    resEl.textContent = '';
    exprEl.classList.remove('flash'); void exprEl.offsetWidth;
    resEl.className = 'result';
  }

  function backspace() {
    justEval = false;
    if (expr.endsWith('(−')) expr = expr.slice(0, -2);
    else expr = expr.slice(0, -1);
    render();
  }

  function shake() {
    if (navigator.vibrate && vibrateOn) navigator.vibrate([0, 20, 40, 20]);
    exprEl.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-8px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }],
      { duration: 220, easing: 'ease-out' });
  }

  /* ---------- hiển thị ---------- */
  function markup(s) {
    return E.prettyExpr(s)
      .replace(/[+−×÷^]/g, m => `<span class="op">${m}</span>`)
      .replace(/[√π%!]/g, m => `<span class="fn">${m}</span>`);
  }

  function fit() {
    const wide = window.innerWidth >= 600, low = window.innerHeight <= 500;
    const max = low ? 40 : wide ? 66 : 58, min = 28;
    exprEl.classList.remove('wrap');
    let f = max; exprEl.style.fontSize = f + 'px';
    while (exprEl.scrollWidth > exprEl.clientWidth && f > min) { f -= 2; exprEl.style.fontSize = f + 'px'; }
    if (exprEl.scrollWidth > exprEl.clientWidth) exprEl.classList.add('wrap');
  }

  function render(override) {
    store.set('expr', expr);
    if (override) { exprEl.textContent = override; exprEl.className = 'expr'; fit(); return; }
    exprEl.innerHTML = expr ? markup(expr) : '0';
    exprEl.className = 'expr' + (expr ? '' : ' empty');
    fit();
    // xem trước kết quả ngay khi đang gõ
    resEl.className = 'result';
    const calc = /[+−×÷^%!√π(]/.test(expr.replace(/^−/, ''));
    if (calc && !justEval) {
      const r = E.evaluate(expr, true);
      resEl.textContent = r.ok ? E.formatNumber(r.value) : '';
    } else resEl.textContent = '';
    const cur = expr ? E.evaluate(expr, true) : { ok: true, value: 0 };
    updateFx(cur.ok ? cur.value : null);
  }

  /* ---------- đổi tiền ¥ <-> ₫ ---------- */
  // đổi 1 số theo chiều dir, trả về chuỗi đã định dạng kèm ký hiệu tiền
  function convert(v, dir, rate) {
    if (dir === 'vnd') return '¥ ' + E.formatNumber(Math.round(v / rate * 100) / 100);
    return E.formatNumber(Math.round(v * rate)) + ' ₫';
  }
  function updateFx(v) {
    $('fx').hidden = !fxOn;
    app.classList.toggle('fx-on', fxOn);
    app.dataset.fx = fxDir;
    const b = $('btnFx');
    b.classList.toggle('on', fxOn);
    b.textContent = fxDir === 'vnd' ? '₫' : '¥';
    if (!fxOn) return;
    if (v != null) $('fxVal').textContent = convert(v, fxDir, fxRate);
    $('fxTag').textContent = fxDir === 'vnd' ? 'TỆ' : 'VND';
    $('fxRateTxt').textContent = '1 ¥ = ' + E.formatNumber(fxRate) + ' ₫';
  }
  // nút ¥: bật/tắt chế độ đổi tiền (không hiện thông báo để khỏi che bàn phím)
  $('btnFx').onclick = () => { fxOn = !fxOn; store.set('fxOn', fxOn); buzz(); render(); };
  // chạm vào khung đổi tiền: đảo chiều ¥ -> ₫ / ₫ -> ¥
  $('fx').onclick = () => {
    fxDir = fxDir === 'vnd' ? 'cny' : 'vnd'; store.set('fxDir', fxDir); buzz();
    $('fx').animate([{ transform: 'scale(.94)' }, { transform: 'scale(1)' }], { duration: 260, easing: 'cubic-bezier(.34,1.56,.64,1)' });
    render();
  };

  /* ---------- lịch sử ---------- */
  function addHistory(e, v) {
    const h = { e, v, t: Date.now() };
    if (fxOn) { h.fx = fxRate; h.dir = fxDir; }
    history.unshift(h);
    if (history.length > MAX_HIST) history.length = MAX_HIST;
    store.set('history', history);
    renderHistory();
  }

  function when(t) {
    const d = new Date(t), now = new Date();
    const hm = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 864e5);
    if (diff === 0) return 'Hôm nay ' + hm;
    if (diff === 1) return 'Hôm qua ' + hm;
    return d.toLocaleDateString('vi-VN') + ' ' + hm;
  }

  const TRASH = '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';
  function renderHistory() {
    $('histCount').textContent = history.length ? history.length + '/' + MAX_HIST : '';
    $('hclear').disabled = !history.length;
    if (!history.length) {
      hlist.innerHTML = '<div class="empty-h"><b>Chưa có phép tính nào</b>Bấm = để lưu phép tính vào đây</div>';
      return;
    }
    hlist.innerHTML = '<div class="hint">Chạm để dùng lại · Vuốt ngang để xoá</div>' + history.map((h, i) =>
      `<div class="hi-wrap" data-i="${i}"><div class="hi-bg">${TRASH}${TRASH}</div>
        <div class="hi"><div class="t">${when(h.t)}</div><div class="e">${markup(h.e)}</div><div class="r">= ${h.fx ? (h.dir === 'vnd' ? '₫ ' : '¥ ') : ''}${E.formatNumber(h.v)}</div>${h.fx ? `<div class="v">≈ ${convert(h.v, h.dir || 'cny', h.fx)}</div>` : ''}</div></div>`).join('');
  }

  // vuốt để xoá (Pointer Events)
  let sw = null;
  hlist.addEventListener('pointerdown', e => {
    const item = e.target.closest('.hi'); if (!item) return;
    sw = { item, wrap: item.parentElement, x: e.clientX, y: e.clientY, dx: 0, drag: false, id: e.pointerId };
  });
  hlist.addEventListener('pointermove', e => {
    if (!sw || e.pointerId !== sw.id) return;
    const dx = e.clientX - sw.x, dy = e.clientY - sw.y;
    if (!sw.drag) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { sw = null; return; }
      if (Math.abs(dx) > 10) { sw.drag = true; sw.item.classList.add('dragging'); try { sw.item.setPointerCapture(e.pointerId); } catch (_) {} }
      else return;
    }
    sw.dx = dx;
    sw.item.style.transform = `translateX(${dx}px)`;
    sw.wrap.querySelector('.hi-bg').style.opacity = Math.min(1, Math.abs(dx) / (sw.item.offsetWidth * .35));
  });
  function endSwipe(e) {
    if (!sw) return;
    const s = sw; sw = null;
    if (!s.drag) { if (e.type === 'pointerup') useHistory(+s.wrap.dataset.i); return; }
    s.item.classList.remove('dragging');
    const w = s.item.offsetWidth;
    if (Math.abs(s.dx) > w * .35) {
      s.item.style.transform = `translateX(${s.dx > 0 ? w : -w}px)`;
      setTimeout(() => {
        s.wrap.style.height = s.wrap.offsetHeight + 'px'; void s.wrap.offsetHeight;
        s.wrap.style.height = '0px'; s.wrap.style.opacity = '0';
        setTimeout(() => deleteHistory(+s.wrap.dataset.i), 220);
      }, 180);
      buzz();
    } else {
      s.item.style.transform = '';
      s.wrap.querySelector('.hi-bg').style.opacity = 0;
    }
  }
  hlist.addEventListener('pointerup', endSwipe);
  hlist.addEventListener('pointercancel', endSwipe);

  function deleteHistory(i) {
    const removed = history.splice(i, 1)[0];
    store.set('history', history); renderHistory();
    toast('Đã xoá 1 phép tính', 'Hoàn tác', () => {
      history.splice(Math.min(i, history.length), 0, removed);
      store.set('history', history); renderHistory();
    });
  }

  function useHistory(i) {
    const h = history[i]; if (!h) return;
    expr = h.e; justEval = false; render();
    setHist(false);
  }

  let clearTimer = 0;
  $('hclear').onclick = () => {
    const b = $('hclear');
    if (!b.classList.contains('confirm')) {
      b.classList.add('confirm'); b.textContent = 'Bấm lần nữa để xoá hết';
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => { b.classList.remove('confirm'); b.textContent = 'Xoá lịch sử'; }, 3000);
      return;
    }
    clearTimeout(clearTimer); b.classList.remove('confirm'); b.textContent = 'Xoá lịch sử';
    const old = history; history = []; store.set('history', history); renderHistory();
    toast('Đã xoá toàn bộ lịch sử', 'Hoàn tác', () => { history = old; store.set('history', history); renderHistory(); });
  };

  // màn ngoài: mở/đóng bảng lịch sử
  function setHist(open) {
    app.classList.toggle('hist-open', open);
    $('btnHist').classList.toggle('on', open);
  }
  $('btnHist').onclick = () => setHist(!app.classList.contains('hist-open'));
  function placeSheet() {
    const top = pad.getBoundingClientRect().top - app.getBoundingClientRect().top;
    app.style.setProperty('--sheet-top', top + 'px');
    fit();
  }
  window.addEventListener('resize', placeSheet);

  /* ---------- nút công cụ ---------- */
  $('btnCopy').onclick = async () => {
    const r = E.evaluate(expr, true);
    const text = r.ok ? String(r.value) : '';
    if (!text) return toast('Chưa có kết quả để sao chép');
    try { await navigator.clipboard.writeText(text); toast('Đã sao chép ' + E.formatNumber(r.value)); }
    catch (e) { toast('Không sao chép được'); }
  };
  const back = $('btnBack');
  let holdT = 0, held = false;
  back.addEventListener('pointerdown', () => { held = false; holdT = setTimeout(() => { held = true; buzz(); expr = ''; justEval = false; render(); }, 500); });
  back.addEventListener('pointerup', () => { clearTimeout(holdT); if (!held) { buzz(); backspace(); } });
  back.addEventListener('pointerleave', () => clearTimeout(holdT));
  back.addEventListener('click', e => { if (e.detail === 0) backspace(); });

  // bàn phím vật lý (bàn phím Bluetooth / test trên máy tính)
  document.addEventListener('keydown', e => {
    if (!$('mSettings').hidden || !$('mWhatsNew').hidden || !$('mUpdate').hidden) { if (e.key === 'Escape') closeModals(); return; }
    const map = { '+': '+', '-': '−', '*': '×', '/': '÷', '^': '^', '%': '%', '!': '!', '.': '.', ',': '.', Enter: '=', '=': '=', Escape: 'C', '(': '()', ')': '()' };
    if (/^\d$/.test(e.key)) press(e.key);
    else if (map[e.key]) { e.preventDefault(); press(map[e.key]); }
    else if (e.key === 'Backspace') backspace();
    else return;
    const b = pad.querySelector(`[data-k="${CSS.escape(/^\d$/.test(e.key) ? e.key : map[e.key] || '')}"]`);
    if (b) { b.classList.add('down'); setTimeout(() => b.classList.remove('down'), 90); }
  });

  /* ---------- toast ---------- */
  let toastT = 0;
  function toast(text, action, fn) {
    const t = $('toast'), a = $('toastAction');
    $('toastText').textContent = text;
    a.hidden = !action; a.textContent = action || '';
    a.onclick = () => { t.classList.remove('show'); fn && fn(); };
    t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), action ? 4000 : 2000);
  }

  /* ---------- hộp thoại ---------- */
  function openModal(id) { const m = $(id); m.hidden = false; m.classList.remove('closing'); }
  function closeModals() {
    document.querySelectorAll('.modal:not([hidden])').forEach(m => {
      m.classList.add('closing');
      setTimeout(() => { m.hidden = true; m.classList.remove('closing'); }, 200);
    });
  }
  document.querySelectorAll('.modal').forEach(m => m.addEventListener('click', e => {
    if (e.target === m || e.target.closest('[data-close]')) closeModals();
  }));
  $('btnSettings').onclick = () => openModal('mSettings');
  $('optRate').value = fxRate;
  $('optRate').onchange = e => {
    const r = parseFloat(String(e.target.value).replace(/[^\d.]/g, ''));
    if (r > 0) { fxRate = r; store.set('fxRate', fxRate); render(); toast('Tỷ giá mới: 1 ¥ = ' + E.formatNumber(fxRate) + ' ₫'); }
    else e.target.value = fxRate;
  };
  $('optVibrate').checked = vibrateOn;
  $('optVibrate').onchange = e => { vibrateOn = e.target.checked; store.set('vibrate', vibrateOn); };

  /* ---------- What's new ---------- */
  let whatsnew = null;
  fetch('whatsnew.json').then(r => r.json()).then(j => { whatsnew = j; }).catch(() => {});
  $('btnWhatsNew').onclick = () => {
    const j = whatsnew || {};
    const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const grp = (title, arr) => arr && arr.length ? `<div class="wn-group"><h4>${title}</h4><ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div>` : '';
    const d = j.date ? new Date(j.date + 'T00:00:00').toLocaleDateString('vi-VN') : '';
    $('wnBody').innerHTML = `<div class="wn-ver">v${esc(j.version || appVersion)}${d ? ' · ' + d : ''}</div>` +
      grp('Mới', j.new) + grp('Cải thiện', j.improved) + grp('Sửa lỗi', j.fixed) +
      (pending ? `<p class="upd-status ok">Có bản mới v${esc(pending.ver)} <button class="btn" id="wnUpd" type="button">Cập nhật</button></p>` : '');
    const u = $('wnUpd'); if (u) u.onclick = () => { closeModals(); setTimeout(showUpdate, 220); };
    openModal('mWhatsNew');
  };

  /* ---------- tự cập nhật qua GitHub Releases ---------- */
  let appVersion = window.APP_VERSION || '0.0.0';
  let pending = null, checking = false;
  const cmp = (a, b) => {
    const x = a.split('.').map(Number), y = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); }
    return 0;
  };
  function setUpdState(cls, msg, msgCls) {
    const b = $('btnUpdate');
    b.classList.remove('ok', 'checking', 'has');
    if (cls) b.classList.add(cls);
    $('latest').hidden = cls !== 'ok';
    b.title = 'Kiểm tra cập nhật' + (msg ? ' · ' + msg : '');
    const s = $('updStatus'); s.textContent = msg || ''; s.className = 'upd-status ' + (msgCls || '');
  }
  async function checkUpdate(manual) {
    if (checking) return;
    checking = true; setUpdState('checking', 'Đang kiểm tra…');
    try {
      const r = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, { cache: 'no-store', headers: { Accept: 'application/vnd.github+json' } });
      if (r.status === 404) { pending = null; setUpdState('ok', 'Đã là bản mới nhất', 'ok'); return; }
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const ver = String(j.tag_name || '').replace(/^v/i, '');
      const asset = (j.assets || []).find(a => /\.apk$/i.test(a.name));
      if (ver && asset && cmp(ver, appVersion) > 0) {
        pending = { ver, notes: j.body || '', url: asset.browser_download_url };
        setUpdState('has', 'Có bản mới v' + ver, 'ok');
        if (manual) showUpdate(); else toast('Có bản mới v' + ver, 'Xem', showUpdate);
      } else {
        pending = null; setUpdState('ok', 'Đã là bản mới nhất', 'ok');
        if (manual) toast('Bạn đang dùng bản mới nhất v' + appVersion);
      }
    } catch (e) {
      setUpdState('', 'Không kiểm tra được, hãy thử lại', 'err');
      if (manual) toast('Không kiểm tra được cập nhật. Kiểm tra mạng rồi thử lại');
    } finally { checking = false; }
  }
  function mdToHtml(md) {
    const esc = s => s.replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    return md.split(/\r?\n/).map(l => {
      if (/^#+\s/.test(l)) return `<b>${esc(l.replace(/^#+\s/, ''))}</b><br>`;
      if (/^[-*]\s/.test(l)) return '• ' + esc(l.slice(2)) + '<br>';
      return l.trim() ? esc(l) + '<br>' : '';
    }).join('').replace(/\*\*(.+?)\*\*/g, '$1');
  }
  function showUpdate() {
    if (!pending) return;
    $('updTitle').textContent = 'Có bản mới v' + pending.ver;
    $('updNotes').innerHTML = mdToHtml(pending.notes) || 'Bản cập nhật mới cho M Calc.';
    $('updProgress').hidden = true; $('btnInstall').disabled = false; $('btnInstall').textContent = 'Cập nhật ngay';
    openModal('mUpdate');
  }
  $('btnInstall').onclick = async () => {
    if (!pending) return;
    if (!isNative) { window.open(pending.url, '_blank'); return; }
    const btn = $('btnInstall'), bar = $('updProgress');
    btn.disabled = true; btn.textContent = 'Đang tải…'; bar.hidden = false; bar.firstElementChild.style.width = '0';
    const h = await Updater.addListener('progress', ev => { bar.firstElementChild.style.width = ev.percent + '%'; btn.textContent = 'Đang tải… ' + ev.percent + '%'; });
    try {
      await Updater.install({ url: pending.url });
      btn.textContent = 'Đang mở trình cài đặt…';
    } catch (e) {
      btn.disabled = false; btn.textContent = 'Cập nhật ngay'; bar.hidden = true;
      if (String(e.message || e).includes('NEED_PERMISSION')) toast('Hãy bật "Cho phép cài ứng dụng" cho M Calc rồi bấm Cập nhật lại');
      else toast('Tải bản cập nhật thất bại, thử lại nhé');
    } finally { h && h.remove && h.remove(); }
  };
  $('btnUpdate').onclick = () => pending ? showUpdate() : checkUpdate(true);
  $('btnCheck2').onclick = () => checkUpdate(true);

  /* ---------- nút Back của Android ---------- */
  if (AppPlugin) {
    AppPlugin.addListener('backButton', () => {
      if (document.querySelector('.modal:not([hidden])')) closeModals();
      else if (app.classList.contains('hist-open')) setHist(false);
      else AppPlugin.exitApp();
    });
  }

  /* ---------- khởi động ---------- */
  async function init() {
    if (Updater) { try { appVersion = (await Updater.info()).version || appVersion; } catch (e) { /* dùng version.js */ } }
    $('verText').textContent = 'v' + appVersion;
    renderHistory();
    render();
    requestAnimationFrame(placeSheet);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    setTimeout(() => checkUpdate(false), 1200);
  }
  init();
})();
