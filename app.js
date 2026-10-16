// app.js — Kaderverwaltung, Aufstellung, Spiel-Ansicht, Speicherung.
// Nutzt die reinen Funktionen aus rotation.js. Alles wird in localStorage
// gespeichert, kein Server nötig.

const SPEICHER_SCHLUESSEL = "volleyCoachState";
const FEHLER_GRUENDE = ["Aufschlag", "Annahme", "Angriff", "Block", "Netz", "Kommunikation", "Unglück", "Sonstige"];
const ZIELPUNKTZAHL_STANDARD = 25;

// ---------- Zustand ----------

function leererZustand() {
  return {
    kader: [], // [{nummer, istLibero, istZuspieler}]
    satz: {
      positionen: [null, null, null, null, null, null],
      liberoImFeld: null, // {positionIndex, liberoNummer} — reine Anzeige-Überlagerung, rührt "positionen" nie an
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
    return { ...basis, ...geladen, satz: { ...basis.satz, ...(geladen.satz || {}) } };
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

    const liberoLabel = document.createElement("label");
    liberoLabel.className = "kader-markierung-label";
    const liberoCheckbox = document.createElement("input");
    liberoCheckbox.type = "checkbox";
    liberoCheckbox.checked = !!spieler.istLibero;
    liberoCheckbox.addEventListener("change", () => {
      spieler.istLibero = liberoCheckbox.checked;
      speichern();
    });
    liberoLabel.appendChild(liberoCheckbox);
    liberoLabel.appendChild(document.createTextNode(" Libero"));
    zeile.appendChild(liberoLabel);

    const zuspielerLabel = document.createElement("label");
    zuspielerLabel.className = "kader-markierung-label";
    const zuspielerCheckbox = document.createElement("input");
    zuspielerCheckbox.type = "checkbox";
    zuspielerCheckbox.checked = !!spieler.istZuspieler;
    zuspielerCheckbox.addEventListener("change", () => {
      spieler.istZuspieler = zuspielerCheckbox.checked;
      speichern();
      renderSpielfeld();
    });
    zuspielerLabel.appendChild(zuspielerCheckbox);
    zuspielerLabel.appendChild(document.createTextNode(" Zuspieler"));
    zeile.appendChild(zuspielerLabel);

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
  zustand.kader.push({ nummer, istLibero: false, istZuspieler: false });
  zustand.kader.sort((a, b) => a.nummer - b.nummer);
  speichern();
  eingabe.value = "";
  renderKader();
  renderAufstellungOptionen();
}

// ---------- Aufstellung-Ansicht ----------

function renderAufstellungOptionen() {
  // 6 Positions-Dropdowns mit allen Kader-Spielern befüllen (Libero steht
  // hier nicht zur Wahl — der kommt erst live im Spiel per Tausch dazu).
  for (let i = 0; i < 6; i++) {
    const select = document.getElementById("pos-" + (i + 1));
    const aktuelleAuswahl = select.value;
    select.innerHTML = '<option value="">—</option>';
    for (const spieler of zustand.kader.filter((s) => !s.istLibero)) {
      const option = document.createElement("option");
      option.value = spieler.nummer;
      option.textContent = "#" + spieler.nummer;
      select.appendChild(option);
    }
    if (aktuelleAuswahl) select.value = aktuelleAuswahl;
  }
}

function aufstellungUebernehmen() {
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
  const zuspielerKader = zustand.kader.find((s) => s.istZuspieler);

  const renderReihe = (containerId, indexReihenfolge) => {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    for (const index of indexReihenfolge) {
      const info = anzeige[index];
      const kachel = document.createElement("button");
      kachel.className = "court-kachel pos-" + info.position;
      if (info.istAufschlagPosition) kachel.classList.add("aufschlag-position");
      if (info.liberoAktiv) kachel.classList.add("libero-aktiv");
      if (zuspielerKader && info.originalSpieler === zuspielerKader.nummer) kachel.classList.add("zuspieler-aktiv");

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
        liberoSpan.textContent = "Libero";
        kachel.appendChild(liberoSpan);
      }
      if (zuspielerKader && info.originalSpieler === zuspielerKader.nummer) {
        const zSpan = document.createElement("span");
        zSpan.className = "court-markierung court-markierung-zuspieler";
        zSpan.textContent = "Zuspieler";
        kachel.appendChild(zSpan);
      }

      kachel.addEventListener("click", () => spielerWechseln(index));
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

  renderLiberoKontrollen();
  renderSatzEndeBanner();
}

function spielerWechseln(index) {
  if (zustand.satz.beendet) return;
  const aktuelleNummer = zustand.satz.positionen[index];
  const auswahl = zustand.kader
    .filter((s) => !s.istLibero)
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

// ---------- Libero: manuelles Rein-/Raus-/Verschieben-Tauschen ----------
// Reine Anzeige-Überlagerung (satz.liberoImFeld) — "positionen" (die echte
// Rotation) wird dabei NIE verändert. Bei jeder tatsächlichen Rotation wird
// die Überlagerung automatisch gelöscht (siehe punktFuerUns/fehlerBestaetigen),
// damit nie ein veralteter Libero-Platz stehen bleibt — der Trainer tauscht
// den Libero danach einfach neu ein, falls nötig.

function liberoKandidaten() {
  return zustand.kader.filter((s) => s.istLibero);
}

function liberoReinnehmen() {
  const kandidaten = liberoKandidaten();
  if (kandidaten.length === 0) {
    alert("Kein Spieler ist im Kader als Libero markiert.");
    return;
  }
  let liberoNummer = kandidaten[0].nummer;
  if (kandidaten.length > 1) {
    const eingabe = prompt("Welcher Libero? (" + kandidaten.map((s) => s.nummer).join(", ") + ")", liberoNummer);
    if (eingabe === null) return;
    liberoNummer = parseInt(eingabe, 10);
    if (!kandidaten.some((s) => s.nummer === liberoNummer)) {
      alert("Unbekannte Libero-Nummer.");
      return;
    }
  }
  const posEingabe = prompt("Für welche Position (1-6) soll der Libero reinkommen?");
  if (posEingabe === null) return;
  const position = parseInt(posEingabe, 10);
  if (!(position >= 1 && position <= 6)) {
    alert("Bitte eine Zahl von 1 bis 6 eingeben.");
    return;
  }
  if (position === 1) {
    if (!confirm("Position 1 ist die Aufschlagposition — laut Regel schlägt der Libero nicht auf. Trotzdem fortfahren?")) {
      return;
    }
  }
  sichereHistorie();
  zustand.satz.liberoImFeld = { positionIndex: position - 1, liberoNummer };
  speichern();
  renderSpielfeld();
}

function liberoRausnehmen() {
  if (!zustand.satz.liberoImFeld) return;
  sichereHistorie();
  zustand.satz.liberoImFeld = null;
  speichern();
  renderSpielfeld();
}

function liberoVerschieben() {
  if (!zustand.satz.liberoImFeld) return;
  const posEingabe = prompt("Libero auf welche Position (1-6) verschieben?");
  if (posEingabe === null) return;
  const position = parseInt(posEingabe, 10);
  if (!(position >= 1 && position <= 6)) {
    alert("Bitte eine Zahl von 1 bis 6 eingeben.");
    return;
  }
  if (position === 1 && !confirm("Position 1 ist die Aufschlagposition — laut Regel schlägt der Libero nicht auf. Trotzdem fortfahren?")) {
    return;
  }
  sichereHistorie();
  zustand.satz.liberoImFeld.positionIndex = position - 1;
  speichern();
  renderSpielfeld();
}

function renderLiberoKontrollen() {
  const status = document.getElementById("libero-status");
  const reinBtn = document.getElementById("libero-rein");
  const rausBtn = document.getElementById("libero-raus");
  const verschiebenBtn = document.getElementById("libero-verschieben");

  const aktiv = zustand.satz.liberoImFeld;
  if (!aktiv) {
    status.textContent = "Libero draußen";
    reinBtn.style.display = "";
    rausBtn.style.display = "none";
    verschiebenBtn.style.display = "none";
  } else {
    status.textContent = "Libero (#" + aktiv.liberoNummer + ") auf Pos. " + (aktiv.positionIndex + 1);
    reinBtn.style.display = "none";
    rausBtn.style.display = "";
    verschiebenBtn.style.display = "";
  }
}

// ---------- Punkte, Rotation, Satzende ----------

function pruefeSatzende() {
  const { wir, gegner } = zustand.satz.punkte;
  if (satzIstBeendet(wir, gegner, zustand.satz.zielPunktzahl)) {
    zustand.satz.beendet = true;
  }
}

function rotationAnwenden(ergebnis) {
  zustand.satz.positionen = ergebnis.positionen;
  zustand.satz.wirAmAufschlag = ergebnis.wirAmAufschlag;
  if (ergebnis.rotiert) {
    // Die Hauptaufstellung hat sich gedreht — ein alter Libero-Platz wäre
    // jetzt falsch. Der Trainer tauscht den Libero bei Bedarf neu ein.
    zustand.satz.liberoImFeld = null;
  }
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

function punktFuerGegnerStarten() {
  if (zustand.satz.beendet) return;
  ausstehenderPunktverlust = true;
  document.getElementById("fehler-dialog").classList.add("aktiv");
  renderFehlerDialogSpielerListe();
}

function punktFuerGegnerAbbrechen() {
  ausstehenderPunktverlust = false;
  document.getElementById("fehler-dialog").classList.remove("aktiv");
}

function renderFehlerDialogSpielerListe() {
  const container = document.getElementById("fehler-spieler-liste");
  container.innerHTML = "";
  // Alle gerade auf dem Feld sichtbaren Nummern (inkl. Libero) anbieten.
  const anzeige = berechneAnzeige(zustand.satz.positionen, zustand.satz.liberoImFeld);
  const sichtbareNummern = [...new Set(anzeige.map((a) => a.anzeigeNummer))];
  for (const nummer of sichtbareNummern) {
    const btn = document.createElement("button");
    btn.className = "btn-klein";
    btn.textContent = "#" + nummer;
    btn.addEventListener("click", () => {
      [...container.children].forEach((b) => b.classList.remove("ausgewaehlt"));
      btn.classList.add("ausgewaehlt");
      container.dataset.ausgewaehlt = nummer;
    });
    container.appendChild(btn);
  }
}

function fehlerBestaetigen(grund) {
  if (!ausstehenderPunktverlust) return;
  const container = document.getElementById("fehler-spieler-liste");
  const nummer = container.dataset.ausgewaehlt;
  if (!nummer) {
    alert("Bitte zuerst den Spieler auswählen.");
    return;
  }

  sichereHistorie();
  zustand.satz.fehler.push({ nummer: parseInt(nummer, 10), grund, zeit: new Date().toISOString() });
  zustand.satz.punkte.gegner++;

  const ergebnis = naechsterZustandNachPunkt(zustand.satz.positionen, zustand.satz.wirAmAufschlag, false);
  rotationAnwenden(ergebnis);
  pruefeSatzende();

  speichern();
  ausstehenderPunktverlust = false;
  document.getElementById("fehler-dialog").classList.remove("aktiv");
  delete container.dataset.ausgewaehlt;
  renderSpielfeld();
  renderFehlerListe();
}

function renderSatzEndeBanner() {
  const banner = document.getElementById("satz-ende-banner");
  const punktBtns = document.getElementById("punkt-buttons");
  if (!zustand.satz.beendet) {
    banner.classList.remove("aktiv");
    punktBtns.classList.remove("ausgeblendet");
    return;
  }
  const { wir, gegner } = zustand.satz.punkte;
  banner.textContent = wir > gegner ? "Satz gewonnen " + wir + ":" + gegner + " 🎉" : "Satz verloren " + wir + ":" + gegner;
  banner.classList.add("aktiv");
  punktBtns.classList.add("ausgeblendet");
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
    zeile.textContent = uhrzeit + " — #" + eintrag.nummer + " — " + eintrag.grund;
    liste.appendChild(zeile);
  }
}

function neuerSatz() {
  if (!confirm("Neuen Satz starten? Die aktuelle Aufstellung, der Punktestand und das Fehler-Log werden zurückgesetzt.")) return;
  zustand.satz = leererZustand().satz;
  zustand.historie = [];
  speichern();
  renderAufstellungOptionen();
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

  document.getElementById("libero-rein").addEventListener("click", liberoReinnehmen);
  document.getElementById("libero-raus").addEventListener("click", liberoRausnehmen);
  document.getElementById("libero-verschieben").addEventListener("click", liberoVerschieben);

  document.getElementById("rueckgaengig").addEventListener("click", rueckgaengig);
  document.getElementById("neuer-satz").addEventListener("click", neuerSatz);

  renderAlles();
  zeigeAnsicht(zustand.satz.laeuft ? "spiel" : "kader");
});
