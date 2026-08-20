<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

// TEMPORARY — diagnosing why trustProxies() isn't marking cookies Secure through
// the Cloudflare Tunnel. Remove once resolved, do not leave in a real release.
Route::get('/debug-request-info-temp', function (Request $request) {
    return response()->json([
        'remote_addr_raw' => $request->server->get('REMOTE_ADDR'),
        'client_ip_resolved' => $request->getClientIp(),
        'is_secure' => $request->isSecure(),
        'trusted_proxies' => $request->getTrustedProxies(),
        'x_forwarded_proto' => $request->header('X-Forwarded-Proto'),
        'x_forwarded_for' => $request->header('X-Forwarded-For'),
        'x_forwarded_host' => $request->header('X-Forwarded-Host'),
        'cf_visitor' => $request->header('Cf-Visitor'),
        'cf_connecting_ip' => $request->header('CF-Connecting-IP'),
        'scheme' => $request->getScheme(),
    ]);
});

Route::get('/', function () {
    return view('index');
});

Route::get('/{path}', function () {
    return view('index');
})->where('path', '[^.]*');
