# ADR 0003: Profil in IndexedDB mit Backup-Slot und Speicher-Code

- **Status:** angenommen
- **Datum:** 2026-10-23
- **Kontext:** M2.6, TECH_DESIGN §11

## Kontext
Der Meta-Fortschritt (Glut, Rissstaub, Glutbaum, Freischaltungen, Dialoge) ist das Wertvollste, was ein Spieler im Spiel besitzt. Einstellungen und der laufende Run liegen bisher in `localStorage`. Der lässt sich zwar einfach ansprechen, kann aber keine atomaren Schreibvorgänge über mehrere Schlüssel und hat ein kleines Kontingent. Auf Mobilgeräten kann der Browser Daten unter Speicherdruck verwerfen.

## Entscheidung
- Das **Profil** liegt in **IndexedDB** (Datenbank `riftbrand`, Store `kv`). Falls IndexedDB blockiert ist, wird automatisch `localStorage` verwendet.
- Jeder Speichervorgang schreibt in **einer Transaktion** den neuen Stand (`profile`) und den vorherigen guten Stand (`profile.backup`). Beim Laden gilt: zuerst das Profil, bei Fehlern das Backup, sonst ein frisches Profil. Kaputte Daten führen nie zum Absturz.
- Das Schema ist versioniert (`PROFILE_VERSION`) und wird mit Zod geprüft. Migrationen folgen dem Muster des Run-Speicherstands (vN → vN+1, mit Tests).
- `navigator.storage.persist()` wird beim Start angefragt.
- **Export und Import** laufen über einen Text-Code: `RB1.<Prüfsumme>.<Base64(deflate(JSON))>`. Die Prüfsumme (FNV-1a über das JSON) erkennt Tippfehler und abgeschnittene Codes, schützt aber nicht vor Manipulation. Das ist für ein Einzelspieler-Spiel ausreichend. Ohne `CompressionStream` wird `RB0.` mit unkomprimiertem Base64 verwendet.
- Einstellungen und der Run-Zwischenstand bleiben in `localStorage`. Sie sind klein und werden synchron beim Start gebraucht.

## Konsequenzen
- Das Profil wird asynchron geladen. `Game.start` wartet darauf, bevor der Titel erscheint.
- Profil-Logik (`sim/meta/`) ist rein und vollständig testbar. Nur das Speichern liegt in `platform/storage/`.
- Ein Speicher-Code ist gerätunabhängig. Der Spieler kann damit vom Handy zum Desktop wechseln oder eine Sicherung behalten.
