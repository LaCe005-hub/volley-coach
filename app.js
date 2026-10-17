// app.js — Kaderverwaltung, Aufstellung, Spiel-Ansicht, Speicherung.
// Nutzt die reinen Funktionen aus rotation.js. Alles wird in localStorage
// gespeichert, kein Server nötig.

const SPEICHER_SCHLUESSEL = "volleyCoachState";
const FEHLER_GRUENDE = ["Aufschlag", "Annahme", "Angriff", "Block", "Netz", "Kommunikation", "Unglück", "Sonstige"];
const ZIELPUNKTZAHL_STANDARD = 25;

// Spieler-Rollen fürs Einfärben auf dem Feld. Standard-6er-Aufstellung:
// 2x Außenangreifer, 2x Mittelblocker, 1x Zuspieler, 1x Diagonal — plus der
// Libero, der nie zur Startaufstellung gehört, sondern live eingetauscht wird.
const ROLLEN = ["Außenangreifer", "Zuspieler", "Mittelblocker", "Diagonal", "Libero"];
const ROLLE_ZU_KLASSE = {
  "Außenangreifer": "rolle-aussen",
  "Zuspieler": "rolle-zuspieler",
  "Mittelblocker": "rolle-mitte",
  "Diagonal": "rolle-diagonal",
  "Libero": "rolle-libero",
};

// ---------- Zustand ----------

function leererZustand() {
  return {
    kader: [], // [{nummer, rolle}] — rolle ist "" oder einer der ROLLEN-Werte
    match: {
      format: null, // 3 (Best of 3) oder 5 (Best of 5) — erst gesetzt, wenn das Match gestartet wurde
      saetzeWir: 0,
      saetzeGegner: 0,
      satzErgebnisse: [], // [{wir, gegner, fehler:[...]}] — ein Eintrag pro abgeschlossenem Satz
      beendet: false,
      laeuft: false, // true, sobald das Format gewählt und der erste Satz gestartet wurde
    },
    satz: {
      positionen: [null, null, null, null, null, null],
      liberoImFeld: null, // {ersetztSpieler, liberoNummer} — reine Anzeige-Überlagerung, rührt "positionen" nie an; folgt dem ersetzten Spieler durch die Rotation
      wirAmAufschlag: true,
      punkte: { wir: 0, gegner: 0 },
      zielPunktzahl: ZIELPUNKTZAHL_STANDARD,
      beendet: false, // true, sobald die Zielpunktzahl mit 2 Punkten Vorsprung erreicht ist
      fehler: [], // [{nummer, grund, zeit}]
      laeuft: false, // true, sobald die Aufstellung übernommen wurde
    },
    historie: [], // Undo-Stack: Kopien von "satz"
  };
}

let zustand = ladeZustand();

function ladeZustand() {
  try {
    const roh = localStorage.getItem(SPEICHER_SCHLUESSEL);
    if (!roh) return leererZustand();
    const geladen = JSON.parse(roh);
    // Fehlende Felder auffüllen, falls sich das Format mal ändert.
    const basis = leererZustand();
    return {
      ...basis,
      ...geladen,
      match: { ...basis.match, ...(geladen.match || {}) },
      satz: { ...basis.satz, ...(geladen.satz || {}) },
    };
  } catch (e) {
    console.warn("Konnte gespeicherten Zustand nicht laden, starte neu.", e);
    return leererZustand();
  }
}

function speichern() {
  try {
    localStorage.setItem(SPEICHER_SCHLUESSEL, JSON.stringify(zustand));
  } catch (e) {
    console.warn("Konnte Zustand nicht speichern (localStorage voll/blockiert?).", e);
  }
}

function sichereHistorie() {
  // Flache Kopie des aktuellen Satzes auf den Undo-Stack legen.
  zustand.historie.push(JSON.parse(JSON.stringify(zustand.satz)));
  // Stack nicht unbegrenzt wachsen lassen.
  if (zustand.historie.length > 50) zustand.historie.shift();
}

function rueckgaengig() {
  const letzter = zustand.historie.pop();
  if (!letzter) return;
  zustand.satz = letzter;
  liberoModusAktiv = false;
  speichern();
  renderAlles();
}

// ---------- Ansichten umschalten ----------

const ansichten = ["kader", "aufstellung", "spiel"];

function zeigeAnsicht(name) {
  for (const a of ansichten) {
    document.getElementById("ansicht-" + a).classList.toggle("aktiv", a === name);
    document.getElementById("nav-" + a).classList.toggle("aktiv", a === name);
  }
}

// ---------- Kader-Ansicht ----------

function renderKader() {
  const liste = document.getElementById("kader-liste");
  liste.innerHTML = "";

  if (zustand.kader.length === 0) {
    liste.innerHTML = '<p class="hinweis">Noch keine Spieler im Kader. Trikotnummer unten eintragen.</p>';
  }

  for (const spieler of zustand.kader) {
    const zeile = document.createElement("div");
    zeile.className = "kader-zeile";

    const nummer = document.createElement("span");
    nummer.className = "kader-nummer";
    nummer.textContent = "#" + spieler.nummer;
    zeile.appendChild(nummer);

    const rolleSelect = document.createElement("select");
    rolleSelect.className = "kader-rolle-auswahl";
    const leerOption = document.createElement("option");
    leerOption.value = "";
    leerOption.textContent = "— Rolle wählen —";
    rolleSelect.appendChild(leerOption);
    for (const rolle of ROLLEN) {
      const option = document.createElement("option");
      option.value = rolle;
      option.textContent = rolle;
      rolleSelect.appendChild(option);
    }
    rolleSelect.value = spieler.rolle || "";
    rolleSelect.addEventListener("change", () => {
      spieler.rolle = rolleSelect.value;
      speichern();
      renderAufstellungOptionen();
      renderSpielfeld();
    });
    zeile.appendChild(rolleSelect);

    const entfernenBtn = document.createElement("button");
    entfernenBtn.className = "btn-klein btn-gefahr";
    entfernenBtn.textContent = "Entfernen";
    entfernenBtn.addEventListener("click", () => {
      zustand.kader = zustand.kader.filter((s) => s.nummer !== spieler.nummer);
      speichern();
      renderKader();
      renderAufstellungOptionen();
    });
    zeile.appendChild(entfernenBtn);

    liste.appendChild(zeile);
  }
}

function kaderSpielerHinzufuegen() {
  const eingabe = document.getElementById("neue-nummer");
  const nummer = parseInt(eingabe.value, 10);
  if (!nummer || nummer < 1 || nummer > 99) {
    alert("Bitte eine gültige Trikotnummer (1–99) eintragen.");
    return;
  }
  if (zustand.kader.some((s) => s.nummer === nummer)) {
    alert("Diese Nummer ist schon im Kader.");
    return;
  }
  zustand.kader.push({ nummer, rolle: "" });
  zustand.kader.sort((a, b) => a.nummer - b.nummer);
  speichern();
  eingabe.value = "";
  renderKader();
  renderAufstellungOptionen();
}

function spielerRolle(nummer) {
  const spieler = zustand.kader.find((s) => s.nummer === nummer);
  return spieler ? spieler.rolle : "";
}

// ---------- Aufstellung-Ansicht ----------

function renderMatchFormatAuswahl() {
  const block = document.getElementById("spielformat-block");
  block.style.display = zustand.match.laeuft ? "none" : "";
}

// Schlägt die Zielpunktzahl für den nächsten Satz vor: 15 im
// Entscheidungssatz, sonst 25. Der Trainer kann das Feld trotzdem von Hand
// überschreiben, falls die eigene Liga andere Regeln hat.
function aktualisiereZielpunktzahlVorschlag() {
  const input = document.getElementById("zielpunktzahl");
  if (zustand.match.laeuft && zustand.match.format) {
    const entscheidungssatz = istEntscheidungssatz(zustand.match.saetzeWir, zustand.match.saetzeGegner, zustand.match.format);
    input.value = entscheidungssatz ? 15 : ZIELPUNKTZAHL_STANDARD;
  } else {
    input.value = ZIELPUNKTZAHL_STANDARD;
  }
}

function renderAufstellungOptionen() {
  // 6 Positions-Dropdowns mit allen Kader-Spielern befüllen (Libero steht
  // hier nicht zur Wahl — der kommt erst live im Spiel per Tausch dazu).
  for (let i = 0; i < 6; i++) {
    const select = document.getElementById("pos-" + (i + 1));
    const aktuelleAuswahl = select.value;
    select.innerHTML = '<option value="">—</option>';
    for (const spieler of zustand.kader.filter((s) => s.rolle !== "Libero")) {
      const option = document.createElement("option");
      option.value = spieler.nummer;
      option.textContent = "#" + spieler.nummer;
      select.appendChild(option);
    }
    if (aktuelleAuswahl) select.value = aktuelleAuswahl;
  }
  renderMatchFormatAuswahl();
}

function aufstellungUebernehmen() {
  // Erster Satz eines neuen Matches: Spielformat muss zuerst feststehen.
  if (!zustand.match.laeuft) {
    const formatInput = document.querySelector('input[name="spielformat"]:checked');
    if (!formatInput) {
      alert("Bitte zuerst Best of 3 oder Best of 5 wählen.");
      return;
    }
    zustand.match = {
      format: parseInt(formatInput.value, 10),
      saetzeWir: 0,
      saetzeGegner: 0,
      satzErgebnisse: [],
      beendet: false,
      laeuft: true,
    };
  }

  const positionen = [];
  for (let i = 1; i <= 6; i++) {
    const wert = document.getElementById("pos-" + i).value;
    if (!wert) {
      alert("Bitte alle 6 Positionen besetzen.");
      return;
    }
    positionen.push(parseInt(wert, 10));
  }
  if (new Set(positionen).size !== 6) {
    alert("Jeder Spieler darf nur auf einer Position stehen.");
    return;
  }

  const wirAmAufschlag = document.getElementById("aufschlag-wir").checked;
  const zielPunktzahl = parseInt(document.getElementById("zielpunktzahl").value, 10) || ZIELPUNKTZAHL_STANDARD;

  zustand.satz = {
    positionen,
    liberoImFeld: null,
    wirAmAufschlag,
    punkte: { wir: 0, gegner: 0 },
    zielPunktzahl,
    beendet: false,
    fehler: [],
    laeuft: true,
  };
  zustand.historie = [];
  liberoModusAktiv = false;
  speichern();
  renderAlles();
  zeigeAnsicht("spiel");
}

// ---------- Spiel-Ansicht ----------

// Reihenfolge der Index-Positionen für die Court-Darstellung:
// oben = Netzseite (Vorderfeld), unten = Hinterfeld.
const COURT_OBEN = [3, 2, 1]; // Positionen 4, 3, 2
const COURT_UNTEN = [4, 5, 0]; // Positionen 5, 6, 1 (1 = Aufschlag)

function renderSpielfeld() {
  if (!zustand.satz.laeuft) return;

  const anzeige = berechneAnzeige(zustand.satz.positionen, zustand.satz.liberoImFeld);
  const zuspielerKader = zustand.kader.find((s) => s.rolle === "Zuspieler");

  const renderReihe = (containerId, indexReihenfolge) => {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    for (const index of indexReihenfolge) {
      const info = anzeige[index];
      const kachel = document.createElement("button");
      kachel.className = "court-kachel";
      kachel.dataset.index = String(index);

      // Farbe nach Rolle des gerade angezeigten Spielers (bei aktivem Libero
      // also die Libero-Farbe, sonst die Rolle des Original-Spielers).
      const rolle = spielerRolle(info.anzeigeNummer);
      if (rolle && ROLLE_ZU_KLASSE[rolle]) kachel.classList.add(ROLLE_ZU_KLASSE[rolle]);

      if (info.istAufschlagPosition) kachel.classList.add("aufschlag-position");
      if (info.liberoAktiv) kachel.classList.add("libero-aktiv");

      const nummerSpan = document.createElement("span");
      nummerSpan.className = "court-nummer";
      nummerSpan.textContent = "#" + info.anzeigeNummer;
      kachel.appendChild(nummerSpan);

      const posSpan = document.createElement("span");
      posSpan.className = "court-position";
      posSpan.textContent = "Pos. " + info.position + (info.istAufschlagPosition ? " ⚡" : "");
      kachel.appendChild(posSpan);

      if (info.liberoAktiv) {
        const liberoSpan = document.createElement("span");
        liberoSpan.className = "court-markierung court-markierung-libero";
        // Der Libero darf laut Regel nicht aufschlagen — rotiert er auf
        // diese Position, macht die Beschriftung selbst darauf aufmerksam
        // (keine Bestätigung nötig, da das durch die Rotation passiv passiert).
        liberoSpan.textContent = info.istAufschlagPosition ? "Libero ⚠" : "Libero";
        kachel.appendChild(liberoSpan);
      }
      if (zuspielerKader && info.originalSpieler === zuspielerKader.nummer) {
        const zSpan = document.createElement("span");
        zSpan.className = "court-markierung court-markierung-zuspieler";
        zSpan.textContent = "Zuspieler";
        kachel.appendChild(zSpan);
      }

      kachel.addEventListener("click", () => {
        if (liberoModusAktiv) {
          liberoAufPositionSetzen(index);
        } else {
          spielerWechseln(index);
        }
      });
      container.appendChild(kachel);
    }
  };

  renderReihe("court-oben", COURT_OBEN);
  renderReihe("court-unten", COURT_UNTEN);

  document.getElementById("aufschlag-status").textContent = zustand.satz.wirAmAufschlag
    ? "Wir schlagen auf"
    : "Gegner schlägt auf";

  const laeuferEl = document.getElementById("laeufer-status");
  if (!zuspielerKader) {
    laeuferEl.textContent = "";
  } else {
    const laeufer = berechneLaeufer(zustand.satz.positionen, zuspielerKader.nummer);
    laeuferEl.textContent = laeufer
      ? "Läufer " + laeufer
      : "Zuspieler (#" + zuspielerKader.nummer + ") nicht auf dem Feld";
  }

  document.getElementById("punktestand").textContent =
    zustand.satz.punkte.wir + " : " + zustand.satz.punkte.gegner;
  document.getElementById("saetze-stand").textContent =
    "Sätze " + zustand.match.saetzeWir + ":" + zustand.match.saetzeGegner + " (Best of " + zustand.match.format + ")";

  renderLiberoIcon();
  renderSatzEndeBanner();
}

function spielerWechseln(index) {
  if (zustand.satz.beendet) return;
  const aktuelleNummer = zustand.satz.positionen[index];
  const auswahl = zustand.kader
    .filter((s) => s.rolle !== "Libero")
    .map((s) => s.nummer)
    .join(", ");
  const eingabe = prompt(
    "Welche Trikotnummer soll auf Position " + (index + 1) + " stehen?\nKader: " + auswahl,
    aktuelleNummer
  );
  if (eingabe === null) return;
  const neueNummer = parseInt(eingabe, 10);
  if (!neueNummer || !zustand.kader.some((s) => s.nummer === neueNummer)) {
    alert("Unbekannte Trikotnummer.");
    return;
  }
  sichereHistorie();

  // Steht die gewählte Nummer schon auf einer anderen Position, tauschen
  // statt überschreiben — sonst stünde ein Spieler doppelt auf dem Feld.
  const andereIndex = zustand.satz.positionen.findIndex((n, i) => n === neueNummer && i !== index);
  if (andereIndex !== -1) {
    zustand.satz.positionen[andereIndex] = aktuelleNummer;
  }
  zustand.satz.positionen[index] = neueNummer;

  speichern();
  renderSpielfeld();
}

// ---------- Libero: Icon an der Seite, Tausch per Antippen ODER Ziehen ----------
// Reine Anzeige-Überlagerung (satz.liberoImFeld) — "positionen" (die echte
// Rotation) wird dabei NIE verändert. Der Libero ist an den SPIELER
// gebunden, den er ersetzt (liberoImFeld.ersetztSpieler), nicht an eine
// feste Position — dadurch "läuft er mit", wenn rotiert wird, und bleibt
// so lange drin, bis der Trainer ihn selbst wieder raustauscht.
// Zwei Bedienwege, beide führen zum selben Ergebnis:
//   a) Antippen: Icon antippen scharf machen ("bereit"), dann eine
//      Positions-Kachel antippen → Libero ersetzt den Spieler, der dort
//      gerade steht. Icon nochmal antippen tauscht ihn zurück.
//   b) Ziehen: Icon mit dem Finger auf eine Positions-Kachel ziehen und
//      loslassen → Libero ersetzt den Spieler dort, ohne Zwischenschritt.
//      Außerhalb jeder Kachel loslassen, während der Libero schon im Feld
//      steht, tauscht ihn zurück.

let liberoModusAktiv = false; // transient, nicht gespeichert
let liberoGewaehlteNummer = null; // transient, nicht gespeichert
let liberoZiehenStatus = null; // transient: {ghost, startX, startY, bewegt, letzteKachel} während des Ziehens

function liberoKandidaten() {
  return zustand.kader.filter((s) => s.rolle === "Libero");
}

function liberoIconKlick() {
  if (zustand.satz.beendet) return;

  if (zustand.satz.liberoImFeld) {
    // Libero steht im Feld -> Icon tauscht ihn direkt zurück.
    sichereHistorie();
    zustand.satz.liberoImFeld = null;
    speichern();
    liberoModusAktiv = false;
    renderSpielfeld();
    return;
  }

  if (liberoModusAktiv) {
    // Schon scharf, nochmal antippen bricht ab.
    liberoModusAktiv = false;
    renderLiberoIcon();
    return;
  }

  const kandidaten = liberoKandidaten();
  if (kandidaten.length === 0) {
    alert("Kein Spieler im Kader hat die Rolle 'Libero'.");
    return;
  }
  liberoGewaehlteNummer = kandidaten[0].nummer;
  if (kandidaten.length > 1) {
    const eingabe = prompt("Welcher Libero? (" + kandidaten.map((s) => s.nummer).join(", ") + ")", liberoGewaehlteNummer);
    if (eingabe === null) return;
    const nr = parseInt(eingabe, 10);
    if (!kandidaten.some((s) => s.nummer === nr)) {
      alert("Unbekannte Libero-Nummer.");
      return;
    }
    liberoGewaehlteNummer = nr;
  }
  liberoModusAktiv = true;
  renderLiberoIcon();
}

function liberoAufPositionSetzen(index) {
  sichereHistorie();
  zustand.satz.liberoImFeld = { ersetztSpieler: zustand.satz.positionen[index], liberoNummer: liberoGewaehlteNummer };
  liberoModusAktiv = false;
  speichern();
  renderSpielfeld();
}

// ---- Ziehen (Pointer Events — funktioniert gleich für Finger und Maus) ----

function liberoIconPointerDown(e) {
  if (zustand.satz.beendet) return;
  e.preventDefault();

  // Welche Libero-Nummer wird gezogen? Bei mehreren Liberos im Kader einmal
  // kurz nachfragen (bricht das Ziehen dann aber nicht ab, läuft danach normal weiter).
  let nummer;
  if (zustand.satz.liberoImFeld) {
    nummer = zustand.satz.liberoImFeld.liberoNummer;
  } else {
    const kandidaten = liberoKandidaten();
    if (kandidaten.length === 0) {
      alert("Kein Spieler im Kader hat die Rolle 'Libero'.");
      return;
    }
    nummer = kandidaten[0].nummer;
    if (kandidaten.length > 1) {
      const eingabe = prompt("Welcher Libero? (" + kandidaten.map((s) => s.nummer).join(", ") + ")", nummer);
      if (eingabe === null) return;
      const nr = parseInt(eingabe, 10);
      if (!kandidaten.some((s) => s.nummer === nr)) {
        alert("Unbekannte Libero-Nummer.");
        return;
      }
      nummer = nr;
    }
  }

  const ghost = document.createElement("div");
  ghost.className = "libero-ghost";
  ghost.textContent = "#" + nummer;
  document.body.appendChild(ghost);

  liberoZiehenStatus = { ghost, nummer, startX: e.clientX, startY: e.clientY, bewegt: false, letzteKachel: null };
  liberoGhostPositionieren(e.clientX, e.clientY);

  document.addEventListener("pointermove", liberoIconPointerMove);
  document.addEventListener("pointerup", liberoIconPointerUp);
}

function liberoGhostPositionieren(x, y) {
  if (!liberoZiehenStatus) return;
  liberoZiehenStatus.ghost.style.left = x + "px";
  liberoZiehenStatus.ghost.style.top = y + "px";
}

function liberoIconPointerMove(e) {
  if (!liberoZiehenStatus) return;
  const dx = e.clientX - liberoZiehenStatus.startX;
  const dy = e.clientY - liberoZiehenStatus.startY;
  if (Math.abs(dx) > 6 || Math.abs(dy) > 6) liberoZiehenStatus.bewegt = true;
  liberoGhostPositionieren(e.clientX, e.clientY);

  // Ghost selbst hat pointer-events:none (siehe style.css), daher findet
  // elementFromPoint trotz des Ghosts darunter die echte Positions-Kachel.
  const ziel = document.elementFromPoint(e.clientX, e.clientY);
  const kachel = ziel ? ziel.closest(".court-kachel") : null;
  if (liberoZiehenStatus.letzteKachel && liberoZiehenStatus.letzteKachel !== kachel) {
    liberoZiehenStatus.letzteKachel.classList.remove("drag-ueber");
  }
  if (kachel) kachel.classList.add("drag-ueber");
  liberoZiehenStatus.letzteKachel = kachel;
}

function liberoIconPointerUp() {
  if (!liberoZiehenStatus) return;
  document.removeEventListener("pointermove", liberoIconPointerMove);
  document.removeEventListener("pointerup", liberoIconPointerUp);

  const { ghost, nummer, bewegt, letzteKachel } = liberoZiehenStatus;
  if (letzteKachel) letzteKachel.classList.remove("drag-ueber");
  ghost.remove();
  liberoZiehenStatus = null;

  if (!bewegt) {
    // Kaum bewegt -> als normales Antippen behandeln (gewohnter Zwei-Schritt-Modus).
    liberoIconKlick();
    return;
  }

  if (letzteKachel) {
    liberoGewaehlteNummer = nummer;
    liberoAufPositionSetzen(parseInt(letzteKachel.dataset.index, 10));
  } else if (zustand.satz.liberoImFeld) {
    // Außerhalb jeder Position losgelassen, während der Libero im Feld
    // stand -> zurücktauschen.
    sichereHistorie();
    zustand.satz.liberoImFeld = null;
    speichern();
    renderSpielfeld();
  }
}

function renderLiberoIcon() {
  const icon = document.getElementById("libero-icon");
  const label = document.getElementById("libero-icon-label");
  icon.classList.remove("bereit", "platziert");

  if (zustand.satz.liberoImFeld) {
    const index = zustand.satz.positionen.indexOf(zustand.satz.liberoImFeld.ersetztSpieler);
    icon.textContent = "#" + zustand.satz.liberoImFeld.liberoNummer;
    icon.classList.add("platziert");
    label.textContent =
      index === -1
        ? "Ersetzter Spieler nicht im Feld — antippen zum Zurücktauschen"
        : "Pos. " + (index + 1) + " — läuft mit, antippen zum Zurücktauschen";
  } else if (liberoModusAktiv) {
    icon.textContent = "#" + liberoGewaehlteNummer;
    icon.classList.add("bereit");
    label.textContent = "Position antippen …";
  } else {
    const kandidaten = liberoKandidaten();
    icon.textContent = kandidaten.length === 1 ? "#" + kandidaten[0].nummer : "L";
    label.textContent = "Libero draußen";
  }
}

// ---------- Punkte, Rotation, Satz- und Matchende ----------

function pruefeSatzende() {
  const { wir, gegner } = zustand.satz.punkte;
  if (!satzIstBeendet(wir, gegner, zustand.satz.zielPunktzahl)) return;

  zustand.satz.beendet = true;

  // In die Match-Historie eintragen (für die Statistik am Matchende).
  zustand.match.satzErgebnisse.push({ wir, gegner, fehler: [...zustand.satz.fehler] });
  if (wir > gegner) {
    zustand.match.saetzeWir++;
  } else {
    zustand.match.saetzeGegner++;
  }
  if (matchIstBeendet(zustand.match.saetzeWir, zustand.match.saetzeGegner, zustand.match.format)) {
    zustand.match.beendet = true;
  }
}

function rotationAnwenden(ergebnis) {
  zustand.satz.positionen = ergebnis.positionen;
  zustand.satz.wirAmAufschlag = ergebnis.wirAmAufschlag;
  // Der Libero ist an den ersetzten Spieler gebunden (liberoImFeld.ersetztSpieler),
  // nicht an eine Position — er "läuft" bei der Rotation automatisch mit und
  // bleibt drin, bis der Trainer ihn per Icon wieder raustauscht.
}

function punktFuerUns() {
  if (zustand.satz.beendet) return;
  sichereHistorie();
  zustand.satz.punkte.wir++;
  const ergebnis = naechsterZustandNachPunkt(zustand.satz.positionen, zustand.satz.wirAmAufschlag, true);
  rotationAnwenden(ergebnis);
  pruefeSatzende();
  speichern();
  renderSpielfeld();
}

let ausstehenderPunktverlust = false;
let fehlerAusgewaehlteSpieler = new Set(); // mehrere Spieler können denselben Punktverlust teilen (z. B. bei Kommunikation)

function punktFuerGegnerStarten() {
  if (zustand.satz.beendet) return;
  ausstehenderPunktverlust = true;
  fehlerAusgewaehlteSpieler = new Set();
  document.getElementById("fehler-dialog").classList.add("aktiv");
  renderFehlerDialogSpielerListe();
}

function punktFuerGegnerAbbrechen() {
  ausstehenderPunktverlust = false;
  fehlerAusgewaehlteSpieler = new Set();
  document.getElementById("fehler-dialog").classList.remove("aktiv");
}

function renderFehlerDialogSpielerListe() {
  const container = document.getElementById("fehler-spieler-liste");
  container.innerHTML = "";
  // Alle gerade auf dem Feld sichtbaren Nummern (inkl. Libero) anbieten.
  // Mehrfachauswahl: jeder Tipp schaltet die jeweilige Nummer an/aus.
  const anzeige = berechneAnzeige(zustand.satz.positionen, zustand.satz.liberoImFeld);
  const sichtbareNummern = [...new Set(anzeige.map((a) => a.anzeigeNummer))];
  for (const nummer of sichtbareNummern) {
    const btn = document.createElement("button");
    btn.className = "btn-klein";
    if (fehlerAusgewaehlteSpieler.has(nummer)) btn.classList.add("ausgewaehlt");
    btn.textContent = "#" + nummer;
    btn.addEventListener("click", () => {
      if (fehlerAusgewaehlteSpieler.has(nummer)) {
        fehlerAusgewaehlteSpieler.delete(nummer);
        btn.classList.remove("ausgewaehlt");
      } else {
        fehlerAusgewaehlteSpieler.add(nummer);
        btn.classList.add("ausgewaehlt");
      }
    });
    container.appendChild(btn);
  }
}

function fehlerBestaetigen(grund) {
  if (!ausstehenderPunktverlust) return;
  if (fehlerAusgewaehlteSpieler.size === 0) {
    alert("Bitte zuerst mindestens einen Spieler auswählen.");
    return;
  }

  sichereHistorie();
  zustand.satz.fehler.push({ nummern: [...fehlerAusgewaehlteSpieler], grund, zeit: new Date().toISOString() });
  zustand.satz.punkte.gegner++;

  const ergebnis = naechsterZustandNachPunkt(zustand.satz.positionen, zustand.satz.wirAmAufschlag, false);
  rotationAnwenden(ergebnis);
  pruefeSatzende();

  speichern();
  ausstehenderPunktverlust = false;
  fehlerAusgewaehlteSpieler = new Set();
  document.getElementById("fehler-dialog").classList.remove("aktiv");
  renderSpielfeld();
  renderFehlerListe();
}

function renderSatzEndeBanner() {
  const banner = document.getElementById("satz-ende-banner");
  const punktBtns = document.getElementById("punkt-buttons");
  const neuerSatzBtn = document.getElementById("neuer-satz");
  const neuesMatchBtn = document.getElementById("neues-match");
  const statistikBox = document.getElementById("match-statistik");

  if (!zustand.satz.beendet) {
    banner.classList.remove("aktiv");
    punktBtns.classList.remove("ausgeblendet");
    neuerSatzBtn.style.display = "";
    neuesMatchBtn.style.display = "none";
    statistikBox.classList.remove("aktiv");
    return;
  }

  const { wir, gegner } = zustand.satz.punkte;
  const satzText = wir > gegner ? "Satz gewonnen " + wir + ":" + gegner : "Satz verloren " + wir + ":" + gegner;
  const matchStandText = "Sätze " + zustand.match.saetzeWir + ":" + zustand.match.saetzeGegner;

  punktBtns.classList.add("ausgeblendet");
  banner.classList.add("aktiv");

  if (zustand.match.beendet) {
    const matchGewonnen = zustand.match.saetzeWir > zustand.match.saetzeGegner;
    banner.textContent = (matchGewonnen ? "Match gewonnen 🏆 " : "Match verloren ") + matchStandText;
    neuerSatzBtn.style.display = "none";
    neuesMatchBtn.style.display = "";
    renderMatchStatistik();
    statistikBox.classList.add("aktiv");
  } else {
    banner.textContent = satzText + " — " + matchStandText;
    neuerSatzBtn.style.display = "";
    neuesMatchBtn.style.display = "none";
    statistikBox.classList.remove("aktiv");
  }
}

function statistikZeile(label, wert) {
  const zeile = document.createElement("div");
  zeile.className = "statistik-zeile";
  const labelSpan = document.createElement("span");
  labelSpan.textContent = label;
  const wertSpan = document.createElement("span");
  wertSpan.textContent = String(wert);
  zeile.appendChild(labelSpan);
  zeile.appendChild(wertSpan);
  return zeile;
}

// Ein horizontaler Balken: Label links, Balken in der Mitte (Breite = Anteil
// am größten Wert dieser Liste), Zahl rechts. "rolleKlasse" ist optional —
// ohne sie bekommt der Balken die neutrale Akzentfarbe (reine Mengen-
// Vergleiche brauchen keine Kategorie-Farbe, nur bei Spielern macht die
// Rollenfarbe den Balken zusätzlich wiedererkennbar).
function balkenZeile(label, wert, maxWert, rolleKlasse) {
  const zeile = document.createElement("div");
  zeile.className = "balken-zeile";

  const labelSpan = document.createElement("span");
  labelSpan.className = "balken-label";
  labelSpan.textContent = label;
  zeile.appendChild(labelSpan);

  const spur = document.createElement("div");
  spur.className = "balken-spur";
  const fuellung = document.createElement("div");
  fuellung.className = "balken-fuellung" + (rolleKlasse ? " " + rolleKlasse : "");
  const breite = maxWert > 0 ? Math.max(6, Math.round((wert / maxWert) * 100)) : 0;
  fuellung.style.width = breite + "%";
  spur.appendChild(fuellung);
  zeile.appendChild(spur);

  const wertSpan = document.createElement("span");
  wertSpan.className = "balken-wert";
  wertSpan.textContent = String(wert);
  zeile.appendChild(wertSpan);

  return zeile;
}

// Statistik über das gesamte Match (alle abgeschlossenen Sätze zusammen) —
// sowohl tabellarisch (pro Spieler: Anzahl + Fehlerarten) als auch grafisch
// (Balkendiagramme). Ein Punktverlust kann mehrere Spieler betreffen (z. B.
// bei Kommunikation) — jeder ausgewählte Spieler zählt dafür voll, nicht
// anteilig. Als Eigenfehler zählt alles außer "Unglück" — ein unglücklicher
// Ballwurf ist kein technischer Fehler, alle anderen Gründe schon.
function renderMatchStatistik() {
  const container = document.getElementById("match-statistik");
  container.innerHTML = "";

  const alleFehler = zustand.match.satzErgebnisse.flatMap((s) => s.fehler);

  if (alleFehler.length === 0) {
    const p = document.createElement("p");
    p.className = "hinweis";
    p.textContent = "Keine Punktverluste erfasst.";
    container.appendChild(p);
    return;
  }

  // ---- Nach Fehlerart (gesamtes Match) ----
  const nachGrund = {};
  for (const f of alleFehler) {
    nachGrund[f.grund] = (nachGrund[f.grund] || 0) + 1;
  }
  const grundSortiert = Object.entries(nachGrund).sort((a, b) => b[1] - a[1]);
  const grundMax = grundSortiert[0][1];

  const ueberschriftArten = document.createElement("h3");
  ueberschriftArten.textContent = "Fehlerarten (gesamtes Match)";
  container.appendChild(ueberschriftArten);

  const artenChart = document.createElement("div");
  artenChart.className = "balken-chart";
  for (const [grund, anzahl] of grundSortiert) {
    artenChart.appendChild(balkenZeile(grund, anzahl, grundMax));
  }
  container.appendChild(artenChart);

  // ---- Pro Spieler: Anzahl + welche Fehlerarten (tabellarisch) ----
  const proSpieler = {}; // nummer -> { gesamt, nachGrund: {grund: anzahl} }
  for (const f of alleFehler) {
    for (const nummer of f.nummern) {
      if (!proSpieler[nummer]) proSpieler[nummer] = { gesamt: 0, nachGrund: {} };
      proSpieler[nummer].gesamt++;
      proSpieler[nummer].nachGrund[f.grund] = (proSpieler[nummer].nachGrund[f.grund] || 0) + 1;
    }
  }
  const spielerSortiert = Object.entries(proSpieler).sort((a, b) => b[1].gesamt - a[1].gesamt);
  const spielerMax = spielerSortiert[0][1].gesamt;

  const ueberschriftSpielerGrafik = document.createElement("h3");
  ueberschriftSpielerGrafik.textContent = "Pro Spieler";
  container.appendChild(ueberschriftSpielerGrafik);

  const spielerChart = document.createElement("div");
  spielerChart.className = "balken-chart";
  for (const [nummer, daten] of spielerSortiert) {
    const rolle = spielerRolle(parseInt(nummer, 10));
    const rolleKlasse = rolle && ROLLE_ZU_KLASSE[rolle] ? "balken-" + ROLLE_ZU_KLASSE[rolle] : null;
    spielerChart.appendChild(balkenZeile("#" + nummer, daten.gesamt, spielerMax, rolleKlasse));
  }
  container.appendChild(spielerChart);

  const tabelle = document.createElement("table");
  tabelle.className = "statistik-tabelle";
  const kopf = document.createElement("tr");
  for (const text of ["Spieler", "Anzahl", "Fehlerarten"]) {
    const th = document.createElement("th");
    th.textContent = text;
    kopf.appendChild(th);
  }
  tabelle.appendChild(kopf);
  for (const [nummer, daten] of spielerSortiert) {
    const zeile = document.createElement("tr");
    const zelleSpieler = document.createElement("td");
    zelleSpieler.textContent = "#" + nummer;
    const zelleAnzahl = document.createElement("td");
    zelleAnzahl.textContent = String(daten.gesamt);
    const zelleArten = document.createElement("td");
    zelleArten.textContent = Object.entries(daten.nachGrund)
      .sort((a, b) => b[1] - a[1])
      .map(([grund, anzahl]) => grund + " ×" + anzahl)
      .join(", ");
    zeile.appendChild(zelleSpieler);
    zeile.appendChild(zelleAnzahl);
    zeile.appendChild(zelleArten);
    tabelle.appendChild(zeile);
  }
  container.appendChild(tabelle);

  // ---- Eigenfehler-Anteil ----
  const eigenfehler = alleFehler.filter((f) => f.grund !== "Unglück").length;
  const keinEigenfehler = alleFehler.length - eigenfehler;

  const ueberschriftEigen = document.createElement("h3");
  ueberschriftEigen.textContent = "Eigenfehler";
  container.appendChild(ueberschriftEigen);

  const eigenListe = document.createElement("div");
  eigenListe.className = "statistik-liste";
  eigenListe.appendChild(statistikZeile("Eigenfehler", eigenfehler + " von " + alleFehler.length));
  eigenListe.appendChild(statistikZeile("Unglück (kein Eigenfehler)", keinEigenfehler + " von " + alleFehler.length));
  container.appendChild(eigenListe);
}

function renderFehlerListe() {
  const liste = document.getElementById("fehler-log");
  liste.innerHTML = "";
  if (zustand.satz.fehler.length === 0) {
    liste.innerHTML = '<p class="hinweis">Noch keine Punktverluste erfasst.</p>';
    return;
  }
  // Neueste zuerst.
  const eintraege = [...zustand.satz.fehler].reverse();
  for (const eintrag of eintraege) {
    const zeile = document.createElement("div");
    zeile.className = "fehler-zeile";
    const uhrzeit = new Date(eintrag.zeit).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    const nummern = eintrag.nummern.map((n) => "#" + n).join(", ");
    zeile.textContent = uhrzeit + " — " + nummern + " — " + eintrag.grund;
    liste.appendChild(zeile);
  }
}

function neuerSatz() {
  if (!confirm("Nächsten Satz starten? Aufstellung und Fehler-Log dieses Satzes werden zurückgesetzt, der Spielstand (Sätze) bleibt erhalten.")) return;
  zustand.satz = leererZustand().satz;
  zustand.historie = [];
  liberoModusAktiv = false;
  speichern();
  renderAufstellungOptionen();
  aktualisiereZielpunktzahlVorschlag();
  zeigeAnsicht("aufstellung");
}

function neuesMatch() {
  if (!confirm("Neues Match starten? Sätze, Punktestand und die gesamte Statistik werden zurückgesetzt. Der Kader bleibt erhalten.")) return;
  const basis = leererZustand();
  zustand.match = basis.match;
  zustand.satz = basis.satz;
  zustand.historie = [];
  liberoModusAktiv = false;
  speichern();
  renderAufstellungOptionen();
  aktualisiereZielpunktzahlVorschlag();
  zeigeAnsicht("aufstellung");
}

// ---------- Alles zusammen rendern ----------

function renderAlles() {
  renderKader();
  renderAufstellungOptionen();
  renderSpielfeld();
  renderFehlerListe();
}

// ---------- Events verdrahten ----------

window.addEventListener("DOMContentLoaded", () => {
  document.getElementById("nav-kader").addEventListener("click", () => zeigeAnsicht("kader"));
  document.getElementById("nav-aufstellung").addEventListener("click", () => zeigeAnsicht("aufstellung"));
  document.getElementById("nav-spiel").addEventListener("click", () => zeigeAnsicht("spiel"));

  document.getElementById("kader-hinzufuegen").addEventListener("click", kaderSpielerHinzufuegen);
  document.getElementById("neue-nummer").addEventListener("keydown", (e) => {
    if (e.key === "Enter") kaderSpielerHinzufuegen();
  });

  document.getElementById("aufstellung-uebernehmen").addEventListener("click", aufstellungUebernehmen);

  document.getElementById("punkt-uns").addEventListener("click", punktFuerUns);
  document.getElementById("punkt-gegner").addEventListener("click", punktFuerGegnerStarten);
  document.getElementById("fehler-abbrechen").addEventListener("click", punktFuerGegnerAbbrechen);
  for (const grund of FEHLER_GRUENDE) {
    const btn = document.querySelector('[data-grund="' + grund + '"]');
    if (btn) btn.addEventListener("click", () => fehlerBestaetigen(grund));
  }

  document.getElementById("libero-icon").addEventListener("pointerdown", liberoIconPointerDown);

  document.getElementById("rueckgaengig").addEventListener("click", rueckgaengig);
  document.getElementById("neuer-satz").addEventListener("click", neuerSatz);
  document.getElementById("neues-match").addEventListener("click", neuesMatch);

  renderAlles();
  aktualisiereZielpunktzahlVorschlag();
  zeigeAnsicht(zustand.satz.laeuft ? "spiel" : "kader");
});
