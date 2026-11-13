# LUMEN

> *every light casts a shadow*

Ein Arena-Roguelite, in dem du nicht schießt – **du bist das Projektil**.
Dashe durch Gegner, um sie zu zerschneiden. Jeder Kill gibt dir die Dash-Ladung zurück. Kette sie.

Kein Build, keine Abhängigkeiten, keine Assets: Grafik, Musik und Soundeffekte entstehen komplett im Code.

## Starten

**Online spielen:** <https://peppigminze.github.io/random/> (GitHub Pages, direkt aus diesem Branch).

**Variante 1:** `index.html` im Browser öffnen (Doppelklick). Fertig.

**Variante 2** (lokaler Server, ein Befehl):

```bash
python -m http.server 5173
```

Dann <http://localhost:5173> öffnen. Getestet in Chromium; Ton startet nach der ersten Eingabe.

## Steuerung

| | Tastatur / Maus | Gamepad | Touch |
|---|---|---|---|
| Bewegen | WASD / Pfeiltasten | Linker Stick / D-Pad | Linker Daumen (Stick) |
| Dash | Leertaste (Bewegungsrichtung) · Linksklick (zum Cursor) | A / RB / RT (rechter Stick zielt) | Rechts tippen · wischen = gezielt |
| Nova | E / Q / Shift · Rechtsklick | X / LB / LT | NOVA-Button |
| Pause | Esc / P | Start | II-Button |
| Menüs | Pfeile + Enter, Esc zurück, 1–3 für Karten | Stick + A / B | Tippen |

## Spielidee

- **Dash** macht dich unverwundbar und schneidet alles auf der Linie – auch Kugeln, die zu Nova-Energie werden.
- **Kills erstatten die Ladung.** Ohne Ladung bist du nur ein Funke. Der Ladestand kreist direkt um deine Figur.
- **Nova** (volle Energieleiste) räumt den Bildschirm.
- Nach jeder Welle wählst du **1 aus 3 Upgrades**. Welle 10 ist der Boss: **THE ECLIPSE**.
- **Shards** bleiben nach dem Tod erhalten und kaufen in der **Schmiede** permanente Upgrades und neue Kerne (Spielstile).

Gegner: Mote (Schwarm), Lancer (telegraphierter Ansturm), Seer (Fernkampf), Pyre (Bombe – lässt sich in Gruppen kicken),
Warden (Schild, nur von hinten), Cell (teilt sich).

## Technische Highlights

- **Prozedurale Fähigkeiten:** Upgrades werden aus `Auslöser × Effekt × Seltenheit` generiert und benannt
  ("Reaper Storm": jeder 3. Kill → Kettenblitz). Gleiche Karten stapeln sich.
- **Seed-basierte Wellen:** Bedrohungsbudget, Formationen, Mutatoren (Swarm, Haste, Umbral, Volatile …). Daily Run mit Tages-Seed.
- **Adaptives Audio (WebAudio, 0 Dateien):** 16tel-Step-Sequencer mit Kick, Hats, Snare, Bass, Arp, Pad, Lead; Layer schalten sich
  nach Gegnerzahl und Kombo zu, Tonart und Patterns kommen aus dem Run-Seed. Kill-Töne klettern mit der Kette die Pentatonik hoch.
  Generierter Hall (Convolver mit Rausch-Impulsantwort), Delay, Tiefpass bei Zeitlupe/Pause.
- **Post-Processing (WebGL):** Bloom auf zwei Ebenen, Chromatic Aberration (an Screenshake gekoppelt), Linsenverzerrung, Vignette, Grain, Glitch.
  Fällt ohne WebGL automatisch auf reines Canvas 2D zurück.
- **Juice:** Trauma-basierter Screenshake, Hit-Stop, Zeitlupe, Kamera-Lookahead und Zoom-Punch, Squash & Stretch,
  ein Bodengitter, das sich unter Schockwellen verformt. Jede Eingabe reagiert im selben Frame – auch ein Dash ohne Ladung.
- **Autopilot:** Derselbe Bot spielt den Attract-Modus hinter dem Titelbild und die automatisierten Testläufe
  (`L.step(n, dt, true)` simuliert ohne Rendering, `?bot` startet einen Bot-Run).
- **Barrierefreiheit:** Screenshake 0–150 %, Blitz-/Glitch-Effekte abschaltbar, Spieltempo 70–100 %, Hochkontrast-Gegner.

Gemessen im Testlauf (1280×720): Simulation ≈ 0,05 ms, Zeichnen ≈ 1,1 ms pro Frame.

Architektur und Design-Entscheidungen: siehe [DESIGN.md](DESIGN.md).

## Geheimnisse

<details>
<summary>Spoiler – erst selbst spielen!</summary>

1. **Die Wendung:** Der Sieg über die Eclipse ist ein falsches Ende. "…but every light casts a shadow." – danach kämpfst du
   gegen **ECHO**, deinen eigenen Schatten. Er spielt *deine* Bewegungen gespiegelt und verzögert nach; seine Dashes sind deine
   Dashes von vor einer Sekunde und hinterlassen Narben. Treffen kannst du ihn nur, wenn er gerade nicht dasht – dasht ihr
   gleichzeitig ineinander, gibt es einen CLASH. Nach jedem Treffer wechselt er die Spiegelachse. Wer ihn besiegt,
   schaltet den Kern **UMBRA** frei und steigt in Tiefe 2 ab.
2. **Versteckte Mechanik:** Einen Lancer *mitten im Ansturm* zu zerschneiden ist ein **COUNTER** – dreifache Punkte,
   alle Ladungen zurück, Zeitlupe.
3. **Easter Egg:** Die Sonnenfinsternis auf dem Titelbild fünfmal anklicken (oder `solar` tippen) → **Solar Mode**, das Spiel in invertiertem Licht.
</details>
