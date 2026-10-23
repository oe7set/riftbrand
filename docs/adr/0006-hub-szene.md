# ADR 0006: Die begehbare Zuflucht nutzt die Raum-Simulation

- **Status:** angenommen
- **Datum:** 2026-10-23
- **Kontext:** ROADMAP M5.1, GDD §2.3

## Kontext
Die Zuflucht soll begehbar werden: Bewegung und Dash wie im Kampf, Kollision mit Gebäuden, eine Kamera, die folgt, und Figuren, die man anspricht. Zur Wahl standen:
1. eine eigene, kleine Hub-Simulation,
2. die bestehende Raum-Simulation ohne Kampf.

## Entscheidung
- Die Zuflucht ist ein Raum der bestehenden Simulation (`createSim` mit `hubRoomSetup()` aus `sim/hub/hub.ts`):
  - keine Begegnung (`encounter: none`)
  - keine Zauber
  - Gebäude als Hindernisse
  - Der Raumausgang öffnet sofort und dient als Portalhalle.
- **Layout als Daten:** `content/hub/layout.ts` (`defineHub`, Zod) mit Stationen (Maren, Nix, Sel, Portal, Lagerfeuer), Figuren-Rigs und Interaktionsradien.
- **Logik:**
  - `nearestStation()` findet die Station in Reichweite. Die Funktion ist rein und getestet.
  - Die App entfernt die Kampftasten aus der Eingabe (`COMBAT_BUTTONS`).
  - Angriff und Interagieren öffnen die Station in Reichweite (`hubInteractPressed()`).
- **Darstellung:** `view/hub/hub-view.ts` zeichnet Figuren (Rigs aus M4 mit Idle, zu Vesper gewandt), Namensschilder, Sprechblasen-Hinweise, Stationsringe, das Lagerfeuer und die Wahrzeichen (Glutbaum, Stand, Turm, Portalbogen). Spieler, Boden und Hindernisse zeichnen die bestehenden Ansichten.
- **Menüs:** Die bestehenden Preact-Menüs (Glutbaum, Relikte, Runenturm, Profil) öffnen sich als Overlay an der Station; „Zurück“ führt zurück ins Laufen.

## Konsequenzen
- Bewegung, Dash, Kollision und Kamera fühlen sich garantiert gleich an wie im Kampf, ohne doppelten Code.
- Die Simulation lernt nichts Neues; der Determinismus bleibt unberührt.
- Grenzen: Hindernisse sind nur Kreise und Rechtecke, Wege oder Höhen gibt es nicht. Für Wiederaufbau (M5.3) reichen Bauplätze als Stationen mit wechselnden Hindernissen.
