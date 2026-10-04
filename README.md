# volley-coach

Persönliche App für einen Volleyball-Trainer: Kader pflegen, Aufstellung eintragen, Rotation inkl. Libero automatisch nachführen (klassische Regel — Libero schlägt nie auf), Punktverluste mit Fehlergrund (Aufschlag/Annahme/Angriff/Block/Netz/Sonstige) protokollieren, jederzeit freier Spielerwechsel.

Single-User-Tool, kein Login, kein Server, kein Internet nötig. Läuft **ausschließlich lokal** — bewusste Entscheidung, keine Online-Version.

## Benutzung (lokal, ohne Internet)

Die App ist eine einzige Seite (`index.html` + `style.css` + `rotation.js` + `app.js`), die direkt im Browser läuft — ganz ohne Server, ganz ohne Installation von Software.

**Auf dem Handy nutzen:**
1. Den Ordner `01_dev` (bzw. die vier Dateien `index.html`, `style.css`, `rotation.js`, `app.js`) aufs Handy übertragen — z. B. per USB-Kabel, per Mail an dich selbst mit den Dateien im Anhang, oder über eine Cloud (Google Drive/OneDrive), dort herunterladen und in einem Ordner speichern. Wichtig: alle vier Dateien müssen im **selben Ordner** liegen.
2. Im Datei-Manager des Handys auf `index.html` tippen → „Öffnen mit" → Chrome oder Firefox wählen.
3. Die App läuft jetzt im Browser, ganz ohne Internetverbindung.
4. Lesezeichen setzen (oder bei Android über das Browser-Menü „Zum Startbildschirm hinzufügen"), damit du beim nächsten Mal nicht wieder durch den Datei-Manager musst.

**Wichtig zum Speichern:** Der Kader und der aktuelle Spielstand werden im Browser selbst gespeichert (`localStorage`), nicht in einer Datei. Das heißt:
- Solange du denselben Browser auf demselben Handy benutzt, bleibt alles erhalten — auch nach Neustart des Handys.
- Wenn du „Browserdaten/Cache löschen" machst oder einen anderen Browser benutzt, ist der gespeicherte Stand weg. Ein Export gibt es aktuell bewusst nicht (siehe `weitermachen.md`).

**Am PC testen:** Einfach `index.html` doppelklicken, öffnet sich im Standard-Browser — funktioniert genauso.

## Technik

Reines HTML/JS/CSS, keine Frameworks, keine Abhängigkeiten, kein Build-Schritt. Die komplette Rotations- und Libero-Logik steht isoliert in `rotation.js` (keine Darstellung drin), alles andere (Kader, Speichern, Darstellung) in `app.js`.

Details und aktueller Stand: `../10_Weitermachen/weitermachen.md`
