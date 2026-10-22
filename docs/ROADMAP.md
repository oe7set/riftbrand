# Riftbrand: Roadmap

> Status: v0.1 · Stand: 2026-10-22
> Geplant wird nach **Meilensteinen, nicht nach Datum**. Ein Meilenstein ist erst abgeschlossen, wenn seine **Abnahmekriterien** erfüllt sind. Das wichtigste Kriterium ist immer: *Macht es Spaß?*
> Rollen: **Claude** entwickelt, der **Product Owner** testet (OnePlus 13 plus Desktop), gibt Feedback und entscheidet über Richtung und Merges.

```
M0 Fundament ─▶ M1 Prototyp ─▶ M2 Vertical Slice ─▶ M3 Alpha ─▶ M4 Beta ─▶ M5 Release 1.0
   Technik        Kampf fühlt     1 Biom komplett,     Content-     Polish,     Steam,
   läuft          sich gut an     ganze Run-Schleife   vollständig  Retention   wahres Ende
```

---

## M0: Fundament
**Ziel:** Die technische Basis steht, ein leerer Raum mit einem steuerbaren Platzhalter läuft auf GitHub Pages und auf dem Handy.

- [ ] Projekt-Setup: pnpm, Vite, TypeScript (strict), Biome, Vitest, Ordnerstruktur nach TECH_DESIGN
- [ ] CI-Workflow (Lint, Typecheck, Test, Build) und Deploy-Workflow (`main` → Pages, Branch → `dev/<branch>`)
- [ ] PWA-Grundgerüst (Manifest, Icons als Platzhalter, Service Worker nur auf `main`)
- [ ] Game Loop: fester 60-Hz-Takt, Interpolation, Pause bei Fokusverlust
- [ ] Seed-RNG mit Unterströmen und Tests
- [ ] ECS-Benchmark: bitECS gegen eigenes minimales ECS (500 Entities, Bewegung und Kollision), Entscheidung als ADR
- [ ] Eingabe: Action-Mapping für Tastatur/Maus, Gamepad und Touch (Floating Joystick, Buttons), Geräteerkennung
- [ ] PixiJS-Setup: Ebenen, Kamera, Skalierung für Hoch- und Querformat, Auflösungsobergrenze
- [ ] Debug-Menü (Grundgerüst): FPS bzw. Frame-Zeit, Tuning-Regler, Hitbox-Anzeige, Zeitlupe
- [ ] Architekturtest: `sim/` importiert nichts Verbotenes
- [ ] Determinismustest: gleicher Seed und gleiche Eingaben ergeben denselben Zustands-Hash

**Abnahme:** Ein Kreis lässt sich auf dem OnePlus 13 per Touch und am PC per Tastatur und Gamepad flüssig mit 120 Hz Darstellung bewegen. Die CI ist grün, die Testversion läuft unter `/riftbrand/dev/...`.

---

## M1: Prototyp „Kämpfen macht Spaß“ ⭐
**Ziel:** Ein Raum, eine Waffe, drei Gegnertypen. 10 Minuten Kämpfen sollen sich gut anfühlen. **Ohne dieses Ergebnis kommt kein weiterer Content dazu.**

**Umfang:**
- [ ] Spielfigur (Vektorform), Bewegung, **Dash mit i-Frames**, **perfekter Dash** (Zeitlupe, garantierter kritischer Treffer)
- [ ] **Ausdauer** (3 Segmente), HUD-Grundgerüst (Leben, Ausdauer)
- [ ] **Brandklinge:** Combo mit 3 Schlägen und Glutwirbel (Spezialangriff), Animation Cancel per Dash, Input-Puffer
- [ ] Zielhilfe (Kegel), freies Zielen mit Maus bzw. Stick, Ziehen zum Zielen auf Touch
- [ ] **3 Gegner:** Schlacke, Funkenspucker, Splitterkoloss, mit Telegraphs und Angriffs-Tokens
- [ ] Schadens-Pipeline (Grundlage), Rückstoß, Poise, Treffer-Unverwundbarkeit, kein Kontaktschaden
- [ ] **Game-Feel-Paket vollständig** (GDD 4.7): Hitstop, Trauma-Shake, Blitze, Squash und Stretch, Treffer- und Kill-Partikel, Zeitlupe beim letzten Gegner, Haptik
- [ ] Prozeduraler Grafik-Generator, Bloom (Hoch) und vorgerenderter Glow (Niedrig)
- [ ] **Soundeffekte** über den Synthesizer: Schlag, Treffer, Kill, Dash, perfekter Dash, Telegraph, Spieler getroffen
- [ ] 1 Arena-Raum mit Wellen-Spawner (endloser Modus mit steigender Intensität) und Tod bzw. Neustart
- [ ] Einstellungen (Grundgerüst): Lautstärke, Shake, Vibration
- [ ] Debug-Menü: alle Game-Feel-Werte live tunebar und als Code exportierbar, Gegner spawnen, Unverwundbarkeit
- [ ] **Test im Hochformat** mit eigener Kamera- und Steuerungsanordnung

**Playtest-Checkliste (Abnahme durch den Product Owner):**
- [ ] Jeder Treffer fühlt sich „knackig“ an, man spürt ihn.
- [ ] Der Dash fühlt sich sicher und reaktionsschnell an, ein perfekter Dash ist befriedigend.
- [ ] Jeder Treffer, den ich einstecke, war lesbar. Ich weiß, was ich hätte tun sollen.
- [ ] Die drei Gegner verlangen unterschiedliches Verhalten.
- [ ] Touch-Steuerung auf dem OnePlus 13: Ich verfehle selten Buttons, die Zielhilfe hilft und stört nicht.
- [ ] Ich will nach dem Tod sofort nochmal spielen.
- [ ] Stabile Darstellung, auch mit 4-facher CPU-Drosselung in den Chrome DevTools ≥ 55 FPS bei 40 Gegnern.
- [ ] Entscheidung: Hochformat behalten oder nur Querformat?

---

## M2: Vertical Slice
**Ziel:** Ein vollständiger Run durch **ein Biom**, inklusive Hub, Meta-Schleife und Speichern. Die Qualität entspricht dem Endprodukt.

- [ ] **Map-Generierung** (Slay-the-Spire-Stil) für die Aschefelder, Map-Ansicht, Pfadwahl
- [ ] Raumtypen: Kampf, Elite, Altar, Horde, Shop, Rast, Ereignis (2–3 Ereignisse), Boss
- [ ] 6 Gegnertypen und 3 Elite-Modifikatoren, Raumvorlagen (ca. 8)
- [ ] **Boss: Der Glutwächter** (2 Phasen)
- [ ] **Effekt-System** (deklarativ) mit Triggern und Aktionen, plus Tests
- [ ] **2 Wesen** (Ignara, Vaelis) mit je ca. 8 Segen, 1 Duo-Segen
- [ ] **12 Relikte** (darunter 2 Fluch-Relikte), Stapeln, Tags
- [ ] **1 Evolution** (Phönixklinge), Riss-Geschoss (Wurf), Brandausbruch (Ultimate)
- [ ] Meta: Glut und Rissstaub, Glutbaum (ca. 8 Knoten), Zuflucht als einfacher Hub mit 2 Figuren und Dialogsystem (ca. 30 Zeilen)
- [ ] **Speichern:** Profil, Einstellungen, Run-Zwischenstand, Migrationen, Export/Import
- [ ] **i18n** EN/DE, Menü-Oberfläche (Preact): Titel, Hub, Belohnungs-Auswahl, Pause mit Build-Übersicht, Ergebnis bzw. Tod mit Fortschrittsbalken
- [ ] Musik: 2 Tracks mit Schichten (Erkundung bzw. Kampf, Boss)
- [ ] Headless-Simulator v1 mit Bot und Balancing-Bericht
- [ ] Lokales Run-Log mit Export
- [ ] Touch-Layout-Editor
- [ ] Erster Upload auf itch.io als „Early Prototype“ (unveröffentlicht oder öffentlich, nach deiner Entscheidung)

**Abnahme:** Ein Run durch Biom 1 dauert 6–8 Minuten und macht Spaß. Ein Tod motiviert zum nächsten Run. Mindestens 3 externe Tester spielen 3 oder mehr Runs freiwillig. Der Simulator zeigt keine offensichtlichen Ausreißer.

---

## M3: Alpha (Content vollständig)
**Ziel:** Das ganze Spiel ist von Anfang bis Ende spielbar, wenn auch noch nicht poliert.

- [ ] 4 Biome mit Paletten, Gegner-Pools und Raumvorlagen, 4 Bosse
- [ ] 5 Wesen mit vollständigen Segen-Sets, 10 Duo-Segen, legendäre Segen
- [ ] 3 Waffen (Brandklinge, Rissspeer, Splitterbogen) mit je 2 Aspekten
- [ ] ca. 40 Relikte, 6 Evolutionen, Orbitale
- [ ] Riss-Prüfungen, ca. 12 Ereignisse
- [ ] Zuflucht mit 5 Figuren, Dialoge (ca. 200 Zeilen), sichtbares Wachstum
- [ ] Codex und Prophezeiungen
- [ ] Onboarding (geskripteter erster Run)
- [ ] Barrierefreiheit: Farbenblind-Modi, Modus mit reduzierten Effekten, Assist-Modus, Textgröße, Tastenbelegung
- [ ] Qualitätsregler (automatische Qualitätsstufen)
- [ ] Balancing über Simulation und Playtests

**Abnahme:** Ein Sieg ist möglich. Der erste Sieg gelingt Testern nach ca. 8–15 Runs. Es gibt keine Abstürze und keine Speicherstand-Fehler, und die Leistungsbudgets werden auf dem Referenzprofil eingehalten.

---

## M4: Beta (Polish und Retention)
- [ ] 5 Waffen mit je 3–4 Aspekten, ca. 60 Relikte, 10 Evolutionen
- [ ] **Brand-Stufen** (ca. 12 Pakt-Modifikatoren)
- [ ] **Tägliche und wöchentliche Seeds** mit lokaler Bestenliste und Teilen-Code
- [ ] Kosmetik (Paletten) als Belohnung für Prophezeiungen
- [ ] Polish-Durchgang: Übergänge, Menü-Animationen, Sound-Mix, Musik (4–6 Tracks)
- [ ] PWA-Feinschliff: Update-Hinweis, Installations-Aufforderung, Offline-Test
- [ ] Test auf iOS Safari und schwächeren Android-Geräten
- [ ] **Entscheidung zur Monetarisierung** und gegebenenfalls Integration (Demo-Grenze bzw. Provider)
- [ ] Optional: datenschutzfreundliche Analytik mit Einwilligung
- [ ] Öffentliche Beta auf itch.io und GitHub Pages, Feedback-Kanal

**Abnahme:** Positive Retention in der Beta (Spieler kommen wieder), stabile Leistung, alle Systeme fertig.

---

## M5: Release 1.0
- [ ] Geheime Pfade, Geheim-Bosse, Bonus-Fragment
- [ ] **Wahres Ende** und Epilog
- [ ] Steam-Version (Desktop-Wrapper, z. B. Tauri oder Electron), Errungenschaften, Steam-Cloud-Speicher
- [ ] Trailer, Store-Seiten, Pressepaket
- [ ] Prüfung der Lokalisierung (EN/DE)
- [ ] Optional: Backend für Online-Bestenlisten und Cloud-Speicherstände

---

## Danach (Ideen-Pool, nicht zugesagt)
- 6. Wesen **Erz** (Verteidigung bzw. Gegenschlag), weitere Waffen
- Endlos-Modus („Der tiefe Riss“)
- Weitere Sprachen
- App-Store-Versionen (Capacitor)
- Mod- bzw. Daten-Support für Community-Content
- Koop (aufwendig, nur bei großem Erfolg)

---

## Arbeitsweise pro Meilenstein
1. Claude zerlegt den Meilenstein in kleine Pakete (Branch plus PR je Paket).
2. Jeder PR läuft durch die CI und bekommt eine Testversion unter `/riftbrand/dev/<branch>/`.
3. Der Product Owner testet auf dem Handy bzw. Desktop und gibt Feedback (Gefühl, Seed, Export aus dem Debug-Menü).
4. Merge nach `main`, und die Hauptversion geht live.
5. Am Ende des Meilensteins folgt der Playtest mit Abnahme-Checkliste, danach eine kurze Rückschau. Das GDD wird bei Bedarf aktualisiert.
