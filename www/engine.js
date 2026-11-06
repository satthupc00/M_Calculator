/* M Calc – bộ tính toán. Ký hiệu nội bộ: + − × ÷ ^ % ! √ π ( ) và số.
 * Không dùng eval: tự phân tích cú pháp (recursive descent). */
(function (root) {
  'use strict';
  const OPS = '+−×÷^';

  function tokenize(s) {
    const t = [];
    for (let i = 0; i < s.length;) {
      const c = s[i];
      if (/[\d.]/.test(c)) {
        let j = i;
        while (j < s.length && /[\d.]/.test(s[j])) j++;
        const raw = s.slice(i, j);
        if ((raw.match(/\./g) || []).length > 1 || raw === '.') throw new Error('bad');
        t.push({ k: 'n', v: parseFloat(raw) });
        i = j;
      } else if ('+−×÷^%!√π()'.includes(c)) { t.push({ k: c }); i++; }
      else if (c === '-') { t.push({ k: '−' }); i++; }
      else if (c === '*') { t.push({ k: '×' }); i++; }
      else if (c === '/') { t.push({ k: '÷' }); i++; }
      else if (c === ' ' || c === ',') i++;
      else throw new Error('bad');
    }
    return t;
  }

  function fact(n) {
    if (n < 0 || !Number.isInteger(n)) throw new Error('fact');
    if (n > 170) return Infinity;
    let r = 1; for (let i = 2; i <= n; i++) r *= i; return r;
  }

  function parse(tokens) {
    let p = 0;
    const peek = () => tokens[p] && tokens[p].k;
    const startsPrimary = k => k === 'n' || k === '(' || k === 'π' || k === '√';

    // a + b% => a + a*b/100 (giống máy tính điện thoại)
    function expr() {
      let a = term().v;
      while (peek() === '+' || peek() === '−') {
        const op = tokens[p++].k;
        const b = term();
        const bv = b.pct ? a * b.v : b.v;
        a = op === '+' ? a + bv : a - bv;
      }
      return a;
    }
    function term() {
      let r = unary();
      for (;;) {
        const k = peek();
        if (k === '×' || k === '÷') {
          p++;
          const b = unary().v;
          if (k === '÷' && b === 0) throw new Error('div0');
          r = { v: k === '×' ? r.v * b : r.v / b };
        } else if (startsPrimary(k)) {          // nhân ngầm: 2π, 3(4), 2√9
          r = { v: r.v * unary().v };
        } else return r;
      }
    }
    function unary() {
      if (peek() === '−') { p++; const u = unary(); return { v: -u.v, pct: u.pct }; }
      if (peek() === '+') { p++; return unary(); }
      return power();
    }
    function power() {
      const b = postfix();
      if (peek() === '^') { p++; return { v: Math.pow(b.v, unary().v) }; }
      return b;
    }
    function postfix() {
      let r = { v: primary() };
      for (;;) {
        if (peek() === '%') { p++; r = { v: r.v / 100, pct: true }; }
        else if (peek() === '!') { p++; r = { v: fact(r.v) }; }
        else return r;
      }
    }
    function primary() {
      const k = peek();
      if (k === 'n') return tokens[p++].v;
      if (k === 'π') { p++; return Math.PI; }
      if (k === '√') {
        p++;
        const v = unary().v;
        if (v < 0) throw new Error('sqrt');
        return Math.sqrt(v);
      }
      if (k === '(') {
        p++;
        const v = expr();
        if (peek() === ')') p++;               // cho phép thiếu ngoặc đóng
        return v;
      }
      throw new Error('bad');
    }
    const v = expr();
    if (p !== tokens.length) throw new Error('bad');
    return v;
  }

  /** Trả về {ok, value} hoặc {ok:false, error}. Bỏ qua toán tử thừa ở cuối (dùng cho xem trước). */
  function evaluate(s, lenient) {
    let src = s;
    if (lenient) {
      while (src && (OPS.includes(src.slice(-1)) || src.slice(-1) === '(' || src.slice(-1) === '√')) src = src.slice(0, -1);
    }
    if (!src) return { ok: false, error: 'empty' };
    try {
      let v = parse(tokenize(src));
      if (!isFinite(v)) return { ok: false, error: 'overflow' };
      v = +v.toPrecision(12);
      if (Object.is(v, -0)) v = 0;
      return { ok: true, value: v };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }

  function groupInt(i) { return i.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }

  /** Định dạng số kết quả: 1260 -> "1,260" */
  function formatNumber(v) {
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e15 || a < 1e-9)) return v.toExponential(6).replace('e+', 'e');
    const s = String(v);
    const [i, d] = s.split('.');
    return groupInt(i) + (d ? '.' + d : '');
  }

  /** Thêm dấu phẩy hàng nghìn vào chuỗi biểu thức đang gõ */
  function prettyExpr(s) {
    return s.replace(/\d+(\.\d*)?/g, m => {
      const [i, d] = m.split('.');
      return groupInt(i) + (d !== undefined ? '.' + d : '');
    });
  }

  const ERR = { div0: 'Không thể chia cho 0', overflow: 'Số quá lớn', sqrt: 'Lỗi căn bậc hai', fact: 'Lỗi giai thừa', bad: 'Sai định dạng' };

  root.MEngine = { evaluate, formatNumber, prettyExpr, OPS, ERR };
  if (typeof module !== 'undefined') module.exports = root.MEngine;
})(typeof window !== 'undefined' ? window : globalThis);
