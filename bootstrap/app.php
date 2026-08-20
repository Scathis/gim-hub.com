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
        // this container. cloudflared runs as a native host process (not a
        // container), so its hairpin-NAT'd source IP is the host's own LAN
        // address (192.168.1.130) — confirmed via a live debug route, NOT the
        // Docker bridge gateway (172.18.0.1) that container-to-container traffic
        // uses elsewhere in this stack. Without trusting that hop's
        // X-Forwarded-Proto, Request::isSecure() is always false and session/XSRF
        // cookies never get the Secure flag, even on the externally-HTTPS
        // gimhub.grestinator.com. Scoped to the host IP only (not '*') so a
        // genuinely different LAN device hitting 192.168.1.130:4100 directly
        // keeps its own source IP (standard Docker DNAT, no masquerade for
        // non-host-originated connections) and can't spoof the header.
        $middleware->trustProxies(
            at: '192.168.1.130',
            headers: Request::HEADER_X_FORWARDED_FOR
                | Request::HEADER_X_FORWARDED_HOST
                | Request::HEADER_X_FORWARDED_PORT
                | Request::HEADER_X_FORWARDED_PROTO,
        );
    })
    ->withExceptions(function (Exceptions $exceptions) {
        Integration::handles($exceptions);
    })->create();
