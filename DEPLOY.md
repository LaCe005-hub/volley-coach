# Deploy

- Art: statische Seite (reines HTML/JS/CSS, kein Build-Schritt, kein Backend)
- Hosting: **GitHub Pages** (nicht der Workshop-Server — der war beim Veröffentlichen nicht erreichbar, nur im lokalen Netz des Workshop-Orts)
- Build: keiner nötig       Start: keiner nötig       Port: –
- Umgebungsvariablen: keine
- Dauerhafte Daten: keine auf dem Server — alles bleibt im `localStorage` des jeweiligen Browsers/Geräts
- Lebenszeichen: `GET /` liefert `index.html`
- Adresse: **https://lace005-hub.github.io/volley-coach/**
- Repo-Sichtbarkeit: **öffentlich** (bewusste Entscheidung des Nutzers — nötig, damit GitHub Pages auf dem kostenlosen Plan funktioniert; die veröffentlichte Seite hat `noindex`, ist also nicht für Suchmaschinen gedacht)
- Freigabe-Status: **mit Auflage akzeptiert** — ein Blocker (`X-Content-Type-Options`-Header fehlt, Plattform-Grenze von GitHub Pages) wurde vom Nutzer bewusst akzeptiert. Details: `10_Weitermachen/freigabe/freigabe_2026-10-16.md`

## Hinweis für den nächsten Agenten

Jeder `git push` auf `main` baut die Seite über GitHub Pages automatisch neu (kein manueller Schritt nötig).
Falls später doch auf den Workshop-Server umgezogen werden soll: `WS einrichten` + `WS veroeffentlichen`
laut `werkbank:online-stellen`-Skill, sobald das lokale Netz des Workshop-Orts erreichbar ist.
