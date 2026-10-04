// app.js — Kaderverwaltung, Aufstellung, Spiel-Ansicht, Speicherung.
// Nutzt die reinen Funktionen aus rotation.js. Alles wird in localStorage
// gespeichert, kein Server nötig.

const SPEICHER_SCHLUESSEL = "volleyCoachState";
const FEHLER_GRUENDE = ["Aufschlag", "Annahme", "Angriff", "Block", "Netz", "Sonstige"];

// ---------- Zustand ----------

function leererZustand() {
  return {
    kader: [], // [{nummer, istLibero}]
    satz: {
      positionen: [null, null, null, null, null, null],
      libero: null, // {liberoNummer, ersetztSpieler}
      wirAmAufschlag: true,
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
    return { ...leererZustand(), ...geladen };
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
    liberoLabel.className = "kader-libero-label";
    const liberoCheckbox = document.createElement("input");
    liberoCheckbox.type = "checkbox";
    liberoCheckbox.checked = spieler.istLibero;
    liberoCheckbox.addEventListener("change", () => {
      spieler.istLibero = liberoCheckbox.checked;
      speichern();
      renderAufstellungOptionen();
    });
    liberoLabel.appendChild(liberoCheckbox);
    liberoLabel.appendChild(document.createTextNode(" Libero"));
    zeile.appendChild(liberoLabel);

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
  zustand.kader.push({ nummer, istLibero: false });
  zustand.kader.sort((a, b) => a.nummer - b.nummer);
  speichern();
  eingabe.value = "";
  renderKader();
  renderAufstellungOptionen();
}

// ---------- Aufstellung-Ansicht ----------

function renderAufstellungOptionen() {
  // 6 Positions-Dropdowns mit allen Kader-Spielern befüllen.
  for (let i = 0; i < 6; i++) {
    const select = document.getElementById("pos-" + (i + 1));
    const aktuelleAuswahl = select.value;
    select.innerHTML = '<option value="">—</option>';
    for (const spieler of zustand.kader) {
      const option = document.createElement("option");
      option.value = spieler.nummer;
      option.textContent = "#" + spieler.nummer;
      select.appendChild(option);
    }
    if (aktuelleAuswahl) select.value = aktuelleAuswahl;
  }

  // Libero-Dropdown: nur Spieler, die als Libero markiert sind.
  const liberoSelect = document.getElementById("libero-nummer");
  const aktuelleLiberoAuswahl = liberoSelect.value;
  liberoSelect.innerHTML = '<option value="">Kein Libero</option>';
  for (const spieler of zustand.kader.filter((s) => s.istLibero)) {
    const option = document.createElement("option");
    option.value = spieler.nummer;
    option.textContent = "#" + spieler.nummer;
    liberoSelect.appendChild(option);
  }
  if (aktuelleLiberoAuswahl) liberoSelect.value = aktuelleLiberoAuswahl;
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

  const liberoNummer = document.getElementById("libero-nummer").value;
  const ersetztSpieler = document.getElementById("libero-ersetzt").value;
  let libero = null;
  if (liberoNummer) {
    if (!ersetztSpieler) {
      alert("Bitte festlegen, welchen Spieler der Libero ersetzt.");
      return;
    }
    libero = { liberoNummer: parseInt(liberoNummer, 10), ersetztSpieler: parseInt(ersetztSpieler, 10) };
  }

  const wirAmAufschlag = document.getElementById("aufschlag-wir").checked;

  zustand.satz = {
    positionen,
    libero,
    wirAmAufschlag,
    fehler: [],
    laeuft: true,
  };
  zustand.historie = [];
  speichern();
  renderAlles();
  zeigeAnsicht("spiel");
}

function renderLiberoErsetztOptionen() {
  // Welche Spieler kann der Libero ersetzen? Die 6, die gerade in den
  // Positions-Dropdowns ausgewählt sind.
  const select = document.getElementById("libero-ersetzt");
  const aktuelleAuswahl = select.value;
  const ausgewaehlte = [];
  for (let i = 1; i <= 6; i++) {
    const wert = document.getElementById("pos-" + i).value;
    if (wert) ausgewaehlte.push(wert);
  }
  select.innerHTML = '<option value="">—</option>';
  for (const nummer of ausgewaehlte) {
    const option = document.createElement("option");
    option.value = nummer;
    option.textContent = "#" + nummer;
    select.appendChild(option);
  }
  if (aktuelleAuswahl) select.value = aktuelleAuswahl;
}

// ---------- Spiel-Ansicht ----------

// Reihenfolge der Index-Positionen für die Court-Darstellung:
// oben = Netzseite (Vorderfeld), unten = Hinterfeld.
const COURT_OBEN = [3, 2, 1]; // Positionen 4, 3, 2
const COURT_UNTEN = [4, 5, 0]; // Positionen 5, 6, 1 (1 = Aufschlag)

function renderSpielfeld() {
  if (!zustand.satz.laeuft) return;

  const anzeige = berechneAnzeige(zustand.satz.positionen, zustand.satz.libero);

  const renderReihe = (containerId, indexReihenfolge) => {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    for (const index of indexReihenfolge) {
      const info = anzeige[index];
      const kachel = document.createElement("button");
      kachel.className = "court-kachel";
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
        liberoSpan.className = "court-libero-markierung";
        liberoSpan.textContent = "Libero";
        kachel.appendChild(liberoSpan);
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
}

function spielerWechseln(index) {
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

function punktFuerUns() {
  sichereHistorie();
  const ergebnis = naechsterZustandNachPunkt(zustand.satz.positionen, zustand.satz.wirAmAufschlag, true);
  zustand.satz.positionen = ergebnis.positionen;
  zustand.satz.wirAmAufschlag = ergebnis.wirAmAufschlag;
  speichern();
  renderSpielfeld();
}

let ausstehenderPunktverlust = false;

function punktFuerGegnerStarten() {
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
  const anzeige = berechneAnzeige(zustand.satz.positionen, zustand.satz.libero);
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

  const ergebnis = naechsterZustandNachPunkt(zustand.satz.positionen, zustand.satz.wirAmAufschlag, false);
  zustand.satz.positionen = ergebnis.positionen;
  zustand.satz.wirAmAufschlag = ergebnis.wirAmAufschlag;

  speichern();
  ausstehenderPunktverlust = false;
  document.getElementById("fehler-dialog").classList.remove("aktiv");
  delete container.dataset.ausgewaehlt;
  renderSpielfeld();
  renderFehlerListe();
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
  if (!confirm("Neuen Satz starten? Die aktuelle Aufstellung und das Fehler-Log werden zurückgesetzt.")) return;
  zustand.satz = leererZustand().satz;
  zustand.historie = [];
  speichern();
  renderAufstellungOptionen();
  renderLiberoErsetztOptionen();
  zeigeAnsicht("aufstellung");
}

// ---------- Alles zusammen rendern ----------

function renderAlles() {
  renderKader();
  renderAufstellungOptionen();
  renderLiberoErsetztOptionen();
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

  for (let i = 1; i <= 6; i++) {
    document.getElementById("pos-" + i).addEventListener("change", renderLiberoErsetztOptionen);
  }
  document.getElementById("aufstellung-uebernehmen").addEventListener("click", aufstellungUebernehmen);

  document.getElementById("punkt-uns").addEventListener("click", punktFuerUns);
  document.getElementById("punkt-gegner").addEventListener("click", punktFuerGegnerStarten);
  document.getElementById("fehler-abbrechen").addEventListener("click", punktFuerGegnerAbbrechen);
  for (const grund of FEHLER_GRUENDE) {
    const btn = document.querySelector('[data-grund="' + grund + '"]');
    if (btn) btn.addEventListener("click", () => fehlerBestaetigen(grund));
  }

  document.getElementById("rueckgaengig").addEventListener("click", rueckgaengig);
  document.getElementById("neuer-satz").addEventListener("click", neuerSatz);

  renderAlles();
  zeigeAnsicht(zustand.satz.laeuft ? "spiel" : "kader");
});
