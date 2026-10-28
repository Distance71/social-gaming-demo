// Mock WebSocket Bridge for Laravel Social Gaming
// Replaces node.js slots-socket and lobby-socket.

(function() {
    'use strict';
    if (window.PromexSocketBridge) return;
    window.PromexSocketBridge = true;
    try {
        const session = window.PromexGameSession
            || (window.parent && window.parent !== window ? window.parent.PromexGameSession : null);
        if (!session || typeof session.protect !== 'function') throw new Error('Game session transport is unavailable');
        session.protect(window);
    } catch (error) {
        console.error('[MockWS] Secure same-origin transport is unavailable:', error);
        return;
    }
    // ----------------------------------------------------
    // Clear stale Amatic session settings to prevent 48% loading hang
    // ----------------------------------------------------
    try {
        sessionStorage.removeItem('sessionValue12');
        sessionStorage.sessionValue12 = '';
    } catch (e) {}
    // ----------------------------------------------------
    // 0. Mixed Content HTTP -> HTTPS Upgrader for same-origin requests
    // ----------------------------------------------------
    try {
        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...args) {
            if (typeof url === 'string' && url.indexOf('http://') === 0) {
                const currentHost = window.location.host;
                if (url.indexOf('http://' + currentHost) === 0 || url.indexOf('http://' + window.location.hostname) === 0) {
                    url = url.replace('http://', 'https://');
                }
            }
            return originalOpen.call(this, method, url, ...args);
        };

        const originalFetch = window.fetch;
        if (originalFetch) {
            window.fetch = function(input, init) {
                if (typeof input === 'string' && input.indexOf('http://') === 0) {
                    const currentHost = window.location.host;
                    if (input.indexOf('http://' + currentHost) === 0 || input.indexOf('http://' + window.location.hostname) === 0) {
                        input = input.replace('http://', 'https://');
                    }
                } else if (input && typeof input.url === 'string' && input.url.indexOf('http://') === 0) {
                    const currentHost = window.location.host;
                    if (input.url.indexOf('http://' + currentHost) === 0 || input.url.indexOf('http://' + window.location.hostname) === 0) {
                        try {
                            const newUrl = input.url.replace('http://', 'https://');
                            input = new Request(newUrl, input);
                        } catch (e) {}
                    }
                }
                return originalFetch.call(this, input, init);
            };
        }
    } catch (e) {
        console.error("[MockWS] Failed to initialize HTTP upgrader:", e);
    }

    // ----------------------------------------------------
    // 0b. WebAudio AudioGuard: Silent Fallback for Corrupt/Missing Sound Files
    // ----------------------------------------------------
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx && AudioCtx.prototype.decodeAudioData) {
            const originalDecode = AudioCtx.prototype.decodeAudioData;
            AudioCtx.prototype.decodeAudioData = function(audioData, successCallback, errorCallback) {
                const self = this;
                function createSilentBuffer() {
                    try {
                        return self.createBuffer(1, 2205, 22050);
                    } catch (e) {
                        return null;
                    }
                }

                return new Promise((resolve) => {
                    originalDecode.call(self, audioData,
                        (buffer) => {
                            if (successCallback) successCallback(buffer);
                            resolve(buffer);
                        },
                        (err) => {
                            console.warn("[MockWS AudioGuard] Audio decode failed, supplying silent buffer fallback.");
                            const silent = createSilentBuffer();
                            if (successCallback && silent) successCallback(silent);
                            else if (errorCallback) errorCallback(err);
                            resolve(silent);
                        }
                    ).catch(err => {
                        console.warn("[MockWS AudioGuard] Audio decode promise rejected, supplying silent buffer fallback.");
                        const silent = createSilentBuffer();
                        if (successCallback && silent) successCallback(silent);
                        resolve(silent);
                    });
                });
            };
        }
    } catch (e) {
        console.error("[MockWS] Failed to initialize AudioGuard:", e);
    }
    // ----------------------------------------------------
    // 1. Binary Packet Helpers (Ported from packet.js)
    // ----------------------------------------------------

    function hexToArrayBuffer(hex) {
        if (typeof hex !== 'string') return new ArrayBuffer(0);
        let view = new Uint8Array(Math.round(hex.length / 2));
        for (let i = 0; i < hex.length; i += 2) {
            view[i / 2] = parseInt(hex.substring(i, i + 2), 16);
        }
        return view.buffer;
    }

    function DecodeMessage(arrayBuffer) {
        let result = "";
        let i = 0;
        let data = new Uint8Array(arrayBuffer);
        if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
            i = 3;
        }
        while (i < data.length) {
            let c = data[i];
            if (c < 128) {
                result += String.fromCharCode(c);
                i++;
            } else if (c > 191 && c < 224) {
                let c2 = data[i + 1];
                result += String.fromCharCode(((c & 31) << 6) | (c2 & 63));
                i += 2;
            } else {
                let c2 = data[i + 1];
                let c3 = data[i + 2];
                result += String.fromCharCode(((c & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
                i += 3;
            }
        }
        return result;
    }

    function PacketBuffer(buffer, capacity) {
        const _self = this;
        _self.capacity = buffer ? buffer.byteLength : capacity || 64;
        _self.size = buffer ? buffer.byteLength : 0;
        _self.offset = 0;
        _self.buffer = buffer || new ArrayBuffer(_self.capacity);
        _self.view = new DataView(_self.buffer);

        _self._writeValue = function (value, type, size) {
            if (_self.size + size > _self.capacity) {
                let capacity = _self.capacity * 2;
                let tmp = new ArrayBuffer(capacity);
                (new Uint8Array(tmp, 0, capacity)).set(new Uint8Array(_self.buffer, 0, _self.capacity));
                _self.capacity = capacity;
                _self.buffer = tmp;
                _self.view = new DataView(_self.buffer);
            }
            _self.view['set' + type](_self.offset, value, true);
            _self.offset += size;
            _self.size += size;
        };

        _self._readValue = function (type, size, offset) {
            if (typeof offset !== "undefined") {
                _self.offset = offset;
            }
            let value = _self.view['get' + type](_self.offset, true);
            _self.offset += size;
            return value;
        };

        _self.getBuffer = function (begin, end) {
            begin = begin || 0;
            end = end || _self.size;
            return _self.buffer.slice(begin, end);
        };
    }

    function OutcomingPacket(capacity) {
        PacketBuffer.call(this, null, capacity);
        const _self = this;

        _self.writeInt16 = function (value) { _self._writeValue(value, 'Int16', 2); };
        _self.writeUint16 = function (value) { _self._writeValue(value, 'Uint16', 2); };
        _self.writeInt32 = function (value) { _self._writeValue(value, 'Int32', 4); };
        _self.writeUint32 = function (value) { _self._writeValue(value, 'Uint32', 4); };
        _self.writeInt8 = function (value) { _self._writeValue(value, 'Int8', 1); };
        _self.writeUint8 = function (value) { _self._writeValue(value, 'Uint8', 1); };

        _self.writeString = function (value) {
            _self.writeInt16(value.length);
            for (let i = 0; i < value.length; ++i) {
                _self.writeInt8(value.charCodeAt(i));
            }
        };

        _self.writeBuffer = function (buffer) {
            let incoming = new IncomingPacket(buffer);
            for (let i = 0; i < incoming.size; ++i) {
                _self.writeUint8(incoming.readUint8());
            }
        };
    }

    function IncomingPacket(buffer) {
        PacketBuffer.call(this, buffer);
        const _self = this;

        _self.readInt16 = function (offset) { return _self._readValue('Int16', 2, offset); };
        _self.readUint16 = function (offset) { return _self._readValue('Uint16', 2, offset); };
        _self.readInt32 = function (offset) { return _self._readValue('Int32', 4, offset); };
        _self.readUint32 = function (offset) { return _self._readValue('Uint32', 4, offset); };
        _self.readInt8 = function (offset) { return _self._readValue('Int8', 1, offset); };
        _self.readUint8 = function (offset) { return _self._readValue('Uint8', 1, offset); };

        _self.readString = function (offset) {
            let length = _self.readInt16(offset);
            let encoded = [];
            for (let i = 0; i < length; ++i) {
                encoded.push(_self.readInt8());
            }
            try {
                return decodeURIComponent(escape(String.fromCharCode.apply(null, encoded)));
            } catch (e) {
                return "";
            }
        };
    }

    // ----------------------------------------------------
    // 2. Custom Mock WebSocket
    // ----------------------------------------------------

    class MockWebSocket {
        constructor(url) {
            this.url = url;
            this.readyState = 0; // CONNECTING
            this.msgId = 0;
            this.gameName = '';
            this.sessionId = '';
            this.cookie = '';

            // Handle lobby / live ticker endpoints: fail silently or simulate open
            if (url.indexOf('/live') !== -1) {
                console.log("[MockWS] Live wins socket intercepted. Simulating offline state.");
                setTimeout(() => {
                    this.readyState = 1; // OPEN
                    if (this.onopen) this.onopen({ type: 'open' });
                }, 50);
                return;
            }

            console.log("[MockWS] Intercepted WebSocket connection to: " + url);

            // Simulate connection opening
            setTimeout(() => {
                this.readyState = 1; // OPEN
                if (this.onopen) this.onopen({ type: 'open' });
                // Pragmatic Slots.js sends "1::" on Socket.IO connection
                if (url.indexOf('/slots-socket') !== -1 || url.indexOf('/socket.io') !== -1) {
                    if (this.onmessage) this.onmessage({ data: '1::' });
                }
            }, 50);
        }

        send(message) {
            console.log("[MockWS send] type:", typeof message, "data:", message);
            if (this.url.indexOf('/live') !== -1) {
                // Ignore outgoing lobby messages
                return;
            }

            if (typeof message === 'string') {
                this._handleStringMessage(message);
            } else if (message instanceof ArrayBuffer || ArrayBuffer.isView(message)) {
                let actualBuffer = message.buffer || message;
                this._handleBinaryMessage(actualBuffer);
            } else {
                console.warn("[MockWS send] Unhandled message type:", typeof message, message);
            }
        }

        close() {
            this.readyState = 3; // CLOSED
            if (this.onclose) this.onclose({ type: 'close' });
        }

        // Pragmatic Play & EGT / String based communication
        _handleStringMessage(message) {
            let param;
            let splitIndex = message.indexOf(":::");
            if (splitIndex !== -1) {
                let paramStr = message.substring(splitIndex + 3);
                try {
                    param = JSON.parse(paramStr);
                } catch (e) {
                    return;
                }
            } else {
                try {
                    param = JSON.parse(message);
                } catch (e) {
                    return;
                }
            }

            // Extract game metadata
            let gameName = param.gameName;
            if (!gameName) {
                let pathParts = window.location.pathname.split('/game/');
                if (pathParts[1]) {
                    gameName = pathParts[1].split('/')[0].split('?')[0];
                }
            }
            let sessionId = param.sessionId || this.sessionId || '123456';
            if (!gameName) return;

            // Make HTTP POST call directly to Laravel
            let targetUrl = window.APP_BASE_URL || (window.location.origin + '/game/' + gameName + '/server?sessionId=' + sessionId);
            if (targetUrl.indexOf('/game/') === -1) {
                targetUrl = window.location.origin + '/game/' + gameName + '/server?sessionId=' + sessionId;
            }

            let params = {
                msgId: this.msgId - 1,
                action: param.command || 'login',
                command: param.command || 'login',
                gameIdentificationNumber: param.gameIdentificationNumber || 808,
                messageId: param.messageId || ('r-r_' + Date.now()),
                reqDat: param
            };
            if (param && typeof param === 'object') {
                Object.assign(params, param);
            }

            console.log("[MockWS String Request] Sending to " + targetUrl, params);

            fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(params)
            })
            .then(res => res.text())
            .then(body => {
                console.log("[MockWS Server Raw Response]:", body);
                if (body && this.onmessage) {
                    let hasTripleColon = body.indexOf(":::") !== -1;
                    let allReq = body.split("------");
                    for (let i = 0; i < allReq.length; i++) {
                        let chunk = allReq[i];
                        if (chunk && chunk.trim()) {
                            if (hasTripleColon && chunk.indexOf(":::") === -1) {
                                chunk = ":::" + chunk;
                            }
                            console.log("[MockWS Sending Chunk to Client]:", chunk);
                            this.onmessage({ data: chunk });
                        }
                    }
                }
            })
            .catch(err => console.error("[MockWS] Error calling server:", err));
        }

        // EGT / Novomatic / Binary based communication
        _handleBinaryMessage(messageBuffer) {
            let messageView8 = new Uint8Array(messageBuffer);

            // Arcade / PGD / KA / Fish games handshake & heartbeat check
            let decodedStr = DecodeMessage(messageBuffer);
            if (decodedStr.indexOf('#{') !== -1 || (messageView8.length === 4 && messageView8[1] === 0 && messageView8[2] === 0 && messageView8[3] === 0)) {
                
                if (messageView8.length === 4 && messageView8[1] === 0 && messageView8[2] === 0 && messageView8[3] === 0) {
                    // Heartbeat response
                    let response = new ArrayBuffer(4);
                    let bufView = new Int8Array(response);
                    bufView[0] = 3;
                    bufView[1] = 0;
                    bufView[2] = 0;
                    bufView[3] = 0;
                    setTimeout(() => {
                        if (this.onmessage) this.onmessage({ data: response });
                    }, 5);
                    return;
                }

                let wf = decodedStr.indexOf('{"');
                let jsonStr = "";
                if (wf !== -1) {
                    jsonStr = decodedStr.substring(wf);
                }
                
                let msgJson;
                try {
                    msgJson = JSON.parse(jsonStr);
                } catch (e) {
                    return;
                }

                if (this.msgId === 0) {
                    // Handshake response
                    this.gameName = msgJson.gameName || 'FishHunterKA';
                    this.cookie = msgJson.cookie;
                    
                    let payloadStr = '...#{"code":200,"sys":{"heartbeat":30}}';
                    let payloadBuf = new TextEncoder().encode(payloadStr);
                    let response = new ArrayBuffer(3 + payloadBuf.length);
                    let responseView = new Uint8Array(response);
                    responseView[0] = 1;
                    responseView[1] = 0;
                    responseView[2] = 0;
                    responseView.set(payloadBuf, 3);

                    setTimeout(() => {
                        if (this.onmessage) this.onmessage({ data: response });
                    }, 10);
                    
                    this.msgId++;
                    return;
                }

                this.msgId++;
                let targetUrl = window.APP_BASE_URL || (window.location.origin + '/game/' + this.gameName + '/server?sessionId=' + this.sessionId);
                if (targetUrl.indexOf('/game/') === -1) {
                    targetUrl = window.location.origin + '/game/' + this.gameName + '/server?sessionId=' + this.sessionId;
                }

                let params = {
                    reqDat: msgJson,
                    gameName: this.gameName
                };

                fetch(targetUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify(params)
                })
                .then(res => res.text())
                .then(body => {
                    let payloadBuf = new TextEncoder().encode(body);
                    let response = new ArrayBuffer(3 + payloadBuf.length);
                    let responseView = new Uint8Array(response);
                    responseView[0] = 1;
                    responseView[1] = 0;
                    responseView[2] = 0;
                    responseView.set(payloadBuf, 3);

                    if (this.onmessage) {
                        this.onmessage({ data: response });
                    }
                })
                .catch(err => console.error("[MockWS] Arcade error:", err));

                return;
            }

            if (this.msgId === 0) {
                // Message 0 is the connection init JSON string packet inside the binary frame
                let msgString = DecodeMessage(messageBuffer);
                let jsonStr = msgString.split(":::")[1];
                if (!jsonStr) return;

                let msgJson = JSON.parse(jsonStr);
                this.cookie = msgJson.cookie;
                this.sessionId = msgJson.sessionId;
                this.gameName = msgJson.gameName;

                // Send the hardcoded connection acknowledgement packet
                setTimeout(() => {
                    let ack = hexToArrayBuffer('010010000000eb297b05000000001ed9000081300100010000001900000faffff100204e00000a000000204e0000840a00005d0000003c0000000f00000000000000010000000100000001000000010000001027000077943febd0974dbcae489bf1f311b770ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff32be050005004d61727932010000006a1fd7dd00000000');
                    if (this.onmessage) this.onmessage({ data: ack });
                }, 10);

                this.msgId++;
                return;
            }

            // Determine actions and templates based on message structure
            let action = '';
            let templateHex = '';
            let reqDat = null;

            if (this.msgId === 1) {
                templateHex = '010014000000840a00000000000000000000e3c82a5c00000000';
                action = 'Init1';
            } else if (this.msgId === 2) {
                templateHex = '01003a0000004803000003005553440100000001000000605e9f0500000000';
                action = 'Init2';
            } else if (this.msgId === 3) {
                templateHex = '010029000000000000000000000032be05000000000014f4c4fd00000000';
                action = 'getBalance';
            } else if (this.msgId === 4) {
                templateHex = '01003d00000064000000840a000000000000000000004803000003005553440100000001000000651404db00000000';
                action = 'Act61';
            } else {
                let code = messageView8[6];
                if (code === 54) {
                    templateHex = '01003600000002a40e0000000000008813000000000000071800000000000010270000000000008b2a000000000000204e000000000000bb5d00000000000050c30000000000000f004a41434b504f5420252e326c662020019cbbb21700000000';
                    action = 'Ping';
                } else if (code === 58) {
                    templateHex = '01003a0000004803000003005553440100000001000000605e9f0500000000';
                    action = 'Act58';
                } else if (code === 41) {
                    templateHex = '010029000000840a00000000000032be05000000000014f4c4fd00000000';
                    action = 'Act41';
                } else if (code === 61) {
                    templateHex = '01003d00000001000000560f0000000000000000000048030000030055534401000000010000003861720700000000';
                    action = 'Act61';
                } else if (code === 18) {
                    action = 'Act18';
                    if (messageView8.length >= 64) {
                        templateHex = '010012000000ff014d00080304020b0908020b0a0a0703030500000000000000000000000000000000000000002e0f000000000000000000000000000000000000cf0e000000000000e583a25c0100002e0f000000000000ffffffffb37d203300000000';
                        let msgString = DecodeMessage(messageBuffer);
                        let splitArr = msgString.split("::");
                        if (splitArr[1]) {
                            try {
                                reqDat = JSON.parse(splitArr[1].split("###")[0]);
                            } catch (e) {}
                        }
                    } else {
                        templateHex = '010012000000ff015e00000000000000000032be0500ff0100000000000048003008d1a12800000001000000be00000000000000560f0000060200080b050509090a0a06080005000000000000000000000000000000000000000000000000000000000001000000560f000000000000ffffffff23f747b200000000';
                        if (this.gameName === 'HaresRevengeMN') {
                            templateHex = '01001200000007025e00000000000000000032be0500070200000000000048003008d1a10a0000000100000000000000000000005a1d00000306080900090607090009060603070000000000000000000000000000000000000000000000000000000000010000005a1d000000000000ffffffff4139a60200000000';
                        } else if (this.gameName === 'EmeraldCityMN') {
                            templateHex = '0100120000004002ae00000000000000000032be0500400200000000000098003008d1a132000000010000006900000000000000af1a00000700060902070006090207000600020700000002070a000003070a000003070a000003070a000003000000000000e63f000000000000f63f000000000000064000000000000016400000000000000000000000000000000000000000000000000600000000000000000000000000000000000000000000000000000001000000af1a000000000000ffffffff9c515b0f00000000';
                        }
                    }
                }
            }

            this.msgId++;

            if (!action) return;

            // Make HTTP POST call to Laravel
            let targetUrl = window.APP_BASE_URL || (window.location.origin + '/game/' + this.gameName + '/server?sessionId=' + this.sessionId);
            if (targetUrl.indexOf('/game/') === -1) {
                targetUrl = window.location.origin + '/game/' + this.gameName + '/server?sessionId=' + this.sessionId;
            }

            let command = '';
            if (reqDat && reqDat.command) {
                command = reqDat.command;
            } else if (action === 'Init1') {
                command = 'login';
            } else if (action === 'Init2') {
                command = 'settings';
            } else if (action === 'getBalance' || action === 'Act61' || action === 'Act58' || action === 'Act41') {
                command = 'subscribe';
            } else {
                command = action;
            }

            let params = {
                msgId: this.msgId - 1,
                action: action,
                command: command,
                reqDat: reqDat,
                messageId: (reqDat && reqDat.messageId) ? reqDat.messageId : (this.msgId - 1),
                gameIdentificationNumber: (reqDat && reqDat.gameIdentificationNumber) ? reqDat.gameIdentificationNumber : 521
            };
            if (reqDat && typeof reqDat === 'object') {
                Object.assign(params, reqDat);
            }

            fetch(targetUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(params)
            })
            .then(res => res.text())
            .then(body => {
                let jsonStr = body.split(":::")[1];
                if (!jsonStr) return;

                let sAnswer;
                try {
                    sAnswer = JSON.parse(jsonStr);
                } catch (e) {
                    return;
                }

                // Modify binary template buffer with Laravel response values
                let ab = hexToArrayBuffer(templateHex);
                let responsePacket = new OutcomingPacket();
                responsePacket.writeBuffer(ab);

                if (sAnswer.action === "getBalance") {
                    responsePacket.offset = 10;
                    responsePacket.writeString(sAnswer.currency);
                    responsePacket.offset = 6;
                    responsePacket.writeUint32(sAnswer.Credit);
                }

                if (sAnswer.action === "Init2" || sAnswer.action === "Act58") {
                    responsePacket.offset = 10;
                    responsePacket.writeString(sAnswer.currency);
                }

                if (sAnswer.action === "Act61") {
                    responsePacket.offset = 26;
                    responsePacket.writeString(sAnswer.currency);
                    responsePacket.offset = 6;
                    responsePacket.writeUint32(sAnswer.Denom);
                    responsePacket.offset = 10;
                    responsePacket.writeUint32(sAnswer.Credit);
                }

                if (sAnswer.action === "Act41") {
                    responsePacket.offset = 6;
                    responsePacket.writeUint32(sAnswer.Credit);
                }

                if (sAnswer.action === "Act18") {
                    responsePacket.offset = 52;
                    responsePacket.writeUint32(sAnswer.Credit);
                    responsePacket.offset = 104;
                    responsePacket.writeUint32(sAnswer.Credit);

                    if (sAnswer.serverResponse && sAnswer.serverResponse.payload) {
                        let payload = sAnswer.serverResponse.payload;
                        responsePacket.offset = 76;
                        responsePacket.writeUint32(payload.serverResponse.totalFreeGames || 0);
                        responsePacket.offset = 84;
                        responsePacket.writeUint32(payload.serverResponse.fscount || 0);
                        responsePacket.offset = 40;
                        responsePacket.writeUint32(payload.serverResponse.slotBet || 0);
                        responsePacket.offset = 88;
                        responsePacket.writeUint32(payload.serverResponse.bonusWin || 0);
                        responsePacket.offset = 100;
                        responsePacket.writeUint8(sAnswer.Denom || 1);

                        let reels = payload.serverResponse.reelsSymbols;
                        if (reels) {
                            let cOffset = 56;
                            for (let i = 0; i < 3; i++) {
                                for (let j = 1; j <= 5; j++) {
                                    let curSym = reels['reel' + j][i];
                                    responsePacket.offset = cOffset;
                                    responsePacket.writeUint8(curSym);
                                    cOffset++;
                                }
                            }
                        }
                    }
                }

                if (sAnswer.action === "Act27") {
                    let payload = JSON.parse(sAnswer.serverResponse.payload);
                    // Add customized offset updates for Act27 if needed
                }

                if (sAnswer.action === "Act25") {
                    let payload = JSON.parse(sAnswer.serverResponse.payload);
                    let reels = payload.serverResponse.reelsSymbols;
                    let cOffset = 10;
                    if (reels) {
                        for (let i = 0; i < 8; i++) {
                            for (let j = 1; j <= 5; j++) {
                                let curSym = reels['reel' + j][i];
                                responsePacket.offset = cOffset;
                                responsePacket.writeUint8(curSym);
                                cOffset++;
                            }
                        }
                    }
                    for (let i = 0; i < 50; i++) {
                        let curWin = payload.serverResponse.spinWinsPrize[i];
                        let curWinMask = payload.serverResponse.spinWinsMask[i];
                        if (curWin > 0) {
                            responsePacket.offset = cOffset;
                            responsePacket.writeUint32(curWin);
                            responsePacket.offset = cOffset + 4;
                            responsePacket.writeUint8(curWinMask);
                        }
                        cOffset += 5;
                    }
                    cOffset = 356;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.scattersWin);
                    cOffset += 4;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.swm);
                    cOffset += 4;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.fsnew);
                    cOffset += 4;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.fscount);
                }

                if (sAnswer.action === "Act26") {
                    let payload = JSON.parse(sAnswer.serverResponse.payload);
                    let reels = payload.serverResponse.reelsSymbols;
                    let cOffset = 10;
                    if (reels) {
                        for (let i = 0; i < 15; i++) {
                            for (let j = 1; j <= 5; j++) {
                                let curSym = reels['reel' + j][i];
                                responsePacket.offset = cOffset;
                                responsePacket.writeUint8(curSym);
                                cOffset++;
                            }
                        }
                    }
                    for (let i = 0; i < 50; i++) {
                        let curWin = payload.serverResponse.spinWinsPrize[i];
                        let curWinMask = payload.serverResponse.spinWinsMask[i];
                        if (curWin > 0) {
                            responsePacket.offset = cOffset;
                            responsePacket.writeUint32(curWin);
                            responsePacket.offset = cOffset + 4;
                            responsePacket.writeUint8(curWinMask);
                        }
                        cOffset += 5;
                    }
                    cOffset = 335;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.scattersWin);
                    cOffset += 4;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.swm);
                    cOffset += 4;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.fsnew);
                    cOffset += 4;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.fscount);
                }

                if (sAnswer.action === "Act21") {
                    let payload = JSON.parse(sAnswer.serverResponse.payload);
                    responsePacket.offset = 10;
                    responsePacket.writeUint32(payload.serverResponse.totalWin);
                }

                if (sAnswer.action === "Act19") {
                    let payload = JSON.parse(sAnswer.serverResponse.payload);
                    let reels = payload.serverResponse.reelsSymbols;
                    let wins = payload.serverResponse.spinWins;

                    responsePacket.offset = 100;
                    responsePacket.writeUint32(sAnswer.Credit);

                    let cOffset = 10;
                    if (reels) {
                        for (let i = 0; i < 3; i++) {
                            for (let j = 1; j <= 5; j++) {
                                let curSym = reels['reel' + j][i];
                                responsePacket.offset = cOffset;
                                responsePacket.writeUint8(curSym);
                                cOffset++;
                            }
                        }
                    }
                    responsePacket.offset = 8;
                    responsePacket.writeUint16(77 + (wins.length * 13));

                    if (sAnswer.gameid) {
                        responsePacket.offset = 6;
                        responsePacket.writeUint16(sAnswer.gameid);
                    }
                    responsePacket.offset = 25;
                    responsePacket.writeUint32(wins.length);

                    cOffset = 29;
                    for (let i = 0; i < wins.length; i++) {
                        let curWin = wins[i];
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint8(curWin[0]);
                        responsePacket.offset = cOffset + 1;
                        responsePacket.writeUint32(curWin[1]);
                        responsePacket.offset = cOffset + 5;
                        responsePacket.writeUint32(curWin[2]);
                        responsePacket.offset = cOffset + 9;
                        responsePacket.writeUint32(curWin[3]);
                        cOffset += 13;
                    }
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.scattersWin);
                    cOffset += 4;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.swm);
                    cOffset += 4;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.fsnew);
                    cOffset += 4;
                    responsePacket.offset = cOffset;
                    responsePacket.writeUint32(payload.serverResponse.fscount);
                }

                if (sAnswer.action === "Act20") {
                    let payload = JSON.parse(sAnswer.serverResponse.payload);
                    let reels = payload.serverResponse.reelsSymbols;

                    let cOffset = 10;
                    if (reels) {
                        for (let i = 0; i < 3; i++) {
                            for (let j = 1; j <= 5; j++) {
                                let curSym = reels['reel' + j][i];
                                responsePacket.offset = cOffset;
                                responsePacket.writeUint8(curSym);
                                cOffset++;
                            }
                        }
                    }
                    if (sAnswer.gameid) {
                        responsePacket.offset = 6;
                        responsePacket.writeUint16(sAnswer.gameid);
                    }
                    cOffset = 25;
                    for (let i = 0; i < 10; i++) {
                        let curWin = payload.serverResponse.spinWinsPrize[i];
                        let curWinMask = payload.serverResponse.spinWinsMask[i];
                        if (curWin > 0) {
                            responsePacket.offset = cOffset;
                            responsePacket.writeUint32(curWin);
                            responsePacket.offset = cOffset + 4;
                            responsePacket.writeUint8(curWinMask);
                        }
                        cOffset += 5;
                    }

                    if (this.gameName === 'LeosTreasureMN') {
                        cOffset = 79;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.scattersWin);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.swm);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.fsnew);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.fscount);
                    } else if (this.gameName === 'MayaTreasureMN') {
                        cOffset = 75;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.bonusWin0);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.scattersWin);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.swm);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.fsnew);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.fscount);
                    } else if (this.gameName === 'VikingAxeMN') {
                        cOffset = 75;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.scattersWin);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.swm);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.fsnew);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.fscount);
                    } else {
                        cOffset = 75;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.scattersWin);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.swm);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.fsnew);
                        cOffset += 4;
                        responsePacket.offset = cOffset;
                        responsePacket.writeUint32(payload.serverResponse.fscount);
                    }
                }

                // Send processed binary buffer back to client
                if (this.onmessage) {
                    this.onmessage({ data: responsePacket.getBuffer() });
                }
            })
            .catch(err => console.error("[MockWS] Binary error calling server:", err));
        }
    }

    // Attach WebSocket state constants expected by third-party game engines
    MockWebSocket.CONNECTING = 0;
    MockWebSocket.OPEN = 1;
    MockWebSocket.CLOSING = 2;
    MockWebSocket.CLOSED = 3;
    MockWebSocket.prototype.CONNECTING = 0;
    MockWebSocket.prototype.OPEN = 1;
    MockWebSocket.prototype.CLOSING = 2;
    MockWebSocket.prototype.CLOSED = 3;

    // Replace browser's native WebSocket class
    window.WebSocket = MockWebSocket;
    console.log("[MockWS] Global window.WebSocket successfully mocked with state constants.");

})();
