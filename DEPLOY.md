# Deploy

- Art: statische Seite (reines HTML/JS/CSS, kein Build-Schritt, kein Backend)
- Hosting: **GitHub Pages** (nicht der Workshop-Server — der war beim Veröffentlichen nicht erreichbar, nur im lokalen Netz des Workshop-Orts)
- Build: keiner nötig       Start: keiner nötig       Port: –
- Umgebungsvariablen: keine
- Dauerhafte Daten: keine auf dem Server — alles bleibt im `localStorage` des jeweiligen Browsers/Geräts
- Lebenszeichen: `GET /` liefert `index.html`
- Adresse: wird von GitHub Pages vergeben, siehe unten

## Hinweis für den nächsten Agenten

Jeder `git push` auf `main` baut die Seite über GitHub Pages automatisch neu (kein manueller Schritt nötig).
Falls später doch auf den Workshop-Server umgezogen werden soll: `WS einrichten` + `WS veroeffentlichen`
laut `werkbank:online-stellen`-Skill, sobald das lokale Netz des Workshop-Orts erreichbar ist.
