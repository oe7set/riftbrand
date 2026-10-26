# ADR 0009: Das Raum-Netz nutzt die Knoten der Run-Karte

- **Status:** angenommen
- **Datum:** 2026-10-26
- **Kontext:** ROADMAP M6.0b, PO-Wunsch E16 (Welten aus kleinen Räumen wie in Cult of the Lamb)

## Kontext
Neben der Pfad-Karte (Ebenen, man wählt den nächsten Knoten) soll es Welten aus verbundenen Räumen geben, in denen man frei hin und her läuft, Schlüssel findet und Türen öffnet. Zur Wahl standen:
1. eine eigene Struktur für Netze mit eigenem Speicherformat und eigenem Ablauf,
2. die vorhandenen Karten-Knoten (`MapNode`) um Raster, Türen und Schlösser erweitern.

## Entscheidung
- **Knoten bleiben Knoten:**
  - Ein Netz ist eine `RunMap` mit `layout: 'net'`. Jeder Raum ist ein `MapNode` mit Rasterzelle, Tür-Nachbarn (N, O, S, W) und Schloss-Bits.
  - `layer` ist der Abstand vom Eingang.
  - Begegnungen, Belohnungen, Materialien, Quests, Szenen und der Bot funktionieren damit ohne Sonderwege.
- **Fortschritt:** `RunState.net` hält Schlüssel, die Eingangstür und besiegte Räume. Alles andere wird wie bisher aus dem Seed abgeleitet.
- **Türen in der Simulation:**
  - Bis zu vier Türen pro Raum ersetzen das Portal.
  - Sie öffnen sich, wenn der Raum geschafft ist; in Rätsel-Räumen sind sie immer offen.
  - Verschlossene Türen kosten einen Schlüssel, den die Simulation zählt und die App ins Run-State übernimmt.
- **Ablauf:**
  - Keine Karten-Ansicht: Beim Verlassen durch eine Tür bucht die App den Raum (Sieg mit Belohnung oder nur Weitergehen) und betritt den Nachbarn.
  - Die Minikarte im HUD ersetzt den Kartenbildschirm.

## Konsequenzen
- Wenig neuer Code und ein Speicherformat für beide Arten. Alte Speicherstände bleiben gültig (die neuen Felder sind optional, v14).
- Die Pfad-Karte bleibt unverändert, bis auf die Weiterleitung `run.net → finishNetRoom`.
- Grenzen:
  - Räume sind quadratisch, damit Rätsel sich zur Tür drehen lassen.
  - Einbahn-Abkürzungen und Räume, die über mehrere Zellen gehen, brauchen später eigene Tür-Arten.
