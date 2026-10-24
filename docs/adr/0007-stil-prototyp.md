# ADR 0007: Stil-Prototyp mit umschaltbaren Kunst-Richtungen

**Status:** angenommen (2026-10-24), Prototyp für M4.5; abgeschlossen: Der PO wählte das Bilderbuch.
**Kontext:**
- Der PO wünscht eine viel freundlichere Stimmung (ROADMAP E15).
- Stimmung lässt sich schlecht beschreiben, besser zeigen: Drei Richtungen sollen in derselben Szene auf dem Handy vergleichbar sein.

## Entscheidung
1. **Stile sind Daten** (`src/content/art/styles.ts`):
   - Hintergrund, Boden-Art und -Farben, Hindernisse
   - Rig-Farben (feste Farben für Vesper, Mischung für alle anderen)
   - Konturen, Stärke des Leuchtens, Augen
   - Bloom, Umgebungs-Partikel und Menü-Farben mit Schrift
2. **Ein Stil ist reine Darstellung.** Die Simulation kennt ihn nicht; der Determinismus bleibt unberührt.
3. **Alles wird beim Start einmal gebacken** (Rigs mit `styleRig()` und `BakeLook`, Boden in `ArenaView`). Ein Stilwechsel lädt das Spiel neu, statt alle Texturen zur Laufzeit neu zu backen. Für einen Prototyp ist das einfacher und verbraucht keinen zusätzlichen Speicher.
4. **Einstellung `artStyle`** (Settings v8, Standard `neon`) im Pause-Menü.
5. **Schriften** kommen als npm-Pakete (`@fontsource/nunito`, `@fontsource/baloo-2`, `@fontsource/quicksand`, je nur das lateinische Subset in 1–2 Stärken). Sie liegen im Bundle und im PWA-Cache, damit sie offline funktionieren. Google Fonts zur Laufzeit scheidet aus (offline, Datenschutz).

## Folgen
- Nach der Wahl des PO (M4.5 Schritt 2) bleibt das Stil-System bestehen. Die nicht gewählten Stile werden entfernt, wenn sie keinen Mehrwert mehr haben, zusammen mit den Schriften, die nur sie brauchen.
- Noch nicht gestylt: HUD, Hub-Wahrzeichen, Effekte und Icons. Sie folgen im Umbau.

## Nachtrag (Schritt 2)
- Der PO wählte **B · Bilderbuch**.
- Die Stil-Daten bleiben (`content/art/style.ts`, ein Stil). Die Einstellung `artStyle` und der Neustart beim Wechsel sind entfallen (Settings v9).
- Nunito und Quicksand sind entfernt.
