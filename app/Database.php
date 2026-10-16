<?php
declare(strict_types=1);
namespace Yuganth;
function migrate(): void
{
    $sql=file_get_contents(dirname(__DIR__).'/database/schema.sql');
    $mysql=db()->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql';
    foreach(explode(';',$sql) as $statement){if(trim($statement)!=='')db()->exec(trim($statement).($mysql?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':''));}
}
function seed(): void
{
    $products=[['guntur-gold','Guntur Gold','chilli','Bold heat and vibrant colour for everyday cooking.','assets/product-1.png',5400],['araku-gold','Araku Gold','turmeric','Golden colour and earthy aroma for everyday recipes.','assets/product-2.png',6000],['spice-loom','Spice Loom','chilli','Strong aroma and intense heat for podis, pickles and marinades.','assets/product-3.png',6400],['pure-gold','Pure Gold','turmeric','Packaging placeholder. Currently unavailable.','assets/product-2.png',5400]];
    transaction(function()use($products){
        foreach($products as [$id,$name,$category,$description,$image,$base]){
            if(!one('SELECT id FROM products WHERE id=?',[$id]))query('INSERT INTO products (id,name,category,description,image) VALUES (?,?,?,?,?)',[$id,$name,$category,$description,$image]);
            foreach([100,250,500,1000] as $weight){$variant=$id.'-'.$weight;if(!one('SELECT id FROM variants WHERE id=?',[$variant]))query('INSERT INTO variants (id,product_id,weight_g,price_paise,stock) VALUES (?,?,?,?,0)',[$variant,$id,$weight,(int)($base*$weight/100)]);}
        }
        if(!one('SELECT name FROM settings WHERE name=?',['banner']))query('INSERT INTO settings (name,value) VALUES (?,?)',['banner','FROM OUR ROOTS. TO YOUR KITCHEN.']);
    });
}
