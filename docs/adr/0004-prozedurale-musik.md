# ADR 0004: Prozedurale Musik statt Audiodateien

- **Status:** angenommen (vorläufig für den Vertical Slice)
- **Datum:** 2026-10-23
- **Kontext:** M2.7, GDD §12.2, TECH_DESIGN §10

## Kontext
Das GDD sieht freie Musik (CC0/CC-BY) in Schichten vor. Für den Vertical Slice sollte es schnell Musik mit Schichten (Erkundung, Kampf, Boss) geben. Fremde Audiodateien bringen Lizenz-Prüfung, Download-Größe und Ladezeit mit. Der vorhandene Synthesizer für Soundeffekte kann bereits Klänge offline rendern.

## Entscheidung
- Die Musik ist **Daten** (`content/audio/music.ts`): Tracks mit Tempo, Taktzahl und Ebenen; jede Ebene hat ein Instrument (eine Synth-Schicht ohne Tonhöhe) und Noten auf einem 16tel-Raster.
- `platform/audio/music-render.ts` rendert jede Ebene **einmal** als nahtlose Schleife (Ausklänge laufen über das Ende hinaus an den Anfang) mit 22 050 Hz. Das Rendern ist rein und getestet.
- `MusicPlayer` rendert nach der Audio-Freischaltung eine Ebene pro Zeitscheibe (kein Ruckler) und startet alle Ebenen eines Tracks synchron. Lautstärken werden je nach Spielzustand überblendet: Erkundung (Pad, Arpeggio), Kampf (+ Bass, Schlagzeug), Boss (eigener Track). Wichtige Sounds ducken die Musik kurz.

## Konsequenzen
- Keine Audiodateien, keine Lizenzfragen, kein zusätzlicher Download. Der Speicher bleibt klein (ca. 8 MB Float-Puffer).
- Der Klang ist auf den Synthesizer begrenzt. Für die Beta kann echte Musik (CC0/CC-BY oder Auftrag) die Daten ersetzen: Der `MusicPlayer` mit Schichten und Überblendung bleibt, nur die Puffer kämen aus Dateien.
- Komposition passiert im Code, Änderungen sind diff-bar und testbar.
