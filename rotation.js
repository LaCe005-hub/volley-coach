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
//
// Hinterfeld = Index 0, 4, 5 (Positionen 1, 5, 6)
// Vorderfeld = Index 1, 2, 3 (Positionen 2, 3, 4)

const HINTERFELD_INDIZES = [0, 4, 5];

function istHinterfeld(index) {
  return HINTERFELD_INDIZES.includes(index);
}

function istAufschlagPosition(index) {
  return index === 0;
}

// Rotiert die Aufstellung einmal im Uhrzeigersinn (Spieler auf Position 2
// rückt auf Position 1 usw., Spieler auf Position 1 geht auf Position 6).
function rotiereAufstellung(positionen) {
  return positionen.slice(1).concat(positionen[0]);
}

// Wird nach jedem Punkt aufgerufen. Gibt die neue Aufstellung + den neuen
// Aufschlag-Status zurück. Rotiert wird nur, wenn die eigene Mannschaft
// den Aufschlag NEU gewinnt (Seitenwechsel zu uns), nicht bei jedem Punkt
// im eigenen Aufschlag und nicht, wenn wir den Punkt verlieren.
function naechsterZustandNachPunkt(positionen, wirAmAufschlag, punktFuerUns) {
  if (punktFuerUns) {
    if (wirAmAufschlag) {
      // Wir schlagen weiter auf, keine Rotation.
      return { positionen, wirAmAufschlag: true };
    }
    // Seitenwechsel zu uns: einmal rotieren, dann aufschlagen.
    return { positionen: rotiereAufstellung(positionen), wirAmAufschlag: true };
  }
  if (wirAmAufschlag) {
    // Wir verlieren den Punkt im eigenen Aufschlag: Seitenwechsel zum Gegner,
    // wir rotieren nicht.
    return { positionen, wirAmAufschlag: false };
  }
  // Gegner schlägt weiter auf, keine Rotation.
  return { positionen, wirAmAufschlag: false };
}

// Berechnet, was auf jeder der 6 Positionen tatsächlich angezeigt werden
// soll — inklusive automatischer Libero-Logik (klassische Regel: Libero
// schlägt nie auf).
//
// libero: { liberoNummer, ersetztSpieler } oder null
function berechneAnzeige(positionen, libero) {
  return positionen.map((spielerNummer, index) => {
    let anzeigeNummer = spielerNummer;
    let liberoAktiv = false;

    if (libero && libero.ersetztSpieler === spielerNummer) {
      const liberoDarfHierStehen = istHinterfeld(index) && !istAufschlagPosition(index);
      if (liberoDarfHierStehen) {
        anzeigeNummer = libero.liberoNummer;
        liberoAktiv = true;
      }
      // Vorderfeld oder Aufschlagposition: Originalspieler bleibt sichtbar,
      // der Libero sitzt in diesem Moment "draußen".
    }

    return {
      position: index + 1,
      originalSpieler: spielerNummer,
      anzeigeNummer,
      liberoAktiv,
      istHinterfeld: istHinterfeld(index),
      istAufschlagPosition: istAufschlagPosition(index),
    };
  });
}
