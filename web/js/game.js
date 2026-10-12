// Copyright 2026 Piegeddon Contributors. Licensed under the Apache License, Version 2.0.
// game.js — движок арены «Пирогеддон»: 1 игрок + ИИ, картинки-картонки, пироги, эффекты.
(function (global) {
  'use strict';

  var W = 1280, H = 720, GROUND = 585;
  var GRAVITY = 1500;
  var WALK = 280;
  var PIE_SPEED_MIN = 340, PIE_SPEED_MAX = 920;
  var THROW_MIN = (-72 * Math.PI) / 180, THROW_MAX = (-16 * Math.PI) / 180;
  var MAX_HP = 3;
  var STUN = 0.7, BLOCK_TIME = 1.0, BLOCK_CD = 3.0;
  var ROUND_TIME = 90;

  var FACTIONS = {
    crust:    { name: 'Красти',       img: 'char_crust',    color: '#c98d4e' },
    custard:  { name: 'Барон Завар',  img: 'char_custard',  color: '#f2c14e' },
    cherry:   { name: 'Черри-Бомб',   img: 'char_cherry',   color: '#e4572e' },
    meringue: { name: 'Меренга',      img: 'char_meringue', color: '#d98cb3' },
  };

  var ASSET_URLS = {
    bg: '/img/bg_arena.png',
    pie: '/img/pie.png',
    splat: '/img/splat.png',
    char_crust: '/img/char_crust.png',
    char_custard: '/img/char_custard.png',
    char_cherry: '/img/char_cherry.png',
    char_meringue: '/img/char_meringue.png',
  };

  var images = {};
  var assetsPromise = null;

  function loadAssets() {
    if (assetsPromise) return assetsPromise;
    assetsPromise = Promise.all(
      Object.keys(ASSET_URLS).map(function (key) {
        return new Promise(function (resolve) {
          var img = new Image();
          img.onload = function () { images[key] = img; resolve(); };
          img.onerror = function () { resolve(); }; // фолбэк — векторный рендер
          img.src = ASSET_URLS[key];
        });
      })
    );
    return assetsPromise;
  }

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function createPlayer(def, slot) {
    var x = [340, 640, 940][slot % 3];
    return {
      id: def.id,
      name: def.name || 'Игрок',
      faction: FACTIONS[def.faction] ? def.faction : 'crust',
      control: def.control || 'ai',
      slot: slot,
      x: x, y: GROUND,
      vx: 0,
      face: slot === 0 ? 1 : -1,
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
      wobble: Math.random() * Math.PI * 2,
      stats: { hits: 0, taken: 0 },
    };
  }

  function createGame(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d');
    var players = [];
    var pies = [];
    var particles = [];
    var splats = [];
    var round = 1;
    var targetRounds = opts.targetRounds || 2;
    var roundTime = ROUND_TIME;
    var phase = 'lobby'; // lobby | fight | round_end | match_end
    var phaseT = 0;
    var winnerId = null;
    var shake = 0;
    var lastTs = 0;
    var raf = 0;

    function addPlayer(def) {
      if (players.length >= 3) return null;
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
        x: p.x + p.face * 60,
        y: p.y - 150,
        vx: Math.cos(p.aim) * speed * p.face,
        vy: Math.sin(p.aim) * speed,
        owner: p.id,
        rot: 0,
        r: 18 + p.charge * 12,
        life: 4,
      });
      burst(p.x + p.face * 60, p.y - 150, '#fff6e8', 6, 120);
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
      splats.push({ x: x, y: y, t: 0, life: 0.5, rot: rand(-0.4, 0.4) });
      burst(x, y, '#fff6e8', 12, 260);
      burst(x, y, '#f2c14e', 8, 220);
      shake = Math.min(shake + 8, 20);
    }

    function hitPlayer(target, pie) {
      if (!target.alive) return;
      if (target.blockT > 0) {
        burst(target.x, target.y - 150, '#7fd1ff', 14, 300);
        shake = Math.min(shake + 3, 12);
        return;
      }
      target.hp -= 1;
      target.stats.taken += 1;
      target.stun = STUN;
      target.vx += (pie.vx > 0 ? 1 : -1) * 200;
      var owner = byId(pie.owner);
      if (owner) owner.stats.hits += 1;
      splat(target.x, target.y - 150);
      if (target.hp <= 0) {
        target.alive = false;
        burst(target.x, target.y - 150, FACTIONS[target.faction].color, 26, 380);
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
        burst(winner.x, winner.y - 180, '#ffd700', 24, 420);
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
      splats = [];
      players.forEach(function (p, i) {
        p.x = [340, 640, 940][i % 3];
        p.hp = MAX_HP;
        p.alive = true;
        p.stun = 0;
        p.charge = 0;
        p.charging = false;
        p.blockT = 0;
        p.blockCd = 0;
        p.face = i === 0 ? 1 : -1;
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
        else if (dist < 280) p.aiMove = target.x > p.x ? -1 : 1;
        else p.aiMove = Math.random() < 0.5 ? -1 : Math.random() < 0.25 ? 1 : 0;

        if (Math.random() < 0.35) {
          p.input.block = true;
          setTimeout(function () { if (p.control === 'ai') p.input.block = false; }, rand(400, 900));
        }
      }

      p.face = target.x > p.x ? 1 : -1;
      var v = 620;
      var s = (GRAVITY * dist) / (v * v);
      var angle = s >= 1 ? -Math.PI / 4 : -Math.asin(clamp(s, -1, 1)) / 2;
      p.aim = clamp(angle, THROW_MIN, THROW_MAX);

      for (var i = 0; i < pies.length; i++) {
        var pie = pies[i];
        if (pie.owner !== p.id && Math.abs(pie.x - p.x) < 170 && Math.abs(pie.y - (p.y - 140)) < 130) {
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

    // --- Обновление -----------------------------------------------------------
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
            p.y = GROUND - Math.abs(Math.sin(performance.now() / 180)) * 30;
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
          p.vx += (move * WALK - p.vx) * Math.min(1, dt * 12);
          p.x = clamp(p.x + p.vx * dt, 120, W - 120);
          if (move !== 0) p.face = move > 0 ? 1 : -1;

          if (p.input.aim) {
            p.aim = clamp(p.aim + p.input.aim * dt * 1.6, THROW_MIN, THROW_MAX);
          }

          if (p.input.block && p.blockCd <= 0 && p.blockT <= 0) {
            p.blockT = BLOCK_TIME;
            p.blockCd = BLOCK_CD;
            burst(p.x, p.y - 150, '#7fd1ff', 8, 180);
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
          var dx = pie.x - p.x, dy = pie.y - (p.y - 140);
          if (dx * dx + dy * dy < (pie.r + 55) * (pie.r + 55)) {
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
      for (var m = splats.length - 1; m >= 0; m--) {
        var sp = splats[m];
        sp.t += dt;
        if (sp.t >= sp.life) splats.splice(m, 1);
      }
      shake = Math.max(0, shake - dt * 30);
    }

    // --- Рендер ---------------------------------------------------------------
    function render() {
      ctx.save();
      if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));

      // Фон-арена (сгенерированный арт), фолбэк — градиент
      if (images.bg) {
        drawCover(images.bg);
      } else {
        var bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, '#5a2c14');
        bg.addColorStop(0.55, '#8a4a26');
        bg.addColorStop(1, '#c49a6c');
        ctx.fillStyle = bg;
        ctx.fillRect(-20, -20, W + 40, H + 40);
      }

      // Затемнение низа для читаемости
      var shade = ctx.createLinearGradient(0, H * 0.55, 0, H);
      shade.addColorStop(0, 'rgba(42,22,8,0)');
      shade.addColorStop(1, 'rgba(42,22,8,0.55)');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, W, H);

      // Таймер раунда — «табло шоу»
      ctx.fillStyle = 'rgba(42,22,8,0.78)';
      roundRect(ctx, W / 2 - 110, 18, 220, 74, 22);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,196,110,0.5)';
      ctx.lineWidth = 3;
      roundRect(ctx, W / 2 - 110, 18, 220, 74, 22);
      ctx.stroke();
      ctx.fillStyle = '#ffd9a8';
      ctx.font = '700 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('РАУНД ' + round, W / 2, 42);
      ctx.fillStyle = '#fff';
      ctx.font = '800 34px system-ui, sans-serif';
      ctx.fillText(fmtTime(roundTime), W / 2, 78);

      players.forEach(drawPlayer);

      pies.forEach(drawPie);

      // Эффекты попадания (сгенерированный splat, blend screen)
      ctx.globalCompositeOperation = 'screen';
      splats.forEach(function (sp) {
        var k = sp.t / sp.life;
        var size = 180 + k * 160;
        ctx.globalAlpha = (1 - k) * 0.95;
        if (images.splat) {
          ctx.save();
          ctx.translate(sp.x, sp.y);
          ctx.rotate(sp.rot);
          ctx.drawImage(images.splat, -size / 2, -size / 2, size, size);
          ctx.restore();
        } else {
          ctx.fillStyle = '#fff6e8';
          ctx.beginPath();
          ctx.arc(sp.x, sp.y, size / 3, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      particles.forEach(function (pt) {
        ctx.globalAlpha = clamp(1 - pt.t / pt.life, 0, 1);
        ctx.fillStyle = pt.color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;

      if (phase === 'lobby') {
        overlay('ГОТОВ?', 'Нажми «Играть» в меню');
      } else if (phase === 'round_end') {
        var w = winnerId ? byId(winnerId) : null;
        overlay(w ? 'РАУНД ЗА: ' + w.name.toUpperCase() : 'НИЧЬЯ!', 'Следующий раунд уже в пути…');
      } else if (phase === 'match_end') {
        var wm = byId(winnerId);
        overlay('ПОБЕДА: ' + (wm ? wm.name.toUpperCase() : '—'), 'Забери свой NFT-скин!');
      }

      ctx.restore();
    }

    function drawCover(img) {
      var scale = Math.max(W / img.width, H / img.height);
      var w = img.width * scale, h = img.height * scale;
      ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
    }

    function drawPlayer(p) {
      var f = FACTIONS[p.faction];
      var bob = p.alive ? Math.sin(performance.now() / 320 + p.wobble) * 5 : 0;
      var tilt = p.alive ? Math.sin(performance.now() / 500 + p.wobble) * 0.02 : 0.25;
      var y = p.y + bob;
      var img = images[f.img];

      // Тень
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(p.x, GROUND + 10, 92, 20, 0, 0, Math.PI * 2);
      ctx.fill();

      if (!p.alive) ctx.globalAlpha = 0.35;

      ctx.save();
      ctx.translate(p.x, y);
      ctx.rotate(tilt);
      ctx.scale(p.face, 1);

      if (img) {
        // Персонаж-картонка (standee): картинка как вырезка
        var cw = 230, ch = 300;
        ctx.save();
        shadowOn(ctx);
        ctx.drawImage(img, -cw / 2, -ch - 6, cw, ch);
        ctx.restore();
        // Ножка-подставка картонки
        ctx.fillStyle = 'rgba(90,52,24,0.85)';
        ctx.beginPath();
        ctx.moveTo(-46, -6);
        ctx.lineTo(46, -6);
        ctx.lineTo(30, 14);
        ctx.lineTo(-30, 14);
        ctx.closePath();
        ctx.fill();
      } else {
        // Векторный фолбэк
        ctx.fillStyle = f.color;
        roundRect(ctx, -40, -150, 80, 130, 26);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(-14, -110, 12, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(14, -110, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#222';
        ctx.beginPath(); ctx.arc(-12, -110, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(16, -110, 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();

      // Зарядка
      if (p.charging && p.charge > 0.02) {
        ctx.fillStyle = 'rgba(42,22,8,0.8)';
        roundRect(ctx, p.x - 55, y - 330, 110, 16, 8);
        ctx.fill();
        var cg = ctx.createLinearGradient(p.x - 55, 0, p.x + 55, 0);
        cg.addColorStop(0, '#ffd066');
        cg.addColorStop(1, '#e8503a');
        ctx.fillStyle = cg;
        roundRect(ctx, p.x - 55, y - 330, 110 * p.charge, 16, 8);
        ctx.fill();
      }

      // Блок — энергокупол
      if (p.blockT > 0) {
        ctx.strokeStyle = 'rgba(127,209,255,0.9)';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.arc(p.x, y - 150, 110, -Math.PI * 0.75, Math.PI * 0.75);
        ctx.stroke();
      }

      // Оглушение — звёзды
      if (p.stun > 0) {
        ctx.fillStyle = '#ffd700';
        for (var s = 0; s < 3; s++) {
          var a = performance.now() / 220 + (s * Math.PI * 2) / 3;
          ctx.beginPath();
          ctx.arc(p.x + Math.cos(a) * 52, y - 320 + Math.sin(a) * 12, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Плашка имени + HP
      ctx.fillStyle = 'rgba(42,22,8,0.72)';
      roundRect(ctx, p.x - 100, y + 22, 200, 52, 14);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = '700 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, y + 44);
      for (var h = 0; h < MAX_HP; h++) {
        drawHeart(p.x - 26 + h * 26, y + 60, 8, h < p.hp ? '#ff5a4e' : 'rgba(255,255,255,0.22)');
      }
    }

    function shadowOn(c) {
      c.shadowColor = 'rgba(0,0,0,0.35)';
      c.shadowBlur = 12;
      c.shadowOffsetY = 8;
    }

    function drawHeart(x, y, s, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(x, y + s * 0.35);
      ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.35);
      ctx.bezierCurveTo(x - s, y + s * 0.8, x, y + s * 1.15, x, y + s * 1.5);
      ctx.bezierCurveTo(x, y + s * 1.15, x + s, y + s * 0.8, x + s, y + s * 0.35);
      ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.35);
      ctx.fill();
    }

    function drawPie(pie) {
      ctx.save();
      ctx.translate(pie.x, pie.y);
      ctx.rotate(pie.rot);
      var d = pie.r * 2.2;
      if (images.pie) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, pie.r * 1.15, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(images.pie, -d / 2, -d / 2, d, d);
        ctx.restore();
      } else {
        ctx.fillStyle = '#e8b25c';
        ctx.beginPath(); ctx.arc(0, 0, pie.r, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff6e8';
        ctx.beginPath(); ctx.arc(0, -2, pie.r * 0.62, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    function overlay(title, sub) {
      ctx.fillStyle = 'rgba(42,22,8,0.55)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(42,22,8,0.92)';
      roundRect(ctx, W / 2 - 400, H / 2 - 110, 800, 180, 28);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,196,110,0.55)';
      ctx.lineWidth = 3;
      roundRect(ctx, W / 2 - 400, H / 2 - 110, 800, 180, 28);
      ctx.stroke();
      ctx.fillStyle = '#ffd9a8';
      ctx.font = '800 52px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, W / 2, H / 2 - 20);
      ctx.font = '600 24px system-ui, sans-serif';
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillText(sub, W / 2, H / 2 + 34);
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

  global.PieGame = { createGame: createGame, FACTIONS: FACTIONS, loadAssets: loadAssets };
})(window);
