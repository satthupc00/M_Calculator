// Ghi số phiên bản từ package.json vào www/version.js và chép capacitor.js
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const v = require(path.join(root, 'package.json')).version;
fs.writeFileSync(path.join(root, 'www/version.js'), `window.APP_VERSION = '${v}';\n`);
fs.copyFileSync(path.join(root, 'node_modules/@capacitor/core/dist/capacitor.js'), path.join(root, 'www/capacitor.js'));
const wn = JSON.parse(fs.readFileSync(path.join(root, 'www/whatsnew.json'), 'utf8'));
if (wn.version !== v) { console.error(`whatsnew.json (${wn.version}) chưa cập nhật cho bản ${v}`); process.exit(1); }
console.log('Phiên bản', v);
