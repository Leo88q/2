// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
// app.js — экраны меню/игры/наград, тач-управление, claim NFT.
(function () {
  'use strict';

  var api = function (path, body) {
    return fetch(path, {
      method: body ? 'POST' : 'GET',
      headers: { 'content-type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) { return r.json(); });
  };

  // --- Профиль игрока -------------------------------------------------------
  function playerId() {
    var k = 'piegeddon_player_id';
    var v = localStorage.getItem(k);
    if (!v) {
      v = 'p_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
      localStorage.setItem(k, v);
    }
    return v;
  }

  var state = {
    playerId: playerId(),
    name: localStorage.getItem('piegeddon_name') || 'Игрок',
    faction: localStorage.getItem('piegeddon_faction') || 'crust',
    game: null,
  };

  function $(id) { return document.getElementById(id); }

  function show(screen) {
    ['menu', 'game', 'reward', 'about'].forEach(function (s) {
      $('screen-' + s).classList.toggle('active', s === screen);
    });
    window.scrollTo(0, 0);
  }

  // --- Меню: фракции --------------------------------------------------------
  function renderFactionPicker() {
    var grid = $('factionPicker');
    grid.innerHTML = '';
    Object.keys(PieGame.FACTIONS).forEach(function (key) {
      var f = PieGame.FACTIONS[key];
      var card = document.createElement('button');
      card.className = 'faction-card' + (key === state.faction ? ' selected' : '');
      card.innerHTML =
        '<img src="/img/' + f.img + '.png" alt="' + f.name + '" onerror="this.style.display=\'none\'">' +
        '<b>' + f.name + '</b>';
      card.addEventListener('click', function () {
        state.faction = key;
        localStorage.setItem('piegeddon_faction', key);
        renderFactionPicker();
      });
      grid.appendChild(card);
    });
  }

  // --- Игра -----------------------------------------------------------------
  function startMatch() {
    show('game');
    var canvas = $('arena');
    var game = PieGame.createGame(canvas, {
      onMatchEnd: onMatchEnd,
    });
    state.game = game;

    game.addPlayer({
      id: state.playerId,
      name: state.name.slice(0, 12),
      faction: state.faction,
      control: 'human',
    });

    var aiNames = ['Барон Завар', 'Черри-Бомб', 'Меренга'];
    var aiFactions = ['custard', 'cherry', 'meringue'].filter(function (f) { return f !== state.faction; });
    var pool = Object.keys(PieGame.FACTIONS).filter(function (f) { return f !== state.faction; });
    for (var i = 0; i < 2; i++) {
      game.addPlayer({
        id: 'ai_' + i,
        name: aiNames[i],
        faction: pool[i % pool.length],
        control: 'ai',
      });
    }

    game.beginRound();
    game.start();
    flash('ПОЕХАЛИ!');
  }

  function flash(text) {
    var d = document.createElement('div');
    d.className = 'flash';
    d.textContent = text;
    $('screen-game').appendChild(d);
    setTimeout(function () { d.remove(); }, 1200);
  }

  // --- Тач-управление -------------------------------------------------------
  function bindHold(id, onDown, onUp) {
    var el = $(id);
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      el.classList.add('pressed');
      if (navigator.vibrate) navigator.vibrate(8);
      onDown();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
      el.addEventListener(ev, function () {
        el.classList.remove('pressed');
        if (onUp) onUp();
      });
    });
  }

  function bindControls() {
    var me = function () { return state.playerId; };
    bindHold('btnLeft', function () { state.game.setInput(me(), { move: -1 }); }, function () { state.game.setInput(me(), { move: 0 }); });
    bindHold('btnRight', function () { state.game.setInput(me(), { move: 1 }); }, function () { state.game.setInput(me(), { move: 0 }); });
    bindHold('btnAimUp', function () { state.game.setInput(me(), { aim: 1 }); }, function () { state.game.setInput(me(), { aim: 0 }); });
    bindHold('btnAimDown', function () { state.game.setInput(me(), { aim: -1 }); }, function () { state.game.setInput(me(), { aim: 0 }); });
    bindHold('btnThrow', function () { state.game.setInput(me(), { charging: true }); }, function () { state.game.setInput(me(), { charging: false }); });
    $('btnBlock').addEventListener('pointerdown', function (e) {
      e.preventDefault();
      state.game.setInput(me(), { block: true });
      $('btnBlock').classList.add('pressed');
      setTimeout(function () {
        state.game && state.game.setInput(me(), { block: false });
        $('btnBlock').classList.remove('pressed');
      }, 450);
    });

    // Клавиатура — для удобства на десктопе
    var map = {
      KeyA: { move: -1 }, KeyD: { move: 1 },
      KeyW: { aim: 1 }, KeyS: { aim: -1 },
      KeyF: { charging: true }, KeyG: { block: true },
    };
    window.addEventListener('keydown', function (e) {
      if (map[e.code] && state.game) state.game.setInput(me(), map[e.code]);
    });
    window.addEventListener('keyup', function (e) {
      if (map[e.code] && state.game) {
        var up = {};
        Object.keys(map[e.code]).forEach(function (k) { up[k] = k === 'move' || k === 'aim' ? 0 : false; });
        state.game.setInput(me(), up);
      }
    });
  }

  // --- HUD ------------------------------------------------------------------
  setInterval(function () {
    if (!state.game) return;
    var h = state.game.hud();
    $('hudTimer').textContent = Math.floor(h.roundTime / 60) + ':' + ('0' + (h.roundTime % 60)).slice(-2);
    $('hudRound').textContent = 'Раунд ' + h.round;
    $('hudPlayers').innerHTML = h.players.map(function (p) {
      var hearts = '';
      for (var i = 0; i < 3; i++) hearts += '<span class="' + (i < p.hp ? 'hp on' : 'hp') + '">♥</span>';
      return (
        '<div class="hud-chip ' + (p.alive ? '' : 'dead') + '">' +
        '<img src="/img/' + PieGame.FACTIONS[p.faction].img + '.png" alt="" onerror="this.remove()">' +
        '<div><b>' + escapeHtml(p.name) + '</b><div class="hearts">' + hearts + '</div></div></div>'
      );
    }).join('');
  }, 200);

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // --- Награды / claim ------------------------------------------------------
  var reported = false;

  function onMatchEnd(winnerId, players) {
    var winner = players.find(function (p) { return p.id === winnerId; });
    $('rewardTitle').textContent = winner && winner.won ? winner.name + ' побеждает!' : 'Матч окончен';
    if (winner) {
      $('rewardArt').src = '/img/' + PieGame.FACTIONS[winner.faction].img + '.png';
    }
    show('reward');

    var me = players.find(function (p) { return p.id === state.playerId; });
    if (reported || !me) return;
    reported = true;

    api('/api/match', {
      matchId: 'web_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      mode: 'ffa',
      durationSec: 90,
      source: 'web',
      players: [me],
    }).then(function (res) {
      var list = $('rewardList');
      list.innerHTML = '';
      var rewards = res.players && res.players[0] ? res.players[0].rewards : [];
      rewards.forEach(function (r) {
        var d = document.createElement('div');
        d.className = 'reward-item rarity-' + r.rarity;
        d.textContent = r.title + ' · ' + r.rarity;
        list.appendChild(d);
      });
      if (!list.children.length) {
        list.innerHTML = '<div class="reward-item">Награды копятся — забери их, подключив кошелёк</div>';
      }
    });

    loadLeaderboard();
  }

  function loadLeaderboard() {
    api('/api/leaderboard').then(function (res) {
      $('leaderboard').innerHTML = (res.entries || []).slice(0, 5).map(function (e) {
        return '<div class="lb-row"><span class="lb-rank">' + e.rank + '</span>' +
          escapeHtml(e.name) + '<span class="lb-pts">' + e.seasonPoints + '</span></div>';
      }).join('');
    }).catch(function () {});
  }

  $('btnDemoWallet').addEventListener('click', function () {
    var alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    var w = '';
    for (var i = 0; i < 44; i++) w += alphabet[Math.floor(Math.random() * alphabet.length)];
    $('walletInput').value = w;
  });

  $('btnClaim').addEventListener('click', function () {
    var wallet = $('walletInput').value.trim();
    var out = $('claimResult');
    if (wallet.length < 32) {
      out.textContent = 'Введи кошелёк или нажми «Демо-кошелёк»';
      return;
    }
    out.textContent = 'Минтим cNFT…';
    api('/api/claim', { playerId: state.playerId, wallet: wallet }).then(function (res) {
      out.innerHTML = (res.results || []).map(function (r) {
        return r.ok
          ? '✅ ' + escapeHtml(r.title) + ' → <code>' + escapeHtml(r.signature) + '</code>'
          : '❌ ' + escapeHtml(r.title) + ': ' + escapeHtml(r.error || 'failed');
      }).join('<br>') || 'Нет ожидающих наград';
    }).catch(function (e) {
      out.textContent = 'Ошибка: ' + e.message;
    });
  });

  $('btnRematch').addEventListener('click', function () {
    reported = false;
    if (state.game) state.game.stop();
    startMatch();
  });

  $('btnToMenu').addEventListener('click', function () {
    if (state.game) state.game.stop();
    show('menu');
    loadLeaderboard();
  });

  // --- Навигация меню -------------------------------------------------------
  $('btnPlay').addEventListener('click', function () {
    reported = false;
    startMatch();
  });
  $('btnAbout').addEventListener('click', function () { show('about'); });
  $('btnBackFromAbout').addEventListener('click', function () { show('menu'); });
  $('btnBackToMenu2').addEventListener('click', function () {
    if (state.game) state.game.stop();
    show('menu');
  });

  // --- Инициализация --------------------------------------------------------
  renderFactionPicker();
  bindControls();
  PieGame.loadAssets();
  loadLeaderboard();
  show('menu');

  // Реферальная ссылка /?ref=CODE
  var ref = new URLSearchParams(location.search).get('ref');
  if (ref && !localStorage.getItem('piegeddon_ref_done')) {
    localStorage.setItem('piegeddon_ref_done', '1');
    api('/api/referral/redeem', {
      code: ref.toUpperCase(),
      playerId: state.playerId,
      name: state.name,
      faction: state.faction,
    }).then(function (r) {
      if (r.ok) {
        var note = document.createElement('div');
        note.className = 'toast';
        note.textContent = '🎁 Гостевой скин «Зрительский Пирог» получен!';
        document.body.appendChild(note);
        setTimeout(function () { note.remove(); }, 4000);
      }
    }).catch(function () {});
  }
})();
