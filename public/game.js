/*
 * Shared, deterministic rules engine for all Lasertag game modes.
 *
 * Runs identically in the browser and in Node. Every phone folds the SAME
 * event log into the SAME state, so no server ruling is ever required.
 *
 * Two things make that work:
 *
 *  1. Events are sorted by (ts, id) before folding. An action taken at 14:03:07
 *     on a phone with no signal lands in its correct historical position once it
 *     finally syncs, and every device recomputes the same outcome.
 *
 *  2. Everything between events is *simulated*, not stored. Domination's capture
 *     timers and ticket drain are continuous, so `advance()` integrates them
 *     exactly, stepping from one threshold crossing to the next. Ask for the
 *     state at any instant and you get the same answer on every device, with no
 *     clock events flying around.
 *
 * Feed entries carry structured params, never prose, so the UI can render them
 * in any language.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CTF = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TEAMS = ['red', 'blue'];

  var DEFAULT_SETTINGS = {
    mode: 'ctf',                 // 'ctf' | 'domination' | 'cs'
    durationSec: 900,            // hard cap for ctf/domination; for cs it is the
                                  // pre-plant cutoff only (see below)
    respawnHintSec: 30,          // advisory only -- respawn is manual
    teamNames: { red: '', blue: '' },   // empty = use the localised default

    // --- Capture the Flag ---
    targetCaptures: 3,
    ownFlagMustBeHome: false,

    // --- Domination ---
    pointCount: 3,               // how many numbered points are in play (1-5)
    startTickets: 300,           // 300 = five minutes of a one-point lead
    captureSec: 5,               // seconds per step: neutral->owned, or owned->neutral
    drainPerSec: 1,              // tickets per second, per point of lead
    scaleWithLead: true,         // off = flat rate no matter how big the lead

    // --- Counter Strike --- (red = Terrorists, blue = Counterterrorists)
    plantSec: 5,                 // how long the carrier must hold a scan to plant
    fuseSec: 45,                 // explosion countdown, starts the instant it's planted
    defuseSec: 7                 // how long an uninterrupted defuse scan takes
  };

  var MAX_POINTS = 5;

  function other(team) { return team === 'red' ? 'blue' : 'red'; }
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  function emptyState() {
    return {
      phase: 'lobby',              // lobby | live | ended
      settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)),
      hostId: null,
      players: {},
      order: [],

      // Capture the Flag
      flags: {
        red: { at: 'base', carrier: null },
        blue: { at: 'base', carrier: null }
      },
      score: { red: 0, blue: 0 },

      // Domination
      tickets: { red: 0, blue: 0 },
      points: [],                  // [{ id, c, dir, owner }]

      // Counter Strike
      bomb: emptyBomb(),

      startedAt: null,
      endsAt: null,
      endedAt: null,
      simTime: null,               // how far the simulation has been advanced
      winner: null,                // 'red' | 'blue' | 'draw'
      endReason: null,             // 'captures' | 'tickets' | 'time' | 'aborted'
      feed: []
    };
  }

  function ensurePlayer(s, id, name) {
    if (!s.players[id]) {
      s.players[id] = {
        id: id, name: name || 'Player', team: null, alive: true,
        deaths: 0, captures: 0, grabs: 0, plants: 0, defuses: 0
      };
      s.order.push(id);
      if (!s.hostId) s.hostId = id;
    }
    if (name) s.players[id].name = name;
    return s.players[id];
  }

  function emptyBomb() {
    return {
      carrier: null,            // terrorist currently holding the bomb (pre-plant)
      site: null,                // 1 | 2 -- being planted at, or planted at
      plantStartedAt: null,      // scan in progress, not yet complete
      plantedAt: null,           // plant complete; the fuse starts here
      defuseBy: null,            // counterterrorist currently defusing
      defuseStartedAt: null,     // their scan in progress, not yet complete
      resolved: null              // null | 'defused' | 'exploded'
    };
  }

  /* Living players on a team, in join order -- used to hand the bomb to a
     random survivor and to decide the "all terrorists down" win. */
  function aliveTeam(s, team) {
    return s.order.filter(function (id) {
      var p = s.players[id];
      return p && p.team === team && p.alive;
    });
  }

  /* Deterministic stand-in for Math.random(): every phone replays the same
     event log and must land on the same "random" pick, so the pick is derived
     from the triggering event's id instead of an actual RNG. */
  function pick(list, seed) {
    var h = 0;
    var str = String(seed);
    for (var i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return list[((h % list.length) + list.length) % list.length];
  }

  /* Structured, translatable. `p` holds only data -- never a sentence. */
  function say(s, ts, kind, p, team) {
    s.feed.push({ ts: ts, kind: kind, p: p || {}, team: team || null });
    if (s.feed.length > 250) s.feed.shift();
  }

  function finish(s, ts, winner, reason) {
    if (s.phase === 'ended') return;
    s.phase = 'ended';
    s.endedAt = ts;
    s.simTime = ts;
    s.winner = winner;
    s.endReason = reason;
    say(s, ts, 'end', { winner: winner, reason: reason },
      winner === 'draw' ? null : winner);
  }

  /* ============================================================ Domination */

  function initPoints(s) {
    var n = clamp(Math.round(s.settings.pointCount) || 1, 1, MAX_POINTS);
    s.points = [];
    for (var i = 1; i <= n; i++) s.points.push({ id: i, c: 0, dir: 0, owner: null });
  }

  /* c runs -1 (fully red) .. 0 (neutral) .. +1 (fully blue).
     Ownership is hysteretic: you only GAIN a point at an extreme, and you only
     LOSE it when the bar passes back through neutral. That is exactly the
     "5s to neutral, another 5s to flip" behaviour, and it also means a
     defender who re-scans in time never loses the point at all. */
  function ownerAfter(prevOwner, c) {
    if (c >= 1) return 'blue';
    if (c <= -1) return 'red';
    // Note the >= / <=: reaching the centre IS the moment the point goes
    // neutral. With a strict > the simulation steps exactly onto c === 0,
    // finds the owner unchanged, and then jumps straight to the far end --
    // draining tickets for a point nobody actually holds.
    if (prevOwner === 'red' && c >= 0) return null;
    if (prevOwner === 'blue' && c <= 0) return null;
    return prevOwner;
  }

  /* Next instant at which this point's ownership could change. */
  function nextThreshold(pt, unitMs) {
    if (!pt.dir) return null;
    var marks = pt.dir > 0 ? [0, 1] : [0, -1];
    var best = null;
    for (var i = 0; i < marks.length; i++) {
      var d = (marks[i] - pt.c) / pt.dir;
      if (d > 1e-9) {
        var when = d * unitMs;
        if (best === null || when < best) best = when;
      }
    }
    return best;
  }

  function countOwned(s) {
    var c = { red: 0, blue: 0 };
    for (var i = 0; i < s.points.length; i++) {
      if (s.points[i].owner) c[s.points[i].owner]++;
    }
    return c;
  }

  function drainPerMs(s) {
    var c = countOwned(s);
    var lead = c.red - c.blue;
    if (!lead) return { rate: 0, loser: null, lead: 0 };
    var mag = s.settings.scaleWithLead ? Math.abs(lead) : 1;
    return {
      rate: mag * s.settings.drainPerSec / 1000,
      loser: lead > 0 ? 'blue' : 'red',
      lead: lead
    };
  }

  /* A settings patch is taken from any event, unvalidated -- a malformed or
     hostile one (a non-numeric string, 0, negative, NaN) must fall back to
     something sane rather than making a threshold uncrossable forever. */
  function safeSec(v, dflt) {
    var n = +v;
    return (isFinite(n) && n > 0) ? n : dflt;
  }

  function movePoints(s, dt, unitMs) {
    for (var i = 0; i < s.points.length; i++) {
      var pt = s.points[i];
      if (!pt.dir) continue;
      pt.c = clamp(pt.c + pt.dir * (dt / unitMs), -1, 1);
      // Snap through float dust so a point actually settles instead of
      // creeping towards its bound for a few extra iterations.
      if (pt.c > 1 - 1e-9) pt.c = 1;
      if (pt.c < -1 + 1e-9) pt.c = -1;
      var was = pt.owner;
      pt.owner = ownerAfter(pt.owner, pt.c);
      if (pt.c === 1 || pt.c === -1) pt.dir = 0;
      if (pt.owner !== was) {
        say(s, s.simTime + dt, pt.owner ? 'pointTaken' : 'pointNeutral',
          { point: pt.id }, pt.owner);
      }
    }
  }

  /* ================================================================ advance */

  /* Move the simulation forward to `until`, stopping at every moment that
     changes the arithmetic (a point flipping, tickets hitting zero, the clock
     running out) so the result is exact rather than sampled. */
  function advance(s, until) {
    if (s.phase !== 'live' || s.simTime === null) return;
    if (!(until > s.simTime)) return;

    var dom = s.settings.mode === 'domination';
    var cs = s.settings.mode === 'cs';
    var unitMs = Math.max(200, (s.settings.captureSec || 5) * 1000);
    // Settings lock at kickoff, so these can be computed once: a stray NaN,
    // zero or negative value (a malformed settings patch) floors to something
    // sane rather than freezing the threshold math below forever.
    var plantMs = cs ? safeSec(s.settings.plantSec, 5) * 1000 : 0;
    var fuseMs = cs ? safeSec(s.settings.fuseSec, 45) * 1000 : 0;
    var defuseMs = cs ? safeSec(s.settings.defuseSec, 7) * 1000 : 0;
    var guard = 0;

    // `target` is recomputed every iteration rather than pinned once before
    // the loop: for CS, whether the main game-length timer (s.endsAt) still
    // caps the simulation depends on s.bomb.plantedAt, which can flip from
    // false to true *inside* this very call (the plant event only marks when
    // planting STARTED -- completion is a threshold this loop steps to). A
    // cap computed once from the pre-loop state would stay stuck at s.endsAt
    // even after the bomb goes live, and since reduce() replays from scratch
    // every time, that would freeze the round at s.endsAt permanently rather
    // than just for one tick.
    for (;;) {
      var hardEnd = (cs && s.bomb.plantedAt) ? until : (s.endsAt || until);
      var target = Math.min(until, hardEnd);
      if (!(s.simTime < target) || guard++ >= 20000) break;
      var step = target - s.simTime;

      if (dom) {
        for (var i = 0; i < s.points.length; i++) {
          var tt = nextThreshold(s.points[i], unitMs);
          if (tt !== null && tt < step) step = tt;
        }

        var d = drainPerMs(s);
        if (d.rate > 0) {
          var toZero = s.tickets[d.loser] / d.rate;
          if (toZero <= step) {
            movePoints(s, toZero, unitMs);
            s.simTime += toZero;
            s.tickets[d.loser] = 0;
            finish(s, s.simTime, other(d.loser), 'tickets');
            return;
          }
          s.tickets[d.loser] = Math.max(0, s.tickets[d.loser] - d.rate * step);
        }
        movePoints(s, step, unitMs);
      }

      if (cs) {
        var b = s.bomb;
        if (b.plantStartedAt && !b.plantedAt) {
          var needPlant = (b.plantStartedAt + plantMs) - s.simTime;
          if (needPlant < step) step = Math.max(0, needPlant);
        } else if (b.plantedAt && !b.resolved) {
          var needFuse = (b.plantedAt + fuseMs) - s.simTime;
          var need = needFuse;
          if (b.defuseStartedAt) {
            var needDefuse = (b.defuseStartedAt + defuseMs) - s.simTime;
            if (needDefuse < need) need = needDefuse;
          }
          if (need < step) step = Math.max(0, need);
        }
      }

      s.simTime += step;

      if (cs) {
        var b2 = s.bomb;
        if (b2.plantStartedAt && !b2.plantedAt &&
            s.simTime >= b2.plantStartedAt + plantMs - 1e-6) {
          var plantedSite = b2.site;
          b2.plantedAt = s.simTime;
          b2.plantStartedAt = null;
          say(s, s.simTime, 'bombPlanted', { site: plantedSite }, 'red');
        } else if (b2.plantedAt && !b2.resolved) {
          var defuseDone = b2.defuseStartedAt &&
            s.simTime >= b2.defuseStartedAt + defuseMs - 1e-6;
          var fuseDone = s.simTime >= b2.plantedAt + fuseMs - 1e-6;
          if (defuseDone) {
            b2.resolved = 'defused';
            finish(s, s.simTime, 'blue', 'defused');
            return;
          } else if (fuseDone) {
            b2.resolved = 'exploded';
            finish(s, s.simTime, 'red', 'exploded');
            return;
          }
        }
      }
    }

    if (s.endsAt && s.simTime >= s.endsAt && s.phase === 'live') {
      if (cs) {
        // The pre-plant cutoff: once the bomb is down the round is decided by
        // the fuse/defuse clock above, not by this timer.
        if (!s.bomb.plantedAt) finish(s, s.endsAt, 'blue', 'time');
      } else {
        var a, b3;
        if (dom) { a = s.tickets.red; b3 = s.tickets.blue; }
        else { a = s.score.red; b3 = s.score.blue; }
        finish(s, s.endsAt, a === b3 ? 'draw' : (a > b3 ? 'red' : 'blue'), 'time');
      }
    }
  }

  /* ================================================================== apply */

  function dropCarried(s, playerId, ts) {
    TEAMS.forEach(function (f) {
      if (s.flags[f].carrier === playerId) {
        s.flags[f] = { at: 'base', carrier: null };
        say(s, ts, 'flagreset', { flag: f, name: s.players[playerId].name }, f);
      }
    });
  }

  function applyCtfScan(s, p, ts, flag) {
    if (TEAMS.indexOf(flag) < 0) return;
    var enemy = other(p.team);

    if (flag === enemy) {
      // The ENEMY flag -> take it, if it is sitting at their base.
      if (s.flags[enemy].at === 'base') {
        s.flags[enemy] = { at: 'carried', carrier: p.id };
        p.grabs++;
        say(s, ts, 'grab', { name: p.name, flag: enemy }, p.team);
      }
      // Already carried by anyone: a no-op. The earliest timestamp wins by
      // virtue of the sort order, so late syncs cannot steal a grab.
    } else {
      // Your OWN flag -> score, if you are carrying theirs.
      if (s.flags[enemy].carrier === p.id) {
        if (s.settings.ownFlagMustBeHome && s.flags[p.team].at !== 'base') {
          say(s, ts, 'rejectOwnFlagOut', { name: p.name }, p.team);
          return;
        }
        s.score[p.team]++;
        p.captures++;
        s.flags[enemy] = { at: 'base', carrier: null };
        say(s, ts, 'capture',
          { name: p.name, team: p.team, red: s.score.red, blue: s.score.blue }, p.team);
        if (s.score[p.team] >= s.settings.targetCaptures) finish(s, ts, p.team, 'captures');
      } else if (s.flags[enemy].at === 'base') {
        say(s, ts, 'rejectNothingToScore', { name: p.name }, p.team);
      }
    }
  }

  function applyDomScan(s, p, ts, pointId) {
    var pt = null;
    for (var i = 0; i < s.points.length; i++) if (s.points[i].id === pointId) pt = s.points[i];
    if (!pt) return;                                  // point not in play this game

    var want = p.team === 'blue' ? 1 : -1;
    if (pt.owner === p.team && pt.c === want) {
      say(s, ts, 'rejectAlreadyOurs', { name: p.name, point: pt.id }, p.team);
      return;
    }
    if (pt.dir === want) return;                      // already heading our way
    pt.dir = want;
    p.grabs++;
    say(s, ts, 'capturing',
      { name: p.name, point: pt.id, contested: pt.owner === other(p.team) }, p.team);
  }

  /* ========================================================= Counter Strike */

  /* One scan means different things for the two sides, and only if it is
     currently possible at all: */
  function applyCsScan(s, p, ts, site) {
    if (site !== 1 && site !== 2) return;              // only two bomb sites exist
    var b = s.bomb;
    if (b.resolved) return;

    if (p.team === 'red') {
      if (b.plantedAt) return;                          // nothing left to plant
      if (b.carrier !== p.id) {
        say(s, ts, 'rejectNotCarrier', { name: p.name }, p.team);
        return;
      }
      if (b.plantStartedAt && b.site === site) return;   // already planting here
      b.site = site;
      b.plantStartedAt = ts;
      p.plants++;
      say(s, ts, 'planting', { name: p.name, site: site }, p.team);
    } else {
      if (!b.plantedAt) {
        say(s, ts, 'rejectNotPlanted', { name: p.name }, p.team);
        return;
      }
      if (site !== b.site) {
        say(s, ts, 'rejectWrongSite', { name: p.name, site: b.site }, p.team);
        return;
      }
      if (b.defuseBy === p.id) return;                   // already defusing
      b.defuseBy = p.id;
      b.defuseStartedAt = ts;
      p.defuses++;
      say(s, ts, 'defusing', { name: p.name, site: site }, p.team);
    }
  }

  /* Death OR leaving only matters for CS while the bomb has not gone off yet:
     either can interrupt whoever was mid-action, and either can hand the bomb
     onward or end the round outright if no terrorist is left standing.
     `leaving` just picks the wording -- "left" reads oddly as "was hit" and
     vice versa -- everything else is identical. Callers pass a raw id/name
     rather than a player object because the 'leave' case has already deleted
     the player from s.players by the time this runs (so that aliveTeam(),
     used below, correctly stops treating them as a candidate). */
  function applyCsDeath(s, playerId, playerName, ts, seed, leaving) {
    var b = s.bomb;
    if (b.resolved) return;

    if (b.defuseBy === playerId) {
      b.defuseBy = null; b.defuseStartedAt = null;
      say(s, ts, leaving ? 'defuseAbortedLeave' : 'defuseAborted', { name: playerName }, 'blue');
    }

    if (!b.plantedAt) {
      if (b.carrier === playerId) {
        if (b.plantStartedAt) {
          say(s, ts, leaving ? 'plantAbortedLeave' : 'plantAborted', { name: playerName }, 'red');
        }
        b.plantStartedAt = null; b.site = null; b.carrier = null;
      }
      var alive = aliveTeam(s, 'red');
      if (!alive.length) { finish(s, ts, 'blue', 'elimination'); return; }
      if (!b.carrier) {
        b.carrier = pick(alive, seed);
        say(s, ts, 'bombAssigned', { name: s.players[b.carrier].name }, 'red');
      }
    }
  }

  function apply(s, ev) {
    var ts = ev.ts;
    var p;

    switch (ev.type) {

      case 'join':
        p = ensurePlayer(s, ev.actor, ev.name);
        if (ev.team && TEAMS.indexOf(ev.team) >= 0) p.team = ev.team;
        say(s, ts, 'join', { name: p.name }, p.team);
        break;

      case 'setName':
        p = ensurePlayer(s, ev.playerId || ev.actor);
        p.name = ev.name || p.name;
        break;

      case 'setTeam':
        p = ensurePlayer(s, ev.playerId || ev.actor);
        if (s.phase !== 'lobby') break;                // teams lock at kickoff
        if (TEAMS.indexOf(ev.team) < 0 && ev.team !== null) break;
        p.team = ev.team;
        say(s, ts, 'team', { name: p.name, team: ev.team }, ev.team);
        break;

      case 'leave':
        var lid = ev.playerId || ev.actor;
        if (s.players[lid]) {
          var leftName = s.players[lid].name;
          dropCarried(s, lid, ts);
          say(s, ts, 'leave', { name: leftName });
          delete s.players[lid];
          s.order = s.order.filter(function (x) { return x !== lid; });
          // Run after the deletion, not before: aliveTeam() below must not
          // still count the player who just left.
          if (s.settings.mode === 'cs' && s.phase === 'live') {
            applyCsDeath(s, lid, leftName, ts, ev.id, true);
          }
        }
        break;

      case 'settings':
        if (s.phase !== 'lobby') break;
        Object.keys(ev.patch || {}).forEach(function (k) {
          if (k === 'teamNames') {
            s.settings.teamNames = Object.assign({}, s.settings.teamNames, ev.patch.teamNames);
          } else if (k in s.settings) {
            s.settings[k] = ev.patch[k];
          }
        });
        break;

      case 'start':
        if (s.phase !== 'lobby') break;
        s.phase = 'live';
        s.startedAt = ts;
        s.simTime = ts;
        s.endsAt = ts + s.settings.durationSec * 1000;
        s.flags = { red: { at: 'base', carrier: null }, blue: { at: 'base', carrier: null } };
        s.score = { red: 0, blue: 0 };
        s.tickets = { red: s.settings.startTickets, blue: s.settings.startTickets };
        initPoints(s);
        s.bomb = emptyBomb();
        Object.keys(s.players).forEach(function (id) { s.players[id].alive = true; });
        if (s.settings.mode === 'cs') {
          var starters = aliveTeam(s, 'red');
          if (starters.length) s.bomb.carrier = pick(starters, ev.id);
        }
        s.feed = [];                                   // lobby chatter is noise once you are running
        say(s, ts, 'start', { mode: s.settings.mode, target: s.settings.targetCaptures });
        if (s.bomb.carrier) say(s, ts, 'bombAssigned', { name: s.players[s.bomb.carrier].name }, 'red');
        break;

      case 'died':
        p = s.players[ev.playerId || ev.actor];
        if (!p || s.phase !== 'live' || !p.alive) break;
        p.alive = false;
        p.deaths++;
        say(s, ts, 'died', { name: p.name }, p.team);
        dropCarried(s, p.id, ts);
        if (s.settings.mode === 'cs') applyCsDeath(s, p.id, p.name, ts, ev.id, false);
        break;

      case 'revived':
        p = s.players[ev.playerId || ev.actor];
        if (!p || s.phase !== 'live' || p.alive) break;
        p.alive = true;
        say(s, ts, 'revived', { name: p.name }, p.team);
        break;

      /* One scan event for both modes. The QR only says WHICH thing was
         scanned; what it means is decided entirely here. */
      case 'scan':
        p = s.players[ev.playerId || ev.actor];
        if (!p || s.phase !== 'live' || !p.team || !p.alive) break;
        if (s.settings.mode === 'domination') applyDomScan(s, p, ts, ev.point);
        else if (s.settings.mode === 'cs') applyCsScan(s, p, ts, ev.point);
        else applyCtfScan(s, p, ts, ev.flag);
        break;

      case 'abort':
        if (s.phase === 'ended') break;
        finish(s, ts, 'draw', 'aborted');
        break;

      /* Back to the lobby keeping players, teams and settings. */
      case 'rematch':
        if (s.phase !== 'ended') break;
        s.phase = 'lobby';
        s.startedAt = s.endsAt = s.endedAt = s.simTime = null;
        s.winner = s.endReason = null;
        s.score = { red: 0, blue: 0 };
        s.tickets = { red: 0, blue: 0 };
        s.points = [];
        s.flags = { red: { at: 'base', carrier: null }, blue: { at: 'base', carrier: null } };
        s.bomb = emptyBomb();
        Object.keys(s.players).forEach(function (id) {
          var q = s.players[id];
          q.alive = true; q.deaths = 0; q.captures = 0; q.grabs = 0; q.plants = 0; q.defuses = 0;
        });
        s.feed = [];
        say(s, ts, 'rematch', {});
        break;

      /* Accepted for compatibility. Time is simulated now, not announced. */
      case 'timeup':
        break;
    }
    return s;
  }

  /* Full replay. Cheap at our scale and it is what guarantees every phone
     agrees after a resync. `until` projects the simulation to a given instant
     -- the UI passes the current time so tickets and capture bars stay live
     without generating any events. */
  function reduce(events, until) {
    var sorted = events.slice().sort(function (a, b) {
      if (a.ts !== b.ts) return a.ts - b.ts;
      return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
    });
    var s = emptyState();
    for (var i = 0; i < sorted.length; i++) {
      advance(s, sorted[i].ts);
      apply(s, sorted[i]);
    }
    if (until) advance(s, until);
    return s;
  }

  return {
    TEAMS: TEAMS,
    MAX_POINTS: MAX_POINTS,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    other: other,
    reduce: reduce,
    emptyState: emptyState,
    countOwned: countOwned,
    drainPerMs: drainPerMs
  };
});
