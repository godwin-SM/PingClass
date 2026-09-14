// One-time helper: get a Gmail refresh token for the CEO support-inbox sync.
// Usage:  node gmail-oauth-helper.mjs <client_id> <client_secret>
// Prints an approval URL, opens the browser (log in as pingclassoff@gmail.com),
// then prints the refresh token. Uses PKCE, which Google requires for desktop apps.

import http from 'node:http';
import { exec } from 'node:child_process';
import { randomBytes, createHash } from 'node:crypto';

const [clientId, clientSecret] = process.argv.slice(2);
if (!clientId || !clientSecret) {
  console.error('Usage: node gmail-oauth-helper.mjs <client_id> <client_secret>');
  process.exit(1);
}

const PORT = 8899;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify';

const verifier = randomBytes(64).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&response_type=code&scope=${encodeURIComponent(SCOPES)}` +
  `&code_challenge=${encodeURIComponent(challenge)}&code_challenge_method=S256` +
  '&access_type=offline&prompt=consent';

console.log('\nOpening your browser… approve access with the GMAIL MAILBOX account (pingclassoff@gmail.com).');
console.log('If it does not open, paste this URL manually:\n\n' + authUrl + '\n');

if (process.platform === 'win32') exec(`start "" "${authUrl}"`);
else exec(`open "${authUrl}"`);

http.createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  const code = u.searchParams.get('code');
  const err = u.searchParams.get('error');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  if (!code) {
    res.end('<h3>Not authorized' + (err ? ': ' + err : '') + '</h3><p>Close this tab and run the script again.</p>');
    return;
  }
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: 'authorization_code',
    code_verifier: verifier,
  });
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  const j = await tokenRes.json();
  if (!j.refresh_token) {
    res.end('<h3>Exchange failed: ' + JSON.stringify(j) + '</h3><p>Close and retry.</p>');
    return;
  }
  res.end('<h3>Success! You can close this tab.</h3>');
  console.log('\n=== REFRESH TOKEN (send this to the assistant to store as a secret) ===\n');
  console.log(j.refresh_token);
  console.log('\n========================================================================\n');
  process.exit(0);
}).listen(PORT, () => console.log(`Waiting for approval on ${REDIRECT}…`));