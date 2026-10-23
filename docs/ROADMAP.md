# Riftbrand: Roadmap

> Status: v0.2 · Stand: 2026-10-23
> Geplant wird nach **Meilensteinen, nicht nach Datum**. Ein Meilenstein ist erst abgeschlossen, wenn seine **Abnahmekriterien** erfüllt sind. Das wichtigste Kriterium ist immer: *Macht es Spaß?*
> Rollen: **Claude** entwickelt, der **Product Owner** (PO) testet (OnePlus 13 plus Desktop), gibt Feedback und entscheidet über Richtung und Merges.
>
> **Neu in v0.2:** Nach der M2-Abnahme hat der PO am 2026-10-23 eine erweiterte Richtung festgelegt (siehe [Entscheidungen](#product-owner-entscheidungen-2026-10-23)):
> - Kampftiefe mit sichtbaren Status-Effekten, Zaubern, Upgrades und Duellen
> - ein lebendiger Neon-Look mit animierten Körpern und Icons
> - eine begehbare Hub-Welt mit freier Weltwahl, Wiederaufbau, Quests, Rüstungen und mehr Story
>
> Die bisherigen Meilensteine M3 (Alpha), M4 (Beta) und M5 (Release) heißen jetzt **M6, M7 und M8**.

```
M0 Fundament ─▶ M1 Prototyp ─▶ M2 Vertical Slice ─▶ M3 Kampftiefe ──────▶ M4 Lebendiger Look
   ✅              ✅              ✅                   Status sichtbar,       animierte Körper,
                                                        Zauber + Aura,         Icon-Set,
                                                        Upgrades, Duelle       Effekte

─▶ M5 Hub-Welt ─────────▶ M6 Alpha ──────────────▶ M7 Beta ────────▶ M8 Release 1.0
   begehbar, Portale,       3 weitere Welten,         Polish,            Steam,
   Wiederaufbau, Quests,    Wesen, Waffen, Zauber,    Retention,         wahres Ende
   Schmied + Rüstungen,     Content vollständig       öffentliche Beta
   Story
```

---

## So liest man diese Roadmap (auch für KI-Agenten)

**Aufbau**
- Ein Meilenstein besteht aus **Paketen** (`M3.1`, `M3.2` …). **Ein Paket ergibt einen Branch und einen PR.** Die Pakete werden in der aufgeführten Reihenfolge umgesetzt, außer „Abhängig von“ sagt etwas anderes.
- Jedes Paket hat dieselben Felder:
  - **Ziel:** was der Spieler danach erlebt, in einem Satz.
  - **Umfang:** Checkliste, die nach dem Merge abgehakt wird.
  - **Technik:** betroffene Ordner, neue Daten-Schemas, Speicherstand-Versionen und Events. Das ist ein Vorschlag; Abweichungen werden im PR begründet.
  - **Tests:** Pflicht-Tests zusätzlich zur Definition of Done in `CLAUDE.md`.
  - **Wie testen (PO):** was der PO am Handy bzw. am PC prüft.
  - **Abhängig von:** Pakete, die vorher gemergt sein müssen.
- Jeder Meilenstein endet mit einer **Abnahme-Checkliste**. Erst wenn der PO sie abhakt, beginnt der nächste Meilenstein (Regel aus `CLAUDE.md`: kein neuer Content vor der Spaß-Abnahme).

**Verbindliche Quellen**
- `CLAUDE.md`: Architektur-, Leistungs-, i18n- und Speicherregeln.
- `docs/GDD.md`: Design.
- `docs/TECH_DESIGN.md`: Technik.
- Ändert ein Paket Design oder Architektur, aktualisiert **derselbe PR** GDD bzw. TECH_DESIGN (Abschnitt „Stand nach M…“).

**Konventionen**
- **Symbole:**
  - ✅ fertig und gemergt
  - 🔜 nächstes Paket
  - ⬜ geplant
  - ❓ offene Frage an den PO (vor Beginn des Pakets klären)
- **Zahlen** sind Startwerte zum Tunen. Sie gehören in Content-Daten bzw. `src/content/tuning.ts` und werden über `registerTunables()` im Debug-Menü sichtbar.
- **Namen von Figuren, Gegnern und Zaubern** sind Arbeitsnamen. Code-Bezeichner sind Englisch, Content-IDs `snake_case` (siehe [Glossar](#glossar-deutsch--code)).
- **Balancing-Regel:**
  - Jedes Paket, das Kampfwerte ändert, nennt die Simulator-Zahlen vorher und nachher (`pnpm sim --runs 200 --fresh`).
  - Neue Mechaniken bringt das Paket dem Bot (`src/sim/bot/`) gleich mit bei, sonst sind die Simulator-Zahlen wertlos.
- **Speicherstände:** Jede Schema-Änderung erhöht die Version und bringt eine getestete Migration mit (siehe [Speicherstand-Fahrplan](#speicherstand-fahrplan)).
- **Neue Eingaben:** Sie müssen in jedem PR mit Touch, Tastatur/Maus und Gamepad bedienbar sein. Neue Touch-Buttons kommen in den Layout-Editor.

---

## Product-Owner-Entscheidungen (2026-10-23)

| Nr. | Thema | Entscheidung | Folge für die Planung |
|---|---|---|---|
| E1 | Duell-Räume | **Zusätzlich** zu den Elite-Räumen, 1–2 pro Welt, eigenes Map-Symbol, bessere Belohnung | M3.5 |
| E2 | Mini-Bosse | 2 pro Welt, je **3 Phasen** mit 3–4 Mustern pro Phase. Aschefelder: **Glut-Duellant** (pariert) und **Zwillingspaar Feuer und Asche** (stärken sich gegenseitig) | M3.5, M6.1–M6.3 |
| E3 | „Wie in Hades“ | Effekte wie Gift, Brand und Frost müssen **auf den Gegnern sichtbar** sein. | M3.1 |
| E4 | Zauber lernen | **Variante c:** dauerhaft in der Zuflucht freischalten **und** im Run aufwerten | M3.2–M3.4, M3.6, M5.5 |
| E5 | Zauber-Slots | **2 Slots:** 1 aktiver Zauber mit Abklingzeit (ca. 10–15 s), 1 Aura, die passiv um die Figur wirkt | M3.2 |
| E6 | Upgrades | Stufen mit sichtbaren Sprüngen (Doppel-, Dreifachgeschoss …) für Zauber **und** Riss-Geschoss | M3.4 |
| E7 | Rüstungen | **Später:** Rüstungen aus einzelnen Rüstungsteilen | M5.4 |
| E8 | Grafik | **Variante a:** Neon-Vektor bleibt, Figuren bekommen **Körper aus Teilen mit Animation**. Zuerst ein Prototyp (Vesper und Schlacke, vorher/nachher). | M4.1 |
| E9 | Icons | Einheitliches Icon-Set im Neon-Stil für Relikte, Segen, Zauber, Upgrades, Status und Map | M4.3 |
| E10 | Welt-Struktur | **Freie Weltwahl** in der Zuflucht per Portal. Welten werden nach und nach freigeschaltet, „ein bisschen wie Cult of the Lamb“. | M5.2, ändert GDD §3 und §6 |
| E11 | Hub-Welt | **Frei begehbar:** Vesper läuft herum und spricht Figuren an. | M5.1 |
| E12 | Quests | **Beides:** Aufträge von Hub-Figuren und Story-Quests | M5.6 |
| E13 | Story | **Beides:** mehr Story im Run und im Hub | M5.7, M6 |
| E14 | Reihenfolge | M2 ist abgenommen. Reihenfolge: Kampftiefe → Look → Hub-Welt → weitere Welten und Bosse | M3 bis M6 |

### Annahmen (vom PO am 2026-10-23 bestätigt: A1, A2 und A3)
| Nr. | Annahme | Stand | Betrifft |
|---|---|---|---|
| A1 | **Elemente:** Die 5 Wesen bleiben (Flamme, Frost, Sturm, Leere, Blut). **Gift** und **Licht** kommen als neue Zauber-Schulen dazu. „Dunkelheit“ entspricht der Leere (Nihl). Ob Gift und Licht später zusätzlich eigene Wesen mit Segen werden, bleibt offen. | ✅ bestätigt; ❓ eigene Wesen offen bis M6.4 | M3.3, M6.4 |
| A2 | **„Wie Cult of the Lamb“** heißt: eine Zuflucht, die durch Wiederaufbau sichtbar wächst, dazu eine Weltkarte mit Portalen und kurze Welt-Runs. **Kein** Anhänger-Management (Hunger, Glaube, Arbeitsaufträge). | ✅ bestätigt | M5.2, M5.3 |
| A3 | **Run-Länge:** Ein Run führt durch **eine** Welt (8–12 min) statt durch 4 Biome am Stück (20–30 min). Der Durchmarsch durch alle Welten kommt als Endgame-Modus in M7. | ✅ bestätigt (Teil von A2) | M5.2 |
| A4 | **Zauber-Taste:** Nur der aktive Zauber braucht eine Taste, die Aura wirkt von selbst. Am Handy kommt genau **ein** Button dazu. | Annahme, im PR zu M3.2 prüfen | M3.2 |
| A5 | Weitere Hades-Elemente (Rüstungsleisten bei Gegnern, Dash-Angriff) wurden nicht gewünscht und bleiben im Ideen-Pool. | Annahme | – |

### PO-Ideen, Runde 2 (2026-10-23, nach M3)
Der PO findet das aktuelle Kampfmodell gut und möchte es **erweitern, ohne den Einstieg zu verkomplizieren**. Alles Neue wird im Lauf des Spiels freigeschaltet. Als Nächstes kommt die Grafik (M4). Die Ideen sind hier festgehalten und eingeschätzt. Was mit ❓ markiert ist, entscheidet der PO, bevor das Paket startet.

| Nr. | Idee | Einschätzung | Vorschlag wann |
|---|---|---|---|
| I1 | **Blocken**, dazu **perfekter Block → Konterangriff** | Passt sehr gut zum Kampf (Gegenstück zur Parierhaltung des Glut-Duellanten, die es in der Simulation schon gibt). Mittlerer Aufwand. ❓ Steuerung am Handy: eigener Button oder „Dash halten = Block“? | **K2.1**, direkt nach M4. Die Block-Pose profitiert von den Körper-Rigs aus M4. |
| I2 | **Springen**, dazu **Sprungangriff** (Landung als Flächenschlag) | Top-down: Sprung = Höhe mit Schatten, überspringt Bodenwellen, Minen und Fallen. Mittlerer bis hoher Aufwand (neue Höhen-Achse in Sim und Darstellung, Gegner-Muster, die man überspringen kann). ❓ Steuerung am Handy (Wischen oder Button). | **K2.2**, nach dem Block |
| I3 | **Kombo-Folgen**: perfekter Block → Konter, Sprung → Sprungangriff, Dash → Dash-Schlag | Günstig, sobald I1 und I2 stehen: Folge-Aktionen als Daten („nach Aktion X innerhalb von N Ticks wird Taste Y zu Z“). | **K2.3** |
| I4 | **Mehr Zauber** | Bereits geplant (M6.4: ca. 20 Zauber in allen Schulen). | M6.4 |
| I5 | **Bodenziel wie in WoW**: Zauber wählen, dann die Stelle anklicken, wo der Schaden passiert | Am Handy gibt es das schon (Ziehen vom Zauber-Button mit Vorschau). Für Maus fehlt nur „Zauber landet am Mauszeiger, begrenzt auf die Reichweite“. Kleiner Aufwand. | **K2.4**, auch vorziehbar |
| I6 | **Frei belegbare Zauberleiste** wie in WoW | Widerspricht E5 (2 Slots) nicht, wenn sie **wächst**: Start 1 aktiver Zauber + 1 Aura, weitere aktive Slots (bis ca. 4) schaltet man frei. Am Handy z. B. 2 Buttons plus Halten für ein Rad-Menü. Mittlerer Aufwand, Balancing-Risiko (Magie-Anteil, siehe M3.7). ❓ Wie viele Slots maximal? | **K2.5** |
| I7 | **Taktische Kämpfe mit weniger Bewegung** | Als **eigener Raumtyp bzw. eigene Begegnung**, nicht als Ersatz: Gegner wirken lange, angekündigte Zauber, die man unterbrechen, blocken oder umgehen muss, Stellung halten, Abklingzeiten planen. Setzt Block (I1) und Zauberleiste (I6) voraus. Mittlerer Aufwand, vor allem Content. | **K2.6** (erster Raumtyp), mehr in M6 |
| I8 | **Zufällige Sammel-Drops** (Materialien) zum Aufwerten | Passt direkt zu M5.4: Toll braucht Materialien, eine Quelle war noch offen. Gegner bzw. Räume lassen weltspezifische Materialien fallen. Kleiner bis mittlerer Aufwand. | **M5.4** (mit Schmied und Rüstungen) |
| I9 | **Mehrere Fähigkeitsbäume parallel**, die man sich erarbeitet (z. B. Bollwerk/Tank, Licht/Heilung, Klinge/Schaden, Runen/Zauber) | Lohnt sich schon im Einzelspieler: Der Glutbaum wird zu mehreren Pfaden, die man nacheinander freischaltet. Jeder kann alles; die Skillung entscheidet die Rolle. Mittlerer Aufwand (Meta-Daten, Oberfläche, Balancing). | **K2.7** bzw. mit M5 (Zuflucht) |
| I10 | **Mehrspieler** mit Tank, Heiler und Schadensverursacher | Größter Brocken. Die deterministische Simulation ist eine gute Grundlage (Lockstep bzw. Rollback). Schwierig: Online-Spiel im Browser braucht einen kleinen Vermittlungs-Server (WebRTC-Signalisierung); bisher ist alles statisch (GitHub Pages). Empfehlung in Stufen: **(1) jetzt schon** die Simulation mehrspielerfähig halten (mehrere Spielfiguren statt einer festen `playerEid`), das ist später teuer nachzurüsten; **(2) lokaler Koop** (2 Gamepads an einem PC, kein Server); **(3) Online-Koop** für 2–4 Spieler. ❓ Wie wichtig ist Mehrspieler (vor oder nach Version 1.0)? | (1) technische Vorbereitung in K2, (2) und (3) eigener Meilenstein, voraussichtlich nach M6 |

**Leitlinie „nicht zu kompliziert am Anfang“:** Der erste Run hat nur Angriff, Dash, Riss-Geschoss und einen Zauber. Block, Sprung, weitere Zauber-Slots und Fähigkeitsbäume werden über die ersten Stunden freigeschaltet (Freischaltungs-Fahrplan GDD §8.3), jeweils mit einer kurzen Einführung.

**Vorschlag Kampf II (K2), nach M4:**
- K2.1 Block und perfekter Block
- K2.2 Sprung und Sprungangriff
- K2.3 Kombo-Folgen
- K2.4 Bodenziel am Mauszeiger
- K2.5 Wachsende Zauberleiste
- K2.6 Taktischer Raumtyp
- K2.7 Fähigkeitsbäume
- Technisch: Simulation für mehrere Spielfiguren vorbereiten

Ob K2 vor oder nach der Hub-Welt (M5) kommt, entscheidet der PO (❓). Die Nummerierung der Meilensteine wird angepasst, sobald das feststeht.

---

## Glossar (Deutsch → Code)

| Begriff | Code-Name | Bedeutung |
|---|---|---|
| Zauber | `spell` | Fähigkeit in einem Zauber-Slot, mit Daten in `src/content/spells/` |
| aktiver Zauber | `kind: 'active'` | Wird per Taste ausgelöst und hat eine Abklingzeit (`cooldownSec`). |
| Aura | `kind: 'aura'` | Wirkt dauerhaft um die Figur, in Pulsen (`pulseSec`, `radiusPx`). |
| Zauber-Schule | `school` | `flame`, `frost`, `storm`, `void`, `blood`, `poison`, `light` |
| Stufe | `level` | 1–5 pro Fähigkeit (Zauber und Riss-Geschoss), steigt im Run |
| Upgrade-Zweig | `branch` | Wahl auf Stufe 3 und 5, z. B. „Mehrfach“ (Doppel- bzw. Dreifachgeschoss) oder „Durchschlag“ |
| Runenfragment | reward `upgrade` | Belohnung: erhöht die Stufe einer Fähigkeit |
| Glutsplitter | reward `boon_level` | Belohnung: erhöht die Stufe eines Segens (GDD §7.1) |
| Status-Effekt | `status` | `burn`, `chill` (bei 5 Stapeln gefroren), `poison`, `blind`, `mark`, `shock`, `bleed` |
| Duell-Raum | node type `duel` | Raum mit 1–2 Mini-Bossen statt Wellen |
| Mini-Boss | enemy role `champion` | Gegner mit 3 Phasen, eigener Lebensleiste und Namen |
| Welt | `world` (heute `biome`) | spielbares Gebiet mit eigener Map, eigenen Gegnern, Mini-Bossen, Boss und Materialien |
| Welt-Run | world run | ein Run durch genau eine Welt |
| Zuflucht | `hub` | die begehbare Hub-Welt |
| Portalhalle | `portal` | Zugang zu den Welten in der Zuflucht |
| Material | `material` | weltspezifischer Rohstoff für Bauen, Schmieden und Quests; bleibt auch beim Tod erhalten |
| Gebäude | `building` | Bauplatz in der Zuflucht mit Stufen (Ruine → aufgebaut → ausgebaut) |
| Rüstungsteil | `armor` | Slot `head`, `chest`, `hands` oder `feet`; Teile bilden Sets |
| Quest | `quest` | `kind: 'errand'` (Auftrag) oder `kind: 'story'` (Story-Quest) |
| Rig | `rig` | Körper aus gebackenen Teilen mit prozeduraler Animation (reine Darstellung) |

---

## M0: Fundament
**Ziel:** Die technische Basis steht, ein leerer Raum mit einem steuerbaren Platzhalter läuft auf GitHub Pages und auf dem Handy.

- [x] Projekt-Setup: pnpm, Vite, TypeScript (strict), Biome, Vitest, Ordnerstruktur nach TECH_DESIGN
- [x] CI-Workflow (Lint, Typecheck, Test, Build) und Deploy-Workflow (`main` → Pages, Branch → `dev/<branch>`)
- [x] PWA-Grundgerüst (Manifest, Icons als Platzhalter, Service Worker nur auf `main`)
- [x] Game Loop: fester 60-Hz-Takt, Interpolation, Pause bei Fokusverlust
- [x] Seed-RNG mit Unterströmen und Tests
- [x] ECS-Benchmark: bitECS gegen eigenes minimales ECS (500 Entities, Bewegung und Kollision), Entscheidung als ADR ([0001](./adr/0001-eigenes-ecs.md))
- [x] Eingabe: Action-Mapping für Tastatur/Maus, Gamepad und Touch (Floating Joystick, Buttons), Geräteerkennung
- [x] PixiJS-Setup: Ebenen, Kamera, Skalierung für Hoch- und Querformat, Auflösungsobergrenze
- [x] Debug-Menü (Grundgerüst): FPS bzw. Frame-Zeit, Tuning-Regler, Hitbox-Anzeige, Zeitlupe
- [x] Architekturtest: `sim/` importiert nichts Verbotenes
- [x] Determinismustest: gleicher Seed und gleiche Eingaben ergeben denselben Zustands-Hash

**Abnahme:** Ein Kreis lässt sich auf dem OnePlus 13 per Touch und am PC per Tastatur und Gamepad flüssig mit 120 Hz Darstellung bewegen. Die CI ist grün, die Testversion läuft unter `/riftbrand/dev/...`.

**Abnahme-Checkliste (Product Owner):** ✅ bestanden (Handy-Test, 2026-10-22: „fühlt sich perfekt an“)
- [x] OnePlus 13: Joystick reagiert sofort, Figur bewegt sich flüssig (FPS-Overlay im Debug-Menü zeigt ~120)
- [x] Hoch- und Querformat: Steuerung erreichbar, Drehen im laufenden Spiel funktioniert
- [x] PC: WASD/Pfeiltasten, Maus-Zielen (die Spitze zeigt zum Cursor), Gamepad-Sticks
- [x] App-Wechsel bzw. Tab-Wechsel pausiert automatisch
- [x] Stresstest: „+500 drifters“ im Debug-Menü bleibt flüssig
- [x] Testversion unter `/riftbrand/dev/<branch>/` und Hauptversion nach dem Merge erreichbar

---

## M1: Prototyp „Kämpfen macht Spaß“ ⭐
**Ziel:** Ein Raum, eine Waffe, drei Gegnertypen. 10 Minuten Kämpfen sollen sich gut anfühlen. **Ohne dieses Ergebnis kommt kein weiterer Content dazu.**

**Umfang:**
- [x] Spielfigur (Vektorform), Bewegung, **Dash mit i-Frames**, **perfekter Dash** (Zeitlupe, garantierter kritischer Treffer)
- [x] **Ausdauer** (3 Segmente), HUD-Grundgerüst (Leben, Ausdauer)
- [x] **Brandklinge:** Combo mit 3 Schlägen und Glutwirbel (Spezialangriff), Animation Cancel per Dash, Input-Puffer
- [x] Zielhilfe (Kegel), freies Zielen mit Maus bzw. Stick, Ziehen zum Zielen auf Touch
- [x] **3 Gegner:** Schlacke, Funkenspucker, Splitterkoloss, mit Telegraphs und Angriffs-Tokens
- [x] Schadens-Pipeline (Grundlage), Rückstoß, Poise, Treffer-Unverwundbarkeit, kein Kontaktschaden
- [x] **Game-Feel-Paket vollständig** (GDD 4.7): Hitstop, Trauma-Shake, Blitze, Squash und Stretch, Treffer- und Kill-Partikel, Zeitlupe beim letzten Gegner, Haptik
- [x] Prozeduraler Grafik-Generator, Bloom (Hoch) und vorgerenderter Glow (Niedrig)
- [x] **Soundeffekte** über den Synthesizer: Schlag, Treffer, Kill, Dash, perfekter Dash, Telegraph, Spieler getroffen
- [x] 1 Arena-Raum mit Wellen-Spawner (endloser Modus mit steigender Intensität) und Tod bzw. Neustart
- [x] Einstellungen (Grundgerüst): Lautstärke, Shake, Vibration
- [x] Debug-Menü: alle Game-Feel-Werte live tunebar und als Code exportierbar, Gegner spawnen, Unverwundbarkeit
- [x] **Test im Hochformat** mit eigener Kamera- und Steuerungsanordnung (Layout umgesetzt, Entscheidung in der Playtest-Checkliste)

_Hinweis: Wurf- und Ultimate-Button sind sichtbar, aber erst ab M2 belegt._

**Playtest-Checkliste (Abnahme durch den Product Owner):** ✅ bestanden (2026-10-22: „Spielt sich gut“)
- [x] Jeder Treffer fühlt sich „knackig“ an, man spürt ihn.
- [x] Der Dash fühlt sich sicher und reaktionsschnell an, ein perfekter Dash ist befriedigend.
- [x] Jeder Treffer, den ich einstecke, war lesbar. Ich weiß, was ich hätte tun sollen.
- [x] Die drei Gegner verlangen unterschiedliches Verhalten.
- [x] Touch-Steuerung auf dem OnePlus 13: Ich verfehle selten Buttons, die Zielhilfe hilft und stört nicht.
- [x] Ich will nach dem Tod sofort nochmal spielen.
- [x] Stabile Darstellung, auch mit 4-facher CPU-Drosselung in den Chrome DevTools ≥ 55 FPS bei 40 Gegnern.
- [x] Entscheidung: Hochformat behalten oder nur Querformat? → **beide bleiben**

---

## M2: Vertical Slice
**Ziel:** Ein vollständiger Run durch **ein Biom**, inklusive Hub, Meta-Schleife und Speichern. Die Qualität entspricht dem Endprodukt.

- [x] **Map-Generierung** (Slay-the-Spire-Stil) für die Aschefelder, Map-Ansicht, Pfadwahl
- [x] Raumtypen: Kampf, Elite, Altar, Horde, Shop, Rast, Ereignis (2–3 Ereignisse), Boss
- [x] 6 Gegnertypen und 3 Elite-Modifikatoren, Raumvorlagen (ca. 8)
- [x] **Boss: Der Glutwächter** (2 Phasen plus Zorn unter 30 %)
- [x] **Effekt-System** (deklarativ) mit Triggern und Aktionen, plus Tests
- [x] **2 Wesen** (Ignara, Vaelis) mit je ca. 8 Segen, 1 Duo-Segen _(je 9 Segen inkl. Wurf-Segen, Duo „Dampfbruch“)_
- [x] **12 Relikte** (darunter 2 Fluch-Relikte), Stapeln, Tags
- [x] **1 Evolution** (Phönixklinge), Riss-Geschoss (Wurf), Brandausbruch (Ultimate)
- [x] Meta: Glut und Rissstaub, Glutbaum (ca. 8 Knoten), Zuflucht als einfacher Hub mit 2 Figuren und Dialogsystem (ca. 30 Zeilen)
- [x] **Speichern:** Profil, Einstellungen, Run-Zwischenstand, Migrationen, Export/Import
- [x] **i18n** EN/DE, Menü-Oberfläche (Preact): Titel, Hub, Belohnungs-Auswahl, Pause mit Build-Übersicht, Ergebnis bzw. Tod mit Fortschrittsbalken
- [x] Musik: 2 Tracks mit Schichten (Erkundung bzw. Kampf, Boss) _(prozedural, ADR 0004)_
- [x] Headless-Simulator v1 mit Bot und Balancing-Bericht
- [x] Lokales Run-Log mit Export
- [x] Touch-Layout-Editor
- [ ] Erster Upload auf itch.io als „Early Prototype“ (unveröffentlicht oder öffentlich, nach deiner Entscheidung) _(Pipeline steht; es fehlen das itch.io-Projekt und der API-Key)_

**Pakete (je ein PR):**
1. ✅ **M2.1 Run-Gerüst:** Map-Generierung und Map-Ansicht, Raumvorlagen mit Hindernissen, Raumtypen Kampf/Elite/Horde/Rast/Boss (Platzhalter-Boss), Ausgang nach dem Raum-Clear, Titelbildschirm, Run-Zwischenstand speichern und fortsetzen, Sieg-Bildschirm, Debug-Button im Pause-Menü
2. ✅ **M2.2 Effekt-System und Segen:** deklarative Effekte, Ignara und Vaelis (je ~8 Segen), Altar-Raum, Belohnungs-Auswahl
3. ✅ **M2.3 Relikte, Shop, Ereignisse:** 12 Relikte (2 Fluch), Scherben, Shop, 2–3 Ereignisse, Build-Übersicht im Pause-Menü
4. ✅ **M2.4 Neue Aktionen:** Riss-Geschoss, Brandausbruch, Duo-Segen, Evolution Phönixklinge
5. ✅ **M2.5 Gegner und Boss:** 3 weitere Gegner, 3 Elite-Modifikatoren, Boss „Der Glutwächter“ (2 Phasen)
6. ✅ **M2.6 Meta:** Zuflucht (Hub), Glut und Rissstaub, Glutbaum, Dialoge, Profil-Speicherstand, Export/Import
7. ✅ **M2.7 Abrundung:** Musik, Headless-Simulator v1, Run-Log, Touch-Layout-Editor, itch.io
8. ✅ **M2.8 Balancing:** Simulator-Befunde behoben: Boss-Leben, Status-Resistenz für Bosse, größere Kampfräume, längere Horden, Funkenspucker entschärft, Mehrfachtreffer-Bug behoben

**Abnahme:** Ein Run durch Biom 1 dauert 6–8 Minuten und macht Spaß. Ein Tod motiviert zum nächsten Run. Mindestens 3 externe Tester spielen 3 oder mehr Runs freiwillig. Der Simulator zeigt keine offensichtlichen Ausreißer.


**Status:** ✅ vom PO abgenommen (2026-10-23). Nach M7 verschoben: der Test mit 3 externen Testern und der erste itch.io-Upload.

---

## M3: Kampftiefe ⚔
**Ziel:** Kämpfe werden abwechslungsreicher und tiefer. Dazu gehören:
- sichtbare Status-Effekte
- ein Zauber-System mit aktivem Zauber und Aura
- aufwertbare Fähigkeiten (Doppel- und Dreifachgeschoss)
- Duell-Räume mit Mini-Bossen

Alles wird zunächst in den **Aschefeldern** gebaut und erprobt.

**Warum zuerst:** Kampf ist der Kern des Spiels (Design-Säulen 1 und 3). Die späteren Meilensteine bauen darauf auf: Icons für Zauber (M4), Rig-Animationen für Mini-Bosse (M4), der Zauberlehrer in der Zuflucht (M5).

### M3.1 Sichtbare Status-Effekte ✅
**Ziel:** Man sieht jedem Gegner sofort an, welche Effekte auf ihm liegen und wie stark sie sind.

**Umfang:**
- [x] **Status-Framework:** Status werden zu Daten statt fest kodierter Fälle, in `src/content/statuses.ts` mit `defineStatus()` und Zod-Schema. Felder:
  - `id`, Farbe, Icon-Glyphe
  - `maxStacks`, Dauer bzw. Verfall, Tick-Intervall
  - Wirkung: Schaden pro Stapel, Tempo-Faktor, Schadens-Verstärkung, Schwelle (z. B. 5 Kälte → gefroren)
  - Die Status-Resistenz (`statusResist`) gilt weiter.
- [x] **Bestehende Status überführen:** Brand (`burn`) und Kälte bzw. Gefroren (`chill`). Das Verhalten bleibt gleich, der Determinismus-Hash für bestehende Seeds bleibt stabil.
- [x] **Neue Status** (vorerst nur über das Debug-Menü auslösbar, Quellen kommen in M3.3):
  - **Gift** (`poison`): stapelt bis 10, macht langsam Schaden und verfällt nicht stapelweise. Ohne neuen Stapel endet es nach 6 s komplett.
  - **Blenden** (`blind`): Die Vorbereitung der Gegner-Angriffe dauert 30 % länger, Gegner-Geschosse streuen stärker. Dauer 3 s.
- [x] **Darstellung am Gegner:**
  - Brand: Glutpartikel und ein orangener Rand, der mit den Stapeln heller wird
  - Kälte: Eiskruste, die mit den Stapeln wächst; gefroren: Eisblock
  - Gift: grüne Blasen und Tropfen, grünlicher Farbton
  - Blenden: weißer Lichtkranz um den Kopf
- [x] **Status-Symbole über dem Gegner** mit Stapelzahl: höchstens 3 sichtbar, das wichtigste zuerst. Auch die Boss-Leiste zeigt die Status des Bosses.
- [x] **Feedback:** Events `Ev.StatusApplied` und `Ev.StatusExpired` in `src/sim/events.ts`, umgesetzt in `src/app/feedback.ts`:
  - kurzer Farbblitz beim ersten Stapel
  - eigene Sounds für „gefroren“ und „Gift voll (10)“
- [x] **Einstellung** „Status-Symbole über Gegnern“ (an/aus), Standard: an

**Technik:**
- `src/sim/effects/status.ts` arbeitet datengetrieben.
- SoA-Felder pro Status (Stapel, Restticks, Tick-Timer) in `src/sim/ecs/components.ts` mit fester Kapazität. Keine Allokationen pro Tick.
- **View:** `src/view/vfx/status-overlay.ts` mit einem vorab allozierten Sprite-Pool pro Gegner-Slot. Die Symbole werden gebacken; bis M4.3 sind es einfache Platzhalter-Glyphen im Neon-Stil.
- Kein Speicherstand betroffen (Status existiert nur im Raum).

**Tests:**
- Stapel-, Verfalls- und Tick-Formeln pro Status
- Resistenz
- „gleicher Seed, gleicher Hash“
- Content-Test für das Status-Schema

**Wie testen (PO):**
- Debug-Menü → „Apply status: burn / chill / poison / blind“ auf alle Gegner.
- Ein Run mit Ignara- bzw. Vaelis-Segen: Erkennt man Brand und Frost sofort?
- Mit 40 Gegnern prüfen, ob alles flüssig bleibt.

**Abhängig von:** –

**Umgesetzt (Abweichungen vom Plan):**
- Blenden lässt Gegner-Salven um 25° abwechselnd nach links bzw. rechts verziehen (statt einer zufälligen Streuung, damit es deterministisch und lesbar bleibt).
- Die Einstellung „Status-Symbole über Gegnern“ erhöht die Settings-Version auf **v3**; der Zauber-Button in M3.2 bekommt deshalb v4.
- Die Symbol-Reihenfolge über den Gegnern ist Kälte → Brand → Gift → Blenden (Blenden zeigt zusätzlich der Lichtkranz).

### M3.2 Zauber-System (Kern) ✅
**Ziel:** Vesper hat zwei Zauber-Slots: einen aktiven Zauber mit Abklingzeit und eine Aura.

**Umfang:**
- [x] **Content-Typ Zauber** in `src/content/spells/*.ts` mit `defineSpell()` und Zod-Schema. Felder:
  - `id`, `school`, `kind: 'active' | 'aura'`
  - `cooldownSec` (aktiv, 8–20 s) bzw. `pulseSec` und `radiusPx` (Aura)
  - `targeting: 'self' | 'aim' | 'nearest'`
  - `effects`: läuft über das bestehende deklarative Effekt-System (Fläche, Geschoss, Status, Heilung …)
  - `levels`: Platzhalter, ausgebaut in M3.4
  - Farbe und Icon
  - i18n-Schlüssel `spell.<id>.name` und `spell.<id>.desc`
- [x] **Simulation:**
  - Zauber-Zustand im Spieler: ausgerüstete IDs, Stufe, Abklingzeit in Ticks.
  - Neues System `src/sim/systems/spells.ts` (nach den Abilities, vor den Projectiles).
  - Die Aura pulst um die Figur.
  - Neuer Stat `cooldownReduction` für spätere Segen und Relikte.
- [x] **Eingabe:** neue Aktion `Button.Spell`.
  - Tastatur: **F** (Interagieren bleibt **E**)
  - Gamepad: **RB/R1**
  - Touch: neuer Button im Bogen um den Angriffs-Button, mit Abklingzeit-Ring wie beim Ultimate
  - Zielen wie beim Riss-Geschoss: Ziehen zielt mit Vorschau, Tippen nutzt die Zielhilfe.
  - Die Aura braucht keine Taste (A4).
- [x] **Touch-Layout-Editor** kennt den neuen Button, mit Standardposition für Hoch- und Querformat.
- [x] **HUD:** zwei Zauber-Symbole. Der aktive Zauber zeigt die Abklingzeit, die Aura zeigt ihren Puls.
- [x] **Events:** `Ev.SpellCast`, `Ev.AuraPulse`, `Ev.SpellReady` (kurzer Ton, wenn der Zauber wieder bereit ist).
- [x] **Debug-Menü:** Zauber ausrüsten, Stufe setzen, Abklingzeit 0.
- [x] **2 Beweis-Zauber:**
  - **Frostnova** (aktiv): Ring um die Figur, viel Kälte
  - **Glutmantel** (Aura): alle 1 s Brand an Gegnern im Umkreis von 90 px
- [x] **Bot und Simulator:**
  - Der Bot wirkt den aktiven Zauber bei Gruppen ab 3 Gegnern und gegen Bosse.
  - `damageBySource` wird um Spieler-Quellen erweitert (Waffe, Spezial, Wurf, Zauber, Aura, Status).

**Technik:**
- **Settings v4:** `touchLayout` bekommt den Button `spell` (Migration v3 → v4, Standardposition einsetzen).
- **Run-Save v6:** ausgerüstete Zauber und Abklingzeiten (Migration v5 → v6: Start-Zauber eintragen).
- Sonderverhalten nur als benannter Handler in `src/sim/effects/handlers/` (Architekturregel 4).

**Tests:**
- Abklingzeit in Ticks: Zeitlupe ändert nur die Anzahl der Ticks.
- Aura-Puls-Takt
- Input-Puffer für den Zauber
- Migrationen
- Determinismus

**Wie testen (PO):**
- Frostnova mitten in eine Gruppe, Glutmantel in der Horde.
- Ist der neue Button in Hoch- und Querformat gut erreichbar, ohne andere zu stören?
- Am PC mit **F** und am Gamepad mit **RB** prüfen.

**Abhängig von:** M3.1

**Umgesetzt (Abweichungen vom Plan):**
- Der Touch-Button sitzt auf dem äußeren Bogen über dem Wurf-Button und zielt wie dieser (Ziehen zielt, Loslassen wirkt).
- Der Arena-Modus (Debug) und jeder neue Run starten mit Frostnova und Glutmantel; Tests ohne Raum-Setup haben keine Zauber.
- Simulator (200 Runs, `--fresh`): balanced 82,5 % → 95,5 % Siege, Run 190 → 181 s, Boss Ø 54 → 44 s; aggressive 15,5 % → 27,5 %. Direkter Zauber-Schaden ist nur ~3 %, der Effekt kommt vor allem vom Einfrieren und vom Brand der Aura. Ausgeglichen wird in M3.7, sobald alle Zauber da sind.

### M3.3 Erste Zauber-Schulen: 8 Zauber ✅
**Ziel:** Eine echte Auswahl aus 4 aktiven Zaubern und 4 Auren, verteilt auf vier Schulen.

| Schule | Aktiver Zauber (Abklingzeit) | Aura |
|---|---|---|
| Flamme (Ignara) | **Meteor** (14 s): schlägt nach 0,5 s Telegraph am Zielpunkt ein, großer Radius, Brand | **Glutmantel**: alle 1 s Brand an Gegnern im Umkreis von 90 px |
| Frost (Vaelis) | **Frostnova** (15 s): Ring um die Figur, friert Gegner in der Nähe ein | **Frosthauch**: Gegner im Umkreis sind langsamer, alle 1,5 s Kälte |
| Gift (neu) | **Giftwolke** (12 s): Wolke am Zielpunkt für 5 s, stapelt Gift | **Pestatem**: Gift-Stapel an Gegnern in der Nähe; Gegner, die vergiftet sterben, platzen zu einer kleinen Giftwolke |
| Licht (neu) | **Lichtlanze** (10 s): durchdringender Strahl in Zielrichtung, blendet | **Heiligenschein**: alle 2 s ein Lichtpuls, der das nächste feindliche Geschoss in der Nähe auflöst |

**Umfang:**
- [x] 8 Zauber als Content (EN/DE, Tunables im Debug-Menü).
- [x] Gift und Blenden werden jetzt im Spiel ausgelöst (vorher nur über das Debug-Menü).
- [x] **Zwischenlösung bis M3.6:**
  - Der Run beginnt mit Frostnova und Glutmantel.
  - Weitere Zauber gibt es im Run als Belohnung (neuer Belohnungstyp `spell`, mit Map-Symbol) und im Shop bei Nix.
  - Ein neuer Zauber ersetzt den im selben Slot. Die Stufe wird übernommen, damit kein Upgrade verloren geht.
- [x] Die Belohnungs-Auswahl zeigt Schule, Art (aktiv bzw. Aura), Abklingzeit und Wirkung.
- [x] **Synergien mit bestehenden Segen:**
  - Brand und Kälte aus Zaubern zählen für alle Segen und für „Dampfbruch“.
  - 2 neue Segen:
    - Ignara „Glutkreis“: Aura-Radius +
    - Vaelis „Kalte Konzentration“: Abklingzeit −

**Technik:**
- Für den Heiligenschein (Geschoss auflösen) gibt es einen Handler `dissolve_projectile`.
- Die Giftwolke ist ein Gefahrenbereich des Spielers. Dafür das bestehende Hazard-Konzept mit `Team.Player` wiederverwenden.

**Tests:**
- Content-Test (Schemas, i18n, Querverweise)
- ein Unit-Test pro Zauber (Treffer, Status, Radius)
- Simulator vorher/nachher

**Wie testen (PO):**
- Debug-Menü → „Grant spell“, jede Aura einmal in der Horde.
- Zielen mit Meteor und Lichtlanze am Handy

**Abhängig von:** M3.2

**Umgesetzt (Abweichungen vom Plan):**
- Neue Effekt-Arten im Zauber-Schema: `burst` mit `delaySec` (Meteor), `zone` (Giftwolke), `beam` (Lichtlanze), `ward` (Heiligenschein) und `onKill` (Pestatem). Spieler-Zonen sind eigene Entities (`C.Zone`), keine Gefahren-Hazards, damit der Bot sie nicht meidet.
- Kampfraum-Belohnungen: 50 % Segen, 12 % Zauber, 23 % Relikt, 15 % Scherben (vorher 60/0/25/15).
- Simulator (200 Runs, `--fresh`): balanced 92,0 % Siege (M3.2: 95,5 %), aggressive 21,5 % (27,5 %); Zauber-Schaden direkt ~3 %. Der Bericht listet jetzt die Zauber am Run-Ende mit Siegquote.

### M3.4 Upgrade-Stufen (Doppel-, Dreifachgeschoss …) ✅
**Ziel:** Zauber und Riss-Geschoss wachsen im Run mit, mit spürbaren Sprüngen.

**Umfang:**
- [x] **Stufen 1–5** für jeden Zauber und für das Riss-Geschoss:
  - Stufe 2 und 4: bessere Werte (Schaden, Radius, Abklingzeit).
  - Stufe 3 und 5: **Wahl zwischen 2 Zweigen** mit sichtbarem Effekt.
- [x] **Zweige des Riss-Geschosses:**
  - **Mehrfach:** Stufe 3 Doppelgeschoss, Stufe 5 Dreifachgeschoss im Fächer
  - **Durchschlag:** Stufe 3 durchdringt 2 Gegner, Stufe 5 prallt zusätzlich einmal ab
- [x] **Zweige der Zauber** (in den Daten), zum Beispiel:
  - Meteor: „Meteorschauer“ (3 kleine Einschläge) oder „Riesenmeteor“ (größer, wirft Gegner um)
  - Lichtlanze: „Doppellanze“ oder „Prisma“ (spaltet sich beim Treffer in 3 Strahlen)
  - Auren: größerer Radius oder schnellerer Puls
- [x] **Belohnung Runenfragment** (`upgrade`): Wahl aus 3 Upgrade-Angeboten für die eigenen Fähigkeiten. Quellen:
  - Kampfraum-Belohnung (vorab sichtbar auf der Map)
  - Horde-Räume
  - Shop
  - Duell-Räume (garantiert)
- [x] **Glutsplitter** (`boon_level`) erhöht die Stufe eines Segens (GDD §7.1, bisher nicht umgesetzt). Er nutzt denselben Auswahl-Dialog.
- [x] Die Build-Übersicht im Pause-Menü zeigt Stufen und gewählte Zweige.
- [x] Der Bot wählt Upgrades (einfache Heuristik: zuerst der aktive Zauber).

**Technik:**
- Daten-Schema: `levels: [{ stats }]` und `branches: { [level]: [optionA, optionB] }` mit Effekt-Überschreibungen.
- **Run-Save v7:** Stufe und Zweig pro Fähigkeit, Segen-Stufen (Migration v6 → v7).

**Tests:**
- Stufen-Formeln, Zweig-Auswahl, Dreifachgeschoss-Fächer (Winkel, Anzahl)
- Migration
- Simulator vorher/nachher

**Wie testen (PO):** Debug-Menü → „Set level“ bzw. „Pick branch“. Fühlt sich der Sprung vom Einzel- zum Dreifachgeschoss nach Belohnung an?

**Abhängig von:** M3.3

**Umgesetzt (Abweichungen vom Plan):**
- Zweige des Riss-Geschosses: **Mehrfach** (Doppel-, dann Dreifachgeschoss) oder **Durchschlag** (durchdringt alle Gegner, +25 % Schaden, dann Schweres Geschoss mit +50 % Schaden). Abprallen entfällt.
- Jede Stufe (nicht nur 2 und 4) gibt die Zahlen-Boni; die Zweige kommen auf Stufe 3 und 5 dazu.
- Kein Upgrade im Shop; Quellen sind Kampfräume (15 %), Horde-Räume (immer) und ab M3.5 Duelle.
- Segen-Stufen (Glutsplitter) bis Stufe 3, Duo-Segen wachsen nicht.
- Run-Save **v7** (Zweige, Riss-Geschoss-Stufe, Segen-Stufe).
- Simulator (200 Runs, `--fresh`): balanced 95,0 % (M3.3: 92,0 %), aggressive 19,5 % (21,5 %).

### M3.5 Duell-Räume und Mini-Bosse ✅
**Ziel:** Neben den Wellen-Kämpfen gibt es Einzelkämpfe gegen 1–2 starke Gegner mit eigenen Mechaniken und Phasen (E1, E2).

**Umfang:**
- [x] **Neuer Raumtyp `duel`:**
  - Map-Symbol: zwei gekreuzte Klingen im Kreis
  - 1–2 pro Welt-Map, frühestens ab Ebene 3, nie direkt vor dem Boss
  - runde Arena mit wenigen Hindernissen
- [x] **Belohnung** (vorab sichtbar): ein Runenfragment garantiert, dazu die Wahl zwischen seltenem Relikt und neuem Zauber, plus 2 Rissstaub.
- [x] **Grundlage für Mini-Bosse:** Gegner-Rolle `champion`.
  - 3 Phasen mit Grenzen in den Daten (Standard 100–66 %, 66–33 %, 33–0 %)
  - Phasenwechsel mit kurzer, verwundbarer Pause (wie beim Glutwächter)
  - eigene Lebensleiste mit Namen; bei Paaren zwei Leisten
  - Status-Resistenz 30 %
- [x] **Glut-Duellant** (`ember_duelist`): flinker Fechter.
  - **Phase 1:** Dreifach-Stich (Kette aus Ausfällen), Seitschritt, **Parierhaltung**.
    - Die Haltung dauert 0,8 s und hat ein deutliches blaues Leuchten mit eigenem Sound.
    - Wer in die Haltung schlägt, wird gekontert.
    - Zauber, Riss-Geschoss und Treffer von hinten brechen die Haltung und machen ihn 1,2 s verwundbar.
  - **Phase 2:** zusätzlich die Klingenwelle (Geschoss-Bogen); er pariert öfter.
  - **Phase 3:** zusätzlich der „Glutsturm“: Er markiert eine Linie am Boden und stürmt hindurch. Das belohnt den perfekten Dash. Insgesamt ist er schneller.
- [x] **Zwillinge Funke und Asche** (`twin_spark`, `twin_ash`): ein Fernkämpfer (Feuer) und ein Nahkämpfer (Schlacke).
  - **Band:** Stehen sie näher als 200 px beieinander, leuchtet ein Band zwischen ihnen, und beide nehmen 40 % weniger Schaden. Ziel ist, sie zu trennen.
  - **Phase 1:** Sie kämpfen einzeln: Funke wirft Feuerbälle, Asche macht Bodenschläge.
  - **Phase 2:** Kombo-Angriffe (Asche schleudert Funke über die Arena, Feuerregen auf der Landestelle).
  - **Phase 3:** beginnt, sobald einer fällt. Der andere wird zornig und **belebt den Partner nach 8 s mit 30 % Leben wieder**, wenn er nicht vorher besiegt wird. Ein Ring-Countdown macht das sichtbar.
  - Die Phasen 1 und 2 richten sich nach dem gemeinsamen Lebensanteil.
- [x] **Fairness** (GDD §4.6):
  - Jedes Muster hat einen Telegraph.
  - Bei Paaren gilt höchstens ein Angriff gleichzeitig, außer bei Kombo-Mustern mit gemeinsamem Telegraph.
  - Nach jedem Muster gibt es ein Strafbarkeitsfenster.
- [x] **Musik:** Duelle nutzen den Kampf-Track mit dem Bass des Boss-Tracks.
- [x] **Bot:** respektiert die Parierhaltung (zaubert oder wartet) und trennt die Zwillinge.

**Technik:**
- Phasen werden aus dem Boss-Code verallgemeinert: `phases` gilt für `boss` und `champion`.
- Parieren wird eine neue Angriffsart `guard`.
- Die Paar-Logik läuft als benannte Handler `twin_link` und `revive_partner`.
- Neue Map-Generator-Regeln mit Tests.
- **Run-Save:** Der neue Knotentyp erfordert ein Map-Schema-Update (v8, Migration: alte Maps bleiben gültig, nur ohne Duelle).

**Tests:**
- Map-Regeln (Anzahl, frühestens Ebene 3)
- Phasenwechsel
- Parier-Logik: Konter nur während der Haltung, Bruch von hinten, Bruch durch Zauber
- Band-Schadensreduktion, Wiederbelebung mit Countdown
- Determinismus
- Simulator: Duelle dauern beim Bot 45–90 s.

**Wie testen (PO):**
- Debug-Menü → „+ ember_duelist“, „+ twins“.
- Einen Seed mit Duell-Raum auf Ebene 3 spielen (wird im PR genannt).

**Abhängig von:** M3.1, M3.4 (Runenfragment als Belohnung)

**Umgesetzt (Abweichungen vom Plan):**
- **Belohnung:** Runenfragment plus Scherben, Glut und Rissstaub wie in einem Elite-Raum. Die zusätzliche Wahl „seltenes Relikt oder neuer Zauber“ entfällt vorerst.
- **Glut-Duellant:** Der Dreifach-Stich ist als kurzer und langer Stoß umgesetzt (keine Ketten-Lunge), den Seitschritt übernimmt das normale Umkreisen.
- **Zwillinge:**
  - Ohne Kombo-Angriff („Asche wirft Funke“); Phase 2 bringt stattdessen Geschossring und Ansturm.
  - Eine gemeinsame Lebensleiste statt zwei.
- **Musik:** Duelle nutzen die normale Kampfmusik.
- **Lebenspunkte nach Simulator angehoben:** Duellant 700 → 1800, Funke 380 → 900, Asche 480 → 1100. Die Duelle dauerten vorher nur 22 s.
- **Simulator** (200 Runs, `--fresh`):
  - balanced 83,0 % Siege, Duell Ø 41 s
  - aggressive 17,0 % Siege, Duell Ø 28 s
- **Run-Save v8** (Knotentyp `duel`).

### M3.6 Zauberlehrer und Ausrüstung (Meta) ✅
**Ziel:** Zauber werden dauerhaft freigeschaltet und vor dem Run ausgerüstet (E4).

**Umfang:**
- [x] **Neue Figur Sel, die Runenweberin** (Arbeitsname) auf dem bisherigen Hub-Bildschirm. Ab M5 ist sie in der begehbaren Zuflucht.
  - schaltet Zauber gegen Glut und Rissstaub frei
  - ca. 15 Dialogzeilen
- [x] **Vor dem Run:** Zauber-Ausrüstung wählen (1 aktiver Zauber und 1 Aura aus den freigeschalteten).
- [x] **Im Run gefundene Zauber:**
  - Noch nicht freigeschaltete Zauber gelten nur für diesen Run.
  - Danach gelten sie als „entdeckt“ und kosten bei Sel nur die Hälfte.
- [x] **Glutbaum-Knoten „Runenkunde“** (teuer): Der ausgerüstete aktive Zauber startet auf Stufe 2.

**Technik:**
- **Profil v2:** freigeschaltete und entdeckte Zauber, Ausrüstung (Migration v1 → v2).
- `RunMeta` übernimmt die Ausrüstung beim Run-Start.

**Tests:**
- Migration
- Kosten und Entdeckt-Rabatt
- RunMeta-Snapshot

**Wie testen (PO):** Im Run einen neuen Zauber finden, ihn danach bei Sel freischalten und im nächsten Run ausrüsten.

**Abhängig von:** M3.3

**Umgesetzt (Abweichungen vom Plan):**
- **Kein eigener Bildschirm vor dem Run:** Die Ausrüstung wählt man in Sels Runenturm (Zuflucht → „Runenturm (Sel)“). Ein Run startet immer mit der dort gewählten Ausrüstung, das spart einen Klick pro Run.
- **Kosten:** Meteor 70 Glut + 2 Staub, Giftwolke 60 + 2, Lichtlanze 70 + 2, Frosthauch 50 + 1, Pestatem 60 + 1, Heiligenschein 60 + 2. Entdeckte Zauber kosten die Hälfte (aufgerundet). Frostnova und Glutmantel sind von Anfang an frei.
- **Entdeckt** wird ein Zauber, wenn er am Ende eines Runs (Sieg, Tod oder Aufgeben) in einem Slot liegt.
- **Runenkunde:** 160 Glut + 3 Staub, eine Stufe.
- **15 Dialogzeilen** für Sel (Einführung, Duell-Tode, Wesen, Run-Zahl, Füller).
- **Profil v2** mit Migration v1 → v2 (bestehende Profile bekommen die Start-Zauber).

### M3.7 Balancing und Abschluss ✅
- [x] **Simulator-Bericht erweitern:** Schaden pro Spieler-Quelle, Zauber-Nutzung, Duell-Zeiten, Tode durch Mini-Bosse.
- [x] **Zielwerte:**
  - Zauber und Auren machen 15–30 % des Schadens aus; die Waffe bleibt die Hauptsache.
  - Ein Duell dauert beim Menschen ca. 1–2 min.
- [x] **GDD aktualisieren:** §4 (Aktionen, Zauber-Slots), §5 (Status-Effekte, Mini-Bosse), §6 (Duell-Raum), §7 (Stufen, Runenfragmente, Glutsplitter), §10 (Zauber-Taste).

**Umgesetzt:**
- **Simulator:** neue Zeile „magic share“ (Zauber + Aura + Status, mit Zielwert), Zauber pro Minute und Anteil der Runs, die an einem Mini-Boss enden. Duell-Zeiten stehen in „room time“, Tode pro Gegner in „deaths“.
- **Zauberschaden angehoben:** Frostnova 18 → 35, Lichtlanze 32 → 50, Meteor 45 → 65. Direkter Zauberschaden lag bei nur 3 %.
- **Simulator** (200 Runs, `--fresh`), vorher → nachher:

  | | balanced | aggressive |
  |---|---|---|
  | Siege | 90,5 % → 91,0 % | 17,0 % → 17,5 % |
  | Magie-Anteil | 15,2 % → **17,7 %** | 12,0 % → 13,9 % |
  | davon direkter Zauberschaden | 3,2 % → 6,1 % | 2,6 % → 4,8 % |
  | Zauber pro Minute | 1,9 | 1,4 |
  | Duell Ø | 38 s | 28 s |
  | Runs, die an einem Mini-Boss enden | 1,5 % | 10,0 % |

- Der aggressive Bot zaubert seltener und liegt knapp unter dem Ziel. Menschen zaubern erfahrungsgemäß öfter. Ob der Anteil am Handy stimmt, prüft die PO-Abnahme.
- **Offen für die Abnahme:** Die Duell-Dauer beim Menschen (Ziel 1–2 min) misst der Bot nicht. Bots brauchen 28–38 s, weil sie keine Muster lernen müssen.

**Abnahme M3 (PO-Checkliste):**
- [ ] Ich sehe auf einen Blick, welche Effekte auf einem Gegner liegen und wie stark.
- [ ] Zauber und Auren fühlen sich mächtig an, aber die Waffe bleibt wichtig.
- [ ] Der Sprung Einzel- → Doppel- → Dreifachgeschoss fühlt sich wie ein Belohnungsmoment an.
- [ ] Duelle fühlen sich anders an als Wellen-Kämpfe: Ich lerne Muster und Phasen.
- [ ] Der Zauber-Button ist am Handy gut erreichbar, nichts liegt im Weg.
- [ ] ≥ 55 FPS mit CPU-Drosselung ×4 bei 40 Gegnern mit Status-Effekten und aktiver Aura.

---

## M4: Lebendiger Neon-Look ✨
**Ziel:** Spielfigur und Gegner werden zu Kreaturen mit Körpern und Animation. Einheitliche Icons machen alles besser lesbar. Der Neon-Vektor-Stil bleibt (E8, E9).

**Grundsätze (verbindlich für alle M4-Pakete):**
1. **Körper aus Teilen:** Kopf, Rumpf, Arme, Beine, Schwanz, Panzer …
   - Jedes Teil wird **einmal** prozedural in eine Textur gebacken (Atlas).
   - Animiert wird nur über die Transformation der Teile (Position, Rotation, Skalierung, Alpha). Kein `Graphics`-Neuzeichnen pro Frame.
2. **Animation ist reine Darstellung.**
   - Sie liest den Simulationszustand (Tempo, Blickrichtung, `aiState`, Angriffsphase, Treffer, Status) und verändert ihn nie (Architekturregel 2).
   - Die Hitboxen in der Simulation bleiben Kreise.
3. **Lesbarkeit vor Schönheit.**
   - Telegraph-Form und -Farbe (GDD §12.1) bleiben die wichtigste Warnung; das Ausholen des Körpers unterstützt sie nur.
   - Die Spielfigur bleibt das hellste Element.
4. **Leistung:**
   - höchstens 8 Teile pro Standard-Gegner, 20 pro Boss
   - pro Gegner ein Container mit vorab angelegten Sprites aus einem Pool
   - Budgets aus TECH_DESIGN §16 einhalten

### M4.1 Prototyp: Vesper und Schlacke (vorher/nachher) ✅
**Ziel:** Der PO kann den neuen Look an zwei Figuren beurteilen, bevor er in die Breite geht.

**Umfang:**
- [x] **Rig-System** in `src/view/render/rig/`:
  - Rig-Daten als Content in `src/content/rigs/`: Teile, Gelenke, Ruhepose, Farbschichten
  - Bake ins Atlas
- [x] **Animations-Bausteine:**
  - Laufzyklus aus dem Tempo
  - Atmen im Stand
  - Ausholen und Zuschlagen aus der Angriffsphase
  - Treffer-Zucken, Squash und Stretch
  - Dash-Nachbild
  - Tod: Zerfall in Glut
- [x] **Vesper:** schlanke Figur mit Kopf, Umhang, Armen und Beinen, leuchtendem Brandmal. Die Waffe in der Hand folgt der Combo.
- [x] **Schlacke:** gedrungene Lavakreatur auf vier Beinen mit glühenden Rissen. Bei der Vorbereitung duckt sie den Kopf.
- [x] **Debug-Menü:** Umschalter „Look: classic / rig“ für den direkten Vergleich, dazu Zeitlupe zum Betrachten.
- [x] **Leistungsmessung:** 40 Schlacken mit Rig gegen den klassischen Look, CPU ×4. Die Zahlen stehen im PR.

**Technik:** ADR „Rig-Animation: Teile-Sprites statt Sprite-Sheets“.

**Wie testen (PO):** Mit dem Umschalter vergleichen, in Hoch- und Querformat, bei normaler Geschwindigkeit und in Zeitlupe.

**Entscheidung (PO):**
- Gefällt der Look, geht es mit M4.2 weiter.
- Sonst wird nachgebessert oder die Richtung geändert, bevor es in die Breite geht.

**Abhängig von:** M3 abgenommen

**Umgesetzt (vom PO am 2026-10-23 abgenommen: „Look passt“):**
- **Seitenansicht:** Figuren stehen aufrecht und werden je nach Blickrichtung gespiegelt. Die Klinge folgt Zielrichtung und Combo: Hieb von oben, Hieb von unten, Stoß; beim Spezialangriff wirbelt sie einmal herum.
- **Größe:** Vesper wird 1,4-fach, Schlacke 1,2-fach des Kollisionsradius gezeichnet, damit die Körper am Handy lesbar sind. Die Hitboxen bleiben unverändert. Ein weicher Glow hält Vesper als hellstes Element.
- **Tod:** Der Körper zerfällt in seine Teile, die mit Glut davonfliegen. Gilt für Gegner und für Vesper.
- **Debug-Menü:**
  - „View“ → „Look: rig (off = classic)“
  - „Time scale“ für Zeitlupe
  - Rig-Werte unter „rigs (look)“ und „rig: vesper/slag“
- **Leistung** (40 Schlacken, Simulation eingefroren, Render-CPU-Zeit pro Frame, Swiftshader im Container):

  | | Rig | klassisch |
  |---|---|---|
  | CPU ×4 | ca. 4,3 ms | ca. 2,7 ms |
  | ohne Drosselung | ca. 1,5 ms | ca. 0,95 ms |

  Das Budget fürs Rendering liegt bei 8 ms. Die FPS werden im Container von der Software-Grafik begrenzt; die echte Messung am OnePlus 13 macht der PO.
- **ADR 0005**, TECH_DESIGN §34.

### M4.2 Alle Kreaturen der Aschefelder ✅
**Umfang:**
- [x] **Rigs für alle Gegner der Aschefelder:**
  - **Funkenspucker:** aufgeblähter Krötenkörper, der Kehlsack bläht sich beim Laden
  - **Splitterkoloss:** Golem mit Splitter-Schultern, hebt die Arme zum Bodenschlag
  - **Glutmilbe:** Insekt mit sechs Beinen
  - **Aschenpriester:** schwebende Robe, die Hände heben sich beim Heilen
  - **Glutleger:** Käfer, der aus dem Hinterleib Minen legt
  - **Glutwächter:** Koloss mit Armen und Brustkern; der Phasenwechsel ist sichtbar (Rüstung bricht ab)
  - **Glut-Duellant** und die **Zwillinge**
- [x] **Elite-Modifikatoren am Körper sichtbar:**
  - geschirmt: Schild am Arm
  - hastig: Funkenschweif
  - flüchtig: pulsierender Kern
- [x] Status-Darstellung aus M3.1 an die Körper anpassen (Eiskruste auf den Teilen, Gift tropft von den Teilen).
- [x] Der klassische Look bleibt als Option „Einfache Grafik“ für schwache Geräte.

**Abhängig von:** M4.1 (Entscheidung des PO)

**Umgesetzt:**
- **10 Rigs** in `src/content/rigs/`: Schlacke, Funkenspucker, Splitterkoloss, Glutmilbe, Aschenpriester, Glutleger, Glut-Duellant, Funke, Asche und Glutwächter. Standard-Gegner haben höchstens 8 Teile, Champions und Boss höchstens 20 (Content-Test).
- **Neue Rig-Kanäle:**
  - `windupScale` und `strikeScale`: Der Kehlsack des Funkenspuckers bläht sich, Kerne schwellen an.
  - `castX` und `castY`, dazu die Parierhaltung über den cast-Kanal: Der Duellant hebt Buckler und Klinge.
  - `hoverUnits` lässt Aschenpriester und Funke schweben.
  - `untilPhase`: Beim Glutwächter brechen Brust- und Schulterplatten in Phase 2 ab und legen den Kern frei.
- **Elite-Merkmale am Körper:**
  - flüchtig: Der Glow pulsiert rot.
  - hastig: Funkenschweif beim Laufen, Glow in Elite-Farbe.
  - geschirmt: Der Schild wird vor dem Körper getragen.
- **Status an den Körpern:**
  - Glut steigt von den Teilen auf, Gift tropft von ihnen herab.
  - Eiskruste und Frost-Hülle liegen als Ellipse um die aufrechte Figur.
  - Die Symbole sitzen über dem Kopf.
- **„Einfache Grafik“** in Pause → Einstellungen schaltet auf die klassischen Formen (Settings v7).
- **Debug-Menü:** „Gather enemies“ stellt alle Gegner im Kreis um Vesper auf, zum Anschauen.

### M4.3 Icon-Set im Neon-Stil ✅
**Ziel:** Segen, Relikte, Zauber, Upgrades, Status und Map-Knoten sind an ihren Icons erkennbar, ohne dass man Text lesen muss.

**Umfang:**
- [x] **Einheitliche Icon-Sprache:** Die Form des Rahmens zeigt die Art.

  | Art | Rahmen |
  |---|---|
  | Segen | Kreis in der Farbe des Wesens |
  | Relikt | Sechseck |
  | aktiver Zauber | Raute |
  | Aura | Raute mit Ring |
  | Upgrade | Doppelwinkel |
  | Status | kleiner Kreis |
  | Material | Quadrat |
  | Quest | Wappenschild |

  Die Rahmenfarbe zeigt die Seltenheit (GDD §7.2); innen sitzt eine Glyphe.
- [x] **Prozeduraler Icon-Generator** in `src/view/render/icons/`:
  - Glyphen aus Grundformen als Daten: Flamme, Schneeflocke, Tropfen, Strahl, Auge, Herz, Klinge, Stern, Schädel …
  - Die Icons werden zur Ladezeit ins Atlas gebacken.
  - Preact-Menüs verwenden sie als Bild-URL wieder.
- [x] **Content-Feld** `icon: { glyph, accent }` für jeden Segen, jedes Relikt, jeden Zauber, jeden Status, jedes Map-Symbol und jedes Material. Der Content-Test prüft, dass jedes Element ein Icon hat.
- [x] **Einsatzorte:** Belohnungs-Auswahl, Build-Übersicht im Pause-Menü, HUD (Zauber, Status), Map, Shop, Ergebnis-Bildschirm.
- [x] **Barrierefreiheit:** Icons unterscheiden sich in der Form, nicht nur in der Farbe.

**Abhängig von:** M3.3 (Zauber existieren). Das Paket kann parallel zu M4.2 laufen.

**Umgesetzt (Abweichungen vom Plan):**
- **Eine Quelle für alle Icons:**
  - Glyphen und Rahmen sind SVG-Pfaddaten (`src/view/render/icons/`).
  - Menüs zeigen sie als SVG-Bild.
  - Für HUD und Status-Overlay werden sie beim Start in Texturen gerastert.
  - Ins Atlas gebacken wird nicht, Einzeltexturen reichen für die wenigen HUD-Icons.
- **29 Glyphen**, darunter Flamme, Schneeflocke, Klinge, Herz, Schädel, Flügel, Sanduhr, Schild, Edelstein und Krone.
- **Rahmen:**
  - Segen: Kreis in der Wesensfarbe, ab Selten mit Rand in der Seltenheitsfarbe.
  - Relikte: Sechseck in der Seltenheitsfarbe.
  - Zauber: Raute; Auren: Raute mit Ring.
  - Upgrades: Doppelwinkel.
  - Status: kleiner Kreis.
  - Für Material und Quest sind die Rahmen schon da; Inhalte dafür kommen ab M5.
- **Content-Feld `icon: { glyph }`** für alle 21 Segen und 12 Relikte (Pflichtfeld im Schema). Zauber und Status nutzen ihr bestehendes `visual.glyph`.
- **Einsatzorte:**
  - Karten für Segen, Relikte, Zauber und Upgrades
  - Shop
  - Segen-Chips auf der Map
  - Build-Übersicht im Pause-Menü
  - Sels Runenturm und Nix' Relikt-Laden
  - HUD (Zauber, Boss-Status) und Status-Symbole über Gegnern
- **Nicht umgesetzt:**
  - Die Map-Symbole bleiben die eigenen SVG-Symbole aus M2.6; sie sind schon formverschieden.
  - Der Ergebnis-Bildschirm zeigt bisher keinen Build, dort gibt es noch keine Icons.

### M4.4 Effekte und Umgebung ✅
- [x] Zauber- und Aura-Effekte überarbeiten: Meteor-Schweif, Schwaden der Giftwolke, Glanz der Lichtlanze.
- [x] **Aschefelder:**
  - Boden-Details (Risse, Glutadern)
  - Requisiten an den Hindernissen
  - Glutregen in mehreren Schichten
- [x] **Leistungs-Durchgang:** Partikel-Budget prüfen und automatische Qualitätsstufen vorbereiten (fertig in M6.8).

**Umgesetzt:**
- **Meteor:** Der Meteor fällt sichtbar von schräg oben auf die Markierung, mit Feuerschweif (`meteorHeadOffset` in `view/render/spell-visuals.ts`).
- **Giftwolke:** Langsam treibende Schwaden am Boden (`cloudSwath`).
- **Lichtlanze:** Vierzackige Glanzpunkte entlang des Strahls, Nachglühen am Boden und ein Lichtblitz am Ursprung (`beamShine`).
- **Aschefelder:**
  - dunkle Bodenrisse, ein Teil davon mit Glutadern
  - an den Blöcken eine glimmende Naht und Geröll an der Unterkante
  - beides einmal pro Raum gezeichnet und per Position geseedet, ohne den Sim-Zufall zu nutzen
- **Glutregen** (`view/vfx/ember-rain.ts`):
  - 48 vorab angelegte Sprites in drei Parallax-Schichten
  - die Qualitätsstufe „Niedrig“ halbiert die Menge
  - folgt der Simulationszeit, ist also in Zeitlupe langsamer
- **Partikel-Budget:** Die neuen Effekte kosten höchstens rund 25 Partikel pro fallendem Meteor, rund 11 pro Giftwolke und rund 9 pro hastigem Elite-Gegner. Das passt in die Budgets von 2000 (Hoch) bzw. 1000 (Niedrig). Die automatischen Qualitätsstufen bleiben für M6.8.

**Abnahme M4 (PO-Checkliste):**
- [ ] Vesper und die Gegner wirken wie lebendige Kreaturen, der Stil ist stimmig.
- [ ] Ich erkenne Angriffe so schnell wie vorher (die Lesbarkeit ist nicht schlechter geworden).
- [ ] Ich erkenne Segen, Relikte und Zauber an ihren Icons, ohne den Text zu lesen.
- [ ] Die Leistung ist wie in M3 (CPU ×4 ≥ 55 FPS bei 40 Gegnern).

---

## M5: Hub-Welt, Weltkarte, Quests und Story 🏕
**Ziel:** Die Zuflucht wird eine begehbare Welt. Von hier aus wählt man per Portal frei zwischen den Welten, baut die Zuflucht wieder auf, nimmt Aufträge an, schmiedet Rüstungen und erlebt die Geschichte, ein bisschen wie in Cult of the Lamb (E7, E10–E13).

**Neue Spielstruktur** (ersetzt in GDD §3 den „Run über 4 Biome in 20–30 min“, A3):
```
Zuflucht (begehbar)
 ├─ Figuren: Dialoge, Aufträge, Story-Quests
 ├─ Stationen: Glutbaum (Maren), Schmiede (Toll), Markt (Nix), Runenturm (Sel),
 │             Kartentisch (Iskra), Archiv (Archivar)
 ├─ Bauplätze: Gebäude mit Materialien wieder aufbauen
 └─ Portalhalle ─▶ freigeschaltete Welt wählen
                     └─▶ Welt-Run: Map mit 8–10 Ebenen (Kampf, Elite, Duell, Horde, Altar, Shop, Rast, Ereignis)
                            └─▶ Welt-Boss ─▶ Sieg oder Tod ─▶ zurück in die Zuflucht
                                 Glut, Rissstaub und Materialien bleiben; Segen, Relikte und Scherben verfallen
```
- **Dauer eines Welt-Runs:** 8–12 min, gut für Handy-Sessions.
- **Freischaltung der Welten:**
  1. Die Aschefelder sind offen.
  2. Der Sieg über den Glutwächter öffnet die Gläserne See.
  3. Der Sieg über die Spiegelkönigin öffnet die Sturmzitadelle.
  4. Der Sieg über den Donnerkreis **und** eine Story-Quest öffnen den Riss.
- **Später (M7):** „Durchmarsch“, alle Welten am Stück, als Endgame-Modus mit Brand-Stufen.

### M5.1 Begehbare Zuflucht (Technik) ⬜
**Umfang:**
- [ ] **Hub-Szene:** eine eigene, kleine Simulation ohne Kampf.
  - Bewegung und Dash fühlen sich an wie im Kampf.
  - Kollision mit Gebäuden; die Kamera folgt.
- [ ] **Hub-Layout als Daten** in `src/content/hub/layout.ts`: Bereiche, Wege, Bauplätze, Positionen der Figuren, Portalhalle.
- [ ] **Interaktion:** In der Nähe einer Figur oder Station erscheint ein Hinweis.
  - Tastatur: **E**
  - Gamepad: **A**
  - Touch: Der Angriffs-Button wird in der Zuflucht zum „Sprechen“-Button.
- [ ] Bestehende Menüs (Glutbaum, Relikt-Freischaltung, Zauberlehrer) öffnen sich als Overlay an der jeweiligen Station.
- [ ] **Figuren** mit Rig-Animation (aus M4), Idle-Verhalten und Sprechblasen für kurze Kommentare.
- [ ] **Übergang** zwischen Run und Zuflucht. Die Position in der Zuflucht wird nicht gespeichert, man startet am Lagerfeuer.
- [ ] **Musik der Zuflucht:** eine eigene, ruhige Schicht.

**Technik:**
- ADR „Hub-Szene: eigene Simulation oder die Raum-Simulation wiederverwenden“.
- Reiner Code in `src/sim/hub/`, Darstellung in `src/view/hub/`. Die Screens bleiben Preact.

**Tests:**
- Kollision, Interaktions-Reichweite
- Eingabe mit allen drei Steuerungsarten (E2E-Smoke-Test: Zuflucht betreten, zu Maren laufen, Menü öffnen)

**Abhängig von:** M4.2 (Rigs)

### M5.2 Portalhalle und Weltkarte ⬜
**Umfang:**
- [ ] **Portalhalle** mit einer Weltkarte als Overlay. Die Karte zeigt die Welten, Sperren und Bedingungen, den Boss-Status, Bestzeiten und Quest-Hinweise.
- [ ] **Run-Struktur umbauen:**
  - Ein Run führt durch genau eine Welt (`worldId` im Run-Zustand).
  - Der Sieg über den Welt-Boss beendet den Run erfolgreich.
- [ ] **Welt-Fortschritt im Profil:** freigeschaltete Welten, besiegte Bosse und Mini-Bosse, Bestzeiten.
- [ ] Nach Tod oder Sieg: Ergebnis-Bildschirm, danach steht man vor dem Portal in der Zuflucht.

**Technik:**
- Biom-Daten werden zu Welt-Daten (`src/content/worlds/` bzw. Umbenennung von `biomes`).
- **Run-Save v9** (`worldId`; alte Stände zählen als Aschefelder).
- **Profil v3** (Welt-Fortschritt).

**Tests:**
- Freischaltungs-Logik
- Migrationen: ein laufender Run vor dem Update lässt sich fortsetzen.

**Abhängig von:** M5.1

### M5.3 Wiederaufbau der Zuflucht ⬜
**Umfang:**
- [ ] **Materialien pro Welt:**

  | Welt | Materialien |
  |---|---|
  | Aschefelder | Glutkern, Schlackeeisen |
  | Gläserne See | Seeglas |
  | Sturmzitadelle | Sturmeisen |
  | Der Riss | Rissglas |

  - Sie fallen in Räumen, bei Elites, in Duellen und bei Bossen.
  - Sie bleiben auch beim Tod erhalten.
- [ ] **Bauplätze mit Stufen** (Ruine → aufgebaut → ausgebaut), bezahlt mit Materialien und Rissstaub:
  - Schmiede (Toll)
  - Markt (Nix)
  - Runenturm (Sel)
  - Kartentisch (Iskra)
  - Archiv (Archivar)
  - Lagerfeuer-Platz (Maren)
- [ ] **Gebäude schalten Funktionen frei**, zum Beispiel:
  - Schmiede → Rüstungen
  - Kartentisch → Welt-Infos und später tägliche Seeds
  - Archiv → Codex
- [ ] **Sichtbares Wachstum** (GDD §2.3): Licht kehrt zurück, Pflanzen wachsen, Figuren ziehen ein.
- [ ] **Dekorationen** als Belohnung. Sie sind reine Kosmetik und geben keine Macht.
- [ ] Kein Anhänger-Management (A2, bestätigt).

**Technik:**
- Gebäude, Stufen und Kosten als Content in `src/content/hub/buildings.ts`.
- **Profil v4:** Materialien und Gebäude-Stufen.

**Tests:** Kosten, Freischaltungen, Migration.

**Abhängig von:** M5.2

### M5.4 Schmied Toll und Rüstungen ⬜
**Umfang:**
- [ ] **Rüstungsteile in 4 Slots:** Kopf, Brust, Hände, Füße.
  - Jedes Teil hat einen Grundwert (Leben, Schaden, Tempo, Abklingzeit, Ausdauer-Regeneration …).
  - Dazu kommt eine Eigenschaft, z. B. „Dash hinterlässt eine Glutspur“.
- [ ] **Sets** pro Welt bzw. Element: Ein 2er-Bonus und ein starker 4er-Bonus, z. B. beim Glut-Set „Brand stapelt doppelt“.
- [ ] Toll stellt Teile her und verbessert sie gegen Materialien (Stufen 1–3).
- [ ] Ausgerüstet wird vor dem Run.
- [ ] Rüstung ist **Meta-Macht mit Obergrenze** wie der Glutbaum: Der Endzustand ist planbar, er bricht das Balancing nicht.
- [ ] **Sichtbar an Vesper:** Rüstungsteile ersetzen die Teile des Rigs.
- [ ] **Waffen und Aspekte** ziehen als Funktion beim Schmied ein (GDD §4.8). Die neuen Waffen kommen in M6.5.
- [ ] **Startumfang:** ein Glut-Set (4 Teile) und 4 einzelne Teile.

**Technik:**
- Content in `src/content/armor/`.
- **Profil v5:** Rüstungen und Ausrüstung.
- `RunMeta` übernimmt die Rüstungswerte beim Run-Start.

**Tests:** Set-Boni, Werte-Stapelung, Obergrenze, Migration.

**Abhängig von:** M5.3

### M5.5 Markt, Händler und Zauberlehrer in der Zuflucht ⬜
- [ ] **Nix' Markt:** Relikt-Freischaltungen (wie bisher), Materialien tauschen, Kosmetik.
- [ ] **Sel, die Runenweberin**, zieht mit ihrem Zauber-Menü aus M3.6 in den Runenturm.
- [ ] **Wöchentlich wechselndes Angebot**, deterministisch aus dem Datum (ohne Server).

**Abhängig von:** M5.3

### M5.6 Quest-System ⬜
**Umfang:**
- [ ] **Quests als Daten** in `src/content/quests/` mit `defineQuest()`. Felder:
  - `kind: 'errand' | 'story'`, Auftraggeber, Voraussetzungen
  - Ziele und Belohnungen
  - Dialogzeilen (Annahme, Fortschritt, Abschluss)
- [ ] **Ziel-Arten:**
  - Material sammeln
  - Gegner mit einem Status besiegen („Besiege 30 vergiftete Gegner“)
  - einen Mini-Boss bzw. Boss besiegen
  - einen Raum ohne Treffer schaffen
  - eine Welt erreichen
  - einen Quest-Gegenstand finden (in einem Ereignis-Raum)

  Die Simulation kennt keine Quests. Der Fortschritt wird aus `SimEvents`-Zählern und dem Run-Bericht abgeleitet.
- [ ] **Aufträge** (wiederholbar bzw. rotierend) von den Figuren, z. B. „Bring Toll 3 Glutkerne“.
- [ ] **Story-Quests** in Ketten. Sie schalten Welten, Gebäude, Figuren und Zauber frei.
- [ ] **Quest-Log** (Preact) mit Verfolgen-Funktion.
  - kleiner Tracker im Run-HUD
  - Quest-Symbol an passenden Map-Knoten
- [ ] **Startumfang:** 10 Aufträge und eine Story-Kette über die Aschefelder (5 Schritte).

**Technik:**
- Auswertung rein und deterministisch in `src/sim/meta/quests.ts`.
- **Profil v6:** Quest-Zustand.

**Tests:** Fortschritt je Ziel-Art, Voraussetzungen der Ketten, Migration.

**Abhängig von:** M5.2

### M5.7 Story-Fundament ⬜
**Umfang:**
- [ ] **`docs/STORY.md` als Story-Bibel.** Der PO gibt sie vor der Umsetzung frei. Inhalt:
  - Hauptbogen über alle Welten
  - Bögen der Figuren
  - das Rätsel um Vesper und die Figur „???“
  - wahres Ende und Ton
- [ ] **Story im Run:**
  - Boss-Intro und -Outro als kurze Szene: Kamerafahrt, Name, 2–3 Textzeilen
  - Begegnungen mit wiederkehrenden Figuren in Ereignis-Räumen
  - Wesen kommentieren den Build am Altar
- [ ] **Story in der Zuflucht:**
  - Das Dialogsystem bekommt Bedingungen zu Quests und Gebäuden.
  - ca. 100 neue Zeilen
- [ ] **Szenen-Baustein:** Text-Szene mit Figuren-Rigs, überspringbar, ohne Sprachausgabe. Stattdessen spricht jede Figur in kurzen Gibberish-Sounds.

**Abhängig von:** M5.1. Die Story-Bibel kann früher entstehen.

**Abnahme M5 (PO-Checkliste):**
- [ ] Ich laufe gern durch die Zuflucht, Figuren und Stationen sind leicht zu finden (Touch, Tastatur, Gamepad).
- [ ] Ich sehe, wie die Zuflucht durch meinen Fortschritt wächst.
- [ ] Ich habe immer ein nächstes Ziel (Auftrag, Gebäude, Welt, Rüstungsteil).
- [ ] Die Story macht neugierig, wie es weitergeht.
- [ ] Ein Welt-Run passt in eine Pause (8–12 min) und lässt sich unterbrechen.

---

## M6: Alpha – Welten und Content vollständig
**Ziel:** Alle 4 Welten sind von Anfang bis Ende spielbar, wenn auch noch nicht poliert. M6 entspricht dem bisherigen M3, erweitert um Duelle, Zauber, Rüstungen und Quests.

**Paket-Vorlage pro Welt** (M6.1–M6.3):
- Palette und Umgebungspartikel
- 6 Gegner mit Rigs und 3 Elite-Modifikatoren
- 2 Mini-Bosse (3 Phasen)
- ein Welt-Boss (2–3 Phasen plus Zorn)
- ca. 8 Raumvorlagen
- ein Musik-Track (Erkundung, Kampf, Boss)
- 1–2 Materialien und ein Rüstungs-Set
- eine Story-Kette
- 3–4 Ereignisse
- ein Status-Thema

### M6.1 Gläserne See ⬜
- **Thema:** Kristall, Fernkampf, Schilde, Spiegelungen. Wesen-Fokus: Vaelis.
- **Mini-Bosse** (Vorschläge):
  - **Spiegelfechterin:** Ein Klon ahmt die Angriffe des Spielers verzögert nach.
  - **Eiswal-Wächter:** taucht unter das Eis ab und löst Schockwellen aus.
- **Boss:** Die Spiegelkönigin (Klone und Täuschung).

### M6.2 Sturmzitadelle ⬜
- **Thema:** schnelle Gegner, Kettenfallen, Gewitter. Wesen-Fokus: Kyrr.
- **Mini-Bosse** (Vorschläge):
  - **Blitzreiter:** Sturmangriffe quer durch die Arena, hinterlässt Spannungsbahnen.
  - **Glockenwärter-Paar:** Schallringe, die man im Takt durchdashen muss.
- **Boss:** Der Donnerkreis (Arena-Wechsel, Tempo).

### M6.3 Der Riss (Finale) ⬜
- **Thema:** Leere, zerbrechende Geometrie, verzerrte Elites. Wesen-Fokus: Nihl und Cruor.
- **Mini-Bosse** (Vorschläge):
  - **Echo der Gebrandmarkten:** spiegelt Vespers eigene Waffe und Zauber.
  - **Leerenschlund:** zieht alles in die Mitte.
- **Boss:** Das Herz des Brandes (mehrere Phasen, Story-Finale, erster Bogen des Sieges).

### M6.4 Wesen, Segen und Zauber ⬜
- [ ] Kyrr, Nihl und Cruor mit vollständigen Segen-Sets (je ca. 9), dazu 10 Duo-Segen und ein legendärer Segen pro Wesen.
- [ ] ❓ **A1:** Gift und Licht als eigene Wesen? Vorschlag, falls ja:
  - Gift = **Morra** (Verfall, Zermürbung)
  - Licht = **Solen** (Schutz, Blenden, Heilung)
- [ ] **Zauber für alle Schulen**, insgesamt ca. 20 (jede Schule mindestens 1 aktiver Zauber und 1 Aura):
  - Sturm: Kettenblitz, Aura Gewitterwolke
  - Leere bzw. Dunkelheit: Schattenschnitt, Aura Dunkelfeld (markiert)
  - Blut: Blutlanze (kostet Leben), Aura Aderlass (Lebensraub)
- [ ] Neue Status sichtbar machen: Schock, Markiert, Blutung.

### M6.5 Waffen ⬜
- [ ] Rissspeer und Splitterbogen mit je 2 Aspekten, die Brandklinge mit 2 Aspekten. Aspekte gibt es beim Schmied.
- [ ] Waffen-Rigs in Vespers Hand.

### M6.6 Relikte, Evolutionen, Orbitale ⬜
- [ ] **ca. 40 Relikte**, davon ca. 6 für Zauber und Auren. Beispiel: „Echo-Rune“ wiederholt den aktiven Zauber nach 1 s schwächer.
- [ ] **6 Evolutionen**, auch mit Zaubern. Beispiel: Frostnova + Kalter Kern + Vaelis-Segen = „Ewiger Winter“.
- [ ] **Orbitale** (höchstens 3).

### M6.7 Riss-Prüfungen, Ereignisse, Codex, Prophezeiungen, Onboarding ⬜
- [ ] Riss-Prüfungen und ca. 12 Ereignisse, mit Story-Begegnungen.
- [ ] **Codex im Archiv:** Bestiarium mit Rig-Ansicht, Zauber, Rüstungen, Lore.
- [ ] Prophezeiungen.
- [ ] **Onboarding:** ein geskripteter erster Besuch in der Zuflucht und ein kurzer erster Run in den Aschefeldern.

### M6.8 Barrierefreiheit und Qualität ⬜
- [ ] Farbenblind-Modi: Status-Effekte bekommen zusätzlich Muster.
- [ ] Modus mit reduzierten Effekten, Assist-Modus, Textgröße, freie Tastenbelegung.
- [ ] Automatische Qualitätsstufen: Rig-Teile, Partikel, Bloom.

### M6.9 Balancing ⬜
- [ ] Der Simulator spielt Welt-Runs und simuliert Meta-Fortschritt über ca. 30 Runs (Glutbaum, Rüstung, Zauber-Freischaltungen).
- [ ] Ergänzend Playtests mit dem PO und externen Testern.

**Abnahme M6:**
- Ein Sieg über das Herz des Brandes ist möglich; den ersten Gesamtsieg schaffen Tester nach ca. 15–25 Welt-Runs.
- Es gibt keine Abstürze und keine Speicherstand-Fehler.
- Die Leistungsbudgets werden auf dem Referenzprofil eingehalten.

---

## M7: Beta – Polish und Retention (bisher M4)
- [ ] 5 Waffen mit je 3–4 Aspekten, ca. 60 Relikte, 10 Evolutionen, ca. 28 Zauber, Rüstungs-Sets für alle Welten
- [ ] **Brand-Stufen** (ca. 12 Pakt-Modifikatoren) und Modus **„Durchmarsch“** (alle Welten am Stück)
- [ ] **Tägliche und wöchentliche Seeds** mit lokaler Bestenliste und Teilen-Code (am Kartentisch)
- [ ] **Kosmetik:** Paletten, Rüstungs-Färbungen, Dekorationen für die Zuflucht. Belohnung für Prophezeiungen und Brand-Stufen.
- [ ] **Polish-Durchgang:**
  - Übergänge, Menü-Animationen, Sound-Mix
  - Musik: ein Track pro Welt, dazu Zuflucht und Bosse
- [ ] **PWA-Feinschliff:** Update-Hinweis, Installations-Aufforderung, Offline-Test
- [ ] Test auf iOS Safari und schwächeren Android-Geräten
- [ ] **Entscheidung zur Monetarisierung**, gegebenenfalls Integration (Demo-Grenze bzw. Provider)
- [ ] Optional: datenschutzfreundliche Analytik mit Einwilligung
- [ ] **Öffentliche Beta** auf itch.io und GitHub Pages mit Feedback-Kanal. Aus M2 übernommen: erster itch.io-Upload und mindestens 3 externe Tester.

**Abnahme:** Positive Retention in der Beta (Spieler kommen wieder), stabile Leistung, alle Systeme fertig.

---

## M8: Release 1.0 (bisher M5)
- [ ] Geheime Pfade, Geheim-Bosse, Bonus-Fragment (eigenes Portal)
- [ ] **Wahres Ende** und Epilog; die Zuflucht verändert sich danach dauerhaft
- [ ] Steam-Version (Desktop-Wrapper, z. B. Tauri oder Electron), Errungenschaften, Steam-Cloud-Speicher
- [ ] Trailer, Store-Seiten, Pressepaket
- [ ] Prüfung der Lokalisierung (EN/DE)
- [ ] Optional: Backend für Online-Bestenlisten und Cloud-Speicherstände

---

## Speicherstand-Fahrplan

Richtwerte. Wenn sich die Reihenfolge der Pakete ändert, verschieben sich die Nummern. Jede Erhöhung braucht eine getestete Migration `vN → vN+1` (`CLAUDE.md`).

| Paket | Settings | Profil | Run-Save | Inhalt |
|---|---|---|---|---|
| heute (M2.8) | v2 | v1 | v5 | – |
| M3.1 ✅ | **v3** | | | Einstellung „Status-Symbole über Gegnern“ |
| M3.2 | **v4** | | **v6** | Touch-Button `spell`, ausgerüstete Zauber im Run |
| M3.4 | | | **v7** | Stufen, Zweige, Segen-Stufen |
| M3.5 | | | **v8** | Knotentyp `duel` in der Map |
| M3.6 | | **v2** | | freigeschaltete und entdeckte Zauber, Ausrüstung |
| nach M3 ✅ | **v5** | | | Einstellung „Aura-Ring um Vesper anzeigen“ (Standard: aus) |
| nach M4.1 ✅ | **v6** | | | Sprachauswahl in den Einstellungen (Automatisch, English, Deutsch) |
| M4.2 ✅ | **v7** | | | „Einfache Grafik“ (klassische Formen) |
| M5.2 | | **v3** | **v9** | Welt-Fortschritt, `worldId` |
| M5.3 | | **v4** | | Materialien, Gebäude-Stufen |
| M5.4 | | **v5** | | Rüstungen |
| M5.6 | | **v6** | | Quest-Zustand |

---

## Risiken der neuen Richtung

| Risiko | Gegenmaßnahme |
|---|---|
| Der Umfang wächst stark (Hub-Welt, Rigs, Quests). | Strikte Paket-Reihenfolge, eine Abnahme pro Meilenstein, Prototyp vor der Breite (M4.1). Kein neuer Content vor der Abnahme. |
| Am Handy wird es eng auf dem Bildschirm. | Nur **ein** neuer Button (A4), Layout-Editor, Status-Symbole abschaltbar |
| Animierte Körper machen Angriffe schlechter lesbar. | Telegraphs bleiben die wichtigste Warnung (M4-Grundsatz 3), Vergleichsschalter im Debug-Menü |
| Rigs kosten Leistung auf schwachen Geräten. | Teile-Budget, Pooling, Option „Einfache Grafik“, CPU ×4 in jedem M4-PR |
| Zauber und Auren machen die Waffe überflüssig. | Zielwert 15–30 % Zauber-Schaden, Simulator-Schaden pro Quelle (M3.7) |
| Der Umbau zu Welt-Runs zerstört Speicherstände. | Migrationen mit Tests, alter Run = Aschefelder (M5.2) |
| Meta-Macht (Glutbaum, Rüstung, Zauber-Stufen) macht das Spiel zu leicht. | Obergrenzen, Simulator mit simuliertem Profil (M6.9) |

---

## Danach (Ideen-Pool, nicht zugesagt)
- 6. Wesen **Erz** (Verteidigung bzw. Gegenschlag), weitere Waffen
- Rüstungsleisten bei Gegnern (wie in Hades) und ein Dash-Angriff (A5)
- zweiter aktiver Zauber-Slot (z. B. durch ein 4er-Rüstungs-Set)
- Begleiter bzw. Haustier in der Zuflucht und im Run
- Endlos-Modus („Der tiefe Riss“)
- weitere Sprachen
- App-Store-Versionen (Capacitor)
- Mod- bzw. Daten-Support für Community-Content
- Koop bzw. Mehrspieler: jetzt eingeplant als I10 (siehe „PO-Ideen, Runde 2“)

---

## Arbeitsweise pro Meilenstein
1. Claude zerlegt den Meilenstein in kleine Pakete (je Paket ein Branch und ein PR). Vor Paketen mit ❓ klärt Claude die offene Frage mit dem PO.
2. Jeder PR läuft durch die CI und bekommt eine Testversion unter `/riftbrand/dev/<branch>/`. Die PR-Beschreibung enthält Was, Warum, **Wie testen** (Debug-Menü, Seed), Simulator-Zahlen bei Balancing-Änderungen und neue Feel-Werte.
3. Der PO testet auf dem Handy bzw. am Desktop und gibt Feedback (Gefühl, Seed, Export aus dem Debug-Menü).
4. Merge nach `main`, und die Hauptversion geht live.
5. Im selben PR werden die Roadmap-Checkboxen abgehakt, und das Symbol 🔜 wandert zum nächsten Paket.
6. Am Ende des Meilensteins folgt der Playtest mit der Abnahme-Checkliste, danach eine kurze Rückschau. GDD und TECH_DESIGN werden bei Bedarf aktualisiert.
