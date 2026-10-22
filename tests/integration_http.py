"""HTTP integration checks using only Python's standard library.
Usage: python tests/integration_http.py PATH_TO_PHP [PHP extension directory]
Creates an isolated SQLite database and a temporary PHP server. No real provider calls.
"""
import contextlib, http.cookiejar, json, os, pathlib, socket, sqlite3, subprocess, sys, tempfile, time, urllib.request, urllib.error

root = pathlib.Path(__file__).resolve().parents[1]
php = str(pathlib.Path(sys.argv[1]).resolve()) if len(sys.argv) > 1 else 'php'
cmd = [php]
if len(sys.argv) > 2:
    cmd += ['-d', 'extension_dir=' + str(pathlib.Path(sys.argv[2]).resolve()), '-d', 'extension=pdo_sqlite']
checks = 0

def check(condition, label):
    global checks
    assert condition, label
    checks += 1

temp_root = pathlib.Path(os.environ.get('YUGANTH_TEST_TEMP', tempfile.gettempdir())).resolve()
with tempfile.TemporaryDirectory(prefix='yuganth-http-', dir=temp_root) as temp:
    path = pathlib.Path(temp)
    assert path.resolve().parent == temp_root, 'Unexpected temporary directory'
    config = path / 'config.php'
    # Forward slashes are valid on Windows and avoid PHP escape surprises.
    dsn = 'sqlite:' + (path / 'test.sqlite').as_posix()
    config.write_text("<?php return ['dsn'=>" + repr(dsn) + ", 'serviceable_pincodes'=>['530028']];", encoding='utf-8')
    env = os.environ.copy()
    env['YUGANTH_CONFIG_FILE'] = str(config)
    subprocess.run(cmd + ['bin/console.php', 'install'], cwd=root, env=env, check=True, capture_output=True)
    # Reserve a random local port; the tiny release/rebind interval is acceptable for test-only use.
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0)); port = s.getsockname()[1]
    base = f'http://127.0.0.1:{port}/'
    log = open(path / 'server.log', 'w', encoding='utf-8')
    server = subprocess.Popen(cmd + ['-S', f'127.0.0.1:{port}', '-t', 'public'], cwd=root, env=env, stdout=log, stderr=log)
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    csrf = ''

    def request(route, body=None, token=True):
        headers = {'Accept': 'application/json'}
        if body is not None:
            headers['Content-Type'] = 'application/json'
            if token: headers['X-CSRF-Token'] = csrf
        req = urllib.request.Request(base + 'api/index.php?route=' + urllib.parse.quote(route), data=None if body is None else json.dumps(body).encode(), headers=headers)
        try:
            with opener.open(req, timeout=5) as response: return response.status, json.load(response)
        except urllib.error.HTTPError as e: return e.code, json.load(e)

    try:
        for attempt in range(30):
            try:
                status, session = request('/session'); break
            except (OSError, urllib.error.URLError): time.sleep(.1)
        else: raise RuntimeError('Test server did not start')
        csrf = session['csrf']
        check(status == 200 and session['user'] is None, 'anonymous session')
        check(not session['checkout_enabled'], 'checkout disabled by default')
        check(request('/admin/orders')[0] == 401, 'anonymous admin access rejected')
        check(request('/orders')[0] == 401, 'anonymous order access rejected')
        check(request('/auth/register', {'name':'Test','email':'test@example.com','password':'test-password-123'}, token=False)[0] == 419, 'CSRF enforced')
        check(request('/catalog')[0] == 200, 'catalogue available')
        status, result = request('/auth/register', {'name':'Test','email':'test@example.com','password':'test-password-123'})
        check(status == 200 and result['user']['role'] == 'customer', 'registration cannot grant admin')
        csrf = result['csrf']
        check(request('/admin/orders')[0] == 403, 'customer admin access rejected')
        check(request('/orders', {})[0] == 503, 'disabled checkout rejects order creation')
        address = {'name':'Tester','phone':'9618423444','line1':'Test address','city':'Visakhapatnam','state':'Andhra Pradesh','pincode':'530028'}
        status, saved = request('/addresses', {'address':address})
        check(status == 201, 'save address')
        check(len(request('/addresses')[1]['addresses']) == 1, 'list own addresses')
        check(request('/orders/' + 'a'*32)[0] == 404, 'unknown order hidden')
        check(request('/auth/forgot', {'email':'unknown@example.com'})[0] == 200, 'reset response does not enumerate accounts')
        status, result = request('/auth/logout', {})
        csrf = result['csrf']
        check(request('/addresses')[0] == 401, 'logout removes access')
        check(request('/auth/login', {'email':'test@example.com','password':'wrong-password-123'})[0] == 401, 'bad password rejected')
        status, result = request('/auth/login', {'email':'test@example.com','password':'test-password-123'})
        csrf = result['csrf']
        check(status == 200, 'login succeeds')
        # A second account must not access the first account's address.
        status, result = request('/auth/register', {'name':'Other','email':'other@example.com','password':'another-password-123'})
        csrf = result['csrf']
        check(not request('/addresses')[1]['addresses'], 'address ownership')
        request('/addresses', {'action':'delete','id':saved['id']})
        status, result = request('/auth/login', {'email':'test@example.com','password':'test-password-123'})
        csrf = result['csrf']
        check(len(request('/addresses')[1]['addresses']) == 1, 'cannot delete another account address')
        check(request('/webhooks/payment', {}, token=False)[0] == 503, 'unconfigured webhook fails closed')
        check(request('/auth/forgot', {'email':'test@example.com'})[0] == 200, 'reset message queued')
        with contextlib.closing(sqlite3.connect(path / 'test.sqlite')) as conn:
            payload = json.loads(conn.execute("SELECT payload FROM outbox WHERE kind='auth.reset'").fetchone()[0])
        token = payload['url'].split('#reset=')[1]
        old_csrf = csrf
        check(request('/auth/reset', {'token':token,'password':'new-password-123'})[0] == 200, 'reset changes password')
        check(request('/addresses')[0] == 401, 'reset invalidates existing session')
        check(request('/auth/reset', {'token':token,'password':'another-password-123'})[0] == 422, 'reset token single use')
        status, result = request('/auth/login', {'email':'test@example.com','password':'new-password-123'})
        csrf = result['csrf']
        check(status == 200, 'new password works')
        # Promote only inside this isolated test DB, then establish a fresh session.
        with contextlib.closing(sqlite3.connect(path / 'test.sqlite')) as conn:
            conn.execute("UPDATE users SET role='admin' WHERE email='test@example.com'")
            conn.commit()
        check(request('/admin/orders')[0] == 200, 'admin order access')
        check(request('/admin/banner', {'value':'Seasonal offer'})[0] == 200, 'admin banner write')
        check(request('/settings')[1]['banner'] == 'Seasonal offer', 'banner reaches public API')
        check(request('/admin/variant', {'id':'guntur-gold-500','price_paise':5500,'stock':5,'active':1,'expected_stock':0,'price_confirmed':1})[0] == 200, 'admin catalogue update')
        check(request('/admin/variant', {'id':'guntur-gold-500','price_paise':5500,'stock':6,'active':1,'expected_stock':0})[0] == 409, 'stale inventory edit rejected')
        status, products = request('/admin/products')
        check(status == 200 and len(products['products']) == 6, 'six products in admin')
        product = next(p for p in products['products'] if p['id'] == 'peanuts')
        update = {**product, 'active':1, 'launch_status':'coming_soon'}
        check(request('/admin/product', update)[0] == 200, 'admin product content edit')
        check(request('/cart/quote', {'items':[{'variant_id':'guntur-gold-500','quantity':2}],'pincode':'530028'})[0] == 200, 'confirmed existing product quote')
        check(request('/admin/variant', {'id':'peanuts-500','price_paise':10000,'stock':10,'active':1,'expected_stock':0,'price_confirmed':1})[0] == 200, 'prepare coming soon stock')
        check(request('/cart/quote', {'items':[{'variant_id':'peanuts-500','quantity':1}],'pincode':'530028'})[0] == 409, 'coming soon is server blocked')
        check(request('/admin/variant', {'id':'peanuts-500','price_paise':0,'stock':10,'active':1,'expected_stock':10,'price_confirmed':1})[0] == 422, 'cannot confirm zero price')
        update['launch_status']='available'
        check(request('/admin/product', update)[0] == 200, 'admin can launch product')
        check(request('/cart/quote', {'items':[{'variant_id':'peanuts-500','quantity':1}],'pincode':'530028'})[0] == 200, 'launched product quotable')
        update['active']=0
        request('/admin/product', update)
        check(not any(p['id']=='peanuts' for p in request('/catalog')[1]['products']), 'hidden product omitted from public catalogue')
        update['active']=1
        request('/admin/product', update)
        with opener.open(base+'index.html') as response: check(response.status == 200, 'storefront serves')
        print(f'PASS: {checks} HTTP integration assertions')
    finally:
        server.terminate(); server.wait(timeout=10); log.close()
