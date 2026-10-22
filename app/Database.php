<?php
declare(strict_types=1);
namespace Yuganth;
function migrate(): void
{
    $sql=file_get_contents(dirname(__DIR__).'/database/schema.sql');
    $mysql=db()->getAttribute(\PDO::ATTR_DRIVER_NAME)==='mysql';
    foreach(explode(';',$sql) as $statement){if(trim($statement)!=='')db()->exec(trim($statement).($mysql?' ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci':''));}
    // Additive migration from the original four-product installation. Never drop historical rows.
    $columns = [
        'products' => ['launch_status'=>"VARCHAR(20) NOT NULL DEFAULT 'coming_soon'", 'origin'=>"VARCHAR(120) NOT NULL DEFAULT ''"],
        'variants' => ['price_confirmed'=>'INTEGER NOT NULL DEFAULT 0'],
    ];
    foreach ($columns as $table=>$definitions) {
        $existing = $mysql ? array_column(rows('SHOW COLUMNS FROM '.$table),'Field') : array_column(rows('PRAGMA table_info('.$table.')'),'name');
        foreach ($definitions as $column=>$definition) if (!in_array($column,$existing,true)) db()->exec('ALTER TABLE '.$table.' ADD COLUMN '.$column.' '.$definition);
    }
}
function seed(): void
{
    $products=[
        ['guntur-gold','Guntur Gold','spices','Red chilli powder for curries, chutneys and everyday cooking.','Guntur','available'],
        ['araku-gold','Araku Gold','spices','Turmeric powder with golden colour and earthy flavour.','Araku','available'],
        ['spice-loom','Spice Loom','spices','Red chilli powder bringing together Guntur and Bygadi chillies.','Guntur & Bygadi','available'],
        ['chia-seeds','Chia Seeds','seeds','Chia seeds, a new addition to the Yuganth pantry.','Origin to be confirmed','coming_soon'],
        ['peanuts','Peanuts','nuts','Peanuts for chutneys, cooking and familiar recipes. Contains peanuts.','Origin to be confirmed','coming_soon'],
        ['ragi-flour','Ragi Flour','flours','Finger millet flour for traditional recipes and everyday cooking.','Origin to be confirmed','coming_soon'],
    ];
    transaction(function()use($products){
        $upgrade = !one('SELECT name FROM schema_migrations WHERE name=?',['six-product-catalogue-v2']);
        foreach($products as [$id,$name,$category,$description,$origin,$status]){
            $image='assets/'.$id.'-cutout.webp';
            if(!one('SELECT id FROM products WHERE id=?',[$id]))query('INSERT INTO products (id,name,category,description,image,origin,launch_status) VALUES (?,?,?,?,?,?,?)',[$id,$name,$category,$description,$image,$origin,$status]);
            elseif($upgrade)query('UPDATE products SET category=?,image=?,origin=?,launch_status=? WHERE id=?',[$category,$image,$origin,$status,$id]);
            $variant=$id.'-500';
            if(!one('SELECT id FROM variants WHERE id=?',[$variant]))query('INSERT INTO variants (id,product_id,weight_g,price_paise,stock) VALUES (?,?,500,0,0)',[$variant,$id]);
            if($upgrade){
                // Preserve prices and stock but require explicit review for the new packaging.
                query('UPDATE variants SET price_confirmed=0 WHERE product_id=?',[$id]);
                query('UPDATE variants SET active=0 WHERE product_id=? AND weight_g<>500',[$id]);
            }
        }
        if($upgrade){query('UPDATE products SET active=0 WHERE id=?',['pure-gold']);query('INSERT INTO schema_migrations (name,applied_at) VALUES (?,?)',['six-product-catalogue-v2',now()]);}
        if(!one('SELECT name FROM settings WHERE name=?',['banner']))query('INSERT INTO settings (name,value) VALUES (?,?)',['banner','FROM OUR ROOTS. TO YOUR KITCHEN.']);
    });
}
