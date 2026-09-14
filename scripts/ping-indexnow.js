const http = require('http');
const https = require('https');

const HOST = 'www.pingclass.in';
const KEY = 'a3099a2b57bd93d3b44ec10cc9a2984a';
const KEY_LOCATION = 'https://www.pingclass.in/' + KEY + '.txt';

function fetch(url) {
  return new Promise((resolve, reject) => {
    (url.startsWith('https') ? https : http).get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

async function main() {
  const sitemap = await fetch('https://' + HOST + '/sitemap.xml');
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
  if (!urls.length) { console.log('ERROR: 0 URLs parsed from sitemap'); process.exit(1); }

  const payload = JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: urls });
  const req = http.request({
    hostname: 'api.indexnow.org',
    path: '/IndexNow',
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(payload) }
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => {
      console.log('Submitted ' + urls.length + ' URLs -> IndexNow ' + res.statusCode + (d ? ' ' + d : ''));
      process.exit(res.statusCode === 202 || res.statusCode === 200 ? 0 : 1);
    });
  });
  req.on('error', e => { console.log('ERROR: ' + e.message); process.exit(1); });
  req.write(payload);
  req.end();
}
main();