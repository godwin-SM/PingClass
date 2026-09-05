from flask import Flask, Response, send_from_directory, request
import gzip
import json
import os

def _load_dotenv(path=".env"):
    try:
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, _, value = line.partition("=")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = value
    except FileNotFoundError:
        pass

_load_dotenv()

app = Flask(__name__, static_folder='.')

# Only static frontend assets are servable. Dotfiles (.env), source files
# (.py, .toml, .sql) and other non-web files are never served.
ALLOWED_EXTENSIONS = {
    '.html', '.js', '.css', '.png', '.jpg', '.jpeg', '.gif',
    '.svg', '.ico', '.woff', '.woff2', '.ttf', '.txt', '.webmanifest', '.map'
}

def _is_servable(filename):
    if filename.startswith('.'):
        return False
    _, ext = os.path.splitext(filename)
    return ext.lower() in ALLOWED_EXTENSIONS

@app.after_request
def maybe_gzip(response):
    # Compress text assets when the client accepts gzip. Saves ~60-70% on the
    # bundled JS/CSS and HTML.
    path = request.path
    if 'gzip' not in request.headers.get('Accept-Encoding', ''):
        return response
    if not (path == '/' or path.endswith(('.html', '.js', '.css', '.svg', '.json', '.webmanifest', '.txt'))):
        return response
    if response.mimetype and response.mimetype.startswith('image'):
        return response
    try:
        if getattr(response, 'direct_passthrough', False):
            data = b''.join(response.response)
            # b''.join consumes the passthrough file wrapper, so re-bind the
            # bytes we just read. Without this, small files that skip gzip
            # below stream 0 bytes while Content-Length still says N, which
            # browsers reject as ERR_CONTENT_LENGTH_MISMATCH.
            response.set_data(data)
            response.direct_passthrough = False
        else:
            data = response.get_data()
    except Exception:
        return response
    if len(data) < 500:
        return response
    gz = gzip.compress(data, 6)
    if len(gz) >= len(data):
        return response
    response.set_data(gz)
    response.direct_passthrough = False
    response.headers['Content-Encoding'] = 'gzip'
    response.headers['Vary'] = 'Accept-Encoding'
    response.headers['Content-Length'] = str(len(gz))
    return response

# Demo-hub pages embed the dashboards in same-origin iframes; everything
# else stays locked down (no framing at all).
FRAMER_PAGES = {'demo-dashboard.html'}
FRAMEABLE_PAGES = {'admin-dashboard.html', 'teacher-dashboard.html', 'parent-dashboard.html'}

@app.after_request
def security_headers(response):
    file = os.path.basename(request.path) or ''
    frameable = file in FRAMEABLE_PAGES
    framer = file in FRAMER_PAGES
    response.headers['X-Frame-Options'] = 'SAMEORIGIN' if frameable else 'DENY'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
    response.headers['Permissions-Policy'] = (
        'camera=(), microphone=(), geolocation=(), usb=(), serial=(), '
        'accelerometer=(), gyroscope=(), magnetometer=()'
    )
    response.headers['Strict-Transport-Security'] = 'max-age=63072000; includeSubDomains; preload'
    csp = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://*.razorpay.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.razorpay.com; "
        "font-src 'self' https://fonts.gstatic.com https://*.razorpay.com; "
        "img-src 'self' data: https://*.razorpay.com; "
        "connect-src 'self' https://evrqzgjksmidqhzvckhq.supabase.co wss://evrqzgjksmidqhzvckhq.supabase.co https://*.razorpay.com; "
    )
    csp += "frame-src 'self' https://*.razorpay.com; " if framer else "frame-src https://*.razorpay.com; "
    csp += "object-src 'none'; base-uri 'self'; "
    csp += "frame-ancestors 'self'" if frameable else "frame-ancestors 'none'"
    response.headers['Content-Security-Policy'] = csp
    if request.path == '/' or request.path.endswith(('.js', '.css', '.html')):
        response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response.headers['Pragma'] = 'no-cache'
        response.headers['Expires'] = '0'
    return response

@app.route('/')
def index():
    return send_from_directory('.', 'admin-dashboard.html')

@app.route('/config.js')
def serve_config():
    config = {
        'RAZORPAY_KEY_ID': os.environ.get('RAZORPAY_KEY_ID', 'rzp_test_TOsCfA6By4dooF'),
        'SUPABASE_URL': os.environ.get('SUPABASE_URL', 'https://evrqzgjksmidqhzvckhq.supabase.co'),
        'SUPABASE_ANON_KEY': os.environ.get(
            'SUPABASE_ANON_KEY',
            'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV2cnF6Z2prc21pZHFoenZja2hxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NTE4MzksImV4cCI6MjEwMDEyNzgzOX0.UV4YLbfJwszr-zzzkpJgbLbQ4ZZhiGVYzlAHpst45mE'
        ),
        'VAPID_PUBLIC_KEY': os.environ.get(
            'VAPID_PUBLIC_KEY',
            'BJtfhRDqtUWCSWIaJhZpjvhXHYGPUNJvqxPNyrMxKG_0AKRmEMpeuNp4fbYoFgqNg-kNP30rfRc0P7GGULChzn4'
        ),
        'PLANS': {
            'free': {'name': 'Free', 'amount': 0, 'razorpayPlanId': None},
            'basic': {'name': 'Basic', 'amount': 24900, 'razorpayPlanId': None},
            'pro': {'name': 'Pro', 'amount': 59900, 'razorpayPlanId': None}
        }
    }
    body = 'const CONFIG = ' + json.dumps(config, indent=2) + ';\n'
    return Response(body, mimetype='application/javascript')

@app.route('/<path:path>')
def serve(path):
    if not _is_servable(os.path.basename(path)):
        return 'Not Found', 404
    return send_from_directory('.', path)

if __name__ == '__main__':
    debug = os.environ.get('FLASK_DEBUG', '0') == '1'
    port = int(os.environ.get('PORT', '8080'))
    # Optional HTTPS for local dev (e.g. to satisfy Razorpay's HTTPS requirement).
    # Preferred (trusted, no Python deps): mkcert localhost cert ->
    #   SSL_CERT=localhost+2.pem  SSL_KEY=localhost+2-key.pem  python app.py
    # Fallback (self-signed, prompts browser warning; needs `pip install cryptography`):
    #   USE_HTTPS=1  python app.py
    ssl_context = None
    cert = os.environ.get('SSL_CERT')
    key = os.environ.get('SSL_KEY')
    if cert and key:
        if not (os.path.isfile(cert) and os.path.isfile(key)):
            print(f"[https] cert/key not found: {cert!r}, {key!r}")
            raise SystemExit("Set SSL_CERT/SSL_KEY to real files, or unset them for plain HTTP.")
        ssl_context = (cert, key)
    elif os.environ.get('USE_HTTPS', '0') == '1':
        ssl_context = 'adhoc'
    app.run(host='0.0.0.0', port=port, debug=debug, ssl_context=ssl_context)
