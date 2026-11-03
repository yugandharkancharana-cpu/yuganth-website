from pathlib import Path
import subprocess, tempfile, os, time, json, urllib.request, urllib.error, http.cookiejar, socket, shutil
PHP=os.environ.get('YUGANTH_PHP') or shutil.which('php') or r'C:\Users\mi\Documents\Codex\2026-10-15\h\work\php-runtime\php.exe'
EXT=str(Path(PHP).parent/'ext')
SITE=Path(__file__).parent/'site'
if not SITE.is_dir(): SITE=Path(__file__).resolve().parent.parent
def php_args():return [PHP]+(['-d',f'extension_dir={EXT}','-d','extension=pdo_sqlite','-d','extension=openssl','-d','extension=curl'] if os.name=='nt' else [])
with tempfile.TemporaryDirectory(prefix='yuganth-guest-',dir=Path(__file__).parent.resolve()) as tmp:
    tmp=Path(tmp);cfg=tmp/'config.php';db=tmp/'test.sqlite'
    cfg.write_text("<?php return ['dsn'=>'sqlite:"+db.as_posix()+"','checkout_enabled'=>true,'catalog_verified'=>true,'payment_driver'=>'manual_test','environment'=>'development','serviceable_pincodes'=>['530028']];")
    env=os.environ.copy();env['YUGANTH_CONFIG_FILE']=str(cfg)
    init=tmp/'seed.php';init.write_text("<?php require "+repr((SITE/'app/bootstrap.php').resolve().as_posix())+"; require "+repr((SITE/'app/Database.php').resolve().as_posix())+"; \\Yuganth\\migrate(); \\Yuganth\\seed(); \\Yuganth\\query('UPDATE variants SET stock=20,price_paise=10000,price_confirmed=1');")
    subprocess.run(php_args()+[str(init)],env=env,check=True,capture_output=True)
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    log=(tmp/'server.log').open('w')
    proc=subprocess.Popen(php_args()+['-S',f'127.0.0.1:{port}','-t',str(SITE/'public')],env=env,stdout=log,stderr=log)
    def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    a,b=client(),client();base=f'http://127.0.0.1:{port}'
    def call(c,endpoint,route,body=None,csrf=None,key=None):
        h={'Accept':'application/json'}
        if body is not None:h['Content-Type']='application/json'
        if csrf:h['X-CSRF-Token']=csrf
        if key:h['Idempotency-Key']=key
        req=urllib.request.Request(base+'/api/'+endpoint+'.php?route='+urllib.parse.quote(route),data=None if body is None else json.dumps(body).encode(),headers=h)
        try:
            with c.open(req) as r:return r.status,json.load(r)
        except urllib.error.HTTPError as e:return e.code,json.load(e)
    try:
        for _ in range(50):
            try:_,session=call(a,'index','/session');break
            except (OSError,ValueError):time.sleep(.1)
        else:raise RuntimeError('Server unavailable')
        csrf=session['csrf'];assert session['user'] is None
        _,sb=call(b,'index','/session')
        body={'items':[{'variant_id':'guntur-gold-500','quantity':2}],'address':{'name':'Guest Tester','phone':'9618423344','line1':'Test street','line2':'','city':'Visakhapatnam','state':'Andhra Pradesh','pincode':'530028'},'coupon':'','terms_accepted':True,'terms_version':'2026-11-03','total_paise':1}
        assert call(a,'guest','/orders',body,key='guest-test-checkout-001')[0]==419,'CSRF required'
        assert call(a,'guest','/orders',{**body,'terms_accepted':False},csrf,'guest-test-checkout-001')[0]==422,'terms required'
        status,result=call(a,'guest','/orders',body,csrf,'guest-test-checkout-001');assert status==201,(status,result)
        order=result['order'];oid=order['id'];assert order['total_paise']==26000,'server controls total'
        again=call(a,'guest','/orders',body,csrf,'guest-test-checkout-001')[1]['order'];assert again['id']==oid,'idempotency'
        altered={**body,'items':[{'variant_id':'guntur-gold-500','quantity':1}]}
        assert call(a,'guest','/orders',altered,csrf,'guest-test-checkout-001')[0]==409,'key reuse cannot change order'
        assert call(a,'index','/session')[1]['user'] is None,'guest is not signed in'
        assert call(a,'index','/orders/'+oid)[0]==401,'guest cannot use account API'
        assert call(b,'guest','/orders/'+oid)[0]==401,'other browser denied'
        assert call(a,'guest','/orders/'+'a'*32)[0]==404,'foreign order denied'
        assert call(a,'guest','/orders/'+oid+'/payment',{},csrf)[1]['checkout']['mode']=='manual_test','payment adapter reached'
        assert call(a,'guest','/orders/'+oid+'/payment/verify',{'paid':True},csrf)[0]==503,'client paid flag cannot confirm payment'
        assert call(a,'guest','/orders/'+oid+'/cancel',{},csrf)[1]['order']['status']=='cancelled','unpaid cancellation'
        assert call(a,'guest','/orders/'+oid+'/payment',{},csrf)[0]==409,'cancelled order not payable'
        assert call(a,'guest','/orders',body,csrf,'guest-test-checkout-002')[0]==201,'new reservation works'
        print('PASS: guest ordering, CSRF, terms, server pricing, idempotency, ownership, account separation, payment adapter and cancellation checks')
    finally:
        proc.terminate();proc.wait();log.close()

