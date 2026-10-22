# CLAUDE.md – Projektregeln für Riftbrand

Riftbrand ist ein 2D-Action-Roguelike für den Browser (PWA, mobile-first, Touch, Tastatur/Maus und Gamepad). Neon-Vektor-Look, Game Feel hat höchste Priorität.

**Lies vor größeren Änderungen:**
- `docs/GDD.md`: Spieldesign (was und warum)
- `docs/TECH_DESIGN.md`: Architektur, Datenmodell, Budgets (wie)
- `docs/ROADMAP.md`: aktueller Meilenstein und Abnahmekriterien (was als Nächstes)
- `docs/adr/`: Architekturentscheidungen

Rollen: Claude entwickelt, der Nutzer testet (OnePlus 13 und Desktop) und entscheidet über Richtung und Merges.

## Befehle
```
pnpm dev          # Dev-Server (auch im LAN erreichbar, zum Testen auf dem Handy)
pnpm build        # Produktions-Build (BASE_PATH, ENABLE_PWA, GIT_SHA setzt die Deploy-Pipeline)
pnpm preview      # Build lokal ausliefern
pnpm check        # Biome-Lint und -Format-Prüfung (pnpm check:fix korrigiert)
pnpm typecheck    # tsc --noEmit
pnpm test         # Vitest: Unit-, Determinismus- und Architekturtests
pnpm e2e          # Playwright-Smoke-Test (vorher pnpm build)
pnpm bench:ecs    # ECS-Benchmark (ADR 0001)
pnpm icons        # PWA-Icons aus public/icons/icon.svg rendern
```
- Vor jedem Commit: `pnpm check && pnpm typecheck && pnpm test`.
- In der Claude-Cloud-Umgebung ist Chromium vorinstalliert: `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium pnpm e2e` (nie `playwright install` ausführen).
- `pnpm sim` (Headless-Simulator) kommt in M2.
- **Nie** `pkill -f "vite preview"` o. Ä. verwenden: Das Muster trifft die eigene Shell. Stattdessen die PID gezielt beenden.

## Harte Architekturregeln
1. **`src/sim/` ist rein und deterministisch.** Keine Importe von `pixi.js`, `src/view`, `src/platform`, kein `window`, `document`, `Math.random`, `Date.now`, `performance.now`, keine asynchrone Logik. Zufall nur über die Seed-RNG-Ströme (`sim/rng`). Ein Architekturtest erzwingt das.
2. **Die View verändert nie den Simulationszustand.** Feedback (VFX, Sound, Haptik) reagiert auf `SimEvents`.
3. **Fester Takt von 60 Hz.** Zeitlupe verändert die Anzahl der Ticks, nie `dt`. Hitstop ist Simulationszustand (`freezeTicks`).
4. **Content ist Daten.** Neue Waffen, Gegner, Segen und Relikte kommen als Datei in `src/content/` mit `define*()`-Helfer und Zod-Schema. Systemcode nur ergänzen, wenn eine Mechanik deklarativ nicht ausdrückbar ist, dann als benannter Handler in `sim/effects/handlers/`.
5. **Keine magischen Zahlen für Game Feel.** Tuning-Werte liegen in `src/content/tuning.ts` bzw. in den Content-Daten und sind im Debug-Menü sichtbar.
6. **Browser-APIs nur über `src/platform/`**, mit Stub-Implementierungen für Tests und Headless-Betrieb.
7. **Spiellogik kennt keine Monetarisierung.** Nur Oberfläche und Meta-Ebene sprechen mit `MonetizationProvider`.

## Leistungsregeln (Hot Paths: Systeme, Partikel, Rendering pro Frame)
- Keine Allokationen pro Frame bzw. Tick: keine neuen Objekte, Arrays, Closures oder Spread-Operatoren, kein `map`/`filter`. Pools und vorab allozierte Puffer verwenden.
- Vektor-Mathematik mit Ausgabe-Parametern (`add(out, a, b)`) in Hot Paths.
- Grafik einmalig in Texturen backen. Im Spiel nur Sprites aus dem Atlas, kein `Graphics`-Neuzeichnen pro Frame.
- Budgets siehe TECH_DESIGN §16. Bei Änderungen an Rendering bzw. Systemen mit CPU-Drosselung ×4 prüfen.

## Code-Konventionen
- TypeScript strict, `noUncheckedIndexedAccess`. Kein `any` (Ausnahme mit Kommentar begründen), keine `!`-Assertions ohne Grund.
- **Benannte Exporte**, keine Default-Exporte.
- Dateinamen in `kebab-case.ts`, Typen und Klassen in `PascalCase`, Funktionen und Variablen in `camelCase`, Konstanten in `SCREAMING_SNAKE_CASE`, **Content-IDs in `snake_case`**.
- Lieber kleine, reine Funktionen als Klassen. Klassen nur für zustandsbehaftete Plattform- bzw. View-Dienste.
- **Code, Bezeichner und Code-Kommentare auf Englisch.** Dokumentation in `docs/` auf Deutsch.
- Kommentare erklären das *Warum*, nicht das *Was*.
- Einheiten in Namen bzw. Kommentaren klar halten: Pixel, Sekunden und Ticks nie mischen (`durationTicks`, `speedPxPerSec`).

## Texte und i18n
- **Keine fest kodierten Texte für Spieler.** Ausnahme: das Debug-Menü (nur für Entwicklung, Englisch). Alles über `t('key')`, Schlüssel in `src/locales/en.json` (Basis) und `de.json`.
- Schlüssel-Schema: `bereich.id.feld`, z. B. `relic.spark_ring.name`. Die Dateien sind flach (`"pause.title": "…"`).
- Der Content-Test prüft, dass alle Schlüssel in beiden Sprachen vorhanden sind.
- Figuren-Pronomen: Die Spielfigur (Vesper) ist geschlechtsneutral.

## Speicherstände
- Jede Änderung am Speicherstand-Schema bedeutet: Schema-Version erhöhen, Migration `vN → vN+1` schreiben und testen. Spielstände dürfen nie durch ein Update kaputtgehen.

## Tests
- Unit-Tests neben dem Code (`foo.test.ts`). Pflicht für: Schadens-Pipeline, Effekt-Trigger und Stapelformeln, RNG, Map-Generierung, Speicherstand-Migrationen, Input-Puffer.
- Content-Änderungen: Der Content-Test (Schemas, Querverweise, i18n) muss grün sein.
- Determinismus nicht brechen: Der Test „gleicher Seed und gleiche Eingaben ergeben gleichen Hash“ muss grün bleiben.
- Game Feel lässt sich nicht per Unit-Test prüfen. Neue Feel-Werte im PR beschreiben, damit der Nutzer gezielt testen kann.

## Git und Arbeitsablauf
- Feature-Branches und Pull Requests. `main` geht automatisch live (GitHub Pages). Branches bekommen eine Testversion unter `/riftbrand/dev/<branch>/`.
- Commit-Nachrichten im **Conventional-Commits**-Format auf Englisch: `feat(combat): add perfect dash slow-mo`, `fix(input): …`, `docs: …`, `chore: …`, `test: …`, `perf: …`.
- Kleine, fokussierte PRs. Die PR-Beschreibung enthält: was, warum, **wie testen** (inklusive Debug-Menü-Hinweisen bzw. Seed) und Screenshots oder Videos, wenn sie sichtbar sind.
- Architektur- bzw. Bibliotheksentscheidungen als kurzen ADR in `docs/adr/NNNN-titel.md` festhalten.

## Definition of Done
- [ ] `pnpm check`, `pnpm typecheck` und `pnpm test` sind grün, der Build funktioniert
- [ ] Keine Verletzung der Architekturregeln, keine Allokationen in Hot Paths
- [ ] Texte über i18n (EN und DE)
- [ ] Neue Tuning-Werte sind im Debug-Menü sichtbar
- [ ] Auf Touch, Tastatur/Maus und Gamepad bedienbar (falls die Änderung Eingabe bzw. Oberfläche betrifft)
- [ ] Docs aktualisiert, wenn sich Design oder Architektur ändern (GDD, TECH_DESIGN, ROADMAP-Checkboxen)

## Prioritäten bei Zielkonflikten
1. Game Feel und Fairness
2. Leistung auf Mobile
3. Lesbarkeit und Wartbarkeit des Codes
4. Content-Umfang

**Kein neuer Content, bevor der aktuelle Meilenstein seine Spaß-Abnahme bestanden hat** (siehe ROADMAP).
