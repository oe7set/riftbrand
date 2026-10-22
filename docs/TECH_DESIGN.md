# Riftbrand: Technisches Design

> Status: v0.1 (Planungsphase) · Stand: 2026-10-22
> Ergänzt das [GDD](./GDD.md). Konventionen für die tägliche Arbeit stehen in [`CLAUDE.md`](../CLAUDE.md).

---

## 1. Leitprinzipien
1. **Simulation und Darstellung sind getrennt.** Die Spiellogik (`src/sim`) kennt weder PixiJS noch DOM, Audio oder Browser-APIs. Sie läuft im Browser und headless in Node gleichermaßen.
2. **Determinismus.** Bei gleichem Seed und gleicher Eingabefolge ergibt sich derselbe Run, mit fester Tick-Rate und Seed-RNG.
3. **Datengetrieben.** Waffen, Gegner, Segen, Relikte, Räume und Biome sind typisierte Daten. Neuer Content braucht im Normalfall **keinen** neuen Systemcode.
4. **Mobile-Leistung von Tag 1.** Budgets, Objekt-Pools und Qualitätsstufen sind Teil der Architektur und keine nachträgliche Optimierung.
5. **Alles ist tunebar.** Jede Game-Feel-Zahl ist ein benannter Tuning-Wert und live im Debug-Menü änderbar.

---

## 2. Tech-Stack

| Bereich | Wahl | Begründung |
|---|---|---|
| Sprache | **TypeScript** (strict, `noUncheckedIndexedAccess`) | Typsicherheit für datengetriebenen Content |
| Build | **Vite** | schneller Dev-Server mit Hot Reload, effizientes Bundling |
| Paketmanager | **pnpm** | schnell, strikt bei Abhängigkeiten |
| Rendering | **PixiJS v8** (WebGL, optional WebGPU) | schnellster 2D-Renderer, Filter und Shader, kleine Bundle-Größe |
| Filter | **pixi-filters** (Bloom/Glow, Farbmatrix) | Neon-Look |
| ECS | **eigenes minimales ECS** (Bitmasken und Typed Arrays), siehe [ADR 0001](./adr/0001-eigenes-ecs.md) | deterministische Iteration, leicht zu hashen und zu serialisieren, weit unter Budget |
| Validierung | **Zod** | Content-Schemas, Speicherstand-Validierung |
| Menü-Oberfläche | **Preact + Signals** (DOM-Overlay), ab M2. Debug-Menü und Pause-Overlay sind bis dahin schlankes DOM ohne Framework | Text, Scrollen, i18n, Barrierefreiheit und Formulare sind im DOM besser als im Canvas |
| Audio | **Web Audio API** direkt, eigener ZzFX-artiger Synthesizer | volle Kontrolle, keine Abhängigkeit, klein |
| Speicher | **IndexedDB** (dünner Wrapper, z. B. `idb-keyval`), Fallback `localStorage` | robust, großer Speicherplatz |
| PWA | **vite-plugin-pwa** (Workbox) | offline, installierbar |
| Tests | **Vitest** (Unit- und Simulationstests), **Playwright** (Smoke-Test) | schnell, versteht TypeScript direkt |
| Lint/Format | **Biome** | ein Werkzeug, sehr schnell |
| CI/CD | **GitHub Actions**, Veröffentlichung auf **GitHub Pages** (`gh-pages`-Branch), siehe [ADR 0002](./adr/0002-deployment-gh-pages.md) | kostenlos, Branch-Testversionen möglich |

**Warum nicht Phaser bzw. Godot?** Siehe die Diskussion in der Planungsphase. Kurz gesagt: Determinismus und Headless-Simulation erfordern eine saubere Trennung von Logik und Darstellung. Phaser verflicht beides, und der Web-Export von Godot ist für Mobile zu schwer.

---

## 3. Architektur

```
┌──────────────────────────────────────────────────────────────────────┐
│ app/          Bootstrap, Szenen-/Zustandsautomat, Game Loop, Debug   │
├───────────────┬──────────────────────────────┬───────────────────────┤
│ platform/     │ sim/  (rein, deterministisch)│ view/                 │
│  input/       │  ecs/   Welt, Komponenten    │  render/  PixiJS      │
│  audio/       │  systems/ Bewegung, Kampf, KI│  vfx/     Partikel,   │
│  storage/     │  run/   Map, Belohnungen     │           Shake,      │
│  display/     │  rng/   Seed-RNG             │           Hitstop-FX  │
│  haptics/     │  events/ Ereignisse pro Tick │  hud/     HUD (Pixi)  │
│  monetization/│  effects/ Segen/Relikt-Logik │  ui/      Menüs       │
│               │                              │           (Preact)    │
├───────────────┴──────────────────────────────┴───────────────────────┤
│ content/   typisierte Daten: Waffen, Gegner, Segen, Relikte, Räume   │
│ shared/    Mathe (Vec2), Typen, Konstanten, i18n-Schlüssel           │
└──────────────────────────────────────────────────────────────────────┘
```

**Abhängigkeitsregeln** (durch Biome bzw. Import-Regeln und einen Architekturtest erzwungen):
- `sim/` darf nur `shared/` und `content/` importieren. **Niemals** `pixi.js`, `platform/`, `view/`, `window` oder `document`.
- `view/` liest den Zustand der Simulation und deren Ereignisse, verändert sie aber nie.
- `platform/` kapselt alle Browser-APIs. Für Tests und Headless-Betrieb gibt es Stub-Implementierungen.
- `content/` enthält nur Daten und Schemas, keine Logik außer reinen Hilfsfunktionen.

### 3.1 Datenfluss pro Frame
```
Eingabegeräte ──▶ InputMapper ──▶ InputFrame (pro Tick, aufzeichenbar)
                                       │
                                       ▼
             ┌──────── sim.step(InputFrame) × N Ticks ────────┐
             │ Systeme in fester Reihenfolge, schreiben       │
             │ SimEvents (Treffer, Kill, Dash, Telegraph …)   │
             └────────────────────────────────────────────────┘
                                       │ Zustand + Ereignisse
                                       ▼
   view.render(alpha) ◀── Interpolation zwischen den letzten 2 Ticks
   vfx / audio / haptics ◀── konsumieren SimEvents (Feedback)
```

---

## 4. Game Loop und Zeit

- **Fester Simulationstakt: 60 Hz** (`TICK = 1/60 s`). Ein Akkumulator sammelt die echte Zeit. Pro Frame laufen höchstens 5 Ticks, danach wird abgebrochen, damit die Simulation nicht in eine Aufholspirale gerät.
- **Rendering ohne PixiJS-`Application`:** Ein eigener `requestAnimationFrame`-Loop (`src/app/game.ts`) ruft `renderer.render()` selbst auf, damit Simulation und Darstellung in einer klar definierten Reihenfolge laufen.
- **Rendering mit Bildschirmfrequenz** (z. B. 120 Hz auf dem OnePlus 13) mit **Interpolation** der Positionen zwischen den Ticks. Das sorgt für flüssige Darstellung ohne Änderung der Logik.
- **Hitstop** ist Teil des Simulationszustands (`freezeTicks`). Die Simulation überspringt Gameplay-Systeme, während Darstellung, Partikel und Shake weiterlaufen. Damit ist Hitstop deterministisch.
- **Zeitlupe** (perfekter Dash, letzter Gegner) wird als `timeScale` umgesetzt. Sie verändert, **wie viele Ticks pro echter Sekunde** laufen, nicht `dt`. Die Simulation sieht immer dasselbe `dt`, damit bleibt der Determinismus erhalten.
- **Pause:** Der Akkumulator wird angehalten. Bei `visibilitychange` und Fokusverlust wird automatisch pausiert.

---

## 5. Determinismus und RNG
- PRNG: **sfc32** oder **xoshiro128\*\*** (32 Bit, schnell, mit serialisierbarem Zustand).
- **Getrennte Zufallsströme** pro Bereich, alle aus dem Run-Seed abgeleitet: `map`, `loot`, `spawn`, `combat`, `ai`, `vfx` (nur für die Darstellung, nicht deterministisch relevant). So verändert eine Änderung im Kampf nicht die Map-Generierung.
- **Verboten in `sim/`:** `Math.random`, `Date.now`, `performance.now`, die Iterationsreihenfolge ungeordneter Strukturen als Logikgrundlage, asynchrone Logik.
- **Grenzen:** Die Map-, Loot- und Spawn-Generierung ist plattformübergreifend exakt reproduzierbar, weil sie ganzzahlige Logik nutzt. Kampf-Wiederholungen (Input-Replays) sind nur innerhalb derselben JS-Engine garantiert exakt, weil `Math.sin` und andere Funktionen implementierungsabhängig sind. Für Bugreports, die „letzten 3 Sekunden“ auf dem Todesbildschirm und die Simulation reicht das. Falls nötig, kommen später eigene Trigonometrie-Tabellen dazu.
- **Täglicher Seed:** `hash("riftbrand-daily-" + UTC-Datum)`.

---

## 6. ECS und Simulation

### 6.1 Komponenten (Auswahl)
`Transform` (Position, vorherige Position für die Interpolation, Rotation) · `Velocity` · `Collider` (Kreis bzw. AABB, Layer) · `Health` · `Poise` · `Faction` · `Hurtbox` · `Hitbox` (Schaden, Rückstoß, Treffer-ID gegen Mehrfachtreffer) · `Stamina` · `PlayerControl` · `AttackState` (Phase: Vorbereitung, aktiv, Erholung) · `AIBrain` (Zustandsautomat-ID und -Zustand) · `Telegraph` · `StatusEffects` (Brennen, Frost, Markiert …) · `Lifetime` · `Projectile` · `Orbital` · `Pickup` · `RenderRef` (nur ein Handle, die View löst es auf)

### 6.2 Systemreihenfolge pro Tick
1. `inputSystem`: InputFrame → Absichten des Spielers (mit Puffer)
2. `aiSystem`: Entscheidungen, Angriffs-Token-Vergabe
3. `actionSystem`: Angriffe, Dash und Fähigkeiten durchlaufen ihre Phasen, Hitboxen werden erzeugt
4. `movementSystem`: Geschwindigkeit, Abstoßung (Schwarm-Trennung), Rückstoß
5. `collisionSystem`: räumliches Hash-Gitter, Hitbox gegen Hurtbox, Körper gegen Wände
6. `damageSystem`: Schadens-Pipeline (siehe 6.4) → Ereignisse
7. `effectSystem`: Trigger von Segen und Relikten (bei Treffer, Kill, Dash, Kritischem Treffer …)
8. `statusSystem`: Ticks für Brennen, Frost usw.
9. `lifecycleSystem`: Tod, Spawns, Lebensdauer, Pooling
10. `roomSystem`: Wellen, Clear-Bedingungen, Belohnungen

### 6.3 Kollision
- **Keine Physik-Engine.** Kreise und AABBs, ein **räumliches Hash-Gitter** (Zellgröße ca. 64 px), das jeden Tick neu aufgebaut wird.
- Kollisions-Layer: `player`, `enemy`, `playerHit`, `enemyHit`, `wall`, `pickup`.
- Schwarm-Trennung: weiche Abstoßung zwischen Gegnern, begrenzt auf k Nachbarn.

### 6.4 Schadens-Pipeline
```
HitEvent → Grundschaden (Waffe/Fähigkeit)
         → additive Modifikatoren (+x)
         → multiplikative Modifikatoren nach Kategorie (Tag-Multiplikatoren)
         → Kritischer Treffer (Chance hyperbolisch gestapelt, Multiplikator)
         → Verteidigung des Ziels / Status (Frost: +Schaden)
         → Ergebnis: Schaden, Rückstoß, Poise-Schaden, Hitstop-Stufe
         → SimEvents: DamageDealt, Crit, Kill, StatusApplied …
```
Jeder Schritt ist eine reine Funktion und hat Unit-Tests.

### 6.5 Effekt-System (Segen, Relikte, Evolutionen)
Effekte werden **deklarativ** in Daten beschrieben. Die Laufzeit kennt eine begrenzte Menge an Triggern, Bedingungen und Aktionen:

```ts
// content/relics/spark-ring.ts (Skizze)
export const sparkRing = defineRelic({
  id: 'spark_ring',
  rarity: 'rare',
  tags: ['fire', 'kill'],
  stacking: { kind: 'linear' },
  effects: [{
    trigger: 'onKill',
    chance: { base: 0.15, perStack: 0.10, scaling: 'hyperbolic' },
    action: { type: 'spawnProjectileRing', count: 6, damage: { base: 8, perStack: 4 }, tags: ['fire'] },
  }],
});
```
- **Trigger:** `onHit`, `onCrit`, `onKill`, `onDash`, `onPerfectDash`, `onDamaged`, `onRoomStart`, `onRoomClear`, `onStatusApplied`, `tick(interval)` …
- **Aktionen:** Status anwenden, Geschoss bzw. Ring erzeugen, Kettenblitz, Explosion, heilen, Werte-Modifikator, Orbital beschwören, Ausdauer zurückgeben …
- **Ausnahmen:** Wenn eine Mechanik nicht deklarativ ausdrückbar ist, gibt es einen Ausweg über einen benannten `customHandler` in `sim/effects/handlers/`. Das soll selten vorkommen.
- **Rekursionsschutz:** Effekte, die Effekte auslösen, sind auf eine Tiefe von 3 begrenzt, plus ein Budget pro Tick.

### 6.6 Gegner-KI
- Pro Gegnertyp ein **Zustandsautomat** aus wiederverwendbaren Verhaltensbausteinen (`approach`, `keepDistance`, `strafe`, `windup → attack → recover`), konfiguriert in den Gegnerdaten.
- **Angriffs-Token-Manager:** maximal 3 Nahkampf- und 4 Fernkampf-Tokens gleichzeitig. Ohne Token wird positioniert bzw. gekreist.
- Bosse: Musterlisten pro Phase mit gewichteter Auswahl, Abklingzeiten und Bedingungen.

---

## 7. Content-Datenmodell

Alle Content-Typen sind in `content/schema/` als **Zod-Schemas** definiert. Die TypeScript-Typen werden mit `z.infer` daraus abgeleitet. Content-Dateien nutzen `define*()`-Helfer, die typisieren und beim Laden validieren.

| Typ | Kernfelder |
|---|---|
| `WeaponDef` | id, Angriffs-Combo (Phasen, Hitbox-Form, Schaden), Spezialangriff, Aspekte[], Tuning |
| `AspectDef` | id, waffenId, Modifikatoren bzw. Effekte, Freischaltkosten |
| `EnemyDef` | id, Rolle, Leben, Poise, Tempo, Collider, KI-Konfiguration, Angriffe[] (Telegraph, Phasen), Drops, Visual-Rezept |
| `BossDef` | wie Enemy + Phasen[] mit Musterlisten |
| `BoonDef` | id, wesenId, Slot oder passiv, Seltenheitswerte, Effekte, Voraussetzungen |
| `DuoBoonDef` | id, wesen[2], Voraussetzungen, Effekte |
| `RelicDef` | id, Seltenheit (inkl. `curse`), Tags, Stapelverhalten, Effekte, Pool-Freischaltung |
| `EvolutionDef` | id, waffenId, benötigt { Segen-Tags/IDs, Relikt-IDs }, Ergebnis-Effekte |
| `RoomTemplate` | id, Form, Hindernisse, Gefahren, Spawn-Punkte, Größe, erlaubte Biome/Raumtypen |
| `BiomeDef` | id, Palette, Gegner-Pool und Gewichte, Wellen-Budgets, Map-Regeln, Boss |
| `EventDef` | id, Text-Schlüssel, Optionen[] mit Bedingungen und Ergebnissen |
| `ProphecyDef`, `HeatModifierDef`, `MetaUpgradeDef`, `DialogueDef` | … |

- **IDs** sind `snake_case`-Strings und als Literal-Typen in einer Registry erfasst. Verweise werden durch Typen geprüft und zusätzlich durch einen Test (`content.test.ts`), der alle Querverweise, fehlende i18n-Schlüssel und doppelte IDs findet.
- **Visual-Rezepte:** Gegner und Projektile beschreiben ihr Aussehen parametrisch (Form, Kantenzahl, Farbe, Glow, Animationsparameter). Der Grafik-Generator erzeugt daraus Texturen.
- **Tuning:** Globale Game-Feel-Werte liegen in `content/tuning.ts`. Das Debug-Menü überschreibt sie zur Laufzeit und exportiert Änderungen als TS-Code-Schnipsel.

---

## 8. Darstellung (PixiJS)

- **Ebenen:** Hintergrund → Bodeneffekte und Telegraphs → Schatten → Einheiten → Projektile → VFX → Licht/Bloom → HUD. Die Menü-Oberfläche liegt als DOM-Overlay darüber.
- **Prozeduraler Grafik-Generator:** Formen werden beim Laden einmal mit `Graphics` gezeichnet und in ein **Textur-Atlas** gebacken. Im Spiel gibt es nur noch Sprites, was effizientes Batching ermöglicht.
- **Partikel:** eigenes, gepooltes System auf `ParticleContainer`. Budget je nach Qualitätsstufe (500, 1000 oder 2000).
- **Bloom:** zweistufig. „Hoch“ nutzt einen Vollbild-Bloom-Filter in halber Auflösung. „Niedrig“ nutzt vorgerenderte Glow-Texturen (additive Sprites) ohne Nachbearbeitung.
- **Kamera:** Folgen mit Glättung, Vorausschau, Trauma-Shake, Zoom je nach Ausrichtung bzw. Seitenverhältnis (gleiche sichtbare Fläche ± Toleranz), Begrenzung an den Raumgrenzen.
- **Auflösung:** `resolution = min(devicePixelRatio, cap)`, wobei die Obergrenze von der Qualitätsstufe abhängt (1,0 / 1,5 / 2,0).
- **Qualitätsregler:** Er misst die Frame-Zeit (gleitendes Mittel) und senkt bzw. hebt die Qualitätsstufe mit Hysterese. Die Einstellungen können ihn überschreiben.

---

## 9. Eingabe
- **Action-Mapping:** Geräte erzeugen abstrakte Aktionen (`move: Vec2`, `aim: Vec2 | null`, `attack`, `special`, `dash`, `cast`, `ultimate`, `interact`, `pause`).
- **Geräte:**
  - Tastatur und Maus über Pointer- und Keyboard-Events
  - Gamepad über die Gamepad API (Abfrage pro Frame), Standard-Mapping, Erkennung von Xbox- bzw. PlayStation-Controllern
  - Touch über Pointer-Events: Floating Joystick, Buttons mit Ziehen zum Zielen
- **InputFrame** pro Tick: kompakt und serialisierbar. Daraus entstehen Replays und das Telemetrie-Log.
- **Puffer:** 150 ms für Aktionen. Der Puffer liegt in der Simulation, damit er deterministisch ist.
- **Touch-Layout:** Profile pro Ausrichtung, gespeichert in den Einstellungen. Der Layout-Editor ist ein DOM-Overlay.

---

## 10. Audio
- **AudioContext** wird bei der ersten Nutzergeste freigeschaltet (iOS- bzw. Android-Anforderung).
- **Soundeffekte:** ZzFX-artige Parameter in `content/audio/sfx.ts`. Sie werden beim Laden in `AudioBuffer` vorgerendert und mit Variation in Tonhöhe und Lautstärke abgespielt.
- **Stimmen-Manager:** maximale Stimmenzahl pro Sound und global (z. B. 32), Prioritäten, Abstandsdämpfung.
- **Ducking:** Wichtige Sounds senken kurzzeitig die Musik ab.
- **Musik:** Die Schichten jedes Tracks laufen synchron, Lautstärken werden je nach Spielzustand überblendet. Streaming über `<audio>` mit `MediaElementSource` hält den Speicher klein.

---

## 11. Speichern
- **Profil** (Meta-Fortschritt), **Einstellungen** und **laufender Run** werden getrennt gespeichert.
- **Schema-Version** plus **Migrationsfunktionen** `vN → vN+1` mit Tests. Kein Update darf Spielstände zerstören.
- **Run-Zwischenstand:** Beim Betreten jedes Map-Knotens wird der `RunState` serialisiert (Seed, RNG-Zustände, Map, Build, Leben, Währung). Es wird **nicht** die gesamte ECS-Welt gespeichert.
- **Export/Import:** JSON → komprimiert (CompressionStream/deflate) → Base64-Code bzw. Datei, mit Prüfsumme.
- **Speichervorgang:** Schreiben mit Zwischenstand und Umbenennung (zuerst `slot.tmp`, dann ersetzen), zusätzlich ein Backup des letzten guten Stands.
- `navigator.storage.persist()` wird angefragt, damit der Browser die Daten nicht verwirft.

---

## 12. Lokalisierung
- Alle sichtbaren Texte werden über Schlüssel angesprochen: `t('boon.ignara.searing_strike.name')`.
- `locales/en.json` ist die Basis, `locales/de.json` die zweite Sprache. Schlüssel werden aus `en.json` typisiert.
- Plural- und Zahlenformatierung über `Intl.PluralRules` und `Intl.NumberFormat`.
- Ein Test meldet fehlende oder überzählige Schlüssel pro Sprache.

---

## 13. Telemetrie und Simulation
- **Lokales Run-Log:** Seed, Version, gewählte Knoten, Belohnungen, Build, Zeit pro Raum, erlittener Schaden pro Quelle, Todesursache. Die letzten 50 Runs werden gespeichert und sind im Debug-Menü exportierbar.
- **Headless-Simulator:** `pnpm sim --runs 1000 --seed-start 1 --bot balanced --biome 1`
  - Bots nutzen dieselbe InputFrame-Schnittstelle wie der Spieler (einfache Heuristiken: ausweichen bei Telegraph, nächsten Gegner angreifen, Belohnungen nach Strategie wählen).
  - Ausgabe als JSON bzw. CSV: Siegquote, Todesursachen, Zeit pro Raum, Auswahl- und Gewinnrate pro Segen bzw. Relikt, Schadensverteilung.
  - Einsatz: Ausreißer-Erkennung (zu starke oder nutzlose Items), Absicherung der Schwierigkeitskurve, Regressionstests für Balancing in der CI (kleine Stichprobe).

---

## 14. Tests und Qualität

| Ebene | Werkzeug | Was |
|---|---|---|
| Unit | Vitest | RNG, Schadens-Pipeline, Effekt-Trigger, Stapelformeln, Map-Generierung, Speicherstand-Migrationen, Input-Puffer |
| Content | Vitest | Schema-Validierung, Querverweise, i18n-Vollständigkeit, doppelte IDs |
| Determinismus | Vitest | Gleicher Seed und gleiche Eingaben ergeben einen identischen Zustands-Hash nach N Ticks |
| Architektur | Vitest/Biome | `sim/` importiert nichts Verbotenes |
| Simulation | Node-Skript | Balancing-Kennzahlen, in der CI als kleine Stichprobe |
| Smoke | Playwright (Chromium) | Spiel lädt, Raum startet, 10 s Bot-Eingabe, keine Konsolenfehler |
| Manuell | Debug-Menü und Playtests | Game Feel, die Checkliste pro Meilenstein (ROADMAP) |

---

## 15. CI/CD und Hosting
- **GitHub Actions – `ci.yml`** (bei jedem Push und PR): Installation → Biome-Prüfung → `tsc --noEmit` → Vitest → Build → Playwright-Smoke-Test.
- **`deploy.yml`:**
  - Push auf `main` → Build mit `base: /riftbrand/` → Veröffentlichung im Wurzelverzeichnis des `gh-pages`-Branchs
  - Push auf einen anderen Branch → Build mit `base: /riftbrand/dev/<branch-slug>/` → Veröffentlichung in `dev/<branch-slug>/`. Das sind die Testversionen pro Branch für Tests auf dem Handy.
  - Beim Löschen eines Branchs wird die zugehörige Testversion entfernt.
  - GitHub Pages wird dazu auf „Deploy from branch: `gh-pages`“ gestellt (manuelle Einstellung im Repository).
- **Service Worker:** Nur der Build von `main` registriert einen Service Worker. Dessen `navigateFallback` schließt `/dev/` aus, damit Testversionen nie vom Cache der Hauptversion abgefangen werden. Testversionen werden ohne Service Worker gebaut.
- **Versionierung:** `package.json`-Version und Git-Kurz-Hash werden im Spiel angezeigt (Titelbildschirm bzw. Debug-Menü) und in Run-Logs gespeichert.

---

## 16. Leistungs-Budgets
| Budget | Ziel (Referenzgerät Mittelklasse, ca. 2021) |
|---|---|
| Frame | 16,6 ms → Simulation ≤ 4 ms, Rendering ≤ 8 ms, Puffer ≥ 4 ms |
| Gegner gleichzeitig | ≤ 300 (Horde), typisch 10–40 |
| Projektile | ≤ 400 |
| Partikel | 500 / 1000 / 2000 je Qualitätsstufe |
| Draw Calls | < 50 |
| JS-Bundle (gzip) | Kern-Bundle < 400 KB, Menü-Oberfläche per Lazy-Loading |
| Erster Start | < 3 s bis zum Titelbildschirm über 4G |
| Garbage Collection | keine Allokation in Hot Loops (Systeme, Partikel). Objekt-Pools für Entities, Projektile und Partikel. |

**Testgeräte:**
- Das **OnePlus 13** (Snapdragon 8 Elite, 120 Hz) ist ein High-End-Gerät. Es dient als Hauptgerät für Game Feel und den 120-Hz-Test der Interpolation.
- Die Mittelklasse-Referenz wird durch **Chrome DevTools mit CPU-Drosselung ×4** angenähert, zusätzlich zur automatischen Qualitätsstufe „Niedrig“.
- Ab der Alpha kommt ein günstiges Android-Testgerät dazu, oder ein Remote-Gerätetest über BrowserStack bzw. LambdaTest im Testzeitraum.

---

## 17. Monetarisierung (vorbereitet, ohne Funktion)
```ts
interface MonetizationProvider {
  init(): Promise<void>;
  isFullVersion(): boolean;          // Demo-Grenze
  showRewarded?(placement: string): Promise<boolean>;
  purchase?(sku: string): Promise<boolean>;
}
```
- Standard: `NoopMonetization` (Vollversion, keine Werbung). Build-Flag `VITE_DEMO_MODE` für die Demo-Grenze.
- Spieldesign und Simulation fragen **nie** direkt nach Monetarisierung. Nur Oberfläche und Meta-Ebene sprechen mit dem Provider.

---

## 18. Ordnerstruktur

```
riftbrand/
├─ CLAUDE.md
├─ docs/                  GDD, TECH_DESIGN, ROADMAP, ADRs (docs/adr/NNNN-titel.md)
├─ public/                Icons, Manifest-Assets, Schriften, Musik
├─ scripts/               sim.ts (Headless-Simulator), Hilfsskripte
├─ src/
│  ├─ main.ts             Bootstrap
│  ├─ app/                Game Loop, Zustandsautomat (Titel/Hub/Run/Ergebnis), Debug-Menü
│  ├─ sim/                REIN: Welt, Systeme, Kampf, KI, Run-Logik, RNG, Ereignisse
│  │  ├─ ecs/
│  │  ├─ systems/
│  │  ├─ combat/          Schadens-Pipeline, Hitboxen
│  │  ├─ effects/         Effekt-Laufzeit, Trigger, Handler
│  │  ├─ ai/
│  │  ├─ run/             Map-Generierung, Belohnungen, RunState
│  │  ├─ rng/
│  │  └─ events.ts
│  ├─ view/
│  │  ├─ render/          Pixi-Setup, Ebenen, Kamera, Grafik-Generator
│  │  ├─ vfx/             Partikel, Shake, Blitze, Hitstop-Effekte
│  │  ├─ hud/
│  │  └─ ui/              Preact-Menüs, Hub, Einstellungen, Layout-Editor
│  ├─ platform/           input/, audio/, storage/, haptics/, display/, monetization/
│  ├─ content/            schema/, weapons/, enemies/, boons/, relics/, rooms/, biomes/, audio/, tuning.ts
│  ├─ shared/             math/, types, i18n
│  └─ locales/            en.json, de.json
├─ tests/                 Integrations-, Determinismus- und Architekturtests, e2e/ (Playwright)
└─ .github/workflows/     ci.yml, deploy.yml
```
Unit-Tests liegen **neben** dem Code (`foo.ts` + `foo.test.ts`).

---

## 19. Stand nach M1 (Prototyp)
- **Spieler-Zustandsautomat** (`sim/systems/player-actions.ts`): Idle, Angriff (Combo), Spezialangriff, Dash, Tot. Eingaben laufen immer durch den Puffer (`capturePlayerInput`), auch während des Hitstops. Zielhilfe und Treffertest nutzen das räumliche Hash-Gitter.
- **Schadens-Pipeline** (`sim/combat/damage.ts`): Krit, Poise bzw. Stagger, Rückstoß nach Gewicht, Hitstop (der längste gewinnt), Dash-i-Frames mit Erkennung des perfekten Dashs, Treffer-Unverwundbarkeit.
- **Gegner-KI** (`sim/systems/enemy-ai.ts`): gemeinsamer Automat Position → Vorbereitung → aktiv → Erholung bzw. Stagger, parametrisiert über `EnemyDef.attack` (`lunge`, `volley`, `slam`). Angriffs-Tokens begrenzen gleichzeitige Angreifer (3 Nahkampf, 4 Fernkampf).
- **Wellen** (`sim/systems/waves.ts`): budgetbasierter Endlosmodus mit Spawn-Portalen.
- **Events → Feedback:** Die Simulation schreibt `SimEvent`s in einen festen Puffer. `app/feedback.ts` ist die *einzige* Stelle, die daraus Partikel, Shake, Blitze, Sound, Vibration und Zeitlupe macht.
- **Zeitlupe** ist App-Zustand (Skalierung der Tick-Rate), die Simulation bleibt deterministisch.
- **Tuning-Register** (`content/tunables.ts`): `TUNING`, Waffen- und Gegnerdaten registrieren ihre Zahlen. Das Debug-Menü baut daraus die Regler und den Code-Export.
- **Content-Schemas** mit Zod (`content/schema.ts`) erzwingen unter anderem die Fairness-Regeln (Telegraph ≥ 0,4 s, gegnerische Geschosse ≤ 260 px/s).
- **Einstellungen** liegen in `localStorage` (klein, synchron; IndexedDB kommt mit den Spielständen in M2), validiert und repariert über ein Zod-Schema.
- **Audio:** `platform/audio/synth.ts` rendert die Rezepte aus `content/audio/sfx.ts` beim ersten Nutzer-Tippen in `AudioBuffer`s. Abgespielt wird mit Variation in Tonhöhe und Lautstärke, Stimmenlimit und Stereo-Panorama nach Bildschirmposition.

## 20. Stand nach M2.1 (Run-Gerüst)
- **Run vs. Raum:** `sim/run/` enthält den Run-Zustand zwischen den Räumen (`RunState`: Map, Position, Leben, Statistik), reine Funktionen und JSON-serialisierbar. Jeder Raum ist eine eigene `SimState`, erzeugt mit `createSim(roomSeed, roomSetupFor(run, node))`. Raumvorlage und Gegnerwellen werden aus dem Seed abgeleitet und nicht gespeichert.
- **Map** (`sim/run/map.ts`): Ebenen-Map. Jeder Knoten verbindet sich mit einem zusammenhängenden Bereich der nächsten Ebene, dadurch entstehen keine Kreuzungen und jeder Knoten ist erreichbar. Regeln: Start mit Kampf, vor dem Boss eine Rast-Ebene, mindestens eine Horde, Elite erst ab Ebene 2.
- **Raummodi** (`sim/room.ts`, `sim/systems/waves.ts`): `arena` (endlos, Debug/Tuning), `waves` (feste Wellen aus dem Encounter-Budget), `horde` (Timer; danach zerfallen alle Gegner). Ein Clear öffnet den Ausgang, `Ev.ExitReached` beendet den Raum.
- **Hindernisse:** Rechtecke und Kreise in Typed Arrays, Kreis-Push-out in Bewegung und Separation. Geschosse verglühen an Hindernissen, Spawns meiden sie.
- **Speichern:** `platform/storage/run-save.ts` speichert den `RunState` beim Betreten jedes Knotens (`localStorage`, versioniert, Zod-validiert, Migrationskette vorbereitet). Beim Fortsetzen startet ein angefangener Raum neu. IndexedDB folgt mit dem Profil-Speicherstand in M2.6.
- **Menüs:** Preact (TSX) in `src/view/ui/`. `Ui.show(screen)` rendert einen Screen aus einer Union (`title`, `map`, `rest`, `victory`) mit Callbacks in die App. Gamepad und Pfeiltasten navigieren räumlich (`spatial-nav.ts`), Tastatur-Gameplay ist in Menüs deaktiviert.
- **App-Ablauf** (`app/game.ts`): Modi `title → map ⇄ room/rest → victory`, plus `arena`. `?seed=…` in der URL startet direkt die Arena.

## 21. Stand nach M2.2 (Effekt-System und Segen)
- **Segen-Daten** (`content/boons/`): Jeder Segen hat benannte `values` (Basiswert plus Schritt pro Seltenheit, optional ganzzahlig bzw. als Prozent) und deklarative `effects`. Ein Effekt ist entweder `stat` (additiver Bonus) oder `trigger` (`onHit`, `onKill`, `onDash`, `onPerfectDash`, `onDamaged`) mit Bedingung, Chance und Aktion (`applyStatus`, `nova`, `heal`, `refundStamina`). Zahlen in Effekten dürfen auf `values` verweisen, `defineBoon` prüft diese Verweise.
- **Kompilieren** (`sim/effects/build.ts`): Aus den Segen eines Runs wird beim Raumstart ein `CompiledBuild` (Stat-Summen plus Trigger-Listen mit aufgelösten Zahlen). Während des Kampfs gibt es keine Objekt-Allokationen und kein Nachschlagen.
- **Laufzeit** (`sim/effects/runtime.ts`): Die Trigger sitzen in der Schadens-Pipeline (`damageEnemy`, `killEnemy`, `damagePlayer`) und beim Dash-Start. Schutz vor Endlosschleifen:
  - Effekt-Schaden (`source: 'effect'`) löst keine `onHit`-Trigger aus.
  - maximale Tiefe 3
  - Budget pro Tick (`TUNING.effectBudgetPerTick`)
  - eigener Abfrage-Puffer pro Tiefe, damit verschachtelte Novas äußere Schleifen nicht überschreiben
- **Status** (`sim/effects/status.ts`):
  - **Brand:** stapelbar, Schaden pro Takt, wird bei neuen Stapeln aufgefrischt.
  - **Kälte:** verlangsamt pro Stapel. Bei vollen Stapeln **gefriert** der Gegner: keine Aktion, der Angriff wird abgebrochen, er nimmt Bonusschaden.
  - Die Schadens-Multiplikatoren aus Build und Status bündelt `damageMultiplier()`.
- **Belohnungen** (`sim/run/rewards.ts`):
  - Kampf-, Elite-, Horde- und Altar-Knoten bringen einen Segen. Das Wesen hängt deterministisch von Seed und Knoten ab und ist als Farbpunkt auf der Map sichtbar.
  - Das Angebot umfasst 3 Segen eines Wesens, ohne bereits besessene. Slot-Segen ersetzen den bisherigen im selben Slot.
  - Elite und Altar verschieben die Seltenheit nach oben.
- **Speicherstand v2:** Der `RunState` enthält jetzt `boons`. Die Migration v1 → v2 ergänzt eine leere Liste.

## 22. Risiken und Gegenmaßnahmen
| Risiko | Gegenmaßnahme |
|---|---|
| Bloom bzw. Glow ist auf schwachen Geräten zu teuer | Qualitätsstufen mit vorgerendertem Glow ab M1 einplanen |
| Touch-Steuerung fühlt sich ungenau an | früh im Prototyp auf dem echten Gerät testen, Zielhilfe und Puffer tunen, Layout-Editor |
| Hochformat funktioniert spielerisch nicht | ausdrücklich in M1 testen, Ausstiegsoption: nur Querformat |
| Effekt-System wird zu komplex bzw. zu langsam | begrenzte Trigger- und Aktionsmenge, Budget pro Tick, Simulation zum Profilieren |
| Content-Umfang (40+ Relikte, 4 Biome) | datengetriebene Pipeline und Content-Tests, Umfang nur nach Spaß-Prüfung pro Meilenstein |
| Speicherstand-Verlust (Browser löscht Speicher) | `storage.persist()`, Export-Erinnerung, Backup-Slot |
| Service Worker liefert veraltete Version aus | Update-Hinweis im Spiel („Neue Version, neu laden“), Versionsanzeige |
| iOS Safari (Audio, Vibration, PWA-Grenzen) | Audio-Freischaltung bei Geste, Haptik optional, ab der Beta auf iOS testen |
