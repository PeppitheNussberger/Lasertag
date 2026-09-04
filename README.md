# Lasertag — Capture the Flag, Domination & Counter Strike

Game master for Lasertag with BRX guns. Two teams, printable QR codes, live
notifications, adjustable game length. Runs as an installable web app — nothing
to publish to an app store.

German by default, English one tap away. Built to survive the field: install it
once with signal and it plays with no reception.

```
node server.js      # http://localhost:8080
npm test            # rules engine, all three modes
```

Zero runtime dependencies. Node 18+.

---

## Capture the Flag

| Situation | Result |
|---|---|
| You scan the **enemy** flag while it's at their base | You carry it. Everyone is notified instantly. |
| You scan **your own** flag while carrying theirs | **Capture.** Point scored, enemy flag returns to their base. |
| You're hit while carrying a flag | The flag **resets to its own base**. |
| You're hit | You can't take or score flags until you tap back in. |
| A team hits the capture target | Game ends immediately for everyone. |
| The clock runs out first | Highest score wins; equal is a draw. |

Configurable: length, captures to win, suggested respawn wait, team names, and
an optional classic rule requiring your own flag to be at base before you score.

## Domination

1–5 numbered points, all starting **neutral**. Each point has a bar that slides
between red and blue.

| Situation | Result |
|---|---|
| You scan a **neutral** point | After 5 s it's yours. |
| You scan an **enemy-held** point | After 5 s it goes neutral, after another 5 s it's yours. |
| They scan back before the bar passes the middle | The bar runs back from where it got to — the point never changed hands. |
| One team holds **more** points than the other | The trailing team's tickets drain. |
| A team runs out of tickets | The other team wins. |
| The clock runs out first | Most tickets remaining wins. |

**Ticket maths.** Default is 300 tickets and 1 ticket per second *per point of
lead*. So a one-point lead burns 300 tickets in exactly five minutes — the
number you asked for — while 3-0 does it in 100 seconds. That scaling is what
stops a walkover from taking as long as a nailbiter; switch off *drain scales
with the lead* in the lobby for a flat rate instead. Capture time, point count,
tickets and rate are all adjustable, and the lobby shows the resulting game
length as you change them.

Dying doesn't change who owns a point — dead players simply can't scan.

Respawn in all modes is manual and on your honour: tap "I'm hit", walk back,
tap "I'm back in". The suggested wait is shown, not enforced (Counter Strike is
the one place death has teeth anyway — see below).

## Counter Strike

Two bomb sites, reusing Domination's numbered QR codes 1 and 2 — print one set,
it works for both modes. Red is the Terrorists, Blue the Counter-Terrorists.
One round per game: no side swap, no best-of-X.

| Situation | Result |
|---|---|
| Kickoff | The bomb goes to one random Terrorist. |
| The carrier scans a bomb site | Planting starts. After **plant time** it's down, and everyone is told which site. |
| A Counter-Terrorist scans that same site | Defusing starts. |
| Defusing finishes before the fuse runs out | **Defused** — Counter-Terrorists win. |
| The fuse (**explosion countdown**) runs out first | **Boom** — Terrorists win. |
| The carrier is hit before planting | The bomb jumps to another living Terrorist. |
| Whoever is planting or defusing is hit | Progress is lost — someone has to start over, if there's still time. |
| Every Terrorist is down before the plant | Counter-Terrorists win outright. |
| The pre-plant clock runs out with no plant | Counter-Terrorists win by default. |

Once the bomb is down, the main game-length clock stops mattering — the round
is decided by the fuse and the defuse timer instead, however long that takes.
Configurable: pre-plant game length, time to plant, the explosion countdown
(from the plant), and how long an uninterrupted defuse takes.

---

## Why it's built this way

**The camera constraint drove the architecture.** Browsers only allow camera
access in a secure context — HTTPS or localhost. A laptop server on a field
hotspot (`http://192.168.x.x`) gets the camera *blocked*, which kills QR
scanning entirely. So the app is hosted on public HTTPS and installed as a PWA:
the service worker caches it, and because the origin stays `https://`, the
camera keeps working with the network gone.

**The server is not the referee.** It stores an append-only event log and fans
it out. Every phone folds that same log into the same state using
`public/game.js`, which runs identically in the browser and in Node.

**Ordering, not arrival, decides the game.** Events are sorted by
`(timestamp, id)` and replayed from scratch on every change. An event created at
14:03:07 on a phone with no signal still lands in its correct historical
position when it finally syncs — so if two players grabbed the same flag, the
one who actually got there first wins, even if their phone synced last. Every
device converges on an identical state.

**Time is simulated, not announced.** Domination's capture bars and ticket drain
are continuous, so nothing ticks over the wire. `advance()` integrates them
exactly, stepping from one threshold crossing to the next — a point flipping,
tickets hitting zero, the clock expiring. Ask for the state at any instant and
every device gives the same answer, so a phone that was in a dead zone for three
minutes catches up to precisely the right numbers instead of an approximation.
The same machinery ends a Capture the Flag game on time without any clock event.

**Transport is SSE + POST, not WebSockets** — native reconnect, survives flaky
mobile networks and dumb proxies, zero dependencies.

Phone clocks are corrected against the server on every exchange, and the server
clamps absurd timestamps so one badly-set device can't rewrite history.

---

## Setting up a game

1. Open `/flags.html`, print what you need once, laminate it. Capture the Flag
   needs the two flag sheets; Domination needs however many numbered points you
   want; Counter Strike needs points 1 and 2 (same codes as Domination — one
   printout covers both). The codes carry the **team or the number**, not the
   location — the same sheets work at every field.
2. One player taps **Spiel erstellen** and reads out the 4-character code (or
   shares the link).
3. Everyone joins, picks a team, host picks the mode and settings.
4. Place the sheets — chest height, facing out, matte not glossy. For
   Domination, spread the points well apart; a line across the field works well
   for 3, a cross for 5. For Counter Strike, keep the two sites well apart and
   away from either base.
5. **Spiel starten.**

Tell everyone to install the app to their home screen *before* leaving, while
they still have signal. That's what makes it work in a dead zone.

---

## Deploying

Any host that runs Node and gives you HTTPS. One file, no dependencies.

**Render** — `render.yaml` is in the repo, so Render configures itself: New →
Blueprint → pick the repo → Apply. Free plan services spin down after 15 minutes
idle and take about a minute to wake, and their filesystem is wiped on restart.
Neither hurts: an active game keeps connections open so it won't sleep mid-round,
and if the server *has* forgotten a game, the first phone back hands its own copy
of the event log over and play continues (`restoreGame` in `public/app.js`, via
`PUT /api/game/:code`).

**Railway / Fly.io** — point at the repo, build command `npm install` (installs
nothing), start command `node server.js`. They terminate TLS for you.

**A VPS you already have** — behind Caddy you get a certificate automatically:

```
ctf.example.com {
    reverse_proxy localhost:8080
}
```

Nginx works too, but disable proxy buffering or live notifications stall:

```nginx
location / {
    proxy_pass http://localhost:8080;
    proxy_set_header Connection '';
    proxy_http_version 1.1;
    proxy_buffering off;      # required for SSE
    chunked_transfer_encoding off;
}
```

**Docker**

```
docker build -t lasertag . && docker run -p 8080:8080 lasertag
```

Games live in memory and are mirrored to `games.json`, so a restart mid-match
loses nothing. They expire after 24 hours. `DATA_FILE` moves that file, `PORT`
changes the port.

---

## Playing in a dead zone

Your taps are stored locally and a yellow bar shows how many are queued. The
moment any phone finds signal, everything syncs and all devices recalculate the
same score. You still play; the scoreboard is right afterwards. What you lose is
the *live* "they took our flag!" alert reaching the others.

If you regularly play somewhere with no coverage and want instant alerts there,
the fix is a relay on the field: a Raspberry Pi or laptop running this same
server on a hotspot. The catch is the certificate — you need a real one, since a
self-signed cert means every player clicks through a warning and some browsers
still refuse the camera. The workable trick is a public DNS A record (e.g.
`field.yourdomain.com`) pointing at the Pi's fixed LAN IP, with a Let's Encrypt
cert issued by DNS challenge. The client needs no changes, only a different
origin.

---

## Layout

```
server.js              sync relay — SSE + POST, no dependencies
public/game.js         rules engine for all three modes (shared browser/Node, no DOM)
public/i18n.js         German/English strings and feed rendering
public/app.js          UI, offline queue, QR scanner
public/index.html      all four screens, all three modes
public/flags.html      printable flag, point and bomb-site sheets
public/help.html       in-app rules, both languages
QUICKSTART-android.md  test it on your phone today, then deploy to Render
render.yaml            Render blueprint — deploys itself
public/sw.js           service worker — makes it work offline
test/                  rules, server, and three browser end-to-end suites
```

The rules engine emits **structured** feed entries (`{kind, params}`), never
prose, so the same event log reads correctly on a German phone and an English
one sitting next to each other.

## Tests

```
node server.js &
npm test              # 152 rules assertions, all three modes
npm run test:server   # 27 HTTP/SSE assertions
npm run test:e2e      # 25 assertions, Capture the Flag, two browsers
npm run test:e2e:dom  # 28 assertions, Domination, two browsers
npm run test:e2e:cs   # 19 assertions, Counter Strike, two browsers
npm run screens       # reference screenshots + verifies printed codes decode
```

251 assertions. Start the server with `ALLOW_TEST_HOOKS=1` for the suites
that simulate a server restart; without it that destructive endpoint does not
exist, which is itself asserted. The end-to-end suites drive real browsers whose cameras show the
actual printed QR images, covering grabs, death resets, mid-game device
switches, captures, capture-bar timing, ticket drain, bomb plant/defuse/explode
races and offline queueing with reconnect.

Two real bugs came out of the original two modes' tests: a hidden overlay that
swallowed every tap, and tickets draining for a point that nobody held (the
simulation stepped exactly onto the centre of the bar, decided ownership
hadn't changed, then jumped straight to the far end). Both are pinned by
regression tests. Counter Strike's own engine work turned up a third: the
bomb-carrier and bomb-wander picks used `Math.random()`, which is fine on one
phone but breaks the core guarantee that every phone folds the same event log
into the same state — two devices (or the same device replaying twice) could
disagree on who was holding the bomb. Fixed by deriving the "random" pick
deterministically from the triggering event's id instead (see `pick()` in
`public/game.js`); a determinism test now pins it down.

A follow-up review of Counter Strike after it first passed its own tests
turned up three more, all now fixed and regression-tested: `advance()` could
freeze a round forever in `'live'` phase if the fuse or defuse finished after
the pre-plant game clock's cutoff, because that cutoff was fixed once instead
of being re-checked after the bomb went off; a player **leaving** mid-plant or
mid-defuse didn't clean up the bomb state the way dying did, which could
softlock a round or credit the wrong winner; and `plantSec`/`fuseSec`/
`defuseSec` had no floor, so a malformed setting (NaN, zero, negative, a
non-numeric string) made a threshold uncrossable. See `safeSec()` in
`public/game.js` for the fix to the last one.

## Not built yet

Nothing currently planned. All three modes share the same event log, teams,
respawn handling, sync, offline layer and time-advance simulation — a new mode
is a branch in `public/game.js` plus a screen, not a new app.
