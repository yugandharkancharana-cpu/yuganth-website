<?php
declare(strict_types=1);

namespace Yuganth;

final class ApiError extends \RuntimeException
{
    public function __construct(public int $status, string $message) { parent::__construct($message); }
}

function config(): array
{
    static $config;
    if ($config === null) {
        $config = require dirname(__DIR__) . '/config/config.example.php';
        $local = getenv('YUGANTH_CONFIG_FILE') ?: dirname(__DIR__) . '/config/local.php';
        if (is_file($local)) $config = array_replace($config, require $local);
        $paymentLocal=dirname(__DIR__).'/config/razorpay.local.php';
        if(is_file($paymentLocal))$config=array_replace($config,require $paymentLocal);
        foreach (['dsn' => 'YUGANTH_DSN', 'db_user' => 'YUGANTH_DB_USER', 'db_password' => 'YUGANTH_DB_PASSWORD', 'razorpay_key_id'=>'YUGANTH_RAZORPAY_KEY_ID', 'razorpay_key_secret'=>'YUGANTH_RAZORPAY_KEY_SECRET', 'razorpay_webhook_secret'=>'YUGANTH_RAZORPAY_WEBHOOK_SECRET'] as $key => $env) {
            if (getenv($env) !== false) $config[$key] = getenv($env);
        }
    }
    return $config;
}

function db(): \PDO
{
    static $pdo;
    if (!$pdo) {
        $c = config();
        $pdo = new \PDO($c['dsn'], $c['db_user'], $c['db_password'], [\PDO::ATTR_ERRMODE => \PDO::ERRMODE_EXCEPTION, \PDO::ATTR_DEFAULT_FETCH_MODE => \PDO::FETCH_ASSOC]);
        if ($pdo->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'sqlite') {
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA busy_timeout = 5000');
        } else $pdo->setAttribute(\PDO::ATTR_EMULATE_PREPARES, false);
    }
    return $pdo;
}

function query(string $sql, array $params = []): \PDOStatement
{
    $s = db()->prepare($sql); $s->execute($params); return $s;
}
function one(string $sql, array $params = []): ?array { return query($sql, $params)->fetch() ?: null; }
function rows(string $sql, array $params = []): array { return query($sql, $params)->fetchAll(); }
function uid(): string { return bin2hex(random_bytes(16)); }
function now(): int { return time(); }
function lockSuffix(): string { return db()->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : ''; }
function transaction(callable $fn): mixed
{
    $sqlite = db()->getAttribute(\PDO::ATTR_DRIVER_NAME) === 'sqlite';
    if ($sqlite) db()->exec('BEGIN IMMEDIATE'); else db()->beginTransaction();
    try { $r = $fn(); if ($sqlite) db()->exec('COMMIT'); else db()->commit(); return $r; }
    catch (\Throwable $e) { if ($sqlite) db()->exec('ROLLBACK'); elseif (db()->inTransaction()) db()->rollBack(); throw $e; }
}
function text(mixed $value, int $max, string $label, int $min = 1): string
{
    if (!is_string($value) || strlen(trim($value)) < $min || strlen(trim($value)) > $max) throw new ApiError(422, "Invalid $label.");
    return trim($value);
}
function integer(mixed $v, int $min, int $max, string $label): int
{
    if (!is_int($v) || $v < $min || $v > $max) throw new ApiError(422, "Invalid $label."); return $v;
}
function queue(string $kind, array $payload): void
{
    query('INSERT INTO outbox (id,kind,payload,created_at) VALUES (?,?,?,?)', [uid(), $kind, json_encode($payload, JSON_THROW_ON_ERROR), now()]);
}
function audit(string $action, string $subject, string $actor): void
{
    query('INSERT INTO audit_log (id,actor_id,action,subject_id,created_at) VALUES (?,?,?,?,?)', [uid(), $actor, $action, $subject, now()]);
}
function sessionStart(): void
{
    $c = config();
    if ($c['environment'] === 'production' && (($_SERVER['HTTPS'] ?? '') !== 'on')) throw new ApiError(400, 'HTTPS is required.');
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name('yuganth_session');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'secure' => $c['environment'] === 'production', 'samesite' => 'Lax']);
    session_start();
    if (isset($_SESSION['last_seen']) && now() - $_SESSION['last_seen'] > $c['session_idle_seconds']) { $_SESSION = []; session_regenerate_id(true); }
    $_SESSION['last_seen'] = now();
    $_SESSION['csrf'] ??= uid();
}
function user(bool $admin = false): array
{
    $u = one('SELECT id,name,email,role,auth_version FROM users WHERE id=?', [$_SESSION['user_id'] ?? '']);
    if (!$u) throw new ApiError(401, 'Please sign in.');
    if ((int)$u['auth_version'] !== ($_SESSION['auth_version'] ?? 0)) throw new ApiError(401, 'Please sign in again.');
    unset($u['auth_version']);
    if ($admin && $u['role'] !== 'admin') throw new ApiError(403, 'Administrator access required.');
    return $u;
}
// Atomic fixed-window IP throttling. REMOTE_ADDR is used; forwarded headers are not trusted.
function throttle(string $scope, int $limit = 20, int $window = 900): void
{
    $bucket = hash('sha256', $scope . '|' . ($_SERVER['REMOTE_ADDR'] ?? 'cli') . '|' . intdiv(now(), $window));
    try { query('INSERT INTO rate_limits (bucket,hits,expires_at) VALUES (?,0,?)', [$bucket, now() + $window]); }
    catch (\PDOException $e) { if (!in_array((string)$e->getCode(), ['23000','23505'], true)) throw $e; }
    query('UPDATE rate_limits SET hits=hits+1 WHERE bucket=?', [$bucket]);
    if ((int)one('SELECT hits FROM rate_limits WHERE bucket=?', [$bucket])['hits'] > $limit) throw new ApiError(429, 'Too many attempts. Please try again later.');
}
require_once __DIR__ . '/Commerce.php';
require_once __DIR__ . '/Integrations.php';
