// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
// controller.js — пульт на телефоне: движение, прицел, зарядка, блок, рефералки.
(function () {
  'use strict';

  var api = PieNet.api;
  var playerId = PieNet.playerId();
  var conn = null;
  var params = new URLSearchParams(location.search);
  var refCode = (params.get('ref') || '').toUpperCase();

  var FACTIONS = [
    { id: 'crust', name: 'Красты', emoji: '🛡', desc: 'Танки, блок' },
    { id: 'custard', name: 'Заварки', emoji: '🍮', desc: 'Заряженный бросок' },
    { id: 'cherry', name: 'Вишенки', emoji: '🍒', desc: 'Скорость' },
    { id: 'meringue', name: 'Меренги', emoji: '☁️', desc: 'Дальний бросок' },
  ];
  var faction = localStorage.getItem('piegeddon_faction') || 'crust';

  function el(id) { return document.getElementById(id); }

  // --- Экран входа ----------------------------------------------------------
  var grid = el('factionGrid');
  FACTIONS.forEach(function (f) {
    var b = document.createElement('button');
    b.className = 'faction-card' + (f.id === faction ? ' selected' : '');
    b.innerHTML = '<div class="fe">' + f.emoji + '</div><b>' + f.name + '</b><small>' + f.desc + '</small>';
    b.addEventListener('click', function () {
      faction = f.id;
      localStorage.setItem('piegeddon_faction', faction);
      grid.querySelectorAll('.faction-card').forEach(function (x) { x.classList.remove('selected'); });
      b.classList.add('selected');
    });
    grid.appendChild(b);
  });

  if (refCode) {
    el('refNote').textContent = 'Реферальный код ' + refCode + ' — активируем при входе';
    el('roomInput').value = '';
  }

  el('btnJoin').addEventListener('click', async function () {
    var code = el('roomInput').value.trim().toUpperCase();
    var name = el('nameInput').value.trim() || 'Гость';
    if (code.length !== 4) {
      el('joinError').textContent = 'Код должен быть из 4 символов';
      return;
    }
    PieNet.setPlayerName(name);

    if (refCode) {
      api('/api/referral/redeem', {
        code: refCode, playerId: playerId, name: name, faction: faction,
      }).then(function (r) {
        if (r.ok) {
          el('refNote').textContent = '🎁 Гостевой скин «Зрительский Пирог» получен!';
        }
      }).catch(function () {});
    }

    api('/api/rooms/' + code).then(function (room) {
      if (room.error) {
        el('joinError').textContent = 'Комната не найдена';
        return;
      }
      openPad(code, name);
    }).catch(function () {
      el('joinError').textContent = 'Сервер недоступен';
    });
  });

  // --- Пульт ----------------------------------------------------------------
  function openPad(code, name) {
    el('joinScreen').classList.add('hidden');
    el('padScreen').classList.remove('hidden');
    el('padName').textContent = name + ' · ' + (FACTIONS.find(function (f) { return f.id === faction; }) || {}).name;

    conn = PieNet.connectRoom({
      room: code,
      role: 'controller',
      player: playerId,
      name: name,
      onMessage: function (msg) {
        if (msg.type === 'hud') {
          var me = (msg.players || []).find(function (p) { return p.id === playerId; });
          if (me) {
            el('padHp').textContent = '♥'.repeat(me.hp) + '♡'.repeat(Math.max(0, 3 - me.hp));
            el('chargeBar').style.width = (me.charge || 0) + '%';
          }
          if (msg.roundTime != null) {
            var m = Math.floor(msg.roundTime / 60), s = msg.roundTime % 60;
            el('padTimer').textContent = m + ':' + (s < 10 ? '0' : '') + s;
          }
        } else if (msg.type === 'error') {
          el('padScreen').innerHTML = '<div class="panel"><h1>:(</h1><p>Комната закрылась. Обновите страницу.</p></div>';
        }
      },
    });

    function send(action, value) {
      conn.send({ type: 'input', action: action, value: value });
    }

    function holdButton(btn, onDown, onUp) {
      btn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        btn.classList.add('pressed');
        onDown();
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) {
        btn.addEventListener(ev, function () {
          btn.classList.remove('pressed');
          if (onUp) onUp();
        });
      });
    }

    holdButton(el('moveLeft'), function () { send('move', -1); }, function () { send('move', 0); });
    holdButton(el('moveRight'), function () { send('move', 1); }, function () { send('move', 0); });
    holdButton(el('aimUp'), function () { send('aim', 1); }, function () { send('aim', 0); });
    holdButton(el('aimDown'), function () { send('aim', -1); }, function () { send('aim', 0); });
    holdButton(el('btnThrow'), function () { send('charge', true); }, function () { send('charge', false); });

    el('btnBlock').addEventListener('pointerdown', function (e) {
      e.preventDefault();
      send('block', true);
      el('btnBlock').classList.add('pressed');
      setTimeout(function () {
        send('block', false);
        el('btnBlock').classList.remove('pressed');
      }, 400);
    });
  }
})();
