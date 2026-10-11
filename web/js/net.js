// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
// net.js — клиент WebSocket для multi-screen режима (ТВ + контроллеры).
(function (global) {
  'use strict';

  function wsUrl(room, role, player, name) {
    var proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    var q = new URLSearchParams({
      room: room,
      role: role,
      player: player,
      name: name || 'Гость',
    });
    return proto + location.host + '/ws?' + q.toString();
  }

  /**
   * Подключение к комнате с авто-реконнектом.
   * opts: { room, role, player, name, onMessage, onStatus }
   */
  function connectRoom(opts) {
    var ws = null;
    var closed = false;
    var retry = 500;

    function open() {
      if (closed) return;
      ws = new WebSocket(wsUrl(opts.room, opts.role, opts.player, opts.name));
      ws.onopen = function () {
        retry = 500;
        if (opts.onStatus) opts.onStatus('online');
      };
      ws.onmessage = function (ev) {
        try {
          var msg = JSON.parse(ev.data);
          if (opts.onMessage) opts.onMessage(msg);
        } catch (e) {
          /* ignore */
        }
      };
      ws.onclose = function () {
        if (opts.onStatus) opts.onStatus('offline');
        if (!closed) {
          setTimeout(open, retry);
          retry = Math.min(retry * 2, 8000);
        }
      };
      ws.onerror = function () {
        try { ws.close(); } catch (e) { /* ignore */ }
      };
    }
    open();

    return {
      send: function (msg) {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg));
      },
      close: function () {
        closed = true;
        if (ws) ws.close();
      },
    };
  }

  /** Стабильный гостевой id игрока (localStorage). */
  function playerId() {
    var k = 'piegeddon_player_id';
    var v = localStorage.getItem(k);
    if (!v) {
      v = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem(k, v);
    }
    return v;
  }

  function playerName() {
    return localStorage.getItem('piegeddon_name') || 'Гость';
  }

  function setPlayerName(n) {
    localStorage.setItem('piegeddon_name', n);
  }

  async function api(path, body) {
    var res = await fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    return res.json();
  }

  global.PieNet = {
    connectRoom: connectRoom,
    playerId: playerId,
    playerName: playerName,
    setPlayerName: setPlayerName,
    api: api,
  };
})(window);
