/*
 * Lasertag - client.
 *
 * Local-first by design. Every action becomes an event applied to the local log
 * immediately, so the UI never waits for the network. Sync is a background
 * concern: unsent events sit in an outbox and drain when signal returns.
 *
 * Domination's tickets and capture bars are *simulated* from the log rather
 * than pushed from a server, so they keep running smoothly with the network
 * gone and still agree with everyone else afterwards.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var LS = window.localStorage;
  var t = I18N.t;

  /* ================================================================ state */

  var pid = LS.getItem('ctf.pid');
  if (!pid) {
    pid = (crypto.randomUUID ? crypto.randomUUID()
      : 'p' + Date.now() + Math.random().toString(16).slice(2));
    LS.setItem('ctf.pid', pid);
  }

  var G = {
    code: null, events: [], outbox: [], lastSeq: 0,
    state: CTF.emptyState(), online: false, es: null,
    offset: 0                                   // serverTime - Date.now()
  };

  function now() { return Date.now() + G.offset; }
  function uid() {
    return (crypto.randomUUID ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
  }

  /* --------------------------------------------------------- persistence */

  function saveLocal() {
    if (!G.code) return;
    try {
      LS.setItem('ctf.log.' + G.code, JSON.stringify({
        events: G.events, outbox: G.outbox.map(function (e) { return e.id; }), lastSeq: G.lastSeq
      }));
      LS.setItem('ctf.code', G.code);
    } catch (e) { /* quota - the server still has the log */ }
  }

  function loadLocal(code) {
    try {
      var d = JSON.parse(LS.getItem('ctf.log.' + code) || 'null');
      if (!d) return false;
      G.events = d.events || [];
      G.lastSeq = d.lastSeq || 0;
      var pending = new Set(d.outbox || []);
      G.outbox = G.events.filter(function (e) { return pending.has(e.id); });
      return true;
    } catch (e) { return false; }
  }

  /* ================================================================= sync */

  function absorb(incoming) {
    var known = new Map(G.events.map(function (e) { return [e.id, e]; }));
    var added = false;
    incoming.forEach(function (ev) {
      var mine = known.get(ev.id);
      if (mine) {
        if (ev.seq && !mine.seq) { mine.seq = ev.seq; added = true; }
      } else {
        G.events.push(ev); known.set(ev.id, ev); added = true;
      }
      if (ev.seq && ev.seq > G.lastSeq) G.lastSeq = ev.seq;
      if (ev.seq) G.outbox = G.outbox.filter(function (o) { return o.id !== ev.id; });
    });
    if (added) { recompute(); saveLocal(); }
  }

  var flushing = false;
  function flush() {
    if (flushing || !G.code || !G.outbox.length) return Promise.resolve();
    flushing = true;
    var batch = G.outbox.slice();
    return fetch('/api/game/' + G.code + '/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: batch })
    }).then(function (r) {
      if (!r.ok) throw new Error('http ' + r.status);
      return r.json();
    }).then(function (d) {
      G.offset = d.serverTime - Date.now();
      G.outbox = G.outbox.filter(function (o) { return batch.indexOf(o) < 0; });
      setOnline(true);
      saveLocal();
    }).catch(function () {
      setOnline(false);
    }).finally(function () { flushing = false; });
  }

  function emit(type, payload) {
    var ev = Object.assign({ id: uid(), ts: now(), actor: pid, type: type }, payload || {});
    G.events.push(ev);
    G.outbox.push(ev);
    recompute();
    saveLocal();
    flush();
    return ev;
  }

  function connect() {
    if (!G.code) return;
    if (G.es) { try { G.es.close(); } catch (e) { } }
    var es = new EventSource('/api/game/' + G.code + '/stream?since=' + G.lastSeq);
    G.es = es;
    es.onmessage = function (m) {
      try {
        var d = JSON.parse(m.data);
        if (d.serverTime) G.offset = d.serverTime - Date.now();
        if (d.events && d.events.length) absorb(d.events);
        setOnline(true);
        flush();
      } catch (e) { }
    };
    es.onopen = function () { setOnline(true); flush(); };
    es.onerror = function () {
      setOnline(false);
      try { es.close(); } catch (e) { }
      // Reconnect with an up-to-date cursor rather than the stale one.
      if (G.es === es) setTimeout(function () { if (G.es === es) connect(); }, 3000);
    };
  }

  function setOnline(v) {
    G.online = v;
    var bar = $('netbar');
    if (v && !G.outbox.length) { bar.hidden = true; return; }
    bar.hidden = false;
    if (v && G.outbox.length) {
      bar.className = 'netbar syncing';
      $('netmsg').textContent = t('net.syncing', { n: G.outbox.length });
    } else {
      bar.className = 'netbar';
      $('netmsg').textContent = G.outbox.length
        ? t('net.offlineQueued', { n: G.outbox.length }) : t('net.offline');
    }
  }

  window.addEventListener('online', function () { connect(); flush(); });
  window.addEventListener('offline', function () { setOnline(false); });
  setInterval(function () { if (G.outbox.length) flush(); }, 8000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && G.code) { flush(); if (!G.online) connect(); }
  });

  /* ================================================================== fx */

  var audioCtx = null;
  function beep(freq, ms, type) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      var o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.25, audioCtx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + ms / 1000);
      o.connect(g); g.connect(audioCtx.destination);
      o.start(); o.stop(audioCtx.currentTime + ms / 1000);
    } catch (e) { }
  }
  function buzz(p) { try { navigator.vibrate && navigator.vibrate(p); } catch (e) { } }

  var toastTimer = null;
  function toast(msg, kind) {
    var el = $('toast');
    el.textContent = msg;
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 3200);
  }

  var wakeLock = null;
  function keepAwake(on) {
    if (on) {
      if (wakeLock || !navigator.wakeLock) return;
      navigator.wakeLock.request('screen').then(function (w) {
        wakeLock = w;
        w.addEventListener('release', function () { wakeLock = null; });
      }).catch(function () { });
    } else if (wakeLock) { try { wakeLock.release(); } catch (e) { } wakeLock = null; }
  }
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && G.state.phase === 'live') keepAwake(true);
  });

  /* ============================================================ rendering */

  var seenFeed = 0, lastPhase = null, lastFeedLen = -1, lastMode = null;

  function recompute() {
    G.state = CTF.reduce(G.events, now());
    window.__state = G.state;          // read-only handle for the test suite
    render();
  }

  function me() { return G.state.players[pid]; }
  function tname(team) {
    var custom = ((G.state.settings.teamNames || {})[team] || '').trim();
    if (custom) return custom;
    if (isCs()) return t(team === 'red' ? 'cs.teamT' : 'cs.teamCT');
    return t('team.' + team);
  }
  function isDom() { return G.state.settings.mode === 'domination'; }
  function isCs() { return G.state.settings.mode === 'cs'; }

  function show(id) {
    ['screen-home', 'screen-lobby', 'screen-game', 'screen-end'].forEach(function (x) {
      $(x).classList.toggle('active', x === id);
    });
  }

  function render() {
    var s = G.state;

    if (s.phase !== lastPhase) {
      if (s.phase === 'live') {
        show('screen-game'); keepAwake(true); seenFeed = s.feed.length; lastFeedLen = -1;
      } else if (s.phase === 'ended') {
        show('screen-end'); keepAwake(false);
      } else if (s.phase === 'lobby' && G.code) {
        show('screen-lobby'); keepAwake(false);
      }
      lastPhase = s.phase;
    }

    if (s.phase === 'lobby') renderLobby(s);
    if (s.phase === 'live') { renderGame(s); announce(s); }
    if (s.phase === 'ended') renderEnd(s);
    setOnline(G.online);
  }

  /* Audible/haptic alerts for the things you cannot afford to miss mid-run. */
  function announce(s) {
    if (s.feed.length <= seenFeed) { seenFeed = Math.min(seenFeed, s.feed.length); return; }
    var fresh = s.feed.slice(seenFeed);
    seenFeed = s.feed.length;
    fresh.forEach(function (f) {
      var msg = I18N.feedText(f, tname);
      if (f.kind === 'grab' || f.kind === 'capturing') {
        toast(msg, 'bad'); beep(880, 160); setTimeout(function () { beep(1180, 200); }, 170);
        buzz([90, 60, 90]);
      } else if (f.kind === 'capture' || f.kind === 'pointTaken') {
        toast(msg, 'good'); beep(660, 120); setTimeout(function () { beep(990, 300); }, 130);
        buzz([140, 70, 140, 70, 240]);
      } else if (f.kind === 'flagreset' || f.kind === 'pointNeutral') {
        toast(msg); beep(420, 220, 'sine'); buzz(70);
      } else if (f.kind === 'planting' || f.kind === 'defusing') {
        toast(msg, 'bad'); beep(880, 160); setTimeout(function () { beep(1180, 200); }, 170);
        buzz([90, 60, 90]);
      } else if (f.kind === 'bombPlanted') {
        toast(msg, 'bad'); beep(200, 320, 'sawtooth');
        setTimeout(function () { beep(200, 320, 'sawtooth'); }, 340);
        buzz([200, 100, 200, 100, 200]);
      } else if (f.kind === 'bombAssigned' || f.kind === 'plantAborted' || f.kind === 'defuseAborted') {
        toast(msg); beep(420, 220, 'sine'); buzz(70);
      } else if (f.kind === 'end') {
        toast(msg, 'good'); buzz([260, 100, 260]);
      }
    });
  }

  function playerLi(p, s) {
    var li = document.createElement('li');
    if (p.id === pid) li.classList.add('me');
    if (!p.alive && s.phase === 'live') li.classList.add('dead');
    li.textContent = p.name;
    var tag = document.createElement('span');
    tag.className = 'tag';
    var bits = [];
    if (p.id === s.hostId) bits.push(t('game.host'));
    if (s.phase === 'live' && !p.alive) bits.push(t('game.tagHit'));
    CTF.TEAMS.forEach(function (f) {
      if (s.flags[f].carrier === p.id) bits.push(t('game.tagHasFlag', { team: tname(f) }));
    });
    tag.textContent = bits.join(' · ');
    li.appendChild(tag);
    return li;
  }

  /* ---------------------------------------------------------------- lobby */

  function countTeam(s, team) {
    return Object.keys(s.players).filter(function (id) { return s.players[id].team === team; }).length;
  }

  function renderLobby(s) {
    $('lobbyCode').textContent = G.code || '----';
    $('lobbyRedName').textContent = tname('red');
    $('setRedName').placeholder = t('team.red');
    $('setBlueName').placeholder = t('team.blue');
    $('lobbyBlueName').textContent = tname('blue');

    document.querySelectorAll('.modebtn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === s.settings.mode);
    });
    document.querySelectorAll('.modeonly').forEach(function (el) {
      el.hidden = el.dataset.for !== s.settings.mode;
    });
    $('check1').textContent = t(isDom() ? 'lobby.check1Dom' : isCs() ? 'lobby.check1Cs' : 'lobby.check1Ctf');
    $('labelRedName').textContent = t(isCs() ? 'lobby.redNameCs' : 'lobby.redName');
    $('labelBlueName').textContent = t(isCs() ? 'lobby.blueNameCs' : 'lobby.blueName');

    ['Red', 'Blue', 'None'].forEach(function (bucket) {
      var ul = $('list' + bucket); ul.innerHTML = '';
      var want = bucket === 'None' ? null : bucket.toLowerCase();
      s.order.forEach(function (id) {
        var p = s.players[id];
        if (p && p.team === want) ul.appendChild(playerLi(p, s));
      });
    });

    var ready = me() && countTeam(s, 'red') > 0 && countTeam(s, 'blue') > 0;
    $('btnStart').disabled = !ready;
    $('btnStart').textContent = ready ? t('lobby.start') : t('lobby.needTeams');

    var set = s.settings;
    var fields = [
      ['setDuration', Math.round(set.durationSec / 60)],
      ['setTarget', set.targetCaptures],
      ['setRespawn', set.respawnHintSec],
      ['setPoints', set.pointCount],
      ['setTickets', set.startTickets],
      ['setDrain', set.drainPerSec],
      ['setCaptureSec', set.captureSec],
      ['setPlantSec', set.plantSec],
      ['setFuseSec', set.fuseSec],
      ['setDefuseSec', set.defuseSec],
      ['setRedName', set.teamNames.red || ''],
      ['setBlueName', set.teamNames.blue || '']
    ];
    fields.forEach(function (f) {
      var el = $(f[0]);
      if (el && document.activeElement !== el) el.value = f[1];
    });
    $('setOwnHome').checked = !!set.ownFlagMustBeHome;
    $('setScale').checked = !!set.scaleWithLead;
    $('domEstimate').textContent =
      t('lobby.estimate', { min: Math.round(set.startTickets / set.drainPerSec / 60 * 10) / 10 });
  }

  /* ----------------------------------------------------------------- game */

  function fmtClock(ms) {
    if (ms < 0) ms = 0;
    var total = Math.round(ms / 1000);
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' +
      String(total % 60).padStart(2, '0');
  }

  function renderGame(s) {
    var mode = s.settings.mode;
    var dom = mode === 'domination';
    var cs = mode === 'cs';

    if (mode !== lastMode) {
      $('ctfView').hidden = mode !== 'ctf';
      $('domView').hidden = !dom;
      $('csView').hidden = !cs;
      $('pointList').innerHTML = '';
      $('btnScanLabel').textContent = t(dom ? 'game.scanPoint' : cs ? 'game.scanBomb' : 'game.scanFlag');
      if (cs) {
        $('labelRed').textContent = tname('red');
        $('labelBlue').textContent = tname('blue');
      } else {
        $('labelRed').textContent = dom ? t('game.ticketsLabel') : '';
        $('labelBlue').textContent = dom ? t('game.ticketsLabel') : '';
      }
      lastMode = mode;
    }

    if (dom) {
      $('scoreRed').textContent = Math.ceil(s.tickets.red);
      $('scoreBlue').textContent = Math.ceil(s.tickets.blue);
      $('targetLine').textContent = '';
      renderPoints(s);
    } else if (cs) {
      $('scoreRed').textContent = 'T';
      $('scoreBlue').textContent = 'CT';
      $('targetLine').textContent = '';
      renderCs(s);
    } else {
      $('scoreRed').textContent = s.score.red;
      $('scoreBlue').textContent = s.score.blue;
      $('targetLine').textContent = t('game.firstTo', { n: s.settings.targetCaptures });
      renderFlags(s);
    }

    var mine = me();
    var carrying = CTF.TEAMS.filter(function (f) { return s.flags[f].carrier === pid; })[0];
    var banner = $('carrierBanner');
    if (!dom && !cs && carrying) {
      banner.hidden = false;
      banner.className = 'banner carrying';
      banner.textContent = t('game.carrying',
        { team: tname(carrying), own: tname(CTF.other(carrying)) });
    } else if (cs && !s.bomb.plantedAt && s.bomb.carrier === pid) {
      banner.hidden = false;
      banner.className = 'banner carrying';
      banner.textContent = t('game.csCarrying');
    } else banner.hidden = true;

    var btn = $('btnStatus');
    if (mine && !mine.alive) {
      btn.className = 'btn btn-dead';
      btn.textContent = t('game.backIn');
      var hint = $('respawnHint');
      hint.hidden = !(s.settings.respawnHintSec > 0);
      hint.textContent = t('game.respawnHint', { n: s.settings.respawnHintSec });
    } else {
      btn.className = 'btn btn-alive';
      btn.textContent = t('game.hit');
      $('respawnHint').hidden = true;
    }

    renderFeed(s);
  }

  function renderFlags(s) {
    CTF.TEAMS.forEach(function (f) {
      var card = $('flag' + f[0].toUpperCase() + f.slice(1));
      card.querySelector('.flabel').textContent = t('game.flagOf', { team: tname(f) });
      var st = s.flags[f];
      card.classList.toggle('taken', st.at !== 'base');
      card.querySelector('.fstate').textContent = st.at === 'base'
        ? t('game.atBase')
        : t('game.takenBy', { name: (s.players[st.carrier] || {}).name || '?' });
    });
  }

  /* Rows are built once and then mutated, because this repaints ~4x a second
     while the capture bars are moving. */
  function renderPoints(s) {
    var ul = $('pointList');
    if (ul.children.length !== s.points.length) {
      ul.innerHTML = '';
      s.points.forEach(function (pt) {
        var li = document.createElement('li');
        li.className = 'pointrow';
        li.innerHTML =
          '<div class="pnum">' + pt.id + '</div>' +
          '<div class="pbody">' +
          '<div class="pstate"><span class="own"></span><span class="moving"></span></div>' +
          '<div class="pbar"><div class="half red"></div><div class="half blue"></div><div class="mid"></div></div>' +
          '</div>';
        ul.appendChild(li);
      });
    }
    s.points.forEach(function (pt, i) {
      var li = ul.children[i];
      li.className = 'pointrow' + (pt.owner ? ' ' + pt.owner : '');
      li.querySelector('.own').textContent = pt.owner
        ? t('game.heldBy', { team: tname(pt.owner) }) : t('game.neutral');
      li.querySelector('.moving').textContent = pt.dir
        ? (pt.dir > 0 ? '→ ' + tname('blue') : '← ' + tname('red')) : '';
      // Both halves grow outward from the centre, so an untouched point is an
      // empty bar and you can read at a glance how far a capture has got.
      li.querySelector('.half.red').style.width = Math.max(0, -pt.c) * 50 + '%';
      li.querySelector('.half.blue').style.width = Math.max(0, pt.c) * 50 + '%';
    });

    var d = CTF.drainPerMs(s);
    var line = $('drainLine');
    if (!d.rate) {
      line.className = 'drainline';
      line.textContent = t('game.noLead');
    } else {
      var winner = CTF.other(d.loser);
      line.className = 'drainline ' + winner;
      line.textContent = t('game.draining',
        { team: tname(winner), n: Math.round(d.rate * 1000 * 10) / 10 });
    }
  }

  function renderCs(s) {
    var b = s.bomb;
    var main = $('csStatusMain'), sub = $('csStatusSub');
    sub.textContent = '';
    if (!b.plantedAt) {
      var carrierName = (s.players[b.carrier] || {}).name || '?';
      if (b.plantStartedAt) {
        main.textContent = t('game.csPlanting', { name: carrierName, site: b.site });
      } else if (b.carrier) {
        main.textContent = t('game.csHolding', { name: carrierName });
      } else {
        main.textContent = t('game.csIdleT');
      }
    } else {
      var fuseLeft = Math.max(0, (b.plantedAt + s.settings.fuseSec * 1000) - now());
      if (b.defuseBy) {
        var defuserName = (s.players[b.defuseBy] || {}).name || '?';
        var defuseLeft = Math.max(0, (b.defuseStartedAt + s.settings.defuseSec * 1000) - now());
        main.textContent = t('game.csDefusing',
          { name: defuserName, site: b.site, clock: fmtClock(defuseLeft) });
      } else {
        main.textContent = t('game.csPlanted', { site: b.site, clock: fmtClock(fuseLeft) });
      }
    }
  }

  function renderFeed(s) {
    if (s.feed.length === lastFeedLen) return;     // avoid thrashing the DOM
    lastFeedLen = s.feed.length;
    var ul = $('feed');
    ul.innerHTML = '';
    s.feed.slice().reverse().slice(0, 40).forEach(function (f) {
      var li = document.createElement('li');
      if (f.team) li.classList.add(f.team);
      if (f.kind === 'capture' || f.kind === 'pointTaken') li.classList.add('capture');
      var time = document.createElement('time');
      time.textContent = fmtClock(Math.max(0, f.ts - (s.startedAt || f.ts)));
      li.appendChild(time);
      li.appendChild(document.createTextNode(I18N.feedText(f, tname)));
      ul.appendChild(li);
    });
  }

  /* ------------------------------------------------------------------ end */

  function renderEnd(s) {
    var badge = $('endBadge');
    badge.className = 'endbadge' + (s.winner && s.winner !== 'draw' ? ' ' + s.winner : '');
    badge.textContent = s.winner === 'draw' ? t('end.draw') : t('end.wins', { team: tname(s.winner) });
    $('endScore').hidden = isCs();
    $('endScore').textContent = isDom()
      ? Math.ceil(s.tickets.red) + ' - ' + Math.ceil(s.tickets.blue)
      : s.score.red + ' - ' + s.score.blue;
    $('endReason').textContent = t('end.reason' +
      (s.endReason || 'time').charAt(0).toUpperCase() + (s.endReason || 'time').slice(1));

    $('thCaps').textContent = t(isDom() ? 'end.scans' : isCs() ? 'end.plants' : 'end.caps');
    $('thGrabs').textContent = t(isCs() ? 'end.defuses' : 'end.grabs');
    $('thGrabs').hidden = false;

    var tb = $('statsBody'); tb.innerHTML = '';
    s.order.map(function (id) { return s.players[id]; }).filter(Boolean)
      .sort(function (a, b) { return isCs()
        ? (b.plants + b.defuses) - (a.plants + a.defuses)
        : (b.captures - a.captures) || (b.grabs - a.grabs); })
      .forEach(function (p) {
        var tr = document.createElement('tr');
        var cells = isDom() ? [p.grabs, p.grabs, p.deaths]
          : isCs() ? [p.plants, p.defuses, p.deaths]
          : [p.captures, p.grabs, p.deaths];
        tr.innerHTML = '<td class="' + (p.team || '') + '">' + escapeHtml(p.name) + '</td>' +
          cells.map(function (c) { return '<td>' + c + '</td>'; }).join('');
        tb.appendChild(tr);
      });
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* The clock and the Domination simulation run locally from stored
     timestamps, never polled, so they stay correct with the network gone. */
  setInterval(function () {
    var s = G.state;
    if (s.phase === 'live') {
      if (isCs() && s.bomb.plantedAt) {
        // Once the bomb is down the main game clock no longer means anything --
        // show the fuse instead.
        var fuseLeft = (s.bomb.plantedAt + s.settings.fuseSec * 1000) - now();
        $('clock').textContent = fmtClock(fuseLeft);
        $('clock').parentElement.classList.toggle('urgent', fuseLeft < 10000);
      } else if (s.endsAt) {
        var left = s.endsAt - now();
        $('clock').textContent = fmtClock(left);
        $('clock').parentElement.classList.toggle('urgent', left < 60000);
      }
      recompute();
    }
  }, 250);

  /* ============================================================== joining */

  function enterGame(code, andJoin) {
    G.code = code;
    G.events = []; G.outbox = []; G.lastSeq = 0;
    loadLocal(code);
    lastPhase = null; lastMode = null; lastFeedLen = -1;
    recompute();
    show('screen-lobby');
    $('lobbyCode').textContent = code;

    fetch('/api/game/' + code).then(function (r) {
      // The server can legitimately have forgotten this game: a restart, a
      // redeploy, or a free-tier host that spun down between rounds. Our phone
      // still holds the whole log, so hand it back rather than losing the game.
      if (r.status === 404 && G.events.length) return restoreGame(code);
      if (!r.ok) throw new Error('missing');
      return r.json();
    }).then(function (d) {
      G.offset = d.serverTime - Date.now();
      absorb(d.events || []);
      setOnline(true);
      finishJoin(andJoin);
    }).catch(function () {
      setOnline(false);
      if (G.events.length) { toast(t('toast.offlineLocal')); finishJoin(andJoin); }
      else { toast(t('toast.gameNotFound'), 'bad'); show('screen-home'); G.code = null; }
    }).finally(function () { connect(); });
  }

  /* Push our copy of the log back to a server that has lost it. Every phone
     that reconnects does the same and the events dedupe by id, so it does not
     matter who gets there first or whose copy is the most complete. */
  function restoreGame(code) {
    G.events.forEach(function (e) { delete e.seq; });   // the server re-numbers
    G.lastSeq = 0;
    G.outbox = G.events.slice();
    return fetch('/api/game/' + code, { method: 'PUT' })
      .then(function () { return flush(); })
      .then(function () { return fetch('/api/game/' + code); })
      .then(function (r) { return r.json(); })
      .then(function (d) { toast(t('toast.restored')); return d; });
  }

  function finishJoin(andJoin) {
    var nm = ($('nameInput').value || LS.getItem('ctf.name') || '').trim() || 'Player';
    LS.setItem('ctf.name', nm);
    if (andJoin !== false && !G.state.players[pid]) emit('join', { name: nm });
    else if (G.state.players[pid] && G.state.players[pid].name !== nm) emit('setName', { name: nm });
    recompute();
  }

  /* ============================================================== scanner */

  var scanState = { stream: null, raf: null, detector: null, onResult: null, stop: false };

  function openScanner(hint, onResult) {
    $('scanhint').textContent = hint;
    scanState.onResult = onResult;
    scanState.stop = false;
    $('scanner').hidden = false;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
    }).catch(function () {
      // Some devices reject the resolution hints; a bare request usually works.
      return navigator.mediaDevices.getUserMedia({ video: true });
    }).then(function (stream) {
      scanState.stream = stream;
      var v = $('video');
      v.srcObject = stream;
      return v.play();
    }).then(function () {
      if ('BarcodeDetector' in window) {
        return window.BarcodeDetector.getSupportedFormats().then(function (f) {
          if (f.indexOf('qr_code') >= 0) {
            scanState.detector = new window.BarcodeDetector({ formats: ['qr_code'] });
          }
        }).catch(function () { });
      }
    }).then(function () { tick(); })
      .catch(function (err) {
        closeScanner();
        toast(err && err.name === 'NotAllowedError'
          ? t('toast.cameraDenied') : t('toast.cameraUnavailable'), 'bad');
      });
  }

  function tick() {
    if (scanState.stop) return;
    var v = $('video');
    if (v.readyState < 2) { scanState.raf = requestAnimationFrame(tick); return; }

    if (scanState.detector) {
      scanState.detector.detect(v).then(function (codes) {
        if (codes && codes.length) handleCode(codes[0].rawValue);
        else scanState.raf = requestAnimationFrame(tick);
      }).catch(function () {
        scanState.detector = null;
        scanState.raf = requestAnimationFrame(tick);
      });
      return;
    }

    var c = $('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
    var w = Math.min(640, v.videoWidth || 640);
    var h = Math.round(w * (v.videoHeight / v.videoWidth || 0.75));
    c.width = w; c.height = h;
    ctx.drawImage(v, 0, 0, w, h);
    var img = ctx.getImageData(0, 0, w, h);
    var res = window.jsQR ? window.jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' }) : null;
    if (res && res.data) handleCode(res.data);
    else scanState.raf = requestAnimationFrame(tick);
  }

  function closeScanner() {
    scanState.stop = true;
    if (scanState.raf) cancelAnimationFrame(scanState.raf);
    if (scanState.stream) scanState.stream.getTracks().forEach(function (tr) { tr.stop(); });
    scanState.stream = null; scanState.detector = null;
    $('video').srcObject = null;
    $('scanner').hidden = true;
  }

  /* Printed flags, printed numbered points, or a shared join link. */
  function parseCode(raw) {
    var v = String(raw || '').trim();
    var m = v.match(/^LTCTF:FLAG:(RED|BLUE)$/i);
    if (m) return { kind: 'flag', flag: m[1].toLowerCase() };
    m = v.match(/^LTCTF:POINT:([1-9])$/i);
    if (m) return { kind: 'point', point: +m[1] };
    try {
      var u = new URL(v, location.origin);
      var f = u.searchParams.get('flag');
      if (f && /^(red|blue)$/i.test(f)) return { kind: 'flag', flag: f.toLowerCase() };
      var pt = u.searchParams.get('point');
      if (pt && /^[1-9]$/.test(pt)) return { kind: 'point', point: +pt };
      var g = u.searchParams.get('g');
      if (g) return { kind: 'game', code: g.toUpperCase() };
    } catch (e) { }
    if (/^[A-Z0-9]{4}$/i.test(v)) return { kind: 'game', code: v.toUpperCase() };
    return null;
  }

  function handleCode(raw) {
    var parsed = parseCode(raw);
    if (!parsed) {
      $('scanhint').textContent = t('scan.unknown');
      scanState.raf = requestAnimationFrame(tick);
      return;
    }
    buzz(50);
    closeScanner();
    if (scanState.onResult) scanState.onResult(parsed);
  }

  /* =============================================================== wiring */

  function applyLanguage() {
    I18N.applyDom();
    document.documentElement.lang = I18N.lang;
    document.querySelectorAll('.lang').forEach(function (b) {
      b.classList.toggle('active', b.dataset.lang === I18N.lang);
    });
    lastMode = null; lastFeedLen = -1;
    render();
  }

  document.querySelectorAll('.lang').forEach(function (b) {
    b.addEventListener('click', function () { I18N.setLang(b.dataset.lang); applyLanguage(); });
  });

  $('nameInput').value = LS.getItem('ctf.name') || '';
  $('nameInput').addEventListener('change', function () {
    LS.setItem('ctf.name', this.value.trim());
  });

  $('btnCreate').addEventListener('click', function () {
    var nm = ($('nameInput').value || '').trim();
    if (!nm) { toast(t('toast.enterName'), 'bad'); $('nameInput').focus(); return; }
    LS.setItem('ctf.name', nm);
    this.disabled = true;
    fetch('/api/game', { method: 'POST' })
      .then(function (r) { return r.json(); })
      .then(function (d) { enterGame(d.code, true); })
      .catch(function () { toast(t('toast.needNet'), 'bad'); })
      .finally(function () { $('btnCreate').disabled = false; });
  });

  $('btnJoin').addEventListener('click', function () {
    var code = ($('codeInput').value || '').trim().toUpperCase();
    if (code.length !== 4) { toast(t('toast.enterCode'), 'bad'); return; }
    enterGame(code, true);
  });
  $('codeInput').addEventListener('input', function () {
    this.value = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  });

  $('btnScanJoin').addEventListener('click', function () {
    openScanner(t('scan.hintGame'), function (p) {
      if (p.kind === 'game') enterGame(p.code, true);
      else toast(t('toast.isFlagNotGame'), 'bad');
    });
  });

  $('btnScanClose').addEventListener('click', closeScanner);

  function leaveGame() {
    if (G.es) { try { G.es.close(); } catch (e) { } G.es = null; }
    G.code = null; lastPhase = null; show('screen-home');
  }
  $('lobbyBack').addEventListener('click', leaveGame);
  $('btnHome').addEventListener('click', leaveGame);

  $('lobbyShare').addEventListener('click', function () {
    var url = location.origin + '/?g=' + G.code;
    if (navigator.share) navigator.share({ title: 'Lasertag', text: G.code, url: url }).catch(function () { });
    else if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast(t('toast.linkCopied')); });
    else toast(url);
  });

  document.querySelectorAll('.btn-team').forEach(function (b) {
    b.addEventListener('click', function () { emit('setTeam', { playerId: pid, team: b.dataset.team }); });
  });

  document.querySelectorAll('.modebtn').forEach(function (b) {
    b.addEventListener('click', function () { settingsPatch({ mode: b.dataset.mode }); });
  });

  $('btnShuffle').addEventListener('click', function () {
    var s = G.state;
    var ids = s.order.filter(function (id) { return s.players[id]; });
    for (var i = ids.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = ids[i]; ids[i] = ids[j]; ids[j] = tmp;
    }
    ids.forEach(function (id, i) { emit('setTeam', { playerId: id, team: i % 2 ? 'blue' : 'red' }); });
  });

  function settingsPatch(patch) { emit('settings', { patch: patch }); }
  function numField(id, key, lo, hi, dflt, scale) {
    $(id).addEventListener('change', function () {
      var v = Math.max(lo, Math.min(hi, +this.value || dflt));
      var patch = {}; patch[key] = scale ? v * scale : v;
      settingsPatch(patch);
    });
  }
  numField('setDuration', 'durationSec', 1, 180, 15, 60);
  numField('setTarget', 'targetCaptures', 1, 20, 3);
  numField('setRespawn', 'respawnHintSec', 0, 300, 30);
  numField('setPoints', 'pointCount', 1, CTF.MAX_POINTS, 3);
  numField('setTickets', 'startTickets', 10, 5000, 300);
  numField('setDrain', 'drainPerSec', 1, 20, 1);
  numField('setCaptureSec', 'captureSec', 1, 60, 5);
  numField('setPlantSec', 'plantSec', 1, 60, 5);
  numField('setFuseSec', 'fuseSec', 5, 300, 45);
  numField('setDefuseSec', 'defuseSec', 1, 120, 7);
  $('setOwnHome').addEventListener('change', function () {
    settingsPatch({ ownFlagMustBeHome: this.checked });
  });
  $('setScale').addEventListener('change', function () {
    settingsPatch({ scaleWithLead: this.checked });
  });
  $('setRedName').addEventListener('change', function () {
    settingsPatch({ teamNames: { red: this.value.trim() } });
  });
  $('setBlueName').addEventListener('change', function () {
    settingsPatch({ teamNames: { blue: this.value.trim() } });
  });

  $('btnStart').addEventListener('click', function () {
    if (!me() || !me().team) { toast(t('toast.pickTeam'), 'bad'); return; }
    beep(520, 120); setTimeout(function () { beep(780, 320); }, 140);
    emit('start', {});
  });

  $('btnScan').addEventListener('click', function () {
    var mine = me();
    if (mine && !mine.alive) { toast(t('toast.deadCantScan'), 'bad'); return; }
    var dom = isDom(), cs = isCs();
    var pointBased = dom || cs;
    openScanner(t(dom ? 'scan.hintPoint' : cs ? 'scan.hintBomb' : 'scan.hintFlag'), function (p) {
      if (pointBased && p.kind !== 'point') { toast(t('toast.isGameNotFlag'), 'bad'); return; }
      if (!pointBased && p.kind !== 'flag') { toast(t('toast.isGameNotFlag'), 'bad'); return; }
      var before = snapshot();
      emit('scan', pointBased ? { playerId: pid, point: p.point } : { playerId: pid, flag: p.flag });
      if (snapshot() === before) toast(t('toast.noEffect'), 'bad');
    });
  });

  function snapshot() {
    var s = G.state;
    return JSON.stringify(s.flags) + JSON.stringify(s.score) +
      s.points.map(function (p) { return p.id + ':' + p.dir + ':' + p.owner; }).join(',') +
      JSON.stringify(s.bomb);
  }

  $('btnStatus').addEventListener('click', function () {
    var mine = me();
    if (!mine) return;
    if (mine.alive) { emit('died', { playerId: pid }); beep(220, 400, 'sawtooth'); buzz(220); }
    else { emit('revived', { playerId: pid }); beep(760, 160); }
  });

  $('btnRoster').addEventListener('click', function () {
    var s = G.state, ul = $('rosterList'); ul.innerHTML = '';
    s.order.forEach(function (id) { if (s.players[id]) ul.appendChild(playerLi(s.players[id], s)); });
    $('rosterSheet').hidden = false;
  });
  $('rosterClose').addEventListener('click', function () { $('rosterSheet').hidden = true; });
  $('rosterSheet').addEventListener('click', function (e) { if (e.target === this) this.hidden = true; });

  $('btnAbort').addEventListener('click', function () {
    if (confirm(t('game.confirmEnd'))) emit('abort', {});
  });
  $('btnRematch').addEventListener('click', function () { emit('rematch', {}); });

  /* ================================================================ boot */

  applyLanguage();

  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(function () { });
  if (!window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) {
    $('installHint').hidden = false;
  }

  var deep = new URLSearchParams(location.search).get('g');
  if (deep) {
    history.replaceState({}, '', '/');
    if ((LS.getItem('ctf.name') || '').trim()) enterGame(deep.toUpperCase(), true);
    else { $('codeInput').value = deep.toUpperCase(); toast(t('toast.nameThenJoin')); }
  } else {
    var last = LS.getItem('ctf.code');
    if (last && loadLocal(last)) {
      var st = CTF.reduce(G.events, now());
      if (st.phase !== 'ended' && st.players[pid]) enterGame(last, false);
    }
  }
})();
