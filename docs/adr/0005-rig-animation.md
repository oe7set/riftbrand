# ADR 0005: Rig-Animation mit Teile-Sprites statt Sprite-Sheets

- **Status:** vorgeschlagen (Prototyp M4.1, wartet auf die PO-Entscheidung)
- **Datum:** 2026-10-23
- **Kontext:** ROADMAP M4 (E8), TECH_DESIGN §8 und §16

## Kontext
Figuren sollen Körper mit Animation bekommen und dabei im Neon-Vektor-Stil bleiben. Möglich sind:
1. Sprite-Sheets (Einzelbilder pro Animation),
2. Skelett-Animation mit externem Werkzeug (Spine, DragonBones),
3. eigene Rigs aus prozedural gezeichneten Teilen.

Sprite-Sheets brauchen Zeichnungen für jede Richtung und jede Animation und werden schnell groß. Spine bringt Lizenzkosten, ein Werkzeug außerhalb des Repos und eine weitere Laufzeit-Bibliothek. Alles andere im Spiel (Gegner, Icons, Effekte) ist bereits prozedurale Vektorgrafik.

## Entscheidung
- **Rigs sind Content** (`src/content/rigs/`, `defineRig()` mit Zod-Schema):
  - Teile mit Gelenk, Eltern-Teil, Zeichenreihenfolge (`z`) und Formen (Ellipse, Polygon, Linie) in Rig-Einheiten (1 = Kollisionsradius)
  - drei Farben (Körper, Akzent, Kern)
  - pro Teil, wie es auf die Kanäle reagiert: Laufen, Atmen, Ausholen, Zuschlagen, Zaubern, Nachziehen, Flattern
- **Backen:** Jedes Teil wird beim Start **einmal** in eine Textur gebacken (`view/render/rig/bake-rig.ts`), dazu eine weiße Silhouette für den Treffer-Blitz und die ganze Figur als Silhouette für das Dash-Nachbild.
- **Animation:** `poseRig()` (`view/render/rig/animate.ts`) ist rein, testbar und allokationsfrei. Es rechnet aus wenigen Eingaben die Welt-Transformation jedes Teils. Die Eingaben (Tempo, Angriffsphase, Zielrichtung, Treffer) liest die `EntityView` nur aus dem Simulationszustand.
- **Seitenansicht:** Figuren stehen aufrecht und werden je nach Blickrichtung gespiegelt; der Waffenarm folgt dem Zielwinkel. Die Hitboxen bleiben Kreise am Boden.
- Der klassische Look bleibt erhalten und lässt sich im Debug-Menü umschalten. Gegner ohne Rig nutzen ihn automatisch.

## Konsequenzen
- Neue Figuren sind Daten-Dateien ohne neuen Systemcode. Animationen entstehen aus wenigen Parametern statt aus Einzelbildern.
- **Kosten** (Messung M4.1, 40 Schlacken, Swiftshader im Container):
  - Render-CPU-Zeit pro Frame bei CPU ×4: ca. 4,3 ms statt 2,7 ms (Budget 8 ms)
  - ohne Drosselung: ca. 1,5 ms statt 0,95 ms
- Grenzen: keine echten Verformungen (Mesh-Skinning) und keine 8 Richtungen. Für den Neon-Stil reicht das; bei Bedarf kann ein Teil später ein eigenes Mesh bekommen.
