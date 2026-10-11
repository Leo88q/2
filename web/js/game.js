// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
// game.js — движок арены «Пирогеддон» (canvas): 2–4 игрока, пироги, блок, зарядка, ИИ.
(function (global) {
  'use strict';

  var W = 1280, H = 720, GROUND = 565;
  var GRAVITY = 1500;
  var WALK = 270;
  var PIE_SPEED_MIN = 320, PIE_SPEED_MAX = 900;
  var THROW_MIN = (-72 * Math.PI) / 180, THROW_MAX = (-16 * Math.PI) / 180;
  var MAX_HP = 3;
  var STUN = 0.7, BLOCK_TIME = 1.0, BLOCK_CD = 3.0;
  var ROUND_TIME = 90;

  var FACTIONS = {
    crust:    { color: '#c98d4e', dark: '#8a5a2b', hat: '#f3e2c7', name: 'Красты' },
    custard:  { color: '#f2c14e', dark: '#b8860b', hat: '#fff4d6', name: 'Заварки' },
    cherry:   { color: '#e4572e', dark: '#a12d12', hat: '#ffe3d6', name: 'Вишенки' },
    meringue: { color: '#d98cb3', dark: '#9c4d7f', hat: '#fdeef6', name: 'Меренги' },
  };

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function createPlayer(def, slot) {
    var x = [220, 520, 760, 1060][slot % 4];
    return {
      id: def.id,
      name: def.name || 'Игрок',
      faction: FACTIONS[def.faction] ? def.faction : 'crust',
      control: def.control || 'ai',
      slot: slot,
      x: x, y: GROUND,
      vx: 0,
      face: slot < 2 ? 1 : -1,
      aim: -Math.PI / 4,
      charging: false,
      charge: 0,
      blockT: 0,
      blockCd: 0,
      stun: 0,
      hp: MAX_HP,
      alive: true,
      roundWins: 0,
      input: { move: 0, aim: 0, charging: false, block: false },
      aiT: 0,
      aiMove: 0,
      throwQueued: false,
      stats: { hits: 0, taken: 0 },
    };
  }

  function createGame(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var players = [];
    var pies = [];
    var particles = [];
    var confetti = [];
    var round = 1;
    var targetRounds = opts.targetRounds || 2;
    var roundTime = ROUND_TIME;
    var phase = 'lobby'; // lobby | fight | round_end | match_end
    var phaseT = 0;
    var winnerId = null;
    var shake = 0;
    var lastTs = 0;
    var raf = 0;
    var flashT = 0;

    function addPlayer(def) {
      if (players.length >= 4) return null;
      var p = createPlayer(def, players.length);
      players.push(p);
      return p;
    }

    function setInput(id, input) {
      var p = byId(id);
      if (p) p.input = Object.assign(p.input, input);
    }

    function byId(id) {
      for (var i = 0; i < players.length; i++) if (players[i].id === id) return players[i];
      return null;
    }

    function spawnPie(p) {
      var speed = PIE_SPEED_MIN + p.charge * (PIE_SPEED_MAX - PIE_SPEED_MIN);
      pies.push({
        x: p.x + p.face * 34,
        y: p.y - 78,
        vx: Math.cos(p.aim) * speed * p.face,
        vy: Math.sin(p.aim) * speed,
        owner: p.id,
        rot: 0,
        r: 16 + p.charge * 10,
        life: 4,
      });
      burst(p.x + p.face * 40, p.y - 80, FACTIONS[p.faction].color, 6, 120);
    }

    function burst(x, y, color, n, speed) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var s = rand(speed * 0.3, speed);
        particles.push({
          x: x, y: y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80,
          life: rand(0.3, 0.8), t: 0,
          r: rand(3, 9), color: color,
        });
      }
    }

    function splat(x, y) {
      burst(x, y, '#fff6e8', 12, 260);
      burst(x, y, '#f2c14e', 8, 220);
      shake = Math.min(shake + 6, 18);
    }

    function hitPlayer(target, pie) {
      if (!target.alive) return;
      if (target.blockT > 0) {
        burst(target.x, target.y - 80, '#7fd1ff', 14, 300);
        shake = Math.min(shake + 3, 12);
        return;
      }
      target.hp -= 1;
      target.stats.taken += 1;
      target.stun = STUN;
      target.vx += (pie.vx > 0 ? 1 : -1) * 180;
      var owner = byId(pie.owner);
      if (owner) owner.stats.hits += 1;
      splat(target.x, target.y - 80);
      if (target.hp <= 0) {
        target.alive = false;
        burst(target.x, target.y - 80, FACTIONS[target.faction].color, 26, 380);
        for (var i = 0; i < 14; i++) {
          confetti.push({
            x: target.x + rand(-40, 40), y: target.y - 100,
            vx: rand(-160, 160), vy: rand(-320, -60),
            life: rand(0.8, 1.6), t: 0,
            r: rand(4, 8), color: ['#e4572e', '#f2c14e', '#7fd1ff', '#d98cb3', '#fff'][i % 5],
          });
        }
        checkRoundEnd();
      }
    }

    function alivePlayers() {
      return players.filter(function (p) { return p.alive; });
    }

    function checkRoundEnd() {
      if (phase !== 'fight') return;
      var alive = alivePlayers();
      if (alive.length <= 1 && players.length > 1) {
        endRound(alive.length === 1 ? alive[0] : null);
      }
    }

    function endRound(winner) {
      phase = 'round_end';
      phaseT = 2.6;
      winnerId = winner ? winner.id : null;
      if (winner) {
        winner.roundWins += 1;
        burst(winner.x, winner.y - 120, '#ffd700', 24, 420);
      }
      if (opts.onRoundEnd) opts.onRoundEnd(winnerId, round);
    }

    function maybeEndMatch() {
      var leader = null;
      for (var i = 0; i < players.length; i++) {
        if (players[i].roundWins >= targetRounds) { leader = players[i]; break; }
      }
      if (leader) {
        phase = 'match_end';
        phaseT = 0;
        winnerId = leader.id;
        if (opts.onMatchEnd) {
          opts.onMatchEnd(winnerId, players.map(function (p) {
            return {
              id: p.id, name: p.name, faction: p.faction,
              hitsLanded: p.stats.hits, hitsTaken: p.stats.taken,
              won: p.id === winnerId, eliminated: !p.alive,
            };
          }));
        }
        return true;
      }
      return false;
    }

    function startRound() {
      round += phase === 'lobby' ? 0 : 1;
      if (phase === 'lobby') round = 1;
      phase = 'fight';
      roundTime = ROUND_TIME;
      pies = [];
      particles = [];
      players.forEach(function (p, i) {
        p.x = [220, 520, 760, 1060][i % 4];
        p.hp = MAX_HP;
        p.alive = true;
        p.stun = 0;
        p.charge = 0;
        p.charging = false;
        p.blockT = 0;
        p.blockCd = 0;
        p.face = i < 2 ? 1 : -1;
      });
      if (opts.onRoundStart) opts.onRoundStart(round);
    }

    // --- ИИ ------------------------------------------------------------------
    function updateAI(p, dt) {
      p.aiT -= dt;
      var enemies = players.filter(function (e) { return e.id !== p.id && e.alive; });
      if (!enemies.length) { p.aiMove = 0; return; }
      var target = enemies.reduce(function (a, b) {
        return Math.abs(a.x - p.x) < Math.abs(b.x - p.x) ? a : b;
      }, enemies[0]);
      var dist = Math.abs(target.x - p.x);

      if (p.aiT <= 0) {
        p.aiT = rand(0.35, 0.9);
        if (dist > 520) p.aiMove = target.x > p.x ? 1 : -1;
        else if (dist < 260) p.aiMove = target.x > p.x ? -1 : 1;
        else p.aiMove = Math.random() < 0.5 ? -1 : Math.random() < 0.25 ? 1 : 0;

        if (Math.random() < 0.35) {
          p.input.block = true;
          setTimeout(function () { if (p.control === 'ai') p.input.block = false; }, rand(400, 900));
        }
      }

      p.face = target.x > p.x ? 1 : -1;
      // Баллистическая оценка угла: sin(2θ) = g·d / v²
      var v = 620;
      var s = (GRAVITY * dist) / (v * v);
      var angle = s >= 1 ? -Math.PI / 4 : -Math.asin(clamp(s, -1, 1)) / 2;
      p.aim = clamp(angle, THROW_MIN, THROW_MAX);

      // Появилась ли вражеская пирога рядом — блок.
      for (var i = 0; i < pies.length; i++) {
        var pie = pies[i];
        if (pie.owner !== p.id && Math.abs(pie.x - p.x) < 160 && Math.abs(pie.y - (p.y - 70)) < 120) {
          p.input.block = true;
          setTimeout(function () { if (p.control === 'ai') p.input.block = false; }, 700);
        }
      }

      if (p.input.charging) {
        p.charge = clamp(p.charge + dt * 0.9, 0, 1);
        if (p.charge >= rand(0.55, 1)) {
          p.throwQueued = true;
          p.input.charging = false;
        }
      } else if (!p.stun && Math.random() < dt * 0.7 && dist < 900) {
        p.input.charging = true;
        p.charge = 0;
      }
    }

    // --- Обновление ----------------------------------------------------------
    function update(dt) {
      if (phase === 'fight') {
        roundTime = Math.max(0, roundTime - dt);
        if (roundTime <= 0) {
          var alive = alivePlayers();
          var best = null;
          alive.forEach(function (p) {
            if (!best || p.hp > best.hp) best = p;
          });
          endRound(alive.length === 1 ? alive[0] : best);
        }
      } else if (phase === 'round_end') {
        phaseT -= dt;
        if (phaseT <= 0) {
          if (!maybeEndMatch()) startRound();
        }
      }

      players.forEach(function (p) {
        if (phase !== 'fight') {
          if (phase === 'match_end' && winnerId === p.id) {
            p.y = GROUND - Math.abs(Math.sin(performance.now() / 180)) * 26; // прыжки победителя
          }
          return;
        }
        if (p.control === 'ai') updateAI(p, dt);

        if (p.stun > 0) {
          p.stun -= dt;
          p.charging = false;
          p.charge = 0;
        } else {
          var move = p.input.move || 0;
          if (p.control === 'remote' || p.control === 'human') move = p.input.move;
          p.vx += (move * WALK - p.vx) * Math.min(1, dt * 12);
          p.x = clamp(p.x + p.vx * dt, 60, W - 60);
          if (move !== 0) p.face = move > 0 ? 1 : -1;

          if (p.input.aim) {
            p.aim = clamp(p.aim + p.input.aim * dt * 1.6, THROW_MIN, THROW_MAX);
          }

          if (p.input.block && p.blockCd <= 0 && p.blockT <= 0) {
            p.blockT = BLOCK_TIME;
            p.blockCd = BLOCK_CD;
            burst(p.x, p.y - 80, '#7fd1ff', 8, 180);
          }
          if (p.blockT > 0) p.blockT -= dt;
          if (p.blockCd > 0) p.blockCd -= dt;

          if (p.input.charging && !p.charging) {
            p.charging = true;
            p.charge = 0;
          }
          if (p.charging) {
            if (p.input.charging) {
              p.charge = clamp(p.charge + dt * 0.9, 0, 1);
            } else {
              spawnPie(p);
              p.charging = false;
              p.charge = 0;
            }
          }
          if (p.throwQueued) {
            p.throwQueued = false;
            spawnPie(p);
            p.charging = false;
            p.charge = 0;
          }
        }
      });

      for (var i = pies.length - 1; i >= 0; i--) {
        var pie = pies[i];
        pie.life -= dt;
        pie.x += pie.vx * dt;
        pie.y += pie.vy * dt;
        pie.vy += GRAVITY * dt;
        pie.rot += dt * 6;

        var hit = false;
        for (var j = 0; j < players.length; j++) {
          var p = players[j];
          if (!p.alive || p.id === pie.owner) continue;
          var dx = pie.x - p.x, dy = pie.y - (p.y - 72);
          if (dx * dx + dy * dy < (pie.r + 34) * (pie.r + 34)) {
            hitPlayer(p, pie);
            hit = true;
            break;
          }
        }
        if (hit || pie.y >= GROUND + 8 || pie.x < -40 || pie.x > W + 40 || pie.life <= 0) {
          if (!hit && pie.y >= GROUND) burst(pie.x, GROUND, '#e8c9a0', 6, 140);
          pies.splice(i, 1);
        }
      }

      for (var k = particles.length - 1; k >= 0; k--) {
        var pt = particles[k];
        pt.t += dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.vy += GRAVITY * 0.55 * dt;
        if (pt.t >= pt.life) particles.splice(k, 1);
      }
      for (var m = confetti.length - 1; m >= 0; m--) {
        var c = confetti[m];
        c.t += dt;
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.vy += GRAVITY * 0.35 * dt;
        if (c.t >= c.life) confetti.splice(m, 1);
      }
      shake = Math.max(0, shake - dt * 30);
      flashT = Math.max(0, flashT - dt);
    }

    // --- Рендер ---------------------------------------------------------------
    function render() {
      ctx.save();
      if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));

      // Фон: картон + логотип шоу
      var bg = ctx.createLinearGradient(0, 0, 0, H);
      bg.addColorStop(0, '#e8c9a0');
      bg.addColorStop(0.55, '#d9b382');
      bg.addColorStop(1, '#c49a6c');
      ctx.fillStyle = bg;
      ctx.fillRect(-20, -20, W + 40, H + 40);

      // Полоски «скотча»
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#fff';
      ctx.save();
      ctx.translate(180, 120); ctx.rotate(-0.25); ctx.fillRect(-90, -18, 180, 36); ctx.restore();
      ctx.save();
      ctx.translate(1080, 160); ctx.rotate(0.2); ctx.fillRect(-90, -18, 180, 36); ctx.restore();
      ctx.globalAlpha = 1;

      // Баннер шоу
      ctx.fillStyle = '#7a2e1d';
      ctx.fillRect(0, 0, W, 92);
      ctx.fillStyle = '#ffd700';
      ctx.font = 'bold 54px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PIEGEDDON', W / 2, 66);
      ctx.font = '600 20px system-ui, sans-serif';
      ctx.fillStyle = '#ffe9b0';
      ctx.fillText('СЕЗОН 1 · ПЕРВЫЙ ЛОМТЕЬ', W / 2, 90);

      // Земля
      var g = ctx.createLinearGradient(0, GROUND, 0, H);
      g.addColorStop(0, '#a97c50');
      g.addColorStop(1, '#7a5230');
      ctx.fillStyle = g;
      ctx.fillRect(0, GROUND, W, H - GROUND);
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      for (var gx = 0; gx < W; gx += 48) {
        ctx.beginPath();
        ctx.moveTo(gx, GROUND);
        ctx.lineTo(gx - 30, H);
        ctx.stroke();
      }

      // Таймер раунда
      ctx.fillStyle = 'rgba(122,46,29,0.92)';
      roundRect(ctx, W / 2 - 90, 108, 180, 54, 14);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 34px system-ui, sans-serif';
      ctx.fillText(fmtTime(roundTime), W / 2, 146);
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.fillStyle = '#ffd9a8';
      ctx.fillText('РАУНД ' + round, W / 2, 178);

      players.forEach(drawPlayer);
      pies.forEach(drawPie);

      particles.forEach(function (pt) {
        ctx.globalAlpha = clamp(1 - pt.t / pt.life, 0, 1);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fill();
      });
      confetti.forEach(function (c) {
        ctx.globalAlpha = clamp(1 - c.t / c.life, 0, 1);
        ctx.fillStyle = c.color;
        ctx.fillRect(c.x, c.y, c.r, c.r * 0.6);
      });
      ctx.globalAlpha = 1;

      if (phase === 'lobby') {
        overlay('ГОТОВЫ К ШОУ?', 'Подключите пульты или нажмите ПРОБЕЛ', '#7a2e1d');
      } else if (phase === 'round_end') {
        var w = winnerId ? byId(winnerId) : null;
        overlay(w ? 'РАУНД ЗА ' + w.name.toUpperCase() : 'НИЧЬЯ!', 'Следующий раунд уже в пути…', '#7a2e1d');
      } else if (phase === 'match_end') {
        var wm = byId(winnerId);
        overlay('ПОБЕДА: ' + (wm ? wm.name.toUpperCase() : '—'), 'Забери свой NFT-скин на экране наград', '#1d5c2e');
      }

      if (flashT > 0) {
        ctx.fillStyle = 'rgba(255,255,255,' + (flashT * 0.35) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      ctx.restore();
    }

    function drawPlayer(p) {
      var f = FACTIONS[p.faction];
      var bob = p.alive ? Math.sin(performance.now() / 300 + p.slot * 2) * 3 : 0;
      var y = p.y + bob;

      // Тень
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(p.x, GROUND + 6, 46, 12, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!p.alive) {
        ctx.globalAlpha = 0.35;
      }

      // Тело
      ctx.fillStyle = f.color;
      roundRect(ctx, p.x - 34, y - 118, 68, 96, 22);
      ctx.fill();
      ctx.fillStyle = f.dark;
      roundRect(ctx, p.x - 34, y - 40, 68, 18, 8);
      ctx.fill();

      // Фартук
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      roundRect(ctx, p.x - 22, y - 92, 44, 52, 12);
      ctx.fill();

      // Глаза
      var look = p.face * 6;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(p.x - 12 + look * 0.3, y - 92, 11, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 12 + look * 0.3, y - 92, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath(); ctx.arc(p.x - 12 + look, y - 92, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 12 + look, y - 92, 5, 0, Math.PI * 2); ctx.fill();

      // Рот
      ctx.strokeStyle = '#5b2b14';
      ctx.lineWidth = 3;
      ctx.beginPath();
      if (p.stun > 0) {
        ctx.arc(p.x, y - 68, 7, 0, Math.PI * 2);
      } else {
        ctx.arc(p.x, y - 74, 12, 0.15 * Math.PI, 0.85 * Math.PI);
      }
      ctx.stroke();

      // Колпак
      ctx.fillStyle = f.hat;
      roundRect(ctx, p.x - 26, y - 150, 52, 36, 16);
      ctx.fill();
      ctx.beginPath(); ctx.arc(p.x - 18, y - 150, 12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 18, y - 150, 12, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x, y - 158, 15, 0, Math.PI * 2); ctx.fill();

      // Рука-пирогомёт
      ctx.save();
      ctx.translate(p.x + p.face * 30, y - 88);
      ctx.rotate(p.aim * (p.face === 1 ? 1 : -1) + (p.face === 1 ? 0 : Math.PI));
      ctx.fillStyle = f.dark;
      roundRect(ctx, -6, -10, 42, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#fff6e8';
      ctx.beginPath(); ctx.arc(42, 0, 12, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      // Зарядка
      if (p.charging && p.charge > 0.02) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        roundRect(ctx, p.x - 34, y - 190, 68, 12, 6);
        ctx.fill();
        ctx.fillStyle = '#e4572e';
        roundRect(ctx, p.x - 34, y - 190, 68 * p.charge, 12, 6);
        ctx.fill();
      }

      // Блок
      if (p.blockT > 0) {
        ctx.strokeStyle = 'rgba(127,209,255,0.9)';
        ctx.lineWidth = 7;
        ctx.beginPath();
        ctx.arc(p.x, y - 80, 58, -Math.PI * 0.7, Math.PI * 0.7);
        ctx.stroke();
      }

      // Оглушение — звёзды
      if (p.stun > 0) {
        ctx.fillStyle = '#ffd700';
        for (var s = 0; s < 3; s++) {
          var a = performance.now() / 220 + (s * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * 34, y - 170 + Math.sin(a) * 10, 6, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Табличка с именем и HP
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, p.x - 62, y + 18, 124, 44, 10);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, y + 38);
      for (var h = 0; h < MAX_HP; h++) {
        ctx.fillStyle = h < p.hp ? '#e4572e' : 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(p.x - 22 + h * 22, y + 52, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function drawPie(pie) {
      ctx.save();
      ctx.translate(pie.x, pie.y);
      ctx.rotate(pie.rot);
      ctx.fillStyle = '#e8b25c';
      ctx.beginPath(); ctx.arc(0, 0, pie.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff6e8';
      ctx.beginPath(); ctx.arc(0, -2, pie.r * 0.62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e4572e';
      ctx.beginPath(); ctx.arc(0, -2, pie.r * 0.22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }

    function overlay(title, sub, color) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = color;
      roundRect(ctx, W / 2 - 380, H / 2 - 110, 760, 170, 26);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 52px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, W / 2, H / 2 - 30);
      ctx.font = '600 24px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(sub, W / 2, H / 2 + 22);
    }

    function roundRect(c, x, y, w, h, r) {
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function fmtTime(t) {
      var m = Math.floor(t / 60);
      var s = Math.floor(t % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function frame(ts) {
      var dt = Math.min(0.05, (ts - lastTs) / 1000 || 0.016);
      lastTs = ts;
      update(dt);
      render();
      raf = requestAnimationFrame(frame);
    }

    return {
      addPlayer: addPlayer,
      setInput: setInput,
      start: function () {
        lastTs = performance.now();
        raf = requestAnimationFrame(frame);
      },
      stop: function () { cancelAnimationFrame(raf); },
      beginRound: startRound,
      forceMatchEnd: function () {
        phase = 'match_end';
        winnerId = players.length ? players[0].id : null;
      },
      hud: function () {
        return {
          phase: phase,
          round: round,
          roundTime: Math.round(roundTime),
          players: players.map(function (p) {
            return {
              id: p.id, name: p.name, faction: p.faction, hp: p.hp,
              alive: p.alive, roundWins: p.roundWins,
              blockCd: Math.max(0, Math.round(p.blockCd * 10) / 10),
              charging: p.charging, charge: Math.round(p.charge * 100),
            };
          }),
        };
      },
      players: function () { return players; },
      byId: byId,
      isFight: function () { return phase === 'fight'; },
      phase: function () { return phase; },
    };
  }

  global.PieGame = { createGame: createGame, FACTIONS: FACTIONS };
})(window);
