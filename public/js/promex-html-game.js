/* Shared bootstrap for new same-origin HTML games. */
(function () {
    'use strict';
    if (window.PromexHtmlGame) return;

    const script = document.currentScript;
    const game = script && script.getAttribute('data-game');
    if (!game || !/^[A-Za-z0-9_]+$/.test(game)) {
        throw new Error('Promex HTML game requires a valid data-game value');
    }
    const query = new URLSearchParams(window.location.search);
    const remoteMode = query.get('promex_remote') === '1' && window.parent !== window;
    let operatorOrigin = null;
    let launchToken = null;
    if (remoteMode) {
        try {
            operatorOrigin = new URL(query.get('operator_origin') || document.referrer).origin;
        } catch (_) {
            throw new Error('Promex Remote requires a valid operator origin');
        }
        launchToken = new URLSearchParams(window.location.hash.slice(1)).get('promex_launch');
        if (!/^https:\/\//i.test(operatorOrigin) || !/^[A-Za-z0-9_-]{43}$/.test(launchToken || '')) {
            throw new Error('Promex Remote launch context is invalid');
        }
    }

    function loadScript(src, ready) {
        if (ready()) return Promise.resolve();
        return new Promise((resolve, reject) => {
            const element = document.createElement('script');
            element.src = src;
            element.async = false;
            element.onload = () => ready() ? resolve() : reject(new Error(src + ' did not initialize'));
            element.onerror = () => reject(new Error('Unable to load ' + src));
            (document.head || document.documentElement).appendChild(element);
        });
    }

    function stage(name, message) {
        window.dispatchEvent(new CustomEvent('promex:stage', { detail: { game, name, message } }));
    }

    const ready = (async () => {
        stage('session', 'Loading secure game session...');
        if (!remoteMode) {
            await loadScript('/js/game-session.js?v=6', () => Boolean(window.PromexGameSession));
            if (window.PromexGameSession.runtimeGame !== game) {
                throw new Error('Game runtime context does not match ' + game);
            }
            stage('session-ready', 'Secure game session ready...');
            if (window.PromexGameSession.ready) await window.PromexGameSession.ready;
        }
        stage('verifier', 'Loading provably fair verifier...');
        await loadScript(remoteMode ? '/cedar/runtime/cedar-client.js?v=6' : '/js/cedar-client.js?v=6', () => Boolean(window.CedarFairness));
        stage('ready', 'Requesting game configuration...');
        window.dispatchEvent(new CustomEvent('promex:game-ready', { detail: { game } }));
        return true;
    })();

    ready.catch(error => {
        window.dispatchEvent(new CustomEvent('promex:game-error', { detail: { game, error } }));
    });

    const pendingRemote = new Map();
    let remoteCommitment = null;
    let pendingSpin = null;
    if (remoteMode) {
        window.addEventListener('message', event => {
            const message = event.data;
            if (event.origin !== operatorOrigin || event.source !== window.parent
                || !message || message.type !== 'promex:game-response'
                || !pendingRemote.has(message.request_id)) return;
            const pending = pendingRemote.get(message.request_id);
            pendingRemote.delete(message.request_id);
            clearTimeout(pending.timeout);
            if (!message.ok || message.data?.status === 'error' || message.data?.error) {
                pending.reject(new Error(message.data?.message || message.data?.error || 'Remote game request was rejected.'));
            } else {
                pending.resolve(message.data);
            }
        });
    }

    function remoteRequest(action, payload) {
        const bytes = crypto.getRandomValues(new Uint8Array(16));
        const requestId = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                pendingRemote.delete(requestId);
                reject(new Error('Promex Remote bridge timed out.'));
            }, 15000);
            pendingRemote.set(requestId, {resolve, reject, timeout});
            window.parent.postMessage({
                type: 'promex:game-request', request_id: requestId, game, action,
                payload: Object.assign({}, payload || {}), launch_token: launchToken
            }, operatorOrigin);
        });
    }

    async function request(action, payload) {
        await ready;
        stage('request', action === 'init' ? 'Opening ' + game + '...' : 'Submitting game round...');
        if (remoteMode) {
            let requestPayload = Object.assign({}, payload || {});
            if (action === 'spin' && !requestPayload.command_id) {
                if (pendingSpin) {
                    requestPayload = Object.assign({}, pendingSpin);
                } else {
                    const logical = crypto.getRandomValues(new Uint8Array(16));
                    requestPayload.request_id = Array.from(logical, byte => byte.toString(16).padStart(2, '0')).join('');
                    requestPayload.server_seed_hash = remoteCommitment;
                    pendingSpin = Object.assign({}, requestPayload);
                }
            }
            const data = await remoteRequest(action, requestPayload);
            if (action === 'init') {
                remoteCommitment = data.server_seed_hash;
                pendingSpin = null;
            } else if (action === 'spin') {
                remoteCommitment = data.next_server_seed_hash;
                pendingSpin = null;
            }
            stage('response', action === 'init' ? 'Game ready.' : 'Round received.');
            window.dispatchEvent(new CustomEvent('promex:game-response', { detail: { game, action, data } }));
            return data;
        }
        const response = await window.fetch('/game/' + encodeURIComponent(game) + '/server', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify(Object.assign({}, payload || {}, { action }))
        });
        let data;
        try {
            data = await response.json();
        } catch (_) {
            throw new Error('The game server returned an unreadable response.');
        }
        if (!response.ok || data.status === 'error' || data.error) {
            const fallback = response.status === 403
                ? 'The licensed game session was rejected. Return to the lobby and reopen the game.'
                : 'The game request failed (HTTP ' + response.status + ').';
            throw new Error(data.message || data.error || fallback);
        }
        stage('response', action === 'init' ? 'Game ready.' : 'Round received.');
        window.dispatchEvent(new CustomEvent('promex:game-response', { detail: { game, action, data } }));
        return data;
    }

    window.PromexHtmlGame = Object.freeze({
        version: 2,
        game,
        delivery: remoteMode ? 'PROMEX_REMOTE' : 'LOCAL',
        ready,
        request,
        verify(proof) {
            if (!window.CedarFairness) throw new Error('Round verifier is unavailable.');
            return window.CedarFairness.verify(proof);
        }
    });
})();
