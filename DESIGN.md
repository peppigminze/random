# LUMEN — Design

> *Every light casts a shadow.*

## Vision
Du bist ein Lichtfunke in einer runden Arena. Du schießt nicht — **du bist das Projektil**.
Ein Dash schneidet durch alles auf seiner Linie, jeder Kill gibt die Dash-Ladung zurück.
Wer gut zielt, kettet Dash an Dash und fliegt als Lichtblitz durch den ganzen Schwarm.

Genre: Arena-Roguelite, "Dash-Slasher". Ein Run dauert 8–12 Minuten.

## Kern-Loop (30 Sekunden)
1. Gegner erscheinen mit Telegraph.
2. Positionieren → Dash durch eine Linie von Gegnern → Ladung zurück → nächster Dash.
3. Kombo steigt, Musik wird dichter, Kill-Töne klettern die Tonleiter hoch.
4. Welle leer → Zeitlupe auf dem letzten Kill → 1 aus 3 Upgrades wählen → nächste Welle.

Risiko/Belohnung: Ohne Ladung bist du wehrlos. Dash macht unverwundbar, aber wo er endet, stehst du.

## Systeme
- **Verben:** Bewegen, Dash (Ladungen), Nova (Energie aus Kills und zerschnittenen Kugeln).
- **Gegner (6):** Mote (Jäger), Lancer (telegraphierter Ansturm, konterbar), Seer (Fernkampf),
  Pyre (Bombe, Kettenreaktion), Warden (Schild, nur von hinten), Cell (teilt sich in Mites).
- **Boss: THE ECLIPSE** — 3 Phasen. Rotierender Schildring mit Lücken; man muss durch die Lücke
  in den Kern dashen. Phase 2: Laser. Phase 3: Arena schrumpft, Spiralen, Schockringe.
- **Prozedural:** Wellen aus Seed + Bedrohungsbudget + Formationen + Mutatoren.
  Fähigkeiten = `Auslöser × Effekt × Stärke` (z. B. "jeder 3. Kill → Kettenblitz"), Namen werden generiert.
- **Meta:** Shards bleiben erhalten → Schmiede (permanente Upgrades), freischaltbare Kerne (Spielstile).
- **Geheimnis:** siehe README-Spoiler.

## Feature-Budget
| Muss | Kann | Nicht |
|---|---|---|
| Dash-Gefühl, 6 Gegner, Boss, Upgrades, Meta, Audio, Post-FX, UI, Gamepad | Touch, Daily-Seed | Story-Texte, Online, Level-Editor |

## Architektur
Kein Build, keine Abhängigkeiten. Klassische `<script>`-Dateien (läuft auch per `file://`), ein Namespace `L`.

| Datei | Aufgabe |
|---|---|
| `js/util.js` | Mathe, Seed-RNG, Palette, Savegame |
| `js/audio.js` | WebAudio: Step-Sequencer, adaptive Layer, SFX |
| `js/input.js` | Tastatur, Maus, Gamepad, Touch → ein Input-State |
| `js/post.js` | WebGL-Post: Bloom (2 Ebenen), Chromatic Aberration, Vignette, Grain |
| `js/fx.js` | Partikel, Screenshake (Trauma), Ringe, Blitze, Texte |
| `js/content.js` | Gegner-Tabellen, Wellen-Generator, Upgrade-Generator |
| `js/game.js` | Simulation: Spieler, Gegner, Kugeln, Run-Ablauf |
| `js/boss.js` | Eclipse und das Finale |
| `js/render.js` | Canvas-2D-Welt + HUD |
| `js/ui.js` | DOM-Menüs, Navigation per Tastatur/Gamepad |
| `js/main.js` | Loop, Bot (Attract-Modus und Test-Autopilot) |

Pipeline pro Frame: Input → Simulation (dt × Zeitskala, Hit-Stop friert ein) → Canvas 2D → Textur → WebGL-Post.
`L.step(dt, n)` simuliert Frames ohne Rendering — damit lassen sich ganze Runs automatisiert durchspielen.
