<?php
declare(strict_types=1);
$config=tempnam(sys_get_temp_dir(),'yuganth-migration-');
file_put_contents($config,"<?php return ['dsn'=>'sqlite::memory:'];");
putenv('YUGANTH_CONFIG_FILE='.$config);register_shutdown_function(fn()=>unlink($config));
require dirname(__DIR__).'/app/bootstrap.php';require dirname(__DIR__).'/app/Database.php';
use function Yuganth\{db,query,one,rows,uid,now,migrate,seed};
db()->exec(file_get_contents(__DIR__.'/fixtures/schema-v1.sql'));
$user=uid();$order=uid();
query('INSERT INTO users (id,name,email,password_hash,created_at) VALUES (?,?,?,?,?)',[$user,'Existing customer','existing@example.com',password_hash('old-account-password',PASSWORD_DEFAULT),now()]);
foreach(['guntur-gold','pure-gold'] as $p){query('INSERT INTO products (id,name,category,description,image) VALUES (?,?,?,?,?)',[$p,$p,'chilli','Legacy product','old.png']);foreach([100,500] as $w)query('INSERT INTO variants (id,product_id,weight_g,price_paise,stock) VALUES (?,?,?,?,?)',[$p.'-'.$w,$p,$w,27000,7]);}
query('INSERT INTO orders (id,user_id,idempotency_key,fingerprint,status,currency,subtotal_paise,discount_paise,shipping_paise,total_paise,address,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',[$order,$user,uid(),'legacy','delivered','INR',27000,0,0,27000,'{}',now(),now()]);
query('INSERT INTO order_items (id,order_id,variant_id,name,weight_g,quantity,unit_paise) VALUES (?,?,?,?,?,?,?)',[uid(),$order,'pure-gold-100','Old Pure Gold',100,1,27000]);
migrate();seed();
$checks=0;function check(bool $v,string $label):void{global $checks;if(!$v)throw new RuntimeException($label);$checks++;}
check((bool)one('SELECT id FROM users WHERE id=?',[$user]),'customer retained');
check(one('SELECT status FROM orders WHERE id=?',[$order])['status']==='delivered','order retained');
check(one('SELECT name FROM order_items WHERE order_id=?',[$order])['name']==='Old Pure Gold','historic line retained');
check((int)one('SELECT active FROM products WHERE id=?',['pure-gold'])['active']===0,'Pure Gold retired without deletion');
check((int)one('SELECT active FROM variants WHERE id=?',['guntur-gold-100'])['active']===0,'old size retained inactive');
$v=one('SELECT * FROM variants WHERE id=?',['guntur-gold-500']);
check((int)$v['stock']===7&&(int)$v['price_paise']===27000,'existing stock and price retained');
check((int)$v['price_confirmed']===0,'price review required');
check(count(rows('SELECT id FROM products WHERE active=1'))===6,'six active products after upgrade');
query('UPDATE variants SET price_confirmed=1 WHERE id=?',['guntur-gold-500']);
query("UPDATE products SET launch_status='available' WHERE id='peanuts'");
migrate();seed();
check((int)one('SELECT price_confirmed FROM variants WHERE id=?',['guntur-gold-500'])['price_confirmed']===1,'repeat install preserves price approval');
check(one('SELECT launch_status FROM products WHERE id=?',['peanuts'])['launch_status']==='available','repeat install preserves launch decision');
echo "PASS: $checks migration assertions\n";
