// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
// tv.js — арена на ТВ: комнаты, клавиатура, награды, отчёт о матче.
(function () {
  'use strict';

  var api = PieNet.api;
  var playerId = PieNet.playerId();
  var roomCode = '';
  var conn = null;
  var game = null;
  var remoteByPlayer = {}; // playerId -> true
  var reported = false;

  var lobbyEl = document.getElementById('lobby');
  var rewardEl = document.getElementById('rewardPanel');
  var roomCodeEl = document.getElementById('roomCode');
  var lobbyPlayersEl = document.getElementById('lobbyPlayers');
  var hudEl = document.getElementById('hud');

  function el(id) { return document.getElementById(id); }

  async function initRoom() {
    var res = await api('/api/rooms', {});
    roomCode = res.code;
    roomCodeEl.textContent = roomCode;
  }

  function connectSocket() {
    conn = PieNet.connectRoom({
      room: roomCode,
      role: 'tv',
      player: 'tv_' + playerId,
      name: 'ТВ Арена',
      onMessage: function (msg) {
        if (msg.type === 'input' && msg.from) {
          if (game && remoteByPlayer[msg.from]) {
            var input = {};
            if (msg.action === 'move') input.move = msg.value;
            if (msg.action === 'aim') input.aim = msg.value;
            if (msg.action === 'charge') input.charging = !!msg.value;
            if (msg.action === 'block') input.block = !!msg.value;
            game.setInput(msg.from, input);
            if (msg.action === 'block') {
              setTimeout(function () { game.setInput(msg.from, { block: false }); }, 450);
            }
          }
        } else if (msg.type === 'presence') {
          renderLobbyPlayers(msg.players || []);
        }
      },
    });
  }

  function renderLobbyPlayers(list) {
    lobbyPlayersEl.innerHTML = '';
    list.forEach(function (p) {
      var d = document.createElement('div');
      d.className = 'lobby-chip';
      d.textContent = '🎮 ' + p.name;
      lobbyPlayersEl.appendChild(d);
      remoteByPlayer[p.playerId] = true;
    });
  }

  function keyboardInput(id) {
    var down = {};
    window.addEventListener('keydown', function (e) {
      if (down[e.code]) return;
      down[e.code] = true;
      mapKey(e.code, true);
    });
    window.addEventListener('keyup', function (e) {
      down[e.code] = false;
      mapKey(e.code, false);
    });

    function mapKey(code, isDown) {
      if (!game) return;
      var v = isDown ? 1 : 0;
      switch (code) {
        case 'KeyA': game.setInput(id, { move: isDown ? -1 : 0 }); break;
        case 'KeyD': game.setInput(id, { move: isDown ? 1 : 0 }); break;
        case 'KeyW': game.setInput(id, { aim: isDown ? 1 : 0 }); break;
        case 'KeyS': game.setInput(id, { aim: isDown ? -1 : 0 }); break;
        case 'KeyF': game.setInput(id, { charging: isDown }); break;
        case 'KeyG': game.setInput(id, { block: isDown }); break;
        default: break;
      }
    }
  }

  function startMatch() {
    lobbyEl.classList.add('hidden');
    rewardEl.classList.add('hidden');
    reported = false;

    var canvas = el('arena');
    game = PieGame.createGame(canvas, {
      onMatchEnd: onMatchEnd,
      onRoundStart: function () { flash('РАУНД ' + game.hud().round); },
      onRoundEnd: function () { /* оверлей рисует сам движок */ },
    });

    // Слот 1: локальный игрок с клавиатурой.
    game.addPlayer({
      id: playerId,
      name: (localStorage.getItem('piegeddon_name') || 'Игрок 1'),
      faction: localStorage.getItem('piegeddon_faction') || 'crust',
      control: 'human',
    });

    // Дальше — подключённые пульты (до 4 всего).
    var remotes = Object.keys(remoteByPlayer);
    for (var i = 0; i < remotes.length && game.players().length < 4; i++) {
      game.addPlayer({ id: remotes[i], name: 'Гость ' + (i + 1), faction: ['custard', 'cherry', 'meringue'][i % 3], control: 'remote' });
    }
    // ИИ добивает до 3 участников.
    var aiNames = ['Барон Завар', 'Черри-Бомб', 'Меренга-Призрак'];
    var aiFactions = ['custard', 'cherry', 'meringue'];
    var n = 0;
    while (game.players().length < 3 && n < 3) {
      game.addPlayer({ id: 'ai_' + n, name: aiNames[n], faction: aiFactions[n], control: 'ai' });
      n++;
    }

    keyboardInput(playerId);
    game.beginRound();
    game.start();
    flash('ПОЕХАЛИ!');
  }

  function flash(text) {
    var d = document.createElement('div');
    d.className = 'flash';
    d.textContent = text;
    document.getElementById('stage').appendChild(d);
    setTimeout(function () { d.remove(); }, 1200);
  }

  function onMatchEnd(winnerId, players) {
    var winner = players.find(function (p) { return p.id === winnerId; });
    el('winnerName').textContent = winner ? winner.name : 'МАТЧ ОКОНЧЕН';
    rewardEl.classList.remove('hidden');

    if (reported) return;
    reported = true;

    var humans = players.filter(function (p) { return p.id.indexOf('ai_') !== 0; });
    if (!humans.length) return;

    api('/api/match', {
      matchId: 'web_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      mode: 'ffa',
      durationSec: 90,
      source: 'web',
      players: humans.map(function (p) {
        return {
          id: p.id,
          name: p.name.slice(0, 24),
          faction: p.faction,
          hitsLanded: p.hitsLanded,
          hitsTaken: p.hitsTaken,
          won: p.won,
          eliminated: p.eliminated,
        };
      }),
    }).then(function (res) {
      var list = el('rewardList');
      list.innerHTML = '';
      (res.players || []).forEach(function (pr) {
        if (!pr.rewards.length) return;
        pr.rewards.forEach(function (r) {
          var d = document.createElement('div');
          d.className = 'reward-item rarity-' + r.rarity;
          d.textContent = r.title + ' · ' + r.rarity;
          list.appendChild(d);
        });
      });
      if (!list.children.length) {
        list.innerHTML = '<div class="reward-item">Награды копятся — забери их, подключив кошелёк</div>';
      }
    });
  }

  function updateHud() {
    if (!game) return;
    var h = game.hud();
    var html = h.players.map(function (p) {
      var hearts = '♥'.repeat(p.hp) + '<span class="hp-off">' + '♥'.repeat(Math.max(0, 3 - p.hp)) + '</span>';
      return (
        '<div class="hud-player ' + (p.alive ? '' : 'dead') + '">' +
        '<b>' + escapeHtml(p.name) + '</b> · ' + p.roundWins + ' побед · ' + hearts +
        '</div>'
      );
    }).join('');
    hudEl.innerHTML = html;
    if (h.phase === 'fight') {
      conn && conn.send({ type: 'hud', phase: h.phase, round: h.round, roundTime: h.roundTime, players: h.players });
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // --- Награды / claim ------------------------------------------------------
  el('btnDemoWallet').addEventListener('click', function () {
    var alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var w = '';
    for (var i = 0; i < 44; i++) w += alphabet[Math.floor(Math.random() * alphabet.length)];
    el('walletInput').value = w;
  });

  el('btnClaim').addEventListener('click', async function () {
    var wallet = el('walletInput').value.trim();
    var out = el('claimResult');
    if (wallet.length < 32) {
      out.textContent = 'Введи кошелёк или нажми «Демо-кошелёк»';
      return;
    }
    out.textContent = 'Минтим cNFT…';
    try {
      var res = await api('/api/claim', { playerId: playerId, wallet: wallet });
      out.innerHTML = res.results.map(function (r) {
        return r.ok
          ? '✅ ' + escapeHtml(r.title) + ' → <code>' + escapeHtml(r.signature) + '</code>'
          : '❌ ' + escapeHtml(r.title) + ': ' + escapeHtml(r.error || 'failed');
      }).join('<br>') || 'Нет ожидающих наград';
    } catch (e) {
      out.textContent = 'Ошибка: ' + e.message;
    }
  });

  el('btnRematch').addEventListener('click', function () {
    rewardEl.classList.add('hidden');
    if (game) game.stop();
    startMatch();
  });

  el('btnStart').addEventListener('click', startMatch);
  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' && !lobbyEl.classList.contains('hidden')) {
      e.preventDefault();
      startMatch();
    }
  });

  setInterval(updateHud, 200);

  initRoom().then(connectSocket);
})();
