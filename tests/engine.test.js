const E = require('../www/engine.js');
const cases = [
  ['235+650+375', 1260], ['0.1+0.2', 0.3], ['2+3×4', 14], ['(2+3)×4', 20], ['10÷4', 2.5],
  ['−5+2', -3], ['2^3^2', 512], ['−2^2', -4], ['200+10%', 220], ['200−10%', 180], ['50%', 0.5],
  ['200×10%', 20], ['5!', 120], ['√9+1', 4], ['2π', 2 * Math.PI], ['3(4)', 12], ['(2+3', 5],
  ['2√16', 8], ['1.5×12', 18], ['√(16+9)', 5], ['3×−2', -6],
];
let fail = 0;
for (const [s, want] of cases) {
  const r = E.evaluate(s);
  if (!r.ok || Math.abs(r.value - +want.toPrecision(12)) > 1e-9) { fail++; console.log('FAIL', s, r, want); }
}
const lenient = [['235+650+', 885], ['12×(', 12], ['5', 5]];
for (const [s, want] of lenient) { const r = E.evaluate(s, true); if (!r.ok || r.value !== want) { fail++; console.log('FAIL lenient', s, r); } }
for (const s of ['5÷0', '1..2', '√(−4)', '(−1)!']) { const r = E.evaluate(s); if (r.ok) { fail++; console.log('FAIL should error', s, r); } }
if (E.formatNumber(1260) !== '1,260' || E.formatNumber(-1234567.5) !== '-1,234,567.5') { fail++; console.log('FAIL format'); }
if (E.prettyExpr('1500×12.50') !== '1,500×12.50') { fail++; console.log('FAIL pretty', E.prettyExpr('1500×12.50')); }
console.log(fail ? fail + ' lỗi' : 'Tất cả ' + (cases.length + 9) + ' phép thử đều đúng');
process.exit(fail ? 1 : 0);
