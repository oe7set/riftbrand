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
- **Export/Import:** JSON → komprimiert (CompressionStream/deflate) → Base64-Code bzw. Datei, mit Prüfsumme. _(M2.6: als Code zum Kopieren und Einfügen, siehe ADR 0003.)_
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

## 22. Stand nach M2.3 (Relikte, Scherben, Shop, Ereignisse)
- **Relikte** (`content/relics/`): Sie nutzen dasselbe Effekt-Schema wie Segen, ihre Werte hängen aber von der **Stapelzahl** ab. Normale Werte wachsen linear; Chancen wachsen hyperbolisch nach `1 − 1/(1 + k·Stapel)` und erreichen nie 100 %. `compileBuild(boons, relics)` fasst beides zusammen.
- **Neue Stats:** `allDamage`, `critChance`, `critDamage`, `moveSpeed`, `staminaRegen`, `healing` (mindestens 10 %), `shardGain`, `maxHp`. `maxHp` wirkt auf Run-Ebene (`applyMaxHp`): Gewinne heilen mit, Verluste kappen nur das aktuelle Leben.
- **Neuer Trigger `onRoomClear`** (zum Beispiel „Zweiter Atem“).
- **Scherben:** Gegner haben einen `shardValue`. Kills füllen `SimState.shards`, der Raum startet mit den Scherben des Runs, und `completeRoom` übernimmt den Endstand plus den Clear-Bonus. Skript-Kills (Horde-Ende, Debug) geben nichts.
- **Belohnungen pro Knoten** (`sim/run/economy.ts` → `nodeReward`): Kampf ergibt Segen (60 %), Relikt (25 %) oder Scherben (15 %). Elite gibt immer ein Relikt mit Seltenheits-Bonus, Horde und Altar einen Segen. Auf der Map sind die Belohnungen als Marker sichtbar.
- **Shop:** Das Sortiment hängt deterministisch von Seed und Knoten ab: 2 Relikte, 1 Fluch-Relikt mit Rabatt, 1 Segen, 1 Heiltrank. Käufe werden in `RunState.shopBought` gespeichert, damit ein Neuladen nicht neu auffüllt.
- **Ereignisse** (`content/events/`): Optionen mit Bedingungen (`requiresShards`, `requiresHpAbove`) und Ergebnissen (`heal`, `damage`, `shards`, `relic`, `maxHp`). `applyOutcomes` wendet sie an und gibt sie für die Anzeige aufgelöst zurück.
- **Speicherstand v3** mit Migrationskette v1 → v2 → v3.

## 23. Stand nach M2.4 (Neue Aktionen)
- **Riss-Geschoss** (`content/abilities.ts` → `RIFT_SHOT`): Wurf mit 2 Ladungen, die nacheinander in je 3 s zurückkommen (`PlayerState.castCharges`, `castRechargeTicks`). Eigene Aktion `PlayerAction.Cast` mit kurzem Windup, Zielhilfe mit großer Reichweite, Dash bzw. Ultimate brechen die Erholung ab.
- **Spieler-Geschosse** (`sim/combat/player-projectiles.ts`): Gleiche Komponenten wie Gegner-Geschosse plus `projPierce`, `projStatus`/`projStacks`, `projIsCast` und `projSwing` (eine Treffer-ID pro Geschoss, damit durchdringende Geschosse jeden Gegner nur einmal treffen). `projectileSystem` prüft sie gegen Gegner über den Spatial Hash.
- **Brandausbruch** (`BRAND_BURST`): Die Leiste `PlayerState.ultCharge` (0..1) füllt sich durch ausgeteilten Schaden (jede Quelle außer der Ultimate selbst, inkl. Brand-Ticks) und erlittenen Schaden (zehnmal stärker gewichtet). Auslösen: Windup mit Unverwundbarkeit, dann `areaBurst` mit der Variante des **dominanten Wesens** (`CompiledBuild.dominantBeing`: meiste Segen, bei Gleichstand der zuletzt gewählte; ohne Segen eine neutrale Variante). Die Leiste wird über `RoomSetup`/`RoomResult` von Raum zu Raum getragen.
- **Neue Schadensquellen:** `cast` (eigener Stat `castDamage`, löst `onHit` mit `source: 'cast'` aus) und `ultimate` (kein `onHit`, keine Aufladung).
- **Effekt-System erweitert:**
  - neue Trigger `onComboFinisher`, `onFreeze`, `onBurnApplied`
  - neue Aktion `projectile` (z. B. Feuervogel), `nova` mit `consumeStatuses` (verbraucht Brand und Frost am Ziel, bevor die Explosion wirkt, damit sie sich nicht selbst neu auslöst)
  - `areaBurst()` ist die gemeinsame Flächen-Schadensfunktion von Novas und Ultimate
- **Duo-Segen** (`content/boons/duos.ts`): normale `BoonDef` mit `partner` und `requires` (pro Gruppe mindestens ein besessener Segen). Sie sind nie im normalen Pool. Sind die Voraussetzungen erfüllt, ersetzt ein Duo mit 50 % Chance (`DUO_OFFER.chance`) die letzte Option eines Angebots von einem der beiden Wesen. Das Würfeln geschieht nach den normalen Optionen, damit bestehende Angebote je Seed gleich bleiben.
- **Evolutionen** (`content/evolutions/`): `EvolutionDef` mit Waffe, benötigten Segen und Relikten sowie festen Effekten. `compileBuild(boons, relics, evolutions)` nimmt sie mit auf. `availableEvolutions(run)` liefert, was angeboten werden darf: am Altar vor der Segen-Wahl (annehmen oder später) und in der Rast als Alternative zur Heilung.
- **Touch-Wurf:** Der Wurf-Button löst beim **Loslassen** aus (`fireOnRelease`). Ziehen zeigt eine Zielvorschau mit der Reichweite; die Richtung geht über `releaseAimPending` genau in den nächsten Sim-Frame. Tippen ohne Ziehen nutzt die Zielhilfe. Ein abgebrochener Pointer feuert nicht.
- **HUD:** Wurf-Ladungen rechts neben der Ausdauer (die nächste Ladung füllt sich sichtbar), die Ultimate-Leiste darunter. Auf Touch zeigen die Buttons Ladungs-Punkte bzw. eine wachsende Füllscheibe; ein voller Brandausbruch pulsiert.
- **Speicherstand v4:** `evolutions` und `ultCharge`, Migration v3 → v4.

## 24. Stand nach M2.5 (Gegner und Boss)
- **Neue Angriffsarten** im Gegner-Schema: `mine` (Minen um die Spielfigur), `summon` (beschwört Gegner per ID, mit Obergrenze) und `mend` (heilt Verbündete). `summon` und `mend` haben keinen Schaden; das Schema trennt dafür `attackTiming` von `attackBase`.
- **Gefahrenzonen** (`sim/combat/hazards.ts`): Entität mit `C.Hazard`, Zündzeit in `projLifeTicks`, Radius in `radius`, Schaden in `projDamage`. `hazardSystem` zündet und trifft die Spielfigur (Dash weicht aus wie bei jedem Angriff). Nach dem Raum-Clear werden alle Zonen entfernt.
- **Elite-Modifikatoren** (`content/elites.ts`): Faktoren für Leben, Größe, Tempo und Abklingzeit, Frontschild (Kegel und Schadensfaktor) und Todesexplosion. In der Sim steht die ID in `eliteMod`. In Encountern wird ein Gegner als Zahl gepackt: Typ im unteren Byte, Elite im nächsten (`sim/enemy-code.ts`). Die Spawn-Warteschlange ist dafür `Uint16Array`.
- **Bosse:** `EnemyDef.boss.phases` mit `hpBelow`, Angriffsliste, `cooldownScale` und `speedScale`. Pro Gegner speichern `aiPhase` und `aiPattern` Phase und gewähltes Muster; `attackOf(def, phase, pattern)` liefert den aktiven Angriff für KI, Telegraph-Darstellung und Feedback. Die Muster-Wahl nimmt nur Muster in Reichweite und nie dasselbe zweimal. Ein Phasenwechsel bricht den Angriff ab und setzt den Boss in Stagger (Strafbarkeitsfenster). Das Token-System gilt nicht für Bosse (`token: 'none'`).
- **Boss-Tod:** `killEnemy` löst `BossDefeated` aus, entfernt wartende Spawns und lässt übrige Gegner ohne Effekte zerfallen.
- **Biom:** `boss` (Gegnertyp am Boss-Knoten), `elitesPerRoom`; `bossBudget` ist jetzt eine optionale Zusatz-Welle (0 = Boss allein). Hordes enthalten keine Brecher, Stützer und Bosse.
- **Neue Events:** `HazardPlaced`, `HazardBlast`, `ShieldBlock`, `EnemyMend`, `BossPhase`, `BossDefeated`. `Telegraph`/`EnemyAttack` tragen Muster (`amount`) und Phase (`flags`).

## 25. Stand nach M2.6 (Meta)
- **Profil** (`sim/meta/profile.ts`, rein): Glut, Rissstaub, Glutbaum-Stufen, freigeschaltete Relikte, Statistiken, gesehene Dialogzeilen, Story-Flags und `lastRun` (Ergebnis, Räume, Kills, Zeit, Todesursache, dominantes Wesen, Boss erreicht, Einnahmen). Funktionen: `buyRank`, `respec` (volle Erstattung), `unlockRelic`, `runMetaFor`, `settleRun`, `nextGoal`.
- **Glutbaum** (`content/meta/ember-tree.ts`): Knoten mit Stufenkosten (Glut und Staub), optionaler Voraussetzung und einem Effekt (`stat`, `startShards`, `roomHeal`, `lastSpark`, `boonReroll`, `staminaSegment`).
- **Run-Snapshot:** `createRun(seed, runMetaFor(profile), lockedRelics(profile))` hält Boni und gesperrte Relikte im `RunState` fest (Speicherstand v5). `RoomSetup` reicht Schadens- und Regenerationsbonus, Ausdauer-Segmente und Letzter-Funke-Ladungen an die Sim weiter. Die Sim kennt damit `staminaMax`, `lastSparks` und `killedBy`.
- **Letzter Funke:** `damagePlayer` fängt einen tödlichen Treffer ab, setzt das Leben auf den Heilanteil (mindestens 1) und gibt 2 s Unverwundbarkeit (Event `LastSpark`).
- **Todesursache:** `damagePlayer` bekommt den Gegnertyp der Quelle. Geschosse und Gefahrenzonen tragen dafür `enemyType` ihres Verursachers.
- **Neu würfeln:** `rollBoonOffer` nimmt einen Salt. `rerollOffer` verbraucht eine Ladung und erhöht `RunState.rerollSalt`, damit das neue Angebot auch nach dem Neuladen gleich bleibt.
- **Relikt-Pool:** Relikte mit `unlockCost` sind gesperrt, bis Nix sie verkauft. `rollRelic` filtert `run.lockedRelics` (Angebote, Shop, Ereignisse).
- **Dialoge** (`content/dialogue/`, `sim/meta/dialogue.ts`): Zeilen mit Sprecher, Priorität, `once` und Bedingungen (Runs, Siege, letztes Ergebnis, Todesursache, dominantes Wesen, Boss erreicht, Flags, seit M5.7 auch erledigte bzw. laufende Quests und wiederaufgebaute Gebäude). Es gewinnt die höchste ungesehene passende Zeile; Füllzeilen rotieren nach Run-Zahl.
- **Szenen** (M5.7, `content/story/scenes.ts`, `view/ui/scene-screen.tsx`): kurze Text-Szenen mit Sprechern (Figur, `vesper`, `wanderer` oder Gegner-ID), Text in `scene.<id>.<n>`, Namen in `speaker.<id>`. `Game.playScene` zeigt jede Szene einmal (Eintrag `scene:<id>` in `seenDialogue`) im Modus `scene`, bevor der Raum startet bzw. das Ergebnis erscheint. Die Laute sind der Sound `talk`, abgespielt mit der Tonhöhe aus `VOICE_PITCH`; Tempo in `SCENE_TUNING`.
- **Speicherung:** siehe ADR 0003 (IndexedDB, Backup-Slot, Export-Code).
- **Oberfläche:** `view/ui/meta-screens.tsx` mit Zuflucht, Glutbaum, Nix' Waren, Speichern/Übertragen und Ergebnis. Textfelder sind von der WASD-Menünavigation ausgenommen.

## 26. Stand nach M2.7 (Abrundung)
- **Headless-Simulator** (`sim/bot/`, `scripts/sim.ts`, `pnpm sim`):
  - `botInput` erzeugt pro Tick einen `InputFrame`. Strategie `balanced` weicht Telegraphs, Geschossen und Minen per Dash aus, kämpft im Nahkampf, nutzt Spezial, Wurf und Ultimate. `aggressive` weicht nie aus (Untergrenze für die Fairness).
  - Hindernis-Steuerung über Sonden entlang des Wegs; bei Blockade dreht der Bot zu einer stabilen Seite.
  - `autoplayRun` spielt den ganzen Run über die echten Run-Funktionen (Map, Belohnungen, Shop, Ereignisse, Rast, Altar, Evolution). Räume über 240 s gelten als Timeout.
  - `summarize` und `toCsv` erzeugen den Bericht. Ein Vitest prüft Determinismus und dass kleine Stichproben ohne Timeout durchlaufen.
- **Schaden pro Quelle:** `SimState.damageBySource` (Index = Gegnertyp, 255 = unbekannt).
- **Run-Log** (`platform/storage/run-log.ts`): Die letzten 50 echten Runs mit Räumen (Typ, Ebene, Zeit, erlittener Schaden), Schaden pro Gegner, Build, Glutbaum-Stufen und Todesursache. Export als JSON im Debug-Menü.
- **Musik:** siehe ADR 0004. `AudioEngine.setMusic('explore' | 'combat' | 'boss' | 'silent')` folgt dem Spielmodus; `RoomCleared` schaltet zurück auf Erkundung.
- **Touch-Layout-Editor** (`view/ui/layout-editor.tsx`): Overrides pro Ausrichtung als Bildschirm-Anteile plus Größenfaktor (`computeTouchLayout(w, h, overrides)`, auf den Bildschirm begrenzt) und eine Deckkraft. Einstellungen v2.
- **itch.io:** `.github/workflows/itch.yml` baut mit relativen Pfaden ohne Service Worker und lädt mit butler hoch, sobald `BUTLER_API_KEY` und `ITCH_TARGET` gesetzt sind.

## 27. Stand nach M2.8 (Balancing)
- **Treffer-Historie statt letzter Treffer-ID:** Jeder Gegner merkt sich die letzten `HIT_HISTORY` (6) Treffer-IDs (`Components.hitHistory`, Ringpuffer pro Entität). Vorher konnte ein durchdringendes Geschoss oder ein Schwung erneut treffen, sobald dazwischen ein anderer Angriff landete; die Phönixklinge traf den Boss so mehrfach pro Vogel. `wasHitBy`/`rememberHit` werden von `damageEnemy` und dem Geschoss-System genutzt.
- **Status-Resistenz** (`EnemyDef.statusResist`, 0–0,9): skaliert Brand-Schaden und Einfrier-Dauer mit (1 − Resistenz). Der Glutwächter hat 0,5, damit gestapelter Brand ihn nicht unabhängig von seinem Leben schmilzt.
- **Biom-Daten:** `combatWavesEarly`, `combatWavesLate`, `combatWavesLateFromLayer` ersetzen die feste Wellenzahl.
- **Werte und Simulator-Ergebnis** (200 Runs, frisches Profil, `pnpm sim --fresh`):

  | Bot | vorher: Sieg / Run / Boss | nachher: Sieg / Run / Boss |
  |---|---|---|
  | balanced | 100 % / 2:02 / 23 s | 82,5 % / 3:10 / 54 s |
  | aggressive | 55,5 % / 1:29 / 21 s | 15,5 % / 2:00 / 47 s |

  Der Bot weicht nahezu perfekt aus und greift ohne Pause an; Menschen brauchen erfahrungsgemäß etwa doppelt so lange. Die Zielwerte für Menschen (Run 6–8 min, Boss 2–4 min) prüft der Playtest.

## 28. Stand nach M3.1 (sichtbare Status-Effekte)
- **Status als Daten:** `src/content/statuses.ts` (`defineStatus()`, Zod-Schema `statusSchema`) beschreibt Brand, Kälte, Gift und Blenden: Stapel-Obergrenze, Dauer, Schaden über Zeit, Verlangsamung, Einfrier-Schwelle, Windup-Faktor, Zielfehler, Farbe, Glyphe, Anzeige-Priorität. Die Reihenfolge von `statusIdSchema` ist der Index in der Simulation (nur anhängen). Die alten `TUNING.burn*`/`chill*`-Werte sind dorthin umgezogen.
- **Speicherung im ECS:** `statusStacks`, `statusTicks`, `statusTimer` mit `STATUS_COUNT` Plätzen pro Entität (`statusSlot(eid, status)`, `stacksOf()`); sie werden wie `hitHistory` gesondert zurückgesetzt. `windupCarry` trägt den Bruchteil-Fortschritt geblendeter Gegner.
- **Logik:** `sim/effects/status.ts` mit `applyStatus()` (generisch; `applyBurn`/`applyChill` bleiben als Kurzformen), `statusSystem()`, `chillSpeedFactor()`, `windupRate()`, `aimErrorDeg()`. Geschosse speichern `Status-Index + 1` in `projStatus`.
- **Events:** `Ev.StatusApplied` trägt `StatusFlag.First`/`Full`, neu ist `Ev.StatusExpired`; `StatusCode` hat `Poison` und `Blind`, `STATUS_CODES` bildet Index → Code ab.
- **Darstellung:** `view/vfx/status-overlay.ts` (`StatusIcons`): bis zu 3 Symbole mit Stapelzahl pro Gegner, gepoolte Sprites und `BitmapText`, vorgefertigte Zahl-Strings (keine Allokation pro Frame). Die Symbole werden in `textures.ts` gebacken (Glyphen Flamme, Schneeflocke, Tropfen, Auge). `EntityView` hat pro Slot zusätzlich `crust` (Eiskruste) und `halo` (Lichtkranz); die Boss-Leiste zeigt alle Status des Bosses.
- **Settings v3:** `statusIcons` (Standard an).
- **Simulator:** unverändert gegenüber M2.8 (200 Runs, balanced: 82,5 % Siege, Run 190 s, Boss Ø 54 s), der Umbau ändert also das Verhalten von Brand und Kälte nicht.

## 29. Stand nach M3.2 (Zauber-System)
- **Content:** `src/content/spells/` mit `defineSpell()` (`spellSchema`): `school`, `kind` (`active`/`aura`), `cooldownSec` bzw. `pulseSec`, Wirk- und Erholzeit, `moveFactor`, `effect` (bisher `burst` um die Figur oder am Zielpunkt) und `visual` (Farbe, Glyphe). `SPELLS` ist die Index-Tabelle der Simulation (nur anhängen), `START_SPELLS` die Start-Ausrüstung.
- **Lauf-Zustand:** `RunState.spells` (`SpellSlots` mit `active`/`aura`, je `{ id, level }`), weitergereicht über `RoomSetup.spells`; `equipSpells()`/`spellSlotsOf()` übersetzen zwischen Lauf und Simulation (`PlayerState.activeSpell`, `auraSpell`, Stufen, `spellCooldownTicks`, `auraTimerTicks`).
- **Ablauf:** Neue Aktion `Button.Spell` → `Buffered.Spell` → `PlayerAction.Spell` (Wirken mit Bewegungsfaktor, unterbrechbar wie der Wurf). `systems/spells.ts`: `startSpellCooldown()` beim Start, `releaseActiveSpell()` am Ende der Wirkzeit, `spellSystem()` (nach den Spieler-Aktionen) zählt die Abklingzeit herunter und löst Aura-Pulse aus. Effekte laufen über `areaBurst()` (gibt jetzt die Zahl der getroffenen Gegner zurück) mit den neuen Trefferquellen `spell` und `aura`.
- **Stats:** `spellDamage`, `cooldownReduction` (Deckel 50 %), `auraRadius`.
- **Events:** `Ev.SpellCast`, `Ev.AuraPulse` (flags = getroffene Gegner), `Ev.SpellReady`; `Ev.Denied` mit `value = 3` für einen Zauber in der Abklingzeit.
- **Eingabe:** Tastatur F (Interagieren nur noch E), Gamepad RB, Touch-Button `spell` (Settings **v4**, Layout-Editor). Run-Save **v6** (`spells`, Migration v5 → v6 setzt die Start-Zauber).
- **Darstellung:** gebackene Zauber-Icons (Raute, Aura mit Ring) in `textures.ts`; HUD zeigt beide Slots unter der Ultimate-Leiste mit Abklingzeit-Abdeckung; der Touch-Button füllt sich während der Abklingzeit.
- **Simulator:** Der Bot wirkt den Zauber bei 3+ Gegnern oder in Boss-Nähe. `SimState.damageDealt` zählt Schaden pro Spieler-Quelle (`combat/dealt.ts`: Trefferquellen plus `status` für Schaden über Zeit); `pnpm sim` gibt die Anteile aus.

## 30. Stand nach M3.3 (Zauber-Schulen)
- **Effekt-Arten** (`spellEffectSchema`): `burst` (sofort oder nach `delaySec`), `zone` (Pulse über `durationSec`), `beam` (Strecke, `lineBurst()` in `effects/runtime.ts`), `ward` (löst feindliche Geschosse auf; Geschosse liegen nicht im Spatial Hash, deshalb ein Entity-Scan pro Puls). `onKill` beschreibt Zonen, die sterbende Gegner mit einem bestimmten Status hinterlassen (`onEnemyKilledWithSpells()` läuft in `killEnemy`, solange die Status-Slots noch intakt sind).
- **Spieler-Zonen:** `C.Zone`, `RenderKind.Zone`, Felder `zonePulseTicks`, `zoneTimer`, `zoneSpell` (Trefferdaten in den `proj*`-Feldern). `spawnPlayerZone()`/`playerZoneSystem()` in `systems/spells.ts`; eine verzögerte Explosion ist eine Zone mit genau einem Puls am Lebensende. Events `Ev.ZonePulse`, `Ev.ShotDissolved`.
- **Belohnungen:** `NodeReward` `{ kind: 'spell' }`, `rollSpellOffer()` (3 nicht ausgerüstete Zauber, deterministisch), `equipRunSpell()` (übernimmt die Stufe des ersetzten Zaubers), Shop-Artikel `{ kind: 'spell' }`. UI: Screen `spell` mit `SpellCard` (auch im Shop).
- **Darstellung:** Zonen in Zauberfarbe (Meteor: Ring mit sich füllender Scheibe; Wolke: atmende Scheibe plus Rauchpartikel), Strahl-Effekt, Touch-Zielvorschau mit Reichweite, Radius und Farbe des Zaubers (`TouchInput.castAimingSpell`).
- **Content-Helfer:** `spellReachPx()`, `spellRadiusPx()` in `content/spells/index.ts`.

## 31. Stand nach M3.4 (Upgrade-Stufen)
- **Daten:** `upgradeTreeSchema` (`tier3`/`tier5` mit je zwei Zweigen aus `upgradeModsSchema`: `count`, Multiplikatoren für Radius, Schaden, Abklingzeit, Puls, Dauer, Rückstoß, `stacksAdd`, `pierce`). Jeder Zauber hat `upgrades`, das Riss-Geschoss `RIFT_SHOT_UPGRADES`. Stufen-Boni als Tunables `upgradeLevel*`, `upgradeFanDeg`, `upgradeEchoSec`, `boonLevelSteps`.
- **Auflösung:** `sim/run/upgrades.ts` faltet Stufe und Zweige (`foldMods`) zu `ResolvedSpell`/`ResolvedCast`. Das passiert einmal beim Raumstart (`equipSpells`, `equipCast`); die Simulation liest pro Tick nur fertige Zahlen (`SimState.activeSpell`, `auraSpell`, `cast`).
- **Mehrfach-Effekte:** `extra` erzeugt Echos (Selbst-Explosion), Meteorschauer (Ring um den Zielpunkt), zusätzliche Wolken, Strahlen-Fächer (`Ev.SpellCast` mit `flags = 1` für weitere Strahlen) und mehr aufgelöste Geschosse; verzögerte Explosionen sind Zonen mit einem Puls.
- **Belohnungen:** `NodeReward` `{ kind: 'upgrade' }`, `rollUpgradeOffer()` (Zweig-Paare bleiben zusammen, Fähigkeiten vor Segen), `applyUpgrade()`. Segen-Stufe in `OwnedBoon.level`, berücksichtigt in `boonValue()`/`boonDescParams()`.
- **Speicherstand:** Run-Save **v7** (`OwnedSpell.branches`, `RunState.cast`, optionales `level` an Segen; Migration v6 → v7).
- **UI:** Screen `upgrade` mit `UpgradeCard`; Build-Übersicht im Pause-Menü mit Zauber-Abschnitt. Debug-Menü: „Spell/Aura/Cast +1 (A/B)“.

## 32. Stand nach M3.5 (Duelle und Mini-Bosse)
- **Daten:**
  - Raumtyp `duel`.
  - Gegner-Rolle `champion`; Phasen über das bestehende `boss.phases`.
  - Angriffsart `guard` (Parierhaltung: `counterDamage`, `counterRangePx`, `frontArcDeg`, `brokenStaggerSec`).
  - Optionales `link` am Gegner (Partner, Reichweite, Schadensreduktion, Wiederbelebung).
  - Biom-Felder `duelMinLayer`, `duelsMin`, `duelsMax`, `duelEncounters`.
- **Map:** `placeDuels()` wandelt nach der Generierung 1–2 Kampfknoten ab `duelMinLayer` in Duelle um (nie auf der Rast-Ebene). `buildEncounter('duel')` wählt eine Aufstellung (eine Welle).
- **Logik in `sim/systems/champions.ts` (benannte Handler):**
  - `linkOnSpawn()` verbindet Zwillinge beim Spawn (`Components.linkEid`, Index + 1).
  - `linkedDamageFactor()` wirkt in `damageMultiplier()`.
  - `phaseRatio()` nutzt das gemeinsame Leben bzw. erzwingt die letzte Phase, wenn der verbundene Partner gefallen ist.
  - `onLinkedDeath()` und `reviveSystem()` steuern den Wiederbelebungs-Countdown (`reviveTicks`, `reviveType`).
  - `activeGuard()` und `hitsGuardedFront()` werden in `damageEnemy()` über `resolveGuard()` ausgewertet: Parieren bricht den Treffer ab und kontert; jede andere Quelle bricht die Haltung (verlängerter Stagger).
- **Events:** `Ev.Parry`, `Ev.GuardBroken`, `Ev.TwinReviveStart`, `Ev.TwinRevived`.
- **Darstellung:** Parierhaltung in `PALETTE.guard` (blauer Ring und Schildbogen, nie warme Angriffsfarben); Band als Linie zwischen den Zwillingen; Countdown-Ring am Überlebenden. Die Boss-Leiste zeigt auch Champions, für Zwillinge das gemeinsame Leben.
- **Bot:** Er schlägt nicht in eine Parierhaltung, sondern bricht sie mit Riss-Geschoss oder Zauber; Champions zählen für Ultimate und Zauber wie Bosse.
- **Speicherstand:** Run-Save **v8** (Knotentyp `duel`; alte Maps bleiben gültig). Duelle zählen für die Meta-Auszahlung wie Elite-Räume.

## 33. Stand nach M3.6 (Sel und Zauber-Ausrüstung)
- **Profil v2** (`platform/storage/profile-save.ts`): `spellsUnlocked`, `spellsDiscovered`, `loadout {active, aura}`. `migrate1to2()` ergänzt die Felder mit den Werten von `createProfile()`; `migrateProfile()` läuft die Kette durch.
- **Content:** `unlockCost` am Zauber (fehlt er, ist der Zauber gratis bzw. Start-Zauber); Glutbaum-Effekt `spellStartLevel` (Knoten `rune_lore`); Sprecherin `sel` im Dialog-Schema.
- **Logik in `sim/meta/profile.ts` (rein):** `spellUnlockCost()` (halber Preis, wenn entdeckt), `canUnlockSpell()`, `unlockSpell()`, `equipLoadout()`, `discoverRunSpells()` (in `settleRun()`), `startSpellsFor()`.
- **Run-Start:** `createRun(seed, meta, lockedRelics, spells)` kopiert die Zauber-Slots aus `startSpellsFor(profile)`. Nicht (mehr) freigeschaltete Ausrüstung fällt auf die Start-Zauber zurück.
- **Oberfläche:** Screen `spells` (`SpellTowerScreen` in `view/ui/meta-screens.tsx`), erreichbar über den Hub.

## 34. Stand nach M4.1 (Rig-Prototyp)
- **ADR 0005:** Rig-Animation mit Teile-Sprites.
- **Content:** `content/rigs/` (`VESPER_RIG`, `SLAG_RIG`, `RIGS`, `ENEMY_RIGS`, `RIG_TUNING`). Schema `rigSchema` in `content/schema.ts`. Rig-Werte (Schrittlänge, Wippen, Neigung) und `RIG_TUNING` sind im Debug-Menü tunbar.
- **Ansicht (`view/render/rig/`):**
  - `bake-rig.ts` backt Teile, Blitz-Silhouetten und die Nachbild-Silhouette.
  - `animate.ts` mit `poseRig()`: rein, allokationsfrei, getestet.
  - `rig-instance.ts`: ein Container pro Gegner-Slot mit vorab angelegten Sprites, Glow und Bodenschatten.
- **`EntityView`:**
  - `look` ('rig' | 'classic') wird im Debug-Menü umgeschaltet.
  - Pro Entität: Laufzyklus aus dem Tempo, Spiegelung mit Hysterese, Angriffsphasen aus `PlayerState` bzw. `aiState`.
  - Status-Glows, Lebensleisten und Status-Symbole sitzen bei Rigs über dem Kopf (`heightUnits`, `centerUnits`, `visualScale`).
- **Feedback:**
  - `Ev.Kill` und `Ev.PlayerDied` lassen den Körper in seine Teile zerfallen (`EntityView.shatter`, Partikel mit den Teile-Texturen).
  - Das Dash-Nachbild nutzt die Rig-Silhouette (`EntityView.rigAfterimage`).
- **Debug-Handle:** `setRigLook`, `spawnEnemy`, `setGodMode`, `setTimeScale` und `renderMs` für Look-Vergleich und Leistungsmessung.

## 35. Stand nach M4.2 (alle Kreaturen als Rigs)
- **Content:** 10 Rigs, `ENEMY_RIGS` ordnet jedem Gegner der Aschefelder einen Rig zu. Neue Schema-Felder:
  - Teile: `untilPhase`
  - Bewegungskanäle: `windupScale`, `strikeScale`, `castX`, `castY`
  - Rig: `hoverUnits`
- **Gegner-Eingaben:** Ausholen bzw. Zuschlagen kommen aus `aiState`. Die Parierhaltung (`guard`) nutzt den cast-Kanal. `RigInstance.update()` bekommt die Boss-Phase (`aiPhase`) und blendet Teile mit `untilPhase` aus.
- **Feedback:**
  - `Ev.BossPhase` → `EntityView.shedArmour()` lässt die Platten als Teile-Partikel abfliegen.
  - Status-Partikel starten an zufälligen Körperteilen (`EntityView.bodyPoint()`, neuer Effekt `poisonDrip`).
  - Hastige Elites ziehen einen Funkenschweif (`hasteSpark`).
- **Elite-Darstellung** (`syncRigElite`): Glow-Farbe bzw. Puls über `RigInstance.setGlow()`. Der Schildbogen wird vor die Figur gesetzt.
- **Einstellungen v7:** `simpleGraphics` schaltet `EntityView.look` auf 'classic'.

## 36. Stand nach M4.3 (Icon-Set)
- **`view/render/icons/glyphs.ts`:** `GLYPHS` (Glyphen als SVG-Pfadteile mit Malart fill, stroke, core, hole), `FRAMES` (Rahmen pro Art) und `GLYPH_SCALE`.
- **`icon-svg.ts`:** `iconSvg(spec)` erzeugt eigenständiges SVG mit Glow-Filter. `iconUrl(spec)` liefert eine gecachte Data-URL.
- **`specs.ts`:** `boonIcon()`, `relicIcon()`, `spellIcon()`, `upgradeIcon()`, `statusIcon()` und `RARITY_COLORS`.
- **`rasterize.ts`:** `rasterizeIcons()` rastert beim Start (asynchron in `GameView.create`) auf 96 px. `bakeTextures()` bekommt die Zauber- und Status-Texturen übergeben; das alte Pixi-`drawGlyph` ist entfallen.
- **Content:** `iconSchema` (`{ glyph }`) ist Pflicht für Segen und Relikte; `glyphSchema` hat 29 Glyphen.
- **Oberfläche:** `Icon` und `CardTitle` in `view/ui/icons.tsx`; Klasse `.rb-icon`.

## 37. Stand nach M5.1 (begehbare Zuflucht)
- **ADR 0006:** Die Zuflucht ist ein Raum der Raum-Simulation (`hubRoomSetup()` in `sim/hub/hub.ts`).
- **Content:** `content/hub/layout.ts` (`REFUGE`, `defineHub`, Stationen mit Radius und optionaler Figur); Rigs `maren`, `nix` und `sel`.
- **Logik:** `nearestStation()`, `hubInteractPressed()` und `COMBAT_BUTTONS`, mit Tests für Reichweite, Überlappung, Kollision und Tasten.
- **App (`game.ts`):**
  - Modus `hub` ist jetzt ein Lauf-Modus: Die Simulation tickt, solange kein Stationsmenü offen ist (`hubMenu`).
  - `updateHubReach()` aktualisiert nach jedem Frame den Hinweis und öffnet die Station.
  - Beim Verlassen der Zuflucht ersetzt die Kulissen-Arena die Hub-Simulation.
- **Darstellung:**
  - `view/hub/hub-view.ts` (Figuren, Schilder, „…“, Ringe, Lagerfeuer, Wahrzeichen)
  - `GameView.render(…, hub)` blendet in der Zuflucht das Kampf-HUD aus
  - `TouchControlsView.sync(…, hub)` zeigt nur Joystick, Dash, Sprechen und Pause
- **Oberfläche:** Screens `hubWalk` (durchlässiges Overlay mit Währungen und Hinweis, zählt nicht als Menü) und `station`. Der alte Hub-Menübildschirm ist entfallen.
- **Musik:** Modus `refuge` (`REFUGE_LAYERS`).

## 38. Stand nach M5.2 (Portalhalle und Weltkarte)
- **Content:** `content/worlds/index.ts` mit `defineWorld` (`worldSchema`):
  - Biom-Daten (oder `null`, solange die Welt noch nicht gebaut ist)
  - Boss-Name, Freischaltung (`start` oder `boss` einer anderen Welt)
  - Position auf der Karte und Farbe
  - Die Biom-Dateien bleiben unter `content/biomes/`; eine Welt verweist auf ihr Biom. `worldBiome(id)` liefert das Biom für Map, Begegnungen und Rast.
- **Run:**
  - `RunState.worldId` ersetzt `biomeId`.
  - `RunState.duelsWon` sammelt die besiegten Duell-Champions (erster Gegner der Aufstellung, deterministisch aus dem Raum-Seed).
- **Profil:**
  - `Profile.worlds[worldId]` speichert Runs, Boss-Siege, Bestzeit und Mini-Bosse.
  - Freigeschaltete Welten werden nicht gespeichert, sondern aus den Boss-Siegen abgeleitet (`isWorldUnlocked`). So kann eine Freischaltung nie aus dem Takt geraten.
  - `LastRun` bekommt `worldId` und `unlockedWorlds` für den Ergebnis-Bildschirm.
- **Logik:** `sim/meta/worlds.ts` (`recordWorldRun`, `isWorldUnlocked`, `isWorldPlayable`, `defaultWorld`), aufgerufen aus `settleRun`.
- **Speicherstände:**
  - Run-Save **v9**: `worldId` statt `biomeId`, `duelsWon`. Alte Stände laufen in den Aschefeldern weiter.
  - Profil **v3**: Bisherige Runs und Siege zählen für die Aschefelder. Bestzeiten gab es noch nicht, sie bleiben leer.
- **Oberfläche:**
  - Screen `worldMap`: Karte mit Pfaden, Welt-Details (Sperre, Boss, Mini-Bosse, Bestzeit, Hinweis) und Aufbrechen bzw. Fortsetzen oder Aufgeben.
  - Der Ergebnis-Bildschirm nennt die Welt und neu geöffnete Welten.
- **Zuflucht:**
  - `hubRoomSetup(hub, 'portal')` setzt Vesper nach einem Run auf `portalArrival` vor dem Portal.
  - Sonst startet man wie bisher am Lagerfeuer.

## 39. Stand nach M5.3 (Wiederaufbau)
- **Content:**
  - `content/materials.ts` (`defineMaterial`, `MATERIAL_DROPS` als Tunables)
  - `content/hub/buildings.ts` (`defineBuilding` mit zwei Stufen, Kosten und Feature-Flags; `defineDecoration`)
  - Rigs `toll`, `iskra` und `archivist`, neue Sprecher und Dialogzeilen
- **Layout:**
  - Stationen `forge`, `map_table` und `archive`, jeweils mit eigenem Grundriss (`SITE_BUILDINGS` ab `SITE_OBSTACLE_START`).
  - Stationen tragen optional ein `building`.
- **Logik:**
  - `sim/meta/refuge.ts`: Kosten, Ausbau, `hasUnlock(flag)`, Bewohnt-Status, Wachstum 0..1, Dekorationen.
  - `rollRoomMaterials()` in `sim/run/economy.ts`, aufgerufen in `completeRoom` mit einem eigenen Strom aus dem Raum-Seed.
- **Speicherstände:**
  - Profil **v4**: `materials`, `buildings`, `decorations`, `LastRun.materials`.
  - Run-Save **v10**: `materials`.
  - `settleRun` legt die Funde immer ins Lager, auch bei Tod oder Aufgabe.
- **Darstellung:**
  - `HubView` bekommt pro Frame ein `RefugeLook` mit `version`.
  - Nur wenn sich die Version ändert, werden Gebäude, Pflanzen und Dekorationen in eine Graphics neu gezeichnet; pro Frame wird nichts neu gezeichnet.
  - Licht über den Bauplätzen: `softGlow`-Sprites mit Alpha je Stufe.
  - Figuren in Ruinen bleiben unsichtbar.
- **Oberfläche:** Screens `build` (Zustand, nächste Stufe, Kosten mit „du hast“) und `decorations`; Material-Chips in Währungszeile, Karten-Kopf und Ergebnis.

## 40. Stand nach M5.4 (Rüstungen)
- **Content:** `content/armor/index.ts`:
  - `defineArmor`: Slot, Set, Werte pro Stufe, Effekte, Kosten, `look`
  - `defineArmorSet`: 2er- und 4er-Bonus
  - Rig-Formen dürfen feste Farben haben (`rigColorRef`), damit Rüstung auf jedem Rig ihre Farbe behält.
- **Simulation:**
  - `compileBuild(…, armor)` kompiliert Teile nach Stufe und zählt Set-Teile.
  - `SimState.armor` und `RoomSetup.armor` kommen aus `RunMeta.armor`, das beim Run-Start aus `profile.equipped` geschnappschusst wird.
  - Spätere Änderungen in der Schmiede berühren einen laufenden Run nicht.
  - `createRun` wendet das Max-Leben der Rüstung sofort an.
- **Meta:** `sim/meta/forge.ts` (`canForge`, `forgeArmor`, `toggleEquip`, `equippedArmor`, `forgeMaxLevel`).
- **Speicherstände:**
  - Profil **v5**: `armor` (Teil → Stufe), `equipped`.
  - Run-Save **v11**: `meta.armor`.
- **Darstellung:**
  - `view/render/rig/armor-look.ts` erzeugt ein Vesper-Rig mit den Formen der Teile.
  - `GameView.setPlayerArmor()` backt es nur, wenn sich die Ausrüstung ändert, und gibt das alte frei.
  - `EntityView.setPlayerRig()` tauscht die Figur.
- **Simulator:** `pnpm sim --armor id:stufe,…` spielt mit Rüstung.

## 41. Stand nach M4.5 Schritt 1 (Stil-Prototyp)
- **ADR 0007.**
- **Daten:** `content/art/styles.ts` (`ART_STYLES`, `artStyleById`, `mixColor`).
- **Lesen beim Start:** `Game.start()` liest den Stil vor dem Erzeugen der View, setzt die Menü-Variablen (`applyUiTheme` in `platform/display.ts`) und übergibt ihn an `GameView.create()`.
- **Rigs:**
  - `view/render/rig/style-rig.ts` färbt um und macht aus Augenpunkten Augen.
  - `bakeRig(…, BakeLook)` backt Konturen (`drawOutline` unter allen Formen eines Teils) und skaliert die Leucht-Ringe.
  - Rig-Formen dürfen feste Farben haben.
- **Umgebung:**
  - `ArenaView(style)` zeichnet die Boden-Arten `cracks`, `meadow`, `doodles` und `watercolor` einmal pro Arena-Größe.
  - `RoomView(textures, style)` zeichnet abgerundete Hindernisse.
  - `EmberRain(texture, particles)` bewegt die Partikel je nach Art: Funken, Glühwürmchen, Blätter oder Lichtpunkte.
- **CSS:** Variablen `--rb-title`, `--rb-font` und `--rb-radius`, dazu Regeln pro `:root[data-style=…]`.

## 42. Stand nach M4.5 (Bilderbuch-Look)
- **Daten:** `content/art/style.ts` (`ART_STYLE`) ist die einzige Kunst-Richtung.
- **Palette:** `PALETTE.ink` ist die Tinte, `PALETTE.background` die dunkle Schattierung. Die Neon-Bodenfarben sind entfernt.
- **Rigs:**
  - `styleRig()` legt Augen als eigenes Teil `eyes` hinter den Kopf.
  - Neuer Bewegungskanal `blink`: `poseRig` skaliert das Teil periodisch, `restingRigMotion()` liefert die Ruhewerte für Teile, die im Code entstehen.
- **HUD:** Tintenrahmen als Sprites unter jeder Leiste (`syncInk`), Texte mit Kontur.
- **Zuflucht:** `HubView` zeichnet alle Wahrzeichen, Gebäude, Pflanzen und Dekorationen gefüllt mit Tintenkontur, weiterhin nur bei Änderungen.
- **Freude:** `EntityView.celebrate()` wird von `feedback.ts` bei `Ev.RoomCleared` ausgelöst.
- **Bodenpartikel** werden normal statt additiv gemischt.

## 43. Stand nach M5.5 (Wochenmarkt)
- **Content:** `content/hub/market.ts` (`TRADES` mit `defineTrade`, `COSMETICS` mit `defineCosmetic`, `MARKET` als Tunables).
- **Logik:** `sim/meta/market.ts`.
  - `weeklyOffer(week)` ist deterministisch: Seed-RNG aus `hashString('market:…:' + week)`.
  - `syncMarketWeek` setzt die Käufe zu Wochenbeginn zurück.
  - Dazu `trade`, `buyCosmetic`, `wearCape` und `capeColor`.
- **Woche:** `currentWeekIndex()` und `daysUntilNextWeek()` in `platform/display.ts`; die Simulation bleibt frei von Datum und Uhrzeit.
- **Darstellung:** `GameView.setPlayerLook(armor, cape)` ersetzt `setPlayerArmor` und backt Rüstung und Umhangfarbe in ein Vesper-Rig.
- **Profil v6.**

## 44. Stand nach M5.6 (Quests)
- **Content:** `content/quests/index.ts` (`defineQuest`: Art, Auftraggeber, Voraussetzungen, Ziele, Belohnung). Texte unter `quest.<id>.name/desc/offer/done`.
- **Logik:** `sim/meta/quests.ts`, rein und deterministisch.
  - `questStatus`, `questFrom`: Story vor Auftrag, Aufträge rotieren.
  - `acceptQuest`, `claimQuest`: Abgaben werden abgezogen, Belohnungen samt Zauber und Flags vergeben.
  - `applyRunToQuests` wird von `settleRun` aufgerufen.
  - `liveProgress` liefert die Zahlen für HUD und Karte.
  - `questItemToFind` vergibt Fundstücke in Ereignis-Räumen.
  - `questNodeTypes` bestimmt, wo der ★ auf der Karte steht.
- **Simulation:** `SimState.statusKills` zählt Spieler-Kills pro Status in `killEnemy`; eingefroren zählt als unterkühlt.
- **Run:** `RoomResult.statusKills` und `flawless` landen in `RunState.tally`.
- **Speicherstände:** Profil v7, Run-Save v12.

## 45. Stand nach M5.7 und M6.0a (Story im Spiel, Rätsel-Räume)
- **Szenen:** siehe §25, Abschnitt „Szenen“ (`content/story/scenes.ts`, `view/ui/scene-screen.tsx`).
- **Rätsel (ADR 0008):**
  - Content: `content/puzzles/index.ts` (`definePuzzle`: Raum, Teile, Ziel-Gruppe, Welten) und `content/puzzles/tuning.ts` (`PUZZLE_TUNING`, im Debug-Menü).
  - Simulation: `sim/puzzle.ts` (`loadPuzzle`, `puzzleSystem` nach den Geschossen, `puzzleMelee`, `puzzleShot`, `resetPuzzle`).
  - `RoomState.puzzle`, `staticRectCount` und `staticCircleCount`. Die Grenzen stehen jetzt bei 64 Rechtecken und 64 Kreisen.
  - Neue Ereignisse: `Ev.PieceChanged`, `PuzzleFail`, `PuzzleSolved`, `PuzzleFall`, `PuzzleHint`, `PuzzleReset`, `GateChanged`, `BlockPushed` (`PieceCode`).
- **Run:**
  - Knotentyp `puzzle` (Biom: `typeWeights.puzzle`, `puzzleMinLayer`, `maxPuzzles`).
  - `puzzleFor()` wählt ohne Wiederholung im Run.
  - Belohnung: Relikt, 1–2 Materialien, Scherben wie ein Kampf.
  - Der Bot bucht Rätsel als gelöst nach 45 s.
- **Darstellung:** `view/render/puzzle-view.ts`.
  - Abgründe, Platten, Runen, Schalen und Torpfosten werden einmal pro Raum gezeichnet.
  - Flammen, Kristalle, Blöcke, Leuchten und Gitter sind Sprites bzw. vorgebaute Formen, deren Werte sich pro Frame ändern.
  - `RoomView` zeichnet nur die festen Hindernisse.
  - HUD: `onHint(name, text)` zeigt Iskras Sprechkasten.
- **Debug:** Abschnitt „Puzzles“ lädt jedes Rätsel einzeln.
- **Speicherstand:** Run-Save **v13** (Knotentyp `puzzle`).

## 46. Stand nach M6.0b (Raum-Netz)
- **ADR 0009.**
- **Generator:** `sim/run/net.ts` (`generateNet`).
  - Wachsender Baum auf einem Raster; ein Boss-Flügel (Wächter mit genau zwei Türen, Boss als Sackgasse) wird hinter dem fernsten Raum angehängt.
  - Danach Schleifen außerhalb des Flügels.
  - Eine verschlossene Tür vor dem Wächter; Rätsel und Schatz in Sackgassen; Rast in der Mitte; Shop; Elite ab Abstand 3.
  - `layer` ist der Abstand vom Eingang und bestimmt die Stärke der Kämpfe.
- **Daten:** `MapNode.gx/gy/doors/locked`, `RunMap.layout = 'net'`, `RunState.net` (`keys`, `entryDir`, `cleared`). Biom: `net` (Größe, Rätsel, Schleifen, Elite-Chance, Shop). `DEFAULT_NET` für den Debug-Netz-Run.
- **Raum:** `netRoomSetup()` baut Türen an den Kantenmitten (`doorSpot`), dreht Rätsel (`rotatePuzzle`) zur Tür und setzt `calm` für Räume ohne Kampf bzw. besiegte Räume (gelten sofort als geschafft, ohne Raum-Effekte).
- **Simulation:**
  - `RoomState.door*`, `keys`, `keysUsed`, `exitDoor`, `doorsAlwaysOpen` (Rätsel).
  - `doorSystem` statt Portal: Eine Tür zählt erst, wenn der Spieler sich einmal entfernt hat.
  - Verschlossene Türen kosten einen Schlüssel (`Ev.DoorUnlocked`) oder melden `Ev.DoorLocked`.
  - Der Spieler erscheint 120 px hinter der Eingangstür.
- **Ablauf (`game.ts`):**
  - `arriveNet()` zeigt beim ersten Besuch den Bildschirm des Raums (Rast, Shop, Ereignis, Altar, Schatz), sonst den begehbaren Raum.
  - `finishNetRoom()` bucht einen frischen Sieg wie `finishRoom` mit Belohnung, sonst `leaveRoom()`. Danach führt `showMap()` durch die gemerkte Tür (`pendingDoor`).
- **Darstellung:** `RoomView` zeichnet Torbögen mit Gitter, Vorhängeschloss und Leuchten. HUD `setMinimap()` zeichnet nur bei Raumwechsel neu.
- **Bot und Simulator:** `playNet` erkundet nächstgelegene offene Räume zuerst, den Boss-Flügel zuletzt. `pnpm sim --net`.

## 47. Risiken und Gegenmaßnahmen
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
