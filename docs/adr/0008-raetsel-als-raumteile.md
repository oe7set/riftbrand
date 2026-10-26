# ADR 0008: Rätsel-Teile liegen als flache Arrays am Raum, nicht als Entities

- **Status:** angenommen
- **Datum:** 2026-10-26
- **Kontext:** ROADMAP M6.0, GDD §6.1

## Kontext
Rätsel-Räume brauchen Feuerschalen, Kristalle, Druckplatten, Runen, Schiebeblöcke, Tore, Abgründe und Rücksetzsteine. Die ROADMAP schlug vor, sie als Entities mit Komponenten zu bauen. Zur Wahl standen:
1. Entities im ECS mit neuen Komponenten,
2. ein eigener, kleiner Zustand am Raum (`RoomState.puzzle`) mit flachen, typisierten Arrays.

## Entscheidung
- **Zustand am Raum:** `sim/puzzle.ts` mit `PuzzleState`.
  - Typisierte Arrays pro Teil: Art, Gruppe, Reihenfolge, aktiv, Position, Halte-Timer.
  - Dazu Gruppen-Zustände und Fortschritt der Reihenfolge.
  - Pro Raum wird einmal angelegt. Pro Tick wird nichts alloziert.
- **Gruppen statt Verdrahtung:**
  - Eine Gruppe ist aktiv, wenn alle ihre Teile aktiv sind.
  - Tore stehen offen, solange ihre Gruppe aktiv ist.
  - Das Rätsel ist gelöst, wenn die Ziel-Gruppe aktiv ist. Ab dann bleiben die Tore dieser Gruppe offen.
  - Teile mit `order` müssen in dieser Reihenfolge kommen. Sonst erlischt die ganze Gruppe, der Fehler wird gezählt und `Ev.PuzzleFail` gemeldet.
- **Kollision ohne neuen Code:**
  - Geschlossene Tore und Blöcke schreibt das System jeden Tick hinter die festen Hindernisse in die Rechteck-Liste des Raums (`staticRectCount`).
  - Schalen, Kristalle und Rücksetzsteine kommen beim Laden einmal als feste Kreise dazu.
  - Bewegung, Geschosse und Gegner-Kollision bleiben unverändert.
- **Treffer:**
  - `puzzleMelee` hängt an `meleeSweep`, einmal pro Schwung und Teil.
  - `puzzleShot` hängt an den Spieler-Geschossen.
- **Abgründe:**
  - Wer ohne Dash hineinläuft, fällt und landet wieder auf dem letzten sicheren Boden.
  - Der Sturz kostet `fallDamage`, aber nie das letzte Leben.
- **Ausgang:** Rätsel-Räume übergehen das Wellen-System. `clearRoom` öffnet den Ausgang beim Lösen.

## Konsequenzen
- Die Teile sind wenige (höchstens 32) und fest pro Raum. Ein eigener Zustand ist kürzer, schneller und leichter zu testen als neue Komponenten für jede Entity.
- Determinismus: Der Zustand geht in `hashSim` ein. Ein Test spielt jedes Rätsel mit echten Eingaben durch, der „Solver“: Schreiten, Schlagen, Schießen, Dash, Schieben.
- Grenze: Gegner kennen Abgründe und Tore nur als Hindernisse bzw. gar nicht. Für Rätsel mit Wächtern (M6.0b) müssen Gegner Abgründe meiden lernen.
