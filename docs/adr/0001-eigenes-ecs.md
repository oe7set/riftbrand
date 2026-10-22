# ADR 0001: Eigenes minimales ECS statt bitECS

- **Status:** angenommen
- **Datum:** 2026-10-22
- **Kontext:** M0, TECH_DESIGN §6

## Kontext
Die Simulation braucht ein ECS, das bei 300+ Gegnern im Budget bleibt (Simulation ≤ 4 ms pro Tick auf Mittelklasse-Geräten), deterministisch iteriert und sich leicht serialisieren und hashen lässt. Zur Wahl standen **bitECS 0.4** und ein **eigenes minimales ECS** (Bitmaske pro Entity, Komponenten als Struct-of-Arrays in Typed Arrays).

## Messung
`pnpm bench:ecs` (`scripts/ecs-bench.ts`): Wander-KI, Bewegung und Separation über dasselbe räumliche Hash-Gitter, 2000 gemessene Ticks nach 300 Aufwärm-Ticks. Node 22, Cloud-Container (Desktop-CPU):

| Entities | eigenes ECS (ms/Tick) | bitECS (ms/Tick) |
|---:|---:|---:|
| 300 | 0,062 | 0,047 |
| 500 | 0,159 | 0,120 |
| 1000 | 0,316 | 0,205 |

Das eigene ECS läuft dabei die vollständige `stepSim`-Pipeline (inklusive Spieler-System, Kopieren der Vorher-Positionen, Bestimmung des maximalen Radius). Der bitECS-Durchlauf ist etwas schlanker, der Vergleich ist also leicht zugunsten von bitECS verzerrt.

## Entscheidung
**Eigenes minimales ECS** (`src/sim/ecs/`).

## Begründung
- Beide Varianten liegen um mehr als den Faktor 10 unter dem Budget. Selbst bei 4- bis 5-fach langsamerer Mobile-CPU bleiben 500 Entities unter 1 ms. Der Geschwindigkeitsvorteil von bitECS (~30 %) ist für uns nicht entscheidend.
- **Determinismus ist offensichtlich:** Iteration immer in aufsteigender Entity-ID, die Freigabeliste ist LIFO. Bei bitECS hängt die Reihenfolge von Abfragen von internen Sparse-Set-Vertauschungen ab. Das ist zwar ebenfalls deterministisch, aber schwerer nachvollziehbar.
- **Speichern, Hashen, Replays:** Der gesamte Zustand liegt in wenigen Typed Arrays. Er lässt sich direkt hashen (`sim/hash.ts`) und später serialisieren.
- **Keine Laufzeitabhängigkeit** in der Simulation, volle Kontrolle über Kapazität und Speicherverhalten (feste Kapazität, keine Allokationen pro Tick).
- Die API ist klein (ca. 80 Zeilen) und passt auf eine Bildschirmseite.

## Konsequenzen
- Die Kapazität ist fest (`MAX_ENTITIES = 4096`). `createEntity` gibt bei Überlauf `-1` zurück, und Spawner müssen das behandeln.
- Maximal 31 Komponenten-Bits (Bit 31 ist `ALIVE_BIT`). Wird das knapp, kommt eine zweite Maske dazu.
- Abfragen laufen linear über `[0, highWater)`. Werden Systeme bei großer Kapazität und wenigen Treffern zu langsam, ergänzen wir gecachte Abfragelisten.
- bitECS bleibt nur als devDependency für den Benchmark erhalten, damit die Messung reproduzierbar ist.
