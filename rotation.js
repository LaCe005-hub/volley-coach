// rotation.js — reine Spiellogik, keine Darstellung, kein Speichern.
// Wird von app.js benutzt. Bewusst getrennt, damit die Regeln an einer
// Stelle stehen und nicht zwischen UI-Code verstreut sind.

// Positionen: Index 0..5 entsprechen den Volleyball-Positionen 1..6.
// Position 1 (Index 0) = Aufschlagposition (Hinterfeld rechts)
// Position 2 (Index 1) = Vorne rechts
// Position 3 (Index 2) = Vorne Mitte
// Position 4 (Index 3) = Vorne links
// Position 5 (Index 4) = Hinten links
// Position 6 (Index 5) = Hinten Mitte

// Rotiert die Aufstellung einmal im Uhrzeigersinn (Spieler auf Position 2
// rückt auf Position 1 usw., Spieler auf Position 1 geht auf Position 6).
function rotiereAufstellung(positionen) {
  return positionen.slice(1).concat(positionen[0]);
}

// Wird nach jedem Punkt aufgerufen. Gibt die neue Aufstellung, den neuen
// Aufschlag-Status und ob dabei tatsächlich rotiert wurde zurück. Rotiert
// wird nur, wenn die eigene Mannschaft den Aufschlag NEU gewinnt
// (Seitenwechsel zu uns), nicht bei jedem Punkt im eigenen Aufschlag und
// nicht, wenn wir den Punkt verlieren.
function naechsterZustandNachPunkt(positionen, wirAmAufschlag, punktFuerUns) {
  if (punktFuerUns) {
    if (wirAmAufschlag) {
      // Wir schlagen weiter auf, keine Rotation.
      return { positionen, wirAmAufschlag: true, rotiert: false };
    }
    // Seitenwechsel zu uns: einmal rotieren, dann aufschlagen.
    return { positionen: rotiereAufstellung(positionen), wirAmAufschlag: true, rotiert: true };
  }
  if (wirAmAufschlag) {
    // Wir verlieren den Punkt im eigenen Aufschlag: Seitenwechsel zum Gegner,
    // wir rotieren nicht.
    return { positionen, wirAmAufschlag: false, rotiert: false };
  }
  // Gegner schlägt weiter auf, keine Rotation.
  return { positionen, wirAmAufschlag: false, rotiert: false };
}

// Was auf jeder der 6 Positionen angezeigt wird. Der Libero ist eine reine
// Anzeige-Überlagerung (liberoImFeld), die Aufstellung (positionen) selbst
// wird davon nie verändert — der Trainer tauscht den Libero manuell rein
// und raus, unabhängig von der Rotation.
//
// liberoImFeld: { positionIndex, liberoNummer } oder null
function berechneAnzeige(positionen, liberoImFeld) {
  return positionen.map((spielerNummer, index) => {
    const liberoHier = !!(liberoImFeld && liberoImFeld.positionIndex === index);
    return {
      position: index + 1,
      originalSpieler: spielerNummer,
      anzeigeNummer: liberoHier ? liberoImFeld.liberoNummer : spielerNummer,
      liberoAktiv: liberoHier,
      istAufschlagPosition: index === 0,
    };
  });
}

// "Läufer X" ist eine gängige Trainer-Bezeichnung für die Rotation: X ist die
// Position, auf der aktuell der Zuspieler steht (in der echten Aufstellung,
// unabhängig von einer eventuellen Libero-Überlagerung). Damit weiß man
// sofort, in welcher der 6 Rotationen man gerade spielt.
// Gibt die Positionsnummer (1-6) zurück, oder null, wenn der Zuspieler nicht
// in der aktuellen Aufstellung steht (z. B. weil er ausgewechselt wurde).
function berechneLaeufer(positionen, zuspielerNummer) {
  if (!zuspielerNummer) return null;
  const index = positionen.indexOf(zuspielerNummer);
  return index === -1 ? null : index + 1;
}

// Ein Satz ist beendet, wenn eine Mannschaft die Zielpunktzahl erreicht hat
// UND mindestens 2 Punkte Vorsprung hat (Standard-Volleyball-Regel). Für den
// Entscheidungssatz kann die Zielpunktzahl auf 15 gesetzt werden statt der
// üblichen 25 — das schlägt die App automatisch vor (siehe istEntscheidungssatz).
function satzIstBeendet(punkteWir, punkteGegner, zielPunktzahl) {
  const fuehrenderVorsprung = Math.abs(punkteWir - punkteGegner);
  const hoechsterStand = Math.max(punkteWir, punkteGegner);
  return hoechsterStand >= zielPunktzahl && fuehrenderVorsprung >= 2;
}

// Wie viele Sätze eine Mannschaft gewinnen muss, um das Match zu gewinnen.
// Best of 3 -> 2 Sätze, Best of 5 -> 3 Sätze.
function benoetigteSatzgewinne(format) {
  return Math.ceil(format / 2);
}

// Match ist beendet, sobald eine Mannschaft die nötige Anzahl Sätze hat.
function matchIstBeendet(saetzeWir, saetzeGegner, format) {
  const noetig = benoetigteSatzgewinne(format);
  return saetzeWir >= noetig || saetzeGegner >= noetig;
}

// Der jeweils letzte mögliche Satz eines Formats (3. Satz bei Best of 3,
// 5. Satz bei Best of 5) ist der Entscheidungssatz und wird standardmäßig
// nur bis 15 statt bis 25 gespielt. "naechsteSatznummer" ist die Nummer des
// Satzes, der als Nächstes gespielt wird (bereits gewonnene Sätze + 1).
function istEntscheidungssatz(saetzeWir, saetzeGegner, format) {
  const naechsteSatznummer = saetzeWir + saetzeGegner + 1;
  return naechsteSatznummer === format;
}
