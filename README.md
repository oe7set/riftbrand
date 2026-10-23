# Riftbrand

*Der Brand hat die Welt zerrissen. Du trägst sein Mal.*

2D-Action-Roguelike für den Browser: mobile-first (Touch), aber auch mit Tastatur/Maus und Gamepad spielbar. Neon-Vektor-Look, TypeScript, PixiJS v8, deterministischer Simulationskern.

- **Spielen:** https://oe7set.github.io/riftbrand/ (Testversionen von Branches: `/riftbrand/dev/<branch>/`)
- **Design und Planung:** [GDD](docs/GDD.md) · [Technisches Design](docs/TECH_DESIGN.md) · [Roadmap](docs/ROADMAP.md) · [ADRs](docs/adr/)
- **Regeln für Mitwirkende (auch für Claude):** [CLAUDE.md](CLAUDE.md)

## Lokal starten
```
pnpm install
pnpm dev        # http://localhost:5173 und im LAN fürs Handy
pnpm test
```

## Spielablauf (Stand M2.7)
Titel → **Zur Zuflucht** (Glutbaum, Nix' Waren, Speicher-Code) → **Aufbrechen** → Map (Pfad wählen) → Raum (alle Wellen schaffen, dann in das Portal laufen) → Map … → Glutwächter → Ergebnis → Zuflucht. Der Run wird beim Betreten jedes Knotens gespeichert, das Profil (Meta-Fortschritt) in IndexedDB. **Arena (endlos)** auf dem Titel ist der Tuning-Modus aus M1. `?seed=123` startet direkt die Arena.

## Steuerung (Stand M2.7)
| | Tastatur/Maus | Gamepad | Touch |
|---|---|---|---|
| Bewegen | WASD / Pfeiltasten | linker Stick | Joystick (linke Hälfte) |
| Zielen | Maus | rechter Stick | vom Angriffs-Button ziehen |
| Angriff (halten = Combo) | Linksklick / J | X / □ | Schwert-Button |
| Glutwirbel (Spezial) | Rechtsklick / K | Y / △ | Spiral-Button |
| Dash | Leertaste / Shift | A / ✕ | Doppelpfeil-Button |
| Riss-Geschoss (Wurf) | Q / L | B / ○ | Rauten-Button (ziehen zielt, loslassen wirft) |
| Brandausbruch (Ultimate) | R | RT / R2 | Stern-Button |
| Pause | Esc / Tab | Start | Pause-Symbol |
| Debug-Menü | ` oder F2 | Select | Drei-Finger-Tipp |

## Headless-Simulator
```
pnpm sim --runs 200 --seed-start 1 --bot balanced   # oder --bot aggressive, --fresh, --csv
```
Bots spielen ganze Runs ohne Grafik und geben Siegquote, Raum- und Bosszeiten, Todesursachen, Schaden pro Gegner sowie Pick- und Siegquoten pro Segen bzw. Relikt aus. Die Ergebnisse landen zusätzlich als JSON in `sim-results/`.

## itch.io
Der Workflow `.github/workflows/itch.yml` lädt den Web-Build mit butler hoch (manuell über *Actions → itch.io → Run workflow* oder bei einem Tag `v*`). Voraussetzung: das Secret `BUTLER_API_KEY` und die Variable `ITCH_TARGET` (z. B. `name/riftbrand`) in den Repository-Einstellungen. Ob die Seite versteckt oder öffentlich ist, stellst du auf itch.io ein.
