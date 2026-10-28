/* Same-origin Laravel game transport: session, CSRF, origin and request identity. */
(function () {
    'use strict';
    if (window.PromexGameSession) return;
    const script = document.currentScript;
    let parentSession = null;
    try {
        if (window.parent && window.parent !== window && window.parent.PromexGameSession) {
            parentSession = window.parent.PromexGameSession;
        }
    } catch (_) {}
    const csrf = (script && script.getAttribute('data-csrf'))
        || (document.querySelector && document.querySelector('meta[name="csrf-token"]')?.content)
        || (parentSession && parentSession.csrfToken)
        || (document.cookie && document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)
            ? decodeURIComponent(document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/)[1]) : null);
    const runtimeGame = (script && script.getAttribute('data-runtime-game'))
        || (parentSession && parentSession.runtimeGame);
    if (!csrf || !runtimeGame || !/^[A-Za-z0-9_]+$/.test(runtimeGame)) {
        throw new Error('Missing game session context');
    }

    function protectedUrl(targetWindow, value, method) {
        const url = new URL(value, targetWindow.location.href);
        return String(method || 'GET').toUpperCase() === 'POST'
            && url.origin === targetWindow.location.origin
            && /^\/game\/[A-Za-z0-9_]+\/server\/?$/.test(url.pathname);
    }
    function requestHeaders() {
        const bytes = window.crypto.getRandomValues(new Uint8Array(16));
        return {
            'X-CSRF-TOKEN': csrf,
            'X-Promex-Request': Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join(''),
            'X-Promex-Time': String(Math.floor(Date.now() / 1000)),
            'X-Requested-With': 'XMLHttpRequest'
        };
    }
    function protect(targetWindow) {
        if (!targetWindow || targetWindow.__promexOrdinaryTransport) return;
        targetWindow.__promexOrdinaryTransport = true;
        const originalFetch = targetWindow.fetch.bind(targetWindow);
        targetWindow.fetch = async function (input, init) {
            const isRequest = typeof targetWindow.Request !== 'undefined' && input instanceof targetWindow.Request;
            const method = (init && init.method) || (isRequest ? input.method : 'GET');
            const url = isRequest ? input.url : String(input);
            if (!protectedUrl(targetWindow, url, method)) return originalFetch(input, init);
            const options = Object.assign({}, init);
            if (options.body === undefined && isRequest) options.body = await input.clone().text();
            const headers = new targetWindow.Headers(options.headers || (isRequest ? input.headers : undefined));
            Object.entries(requestHeaders()).forEach(([name, value]) => headers.set(name, value));
            options.headers = headers;
            options.method = method;
            options.credentials = 'same-origin';
            return originalFetch(isRequest ? input.url : input, options);
        };

        const XHR = targetWindow.XMLHttpRequest;
        if (!XHR || !XHR.prototype) return;
        const open = XHR.prototype.open;
        const send = XHR.prototype.send;
        const setHeader = XHR.prototype.setRequestHeader;
        XHR.prototype.open = function (method, url, ...args) {
            this._promexMethod = String(method).toUpperCase();
            this._promexUrl = String(url);
            this._promexProtected = protectedUrl(targetWindow, this._promexUrl, this._promexMethod);
            return open.call(this, method, url, ...args);
        };
        XHR.prototype.setRequestHeader = function (name, value) {
            if (this._promexProtected && /^(x-csrf-token|x-promex-request|x-promex-time)$/i.test(name)) return;
            return setHeader.call(this, name, value);
        };
        XHR.prototype.send = function (body) {
            if (this._promexProtected) {
                Object.entries(requestHeaders()).forEach(([name, value]) => setHeader.call(this, name, value));
            }
            return send.call(this, body);
        };
    }

    const session = Object.freeze({
        version: 3,
        ready: Promise.resolve(true),
        csrfToken: csrf,
        runtimeGame,
        protect
    });
    window.PromexGameSession = session;
    protect(window);
})();
