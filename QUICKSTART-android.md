# Testing on your Android phone — no hosting, no accounts

The goal here is to get the app onto your phone **with a working camera**, in
about ten minutes, without deploying anything.

The trick: Chrome can forward a port over the USB cable, so your phone opens
`http://localhost:8080` and reaches your laptop. Because the phone sees it as
*localhost*, Chrome treats it as a secure context and allows the camera — the
exact thing that fails if you connect over wifi to `192.168.x.x`.

---

## 1. Run the server on your laptop

Install [Node.js](https://nodejs.org) (LTS) if you don't have it, then unzip the
project and, in that folder:

```
node server.js
```

You should see `Lasertag relay listening on http://localhost:8080`. Leave it
running.

> Do **not** run `npm install` — the app has zero dependencies. That command
> only pulls in the browser-testing tooling, which you don't need.

Open `http://localhost:8080` in your laptop browser to confirm it works.

---

## 2. Turn on USB debugging on the phone

1. **Settings → About phone**, tap **Build number** seven times.
   ("You are now a developer.")
2. **Settings → System → Developer options** → enable **USB debugging**.
3. Plug the phone into the laptop.
4. On the phone, accept the *"Allow USB debugging?"* prompt. Tick "always
   allow".

On Windows the driver installs itself. On macOS and Linux nothing is needed.

---

## 3. Forward the port

In **Chrome on the laptop**, go to:

```
chrome://inspect/#devices
```

Your phone should be listed. Then:

1. Click **Port forwarding…**
2. Add port `8080` → `localhost:8080`
3. Tick **Enable port forwarding** → Done

---

## 4. Open it on the phone

In **Chrome on the phone**, go to:

```
http://localhost:8080
```

The app loads. When you tap **Punkt scannen** / **Flagge scannen** it will ask
for camera permission — say yes. If the camera opens, everything that matters
is working.

---

## What to actually test

**You don't need a printer.** Open `http://localhost:8080/flags.html` on your
laptop and scan the codes straight off the monitor. Turn the screen brightness
up; it reads fine. (Do print them before you play for real — a monitor is not
much use in a forest.)

**You need two players**, so use the laptop as the second one. Open the app in a
normal window *and* an incognito window — they get separate player identities,
because identity lives in that browser's local storage. The laptop can't scan
without a webcam, but it doesn't need to; it just has to be in the game so you
can watch it react.

A useful run-through:

1. Phone: enter a name → **Spiel erstellen**. Note the 4-character code.
2. Laptop (incognito): enter a different name, type the code, **Beitreten**.
3. Put them on opposite teams, tap **Spiel starten**.
4. Phone: scan the blue flag off your laptop screen. The laptop window should
   say *"Erobert von …"* within a second, with a sound and a toast.
5. Phone: tap **Getroffen!** → the flag resets to base on both screens.
6. Switch the lobby to **Domination** and try again: watch the capture bar slide
   for five seconds before the point actually changes hands, and the ticket
   counter start falling on the losing side.

**Test the offline behaviour** — this is the part worth seeing with your own
eyes. With a game running on the phone, **unplug the USB cable**. The yellow bar
appears, but the app keeps working: tap "Getroffen!", scan things, watch the
Domination bars and tickets keep running perfectly. Plug the cable back in and
everything syncs to the laptop at once, in the right order.

**Install it to the home screen**: Chrome menu (⋮) → *Zum Startbildschirm
hinzufügen*. It then opens fullscreen with no browser chrome, which is how
you'd actually use it.

---

## If USB is a hassle

You can reach the laptop from any phone on the same wifi at
`http://<laptop-ip>:8080` — find the IP with `ipconfig` (Windows) or
`ifconfig | grep inet` (macOS/Linux).

Everything works over wifi **except the camera**: lobby, teams, settings, the
timer, the Domination simulation, the live feed, sync between several phones.
Only scanning is blocked, because that origin isn't a secure context. It's a
decent way to see the app on a few phones at once — just not a way to play.

---

## When you're ready to actually play — deploying to Render

Once the phone test passes, put it on a real HTTPS address so everyone's camera
works. `render.yaml` is already in the project, so Render configures itself.

1. Push this folder to a GitHub repo (private is fine).
2. [render.com](https://render.com) → sign up with GitHub → **New → Blueprint**.
3. Pick the repo. It reads `render.yaml` and shows one service, `lasertag`,
   on the Free plan. **Apply**.
4. Two minutes later you have `https://lasertag-xxxx.onrender.com`.
5. Open it on each phone once, with signal, and **add it to the home screen**.

### The one catch, and why it doesn't matter

Free Render services **spin down after 15 minutes** without traffic and take
about a minute to wake. In practice:

- It will not sleep *during* a game. Every phone holds a live connection to it,
  which counts as traffic.
- It may well have slept before you start. The first person to open the app
  waits about a minute on a loading page. Open it while you're still kitting up.
- The free filesystem is wiped on every restart, so a sleeping server forgets
  the games it was holding. **The app handles this by itself**: when a phone
  finds the server no longer knows the game, it hands its own copy of the event
  log back and play continues. You'll see a one-line note when it happens. This
  is tested — see the "server amnesia" section of `npm run test:e2e`.

If the one-minute wake-up starts to grate, the upgrade path is Cloudflare
Workers: free, never sleeps, nothing of yours running. That needs the relay
ported to a Worker plus a Durable Object.
