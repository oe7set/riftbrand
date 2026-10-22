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

## Steuerung (Stand M0)
| | Tastatur/Maus | Gamepad | Touch |
|---|---|---|---|
| Bewegen | WASD / Pfeiltasten | linker Stick | Joystick (linke Hälfte) |
| Zielen | Maus | rechter Stick | vom Angriffs-Button ziehen |
| Pause | Esc / Tab | Start | Pause-Symbol |
| Debug-Menü | ` oder F2 | Select | Drei-Finger-Tipp |
