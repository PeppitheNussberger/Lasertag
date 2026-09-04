/*
 * Translations. German is the default; English is one tap away in the lobby.
 *
 * Static markup is translated by tagging elements with data-i18n (textContent)
 * or data-i18n-ph (placeholder). Feed lines arrive from the rules engine as
 * structured params and are turned into prose here, so the same event log
 * reads correctly on a German phone and an English one side by side.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.I18N = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var STR = {
    de: {
      'app.title': 'Lasertag',
      'app.sub': 'Spielleiter für Capture the Flag, Domination & Counter Strike',
      'team.red': 'Rot',
      'team.blue': 'Blau',
      'cs.teamT': 'Terroristen',
      'cs.teamCT': 'Counter-Terroristen',

      'home.name': 'Dein Name',
      'home.namePh': 'z. B. Thomas',
      'home.create': 'Spiel erstellen',
      'home.join': 'Beitreten',
      'home.codePh': 'CODE',
      'home.scanJoin': 'Stattdessen Spiel-QR scannen',
      'home.printFlags': 'QR-Codes drucken',
      'home.help': 'So funktioniert es',
      'home.installHint': 'Tipp: Füge die App zum Startbildschirm hinzu, solange du noch Empfang hast. Danach läuft sie auf dem Feld auch ohne Netz.',

      'lobby.code': 'Code',
      'lobby.mode': 'Spielmodus',
      'lobby.modeCtf': 'Capture the Flag',
      'lobby.modeCtfDesc': 'Gegnerische Flagge klauen und heimbringen',
      'lobby.modeDom': 'Domination',
      'lobby.modeDomDesc': 'Punkte halten, dem Gegner Tickets abziehen',
      'lobby.modeCs': 'Counter Strike',
      'lobby.modeCsDesc': 'Bombe legen & entschärfen, eine Runde',
      'lobby.joinRed': 'Zu Rot',
      'lobby.joinBlue': 'Zu Blau',
      'lobby.shuffle': 'Teams gleichmäßig mischen',
      'lobby.settings': 'Spieleinstellungen',
      'lobby.duration': 'Maximale Spieldauer',
      'lobby.target': 'Eroberungen zum Sieg',
      'lobby.respawn': 'Empfohlene Respawn-Zeit',
      'lobby.ownHome': 'Eigene Flagge muss in der Basis sein',
      'lobby.ownHomeNote': 'klassische Regel, deutlich schwerer',
      'lobby.points': 'Anzahl Punkte',
      'lobby.tickets': 'Start-Tickets',
      'lobby.captureSec': 'Eroberungsdauer pro Stufe',
      'lobby.drain': 'Tickets pro Sekunde',
      'lobby.scaleWithLead': 'Abzug steigt mit dem Vorsprung',
      'lobby.scaleWithLeadNote': 'bei 3:1 dreifacher Abzug – ein Durchmarsch endet schneller',
      'lobby.plantSec': 'Dauer des Bombenlegens',
      'lobby.fuseSec': 'Explosions-Countdown ab dem Legen',
      'lobby.defuseSec': 'Entschärfungsdauer',
      'lobby.redName': 'Name Team Rot',
      'lobby.blueName': 'Name Team Blau',
      'lobby.redNameCs': 'Name Terroristen',
      'lobby.blueNameCs': 'Name Counter-Terroristen',
      'lobby.start': 'Spiel starten',
      'lobby.needTeams': 'Pro Team mindestens ein Spieler',
      'lobby.checklist': 'Vor dem Start',
      'lobby.check1Ctf': 'Beide Flaggen-QR-Codes ausdrucken und an den Basen platzieren.',
      'lobby.check1Dom': 'Die nummerierten Punkt-QR-Codes ausdrucken und im Gelände verteilen.',
      'lobby.check1Cs': 'Die beiden Bombenplatz-QR-Codes (1 & 2) ausdrucken und im Gelände platzieren.',
      'lobby.check2': 'Alle treten bei und wählen ein Team.',
      'lobby.check3': 'Alle öffnen die App einmal hier mit Empfang, damit sie gespeichert wird.',
      'lobby.estimate': 'Bei einem Punkt Vorsprung dauert es {min} Min., die Tickets aufzubrauchen.',

      'game.firstTo': 'erste {n} Eroberungen',
      'game.ticketsLabel': 'Tickets',
      'game.scanFlag': 'Flagge scannen',
      'game.scanPoint': 'Punkt scannen',
      'game.scanBomb': 'Bombenplatz scannen',
      'game.csCarrying': 'Du trägst die Bombe – scanne Platz 1 oder 2, um sie zu legen',
      'game.csHolding': '{name} trägt die Bombe',
      'game.csPlanting': '{name} legt die Bombe an Platz {site} …',
      'game.csPlanted': 'Bombe an Platz {site} platziert – Explosion in {clock}',
      'game.csDefusing': '{name} entschärft an Platz {site} … fertig in {clock}',
      'game.csIdleT': 'Warte auf den Bombenträger …',
      'game.hit': 'Getroffen!',
      'game.backIn': 'Wieder im Spiel',
      'game.atBase': 'In der Basis',
      'game.takenBy': 'Erobert von {name}',
      'game.flagOf': 'Flagge {team}',
      'game.point': 'Punkt {n}',
      'game.neutral': 'Neutral',
      'game.heldBy': 'Team {team}',
      'game.carrying': 'Du hast die Flagge {team} – scanne eure Flagge {own}, um zu punkten',
      'game.respawnHint': 'Geh zurück zum Spawn – empfohlen {n} s',
      'game.players': 'Spieler',
      'game.endGame': 'Spiel beenden',
      'game.confirmEnd': 'Spiel für alle beenden?',
      'game.host': 'Host',
      'game.tagHit': 'getroffen',
      'game.tagHasFlag': 'hat Flagge {team}',
      'game.noLead': 'Gleichstand – keine Tickets laufen',
      'game.draining': '{team} zieht {n}/s ab',

      'end.wins': '{team} gewinnt',
      'end.draw': 'Unentschieden',
      'end.reasonCaptures': 'Eroberungsziel erreicht',
      'end.reasonTickets': 'Tickets aufgebraucht',
      'end.reasonTime': 'Zeit abgelaufen',
      'end.reasonAborted': 'Vorzeitig beendet',
      'end.reasonDefused': 'Bombe entschärft',
      'end.reasonExploded': 'Bombe detoniert',
      'end.reasonElimination': 'Alle Terroristen ausgeschaltet',
      'end.player': 'Spieler',
      'end.caps': 'Erob.',
      'end.grabs': 'Klaus',
      'end.scans': 'Scans',
      'end.plants': 'Gelegt',
      'end.defuses': 'Entschärft',
      'end.hits': 'Treffer',
      'end.rematch': 'Revanche (gleiche Teams)',
      'end.home': 'Zurück zum Start',

      'scan.hintFlag': 'Auf einen Flaggen-QR-Code richten',
      'scan.hintPoint': 'Auf einen Punkt-QR-Code richten',
      'scan.hintBomb': 'Auf einen Bombenplatz-QR-Code richten',
      'scan.hintGame': 'Auf den Spiel-QR-Code richten',
      'scan.cancel': 'Abbrechen',
      'scan.unknown': 'Kein Lasertag-Code – weitersuchen',

      'net.offline': 'Offline – das Spiel läuft auf diesem Handy weiter',
      'net.offlineQueued': 'Offline – {n} Aktion(en) in der Warteschlange',
      'net.syncing': 'Synchronisiere {n} Aktion(en) …',

      'toast.enterName': 'Bitte zuerst deinen Namen eingeben',
      'toast.enterCode': 'Bitte den vierstelligen Code eingeben',
      'toast.pickTeam': 'Bitte zuerst ein Team wählen',
      'toast.deadCantScan': 'Du bist getroffen – zuerst „Wieder im Spiel“ tippen',
      'toast.noEffect': 'Nichts passiert – prüfe den Status',
      'toast.linkCopied': 'Link kopiert',
      'toast.cameraDenied': 'Kamerazugriff verweigert',
      'toast.cameraUnavailable': 'Kamera nicht verfügbar – benötigt HTTPS',
      'toast.gameNotFound': 'Spiel nicht erreichbar',
      'toast.offlineLocal': 'Offline – lokale Kopie wird verwendet',
      'toast.needNet': 'Zum Erstellen wird eine Verbindung gebraucht',
      'toast.isFlagNotGame': 'Das ist ein Flaggen-Code, kein Spiel-Code',
      'toast.isGameNotFlag': 'Das ist ein Spiel-Code, keine Flagge',
      'toast.nameThenJoin': 'Namen eingeben, dann auf Beitreten tippen',
      'toast.restored': 'Server war neu gestartet – Spiel von diesem Handy wiederhergestellt',

      'feed.join': '{name} ist beigetreten',
      'feed.team': '{name} → {team}',
      'feed.leave': '{name} hat verlassen',
      'feed.startCtf': 'Spiel läuft – erste {target} Eroberungen gewinnen',
      'feed.startDom': 'Spiel läuft – alle Punkte sind neutral',
      'feed.rematch': 'Revanche – zurück in die Lobby',
      'feed.died': '{name} ist getroffen',
      'feed.revived': '{name} ist wieder im Spiel',
      'feed.grab': '{name} hat die Flagge {flag}!',
      'feed.capture': 'EROBERT! {name} punktet für {team} ({red} : {blue})',
      'feed.flagreset': 'Flagge {flag} zurück in die Basis ({name} getroffen)',
      'feed.rejectOwnFlagOut': '{name} kann nicht punkten – eigene Flagge ist weg',
      'feed.rejectNothingToScore': '{name} hat keine Flagge dabei',
      'feed.rejectAlreadyOurs': 'Punkt {point} gehört euch bereits',
      'feed.capturing': '{name} erobert Punkt {point} …',
      'feed.capturingContested': '{name} greift Punkt {point} an …',
      'feed.pointTaken': 'Punkt {point} gehört jetzt {team}',
      'feed.pointNeutral': 'Punkt {point} ist neutral',
      'feed.startCs': 'Spiel läuft – Bombe wurde vergeben',
      'feed.bombAssigned': '{name} trägt jetzt die Bombe',
      'feed.planting': '{name} legt die Bombe an Platz {site} …',
      'feed.plantAborted': '{name} wurde getroffen – Legen abgebrochen',
      'feed.plantAbortedLeave': '{name} hat das Spiel verlassen – Legen abgebrochen',
      'feed.bombPlanted': 'Bombe an Platz {site} platziert!',
      'feed.defusing': '{name} entschärft an Platz {site} …',
      'feed.defuseAborted': '{name} wurde getroffen – Entschärfen abgebrochen',
      'feed.defuseAbortedLeave': '{name} hat das Spiel verlassen – Entschärfen abgebrochen',
      'feed.rejectNotCarrier': '{name} trägt die Bombe nicht',
      'feed.rejectNotPlanted': '{name} – noch nichts zu entschärfen',
      'feed.rejectWrongSite': 'Falscher Platz – die Bombe liegt an Platz {site}',
      'feed.endWin': 'Spielende – {team} gewinnt!',
      'feed.endDraw': 'Spielende – unentschieden',
      'print.back': 'Zurück zur App',
      'print.title': 'QR-Codes zum Ausdrucken',
      'print.lead': 'Einmal ausdrucken und für immer verwenden – die Codes enthalten das Team bzw. die Nummer, nicht den Ort. Dieselben Blätter funktionieren auf jedem Gelände.',
      'print.tabFlags': 'Capture the Flag',
      'print.tabPoints': 'Domination',
      'print.tabCs': 'Counter Strike',
      'print.size': 'Größe',
      'print.ecc': 'Fehlerkorrektur',
      'print.eccH': 'Höchste (übersteht Dreck & Regen)',
      'print.eccQ': 'Hoch',
      'print.eccM': 'Mittel',
      'print.button': 'Drucken',
      'print.howMany': 'Anzahl Punkte',
      'print.redFlag': 'Flagge Rot',
      'print.blueFlag': 'Flagge Blau',
      'print.redSub': 'Team Blau scannt zum Klauen · Team Rot scannt zum Punkten',
      'print.blueSub': 'Team Rot scannt zum Klauen · Team Blau scannt zum Punkten',
      'print.point': 'Punkt {n}',
      'print.pointSub': 'Scannen, um den Punkt für das eigene Team zu erobern',
      'print.bombSite': 'Bombenplatz {n}',
      'print.bombSiteSub': 'Terroristen scannen zum Legen · Counter-Terroristen scannen zum Entschärfen',
      'print.cut': 'AUSSCHNEIDEN & LAMINIEREN',
      'print.tipsTitle': 'Platzierung im Gelände',
      'print.tip1': 'Laminieren oder in eine Klarsichthülle stecken. Nasses Papier lässt sich nicht scannen.',
      'print.tip2': 'Auf Brusthöhe an Pfosten oder Baum befestigen, nach außen zeigend – nicht flach auf den Boden.',
      'print.tip3': 'Direkte flache Sonne vermeiden. Matt scannt deutlich besser als glänzend.',
      'print.tip4': 'Höchste Fehlerkorrektur heißt: der Code funktioniert noch, wenn rund ein Drittel verdeckt ist.',
      'print.tip5': 'Von jedem Blatt ein Handyfoto als Ersatz machen – man kann es notfalls vom Display scannen.',
      'print.tipDom': 'Punkte weit auseinander verteilen. Bei 3 Punkten funktioniert eine Linie quer über das Feld am besten, bei 5 ein Kreuz.',
      'print.tipCs': 'Nur zwei Bombenplätze – dieselben QR-Codes wie Domination-Punkt 1 & 2. Gut sichtbar, aber nicht direkt neben den Basen platzieren.',
    },

    en: {
      'app.title': 'Lasertag',
      'app.sub': 'Game master for Capture the Flag, Domination & Counter Strike',
      'team.red': 'Red',
      'team.blue': 'Blue',
      'cs.teamT': 'Terrorists',
      'cs.teamCT': 'Counter-Terrorists',

      'home.name': 'Your name',
      'home.namePh': 'e.g. Thomas',
      'home.create': 'Create game',
      'home.join': 'Join',
      'home.codePh': 'CODE',
      'home.scanJoin': 'Scan game QR instead',
      'home.printFlags': 'Print the QR codes',
      'home.help': 'How it works',
      'home.installHint': 'Tip: add this to your home screen while you still have signal. It then works on the field with no reception.',

      'lobby.code': 'Code',
      'lobby.mode': 'Game mode',
      'lobby.modeCtf': 'Capture the Flag',
      'lobby.modeCtfDesc': 'Steal their flag, bring it home',
      'lobby.modeDom': 'Domination',
      'lobby.modeDomDesc': 'Hold points, drain their tickets',
      'lobby.modeCs': 'Counter Strike',
      'lobby.modeCsDesc': 'Plant & defuse the bomb, one round',
      'lobby.joinRed': 'Join Red',
      'lobby.joinBlue': 'Join Blue',
      'lobby.shuffle': 'Shuffle teams evenly',
      'lobby.settings': 'Game settings',
      'lobby.duration': 'Maximum game length',
      'lobby.target': 'Captures to win',
      'lobby.respawn': 'Suggested respawn wait',
      'lobby.ownHome': 'Own flag must be at base to score',
      'lobby.ownHomeNote': 'classic rule, considerably harder',
      'lobby.points': 'Number of points',
      'lobby.tickets': 'Starting tickets',
      'lobby.captureSec': 'Capture time per step',
      'lobby.drain': 'Tickets per second',
      'lobby.scaleWithLead': 'Drain scales with the lead',
      'lobby.scaleWithLeadNote': '3-1 drains three times as fast, so a walkover ends sooner',
      'lobby.plantSec': 'Time to plant the bomb',
      'lobby.fuseSec': 'Explosion countdown from the plant',
      'lobby.defuseSec': 'Time to defuse',
      'lobby.redName': 'Red team name',
      'lobby.blueName': 'Blue team name',
      'lobby.redNameCs': 'Terrorists name',
      'lobby.blueNameCs': 'Counter-Terrorists name',
      'lobby.start': 'Start game',
      'lobby.needTeams': 'Need a player on each team',
      'lobby.checklist': 'Before you start',
      'lobby.check1Ctf': 'Print both flag QR codes and place them at the two bases.',
      'lobby.check1Dom': 'Print the numbered point QR codes and spread them over the field.',
      'lobby.check1Cs': 'Print both bomb site QR codes (1 & 2) and place them on the field.',
      'lobby.check2': 'Everyone joins and picks a team.',
      'lobby.check3': 'Everyone opens the app once here, with signal, so it caches.',
      'lobby.estimate': 'With a one-point lead the tickets last {min} min.',

      'game.firstTo': 'first to {n}',
      'game.ticketsLabel': 'Tickets',
      'game.scanFlag': 'Scan flag',
      'game.scanPoint': 'Scan point',
      'game.scanBomb': 'Scan bomb site',
      'game.csCarrying': 'You have the bomb – scan site 1 or 2 to plant it',
      'game.csHolding': '{name} has the bomb',
      'game.csPlanting': '{name} is planting at site {site} …',
      'game.csPlanted': 'Bomb planted at site {site} – exploding in {clock}',
      'game.csDefusing': '{name} is defusing at site {site} … done in {clock}',
      'game.csIdleT': 'Waiting on the bomb carrier …',
      'game.hit': "I'm hit",
      'game.backIn': "I'm back in",
      'game.atBase': 'At base',
      'game.takenBy': 'Taken by {name}',
      'game.flagOf': '{team} flag',
      'game.point': 'Point {n}',
      'game.neutral': 'Neutral',
      'game.heldBy': 'Team {team}',
      'game.carrying': 'You have the {team} flag – scan your own {own} flag to score',
      'game.respawnHint': 'Walk back to your spawn – suggested {n} s',
      'game.players': 'Players',
      'game.endGame': 'End game',
      'game.confirmEnd': 'End the game for everyone?',
      'game.host': 'host',
      'game.tagHit': 'hit',
      'game.tagHasFlag': 'has {team} flag',
      'game.noLead': 'Level – no tickets draining',
      'game.draining': '{team} draining {n}/s',

      'end.wins': '{team} wins',
      'end.draw': 'Draw',
      'end.reasonCaptures': 'Capture target reached',
      'end.reasonTickets': 'Tickets ran out',
      'end.reasonTime': 'Time ran out',
      'end.reasonAborted': 'Ended early',
      'end.reasonDefused': 'Bomb defused',
      'end.reasonExploded': 'Bomb exploded',
      'end.reasonElimination': 'All terrorists eliminated',
      'end.player': 'Player',
      'end.caps': 'Caps',
      'end.grabs': 'Grabs',
      'end.scans': 'Scans',
      'end.plants': 'Plants',
      'end.defuses': 'Defuses',
      'end.hits': 'Hits',
      'end.rematch': 'Rematch (same teams)',
      'end.home': 'Back to start',

      'scan.hintFlag': 'Point at a flag QR code',
      'scan.hintPoint': 'Point at a point QR code',
      'scan.hintBomb': 'Point at a bomb site QR code',
      'scan.hintGame': 'Point at the game QR code',
      'scan.cancel': 'Cancel',
      'scan.unknown': 'Not a Lasertag code – keep looking',

      'net.offline': 'Offline – the game continues on this phone',
      'net.offlineQueued': 'Offline – {n} action(s) queued',
      'net.syncing': 'Syncing {n} action(s) …',

      'toast.enterName': 'Enter your name first',
      'toast.enterCode': 'Enter the 4-character code',
      'toast.pickTeam': 'Pick a team first',
      'toast.deadCantScan': 'You are hit – tap “I\'m back in” first',
      'toast.noEffect': 'Nothing happened – check the status',
      'toast.linkCopied': 'Link copied',
      'toast.cameraDenied': 'Camera permission denied',
      'toast.cameraUnavailable': 'Camera unavailable – needs HTTPS',
      'toast.gameNotFound': 'Could not reach that game',
      'toast.offlineLocal': 'Offline – using the copy stored on this phone',
      'toast.needNet': 'Need a connection to create a game',
      'toast.isFlagNotGame': 'That is a flag code, not a game code',
      'toast.isGameNotFlag': 'That is a game code, not a flag',
      'toast.nameThenJoin': 'Enter your name, then tap Join',
      'toast.restored': 'Server had restarted – game restored from this phone',

      'feed.join': '{name} joined',
      'feed.team': '{name} → {team}',
      'feed.leave': '{name} left',
      'feed.startCtf': 'Game on – first to {target} captures',
      'feed.startDom': 'Game on – every point is neutral',
      'feed.rematch': 'Rematch – back in the lobby',
      'feed.died': '{name} is hit',
      'feed.revived': '{name} is back in',
      'feed.grab': '{name} took the {flag} flag!',
      'feed.capture': 'CAPTURE! {name} scored for {team} ({red} - {blue})',
      'feed.flagreset': '{flag} flag reset to base ({name} was hit)',
      'feed.rejectOwnFlagOut': '{name} cannot score – own flag is out',
      'feed.rejectNothingToScore': '{name} has no flag to bring home',
      'feed.rejectAlreadyOurs': 'Point {point} is already yours',
      'feed.capturing': '{name} is taking point {point} …',
      'feed.capturingContested': '{name} is attacking point {point} …',
      'feed.pointTaken': 'Point {point} now belongs to {team}',
      'feed.pointNeutral': 'Point {point} is neutral',
      'feed.startCs': 'Game on – the bomb has been assigned',
      'feed.bombAssigned': '{name} now has the bomb',
      'feed.planting': '{name} is planting at site {site} …',
      'feed.plantAborted': '{name} was hit – planting aborted',
      'feed.plantAbortedLeave': '{name} left the game – planting aborted',
      'feed.bombPlanted': 'Bomb planted at site {site}!',
      'feed.defusing': '{name} is defusing at site {site} …',
      'feed.defuseAborted': '{name} was hit – defusing aborted',
      'feed.defuseAbortedLeave': '{name} left the game – defusing aborted',
      'feed.rejectNotCarrier': "{name} doesn't have the bomb",
      'feed.rejectNotPlanted': '{name} – nothing to defuse yet',
      'feed.rejectWrongSite': 'Wrong site – the bomb is at site {site}',
      'feed.endWin': 'Game over – {team} wins!',
      'feed.endDraw': 'Game over – draw',
      'print.back': 'Back to the app',
      'print.title': 'QR codes to print',
      'print.lead': 'Print once and reuse forever – the codes carry the team or the number, not the location, so the same sheets work at every field you play.',
      'print.tabFlags': 'Capture the Flag',
      'print.tabPoints': 'Domination',
      'print.tabCs': 'Counter Strike',
      'print.size': 'Size',
      'print.ecc': 'Error correction',
      'print.eccH': 'Highest (survives dirt & rain)',
      'print.eccQ': 'High',
      'print.eccM': 'Medium',
      'print.button': 'Print',
      'print.howMany': 'Number of points',
      'print.redFlag': 'Red flag',
      'print.blueFlag': 'Blue flag',
      'print.redSub': 'Blue team scans this to take it · Red team scans it to score',
      'print.blueSub': 'Red team scans this to take it · Blue team scans it to score',
      'print.point': 'Point {n}',
      'print.pointSub': 'Scan to capture this point for your team',
      'print.bombSite': 'Bomb site {n}',
      'print.bombSiteSub': 'Terrorists scan to plant · Counter-Terrorists scan to defuse',
      'print.cut': 'CUT & LAMINATE',
      'print.tipsTitle': 'Placing them in the field',
      'print.tip1': 'Laminate them or use a clear sleeve. Wet paper stops scanning.',
      'print.tip2': 'Mount at chest height on a post or tree, facing outward – not flat on the ground.',
      'print.tip3': 'Avoid direct low sun. A matte surface scans far better than glossy.',
      'print.tip4': 'Highest error correction means the code still reads with roughly a third obscured.',
      'print.tip5': 'Photograph each sheet as a backup – you can scan it off a screen if a print is destroyed.',
      'print.tipDom': 'Spread the points well apart. With 3 points a line across the field works best; with 5, a cross.',
      'print.tipCs': 'Only two bomb sites – the same QR codes as Domination point 1 & 2. Keep them visible, but not right next to either base.',
    }
  };

  // German unless the player has explicitly chosen otherwise. Deliberately not
  // derived from the browser locale: the crew is German, the phones are not
  // always set to German, and guessing wrong mid-game is worse than a default.
  var lang = 'de';
  try {
    var saved = localStorage.getItem('ctf.lang');
    if (saved && STR[saved]) lang = saved;
  } catch (e) { }

  function fill(str, params) {
    return String(str).replace(/\{(\w+)\}/g, function (m, k) {
      return params && params[k] !== undefined ? params[k] : m;
    });
  }

  function t(key, params) {
    var table = STR[lang] || STR.de;
    var v = table[key];
    if (v === undefined) v = STR.de[key];
    if (v === undefined) return key;
    return fill(v, params);
  }

  function setLang(l) {
    if (!STR[l]) return;
    lang = l;
    try { localStorage.setItem('ctf.lang', l); } catch (e) { }
  }

  /* Apply to any static markup tagged with data-i18n / data-i18n-ph. */
  function applyDom(rootEl) {
    (rootEl || document).querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    (rootEl || document).querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.setAttribute('placeholder', t(el.getAttribute('data-i18n-ph')));
    });
  }

  /* Structured feed entry -> a sentence. `tname` resolves a team's custom name. */
  function feedText(entry, tname) {
    var p = entry.p || {};
    var q = {
      name: p.name,
      point: p.point,
      site: p.site,
      target: p.target,
      red: p.red,
      blue: p.blue,
      team: p.team ? tname(p.team) : (entry.team ? tname(entry.team) : ''),
      flag: p.flag ? tname(p.flag) : ''
    };
    switch (entry.kind) {
      case 'start':
        return t(p.mode === 'domination' ? 'feed.startDom'
          : p.mode === 'cs' ? 'feed.startCs' : 'feed.startCtf', q);
      case 'capturing': return t(p.contested ? 'feed.capturingContested' : 'feed.capturing', q);
      case 'end':
        return p.winner === 'draw' ? t('feed.endDraw')
          : t('feed.endWin', { team: tname(p.winner) });
      default: return t('feed.' + entry.kind, q);
    }
  }

  return {
    t: t,
    setLang: setLang,
    get lang() { return lang; },
    applyDom: applyDom,
    feedText: feedText,
    languages: ['de', 'en']
  };
});
