<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Sentry\Laravel\Integration;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        $middleware->validateCsrfTokens(except: [
            'api/group/*/update-group-member',
            'api/group/*/am-i-in-group',
        ]);

        // Cloudflare Tunnel terminates TLS at the edge and proxies plain HTTP to
        // this container via the Docker bridge gateway (172.18.0.1) — without
        // trusting that hop's X-Forwarded-Proto, Request::isSecure() is always
        // false and session/XSRF cookies never get the Secure flag, even on the
        // externally-HTTPS gimhub.grestinator.com. Scoped to the gateway IP only
        // (not '*') so a plain-HTTP LAN client at 192.168.1.130:4100 can't spoof
        // the header and can't be treated as a trusted proxy.
        $middleware->trustProxies(
            at: '172.18.0.1',
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        Integration::handles($exceptions);
    })->create();
