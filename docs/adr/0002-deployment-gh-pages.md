# ADR 0002: Deployment über den `gh-pages`-Branch mit Testversionen pro Branch

- **Status:** angenommen
- **Datum:** 2026-10-22
- **Kontext:** M0, TECH_DESIGN §15

## Kontext
Der Product Owner testet vor allem auf dem Handy. Jede Änderung soll vor dem Merge unter einer eigenen URL spielbar sein. `actions/deploy-pages` veröffentlicht immer die ganze Seite als ein Artefakt und kann keine parallelen Testversionen für Branches neben der Hauptversion halten.

## Entscheidung
- `.github/workflows/deploy.yml` baut bei jedem Push und schreibt mit `scripts/publish-pages.sh` in den Branch `gh-pages`:
  - `main` → Wurzelverzeichnis (`/riftbrand/`). Dabei wird alles außer `dev/` ersetzt.
  - jeder andere Branch → `dev/<branch-slug>/` (`/riftbrand/dev/<slug>/`)
  - Branch gelöscht → `dev/<slug>/` wird entfernt.
- Alle Schreibvorgänge laufen über eine gemeinsame `concurrency`-Gruppe und damit nacheinander.
- Der **Service Worker** (PWA) wird nur im `main`-Build erzeugt. Sein Navigations-Fallback schließt `/dev/` aus. Er hat kein Laufzeit-Caching, sodass Anfragen von Testversionen ungestört ans Netz gehen.
- Einmalige manuelle Einstellung: *Settings → Pages → Source: Deploy from a branch → `gh-pages` / root*.

## Konsequenzen
- Der Branch `gh-pages` wächst mit jedem Deploy. Bei Bedarf kann er mit einem einzelnen frischen Commit neu angelegt werden.
- Alte Assets mit Hash im Namen werden im Wurzelverzeichnis bei jedem `main`-Deploy entfernt, in `dev/<slug>/` bei jedem Branch-Deploy.
- Testversionen sind öffentlich erreichbar, wie das Repository selbst.
