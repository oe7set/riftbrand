# Riftbrand: Game Design Document

> Status: v0.1 (Planungsphase) · Stand: 2026-10-22
> **Hinweis (2026-10-23):** Der Product Owner hat den Ausbau erweitert: Zauber mit Aura, Upgrade-Stufen, Duell-Räume mit Mini-Bossen, animierte Körper, Icon-Set, eine begehbare Zuflucht mit freier Weltwahl per Portal (ein Run = eine Welt), Wiederaufbau, Quests und Rüstungen. Die Entscheidungen stehen in der [ROADMAP](./ROADMAP.md#product-owner-entscheidungen-2026-10-23). Die betroffenen Abschnitte dieses Dokuments (u. a. §3, §4, §6, §7, §12) werden im jeweiligen Paket angepasst und gelten bis dahin nur, soweit sie den Entscheidungen nicht widersprechen.
> Alle Zahlen sind **Startwerte zum Tunen**, keine finalen Werte. Sie liegen später als Tuning-Daten im Code und sind über das Debug-Menü live veränderbar.

---

## 1. Überblick

**Pitch:** *Der Brand hat die Welt zerrissen. Du trägst sein Mal.*
Riftbrand ist ein 2D-Action-Roguelike im Browser. Die Spielfigur, die „Gebrandmarkte“, kämpft sich durch die zerbrochenen Fragmente einer Welt zum Ursprung des Risses. Weil das Brandmal sie nicht sterben lässt, kehrt sie nach jedem Tod in die letzte Zuflucht zurück. Dort wird sie stärker, die Zuflucht wächst, und Stück für Stück zeigt sich, warum gerade sie gezeichnet wurde.

| | |
|---|---|
| Genre | Action-Roguelike (Hades × Vampire Survivors × fairer Souls-Kampf) |
| Plattform | Browser (PWA), mobile-first. Touch, Maus/Tastatur und Gamepad sind gleichwertig. Später Steam. |
| Ausrichtung | Quer- und Hochformat (Querformat ist primär) |
| Run-Länge | 20–30 min, unterbrechbar (Speichern an jeder Raumgrenze) |
| Zielgruppe | Action-Roguelike-Fans (Hades, Dead Cells, Vampire Survivors) sowie Mobile-Spieler, die „echte“ Action ohne Pay-to-Win suchen |
| Ton | Mythisch und stilvoll, düster mit Wärme und Witz |
| Look | Neon-Vektor: leuchtende geometrische Formen auf dunklem Grund, viel Licht und viele Partikel |

### 1.1 Design-Säulen
Jede Feature-Entscheidung wird gegen diese fünf Säulen geprüft. Wenn ein Feature keiner davon dient, kommt es nicht ins Spiel.

1. **Game Feel zuerst.** Jede Aktion hat sofort spürbares Feedback in Bild, Ton und Haptik. Steuerung reagiert ohne Verzögerung, und Eingaben gehen nie verloren.
2. **Fair, aber fordernd.** Jeder Tod ist lesbar und vermeidbar. Gegner telegraphieren, und der Spieler hat immer eine Antwort (Dash, Positionierung, Unterbrechen).
3. **Builds, die das Spiel brechen.** Am Ende eines guten Runs fühlt man sich übermächtig. Synergien sind entdeckbar, stapelbar und überraschend.
4. **Jeder Run bringt etwas.** Auch ein gescheiterter Run bringt Fortschritt in Währung, Story, Codex oder Freischaltungen.
5. **Überall spielbar.** Fünf Minuten im Bus und zwei Stunden am PC sind gleich gut möglich. Keine Eingabemethode ist zweite Wahl.

---

## 2. Setting und Story

### 2.1 Die Welt
Vor langer Zeit brach der **Brand** aus, ein kosmisches Feuer aus einem Riss jenseits der Welt. Die Welt zerbrach in schwebende **Fragmente**, die im Nichts treiben und jeweils in einem anderen Zustand erstarrt sind. Durch die Risse sickern Wesen von „drüben“, und mit ihnen kommen Mächte, die manche Bewohner verehren und andere fürchten.

Im Zentrum aller Fragmente liegt das **Herz des Brandes**. Niemand, der dorthin aufgebrochen ist, kehrte zurück, außer der Spielfigur, und zwar immer wieder.

### 2.2 Die Spielfigur: die Gebrandmarkte
- Arbeitsname: **Vesper**. Die Figur ist bewusst geschlechtsneutral gestaltet, Pronomen werden in Texten vermieden oder neutral gehalten.
- Sie trägt ein leuchtendes **Brandmal**. Stirbt sie, zerfällt sie zu Glut und setzt sich in der Zuflucht wieder zusammen.
- Story-Frage: *Warum wurde ausgerechnet sie gezeichnet, und was will der Brand von ihr?*
- Persönlichkeit: trocken und humorvoll, müde vom Sterben, aber stur.

### 2.3 Die letzte Zuflucht (Hub)
Ein kleines Fragment am Rand des Risses mit einer Handvoll Überlebender. Die Zuflucht **wächst sichtbar** mit dem Fortschritt: Gebäude entstehen, Figuren ziehen ein, Licht kehrt zurück.

| Figur (Arbeitsname) | Rolle | Funktion |
|---|---|---|
| **Maren, die Hüterin** | Älteste der Zuflucht, mütterlich und streng | Permanente Upgrades gegen **Glut** (der „Glutbaum“) |
| **Toll, der Schmied** | Grummelig, perfektionistisch | Waffen und Aspekte gegen **Rissstaub** |
| **Iskra, die Kartografin** | Neugierig, redet zu schnell | Brand-Stufen (Heat), tägliche bzw. wöchentliche Seeds, Kartenwissen |
| **Der Archivar** | Gesichtslos, spricht in Rätseln | Codex, Prophezeiungen, Lore |
| **Nix, die Händlerin** | Zwielichtig und charmant, taucht auch in Runs auf | Kosmetik, Relikt-Pool-Freischaltungen, Shop-Räume |
| **???** (der Wanderer) | Wird später enthüllt (siehe `docs/STORY.md`) | Treiber der Story und des wahren Endes |

**Umgesetzt (M2.6):** Die Zuflucht ist ein Hub-Bildschirm mit **Maren** (Glutbaum) und **Nix** (schaltet Relikte gegen Rissstaub für den Pool frei: Henkersmal, Zweiter Atem, Atemstein und der Fluch Glasknochen sind anfangs gesperrt). Beide sprechen bei jedem Besuch eine Zeile (ca. 28 Zeilen insgesamt). Die Zuflucht wächst noch nicht sichtbar.

**Umgesetzt (M3.6):** **Sel, die Runenweberin** (ruhig, spricht in Mustern und Schrift) zieht in den Runenturm. Bei ihr schaltet man Zauber dauerhaft gegen Glut und Rissstaub frei und wählt die Ausrüstung (1 aktiver Zauber, 1 Aura) für die nächsten Runs. Zauber, die man im Run gefunden hat, gelten danach als „entdeckt“ und kosten bei ihr die Hälfte.

**Umgesetzt (M5.3), Wiederaufbau:**
- **Materialien:** Jede Welt hat eigene Materialien (Aschefelder: Schlackeeisen und der seltenere Glutkern). Sie fallen in Räumen, bei Elites, in Duellen und bei Bossen und bleiben auch beim Tod erhalten.
- **Bauplätze:** Mit Materialien und Rissstaub baut man sechs Plätze in zwei Stufen aus.
  - Schmiede, Kartentisch und Archiv sind zuerst Ruinen. Beim Wiederaufbau ziehen Toll, Iskra und der Archivar ein.
  - Markt, Runenturm und Lagerfeuer wachsen sichtbar: Lichter, Runenring, Bänke und Laternen.
- **Sichtbares Wachstum:** Mit jedem Ausbau sprießen Pflanzen, und über gebauten Plätzen liegt Licht.
- **Dekorationen** am Lagerfeuer sind reine Kosmetik.

**Umgesetzt (M5.4), Rüstungen:**
- **Toll** stellt in der Schmiede Rüstungsteile her (Kopf, Brust, Hände, Füße) und verbessert sie auf Stufe 2 bzw. 3. Bezahlt wird mit Materialien und Rissstaub.
- **Teile:** Jedes Teil hat einen Grundwert und eine Eigenschaft, z. B. „der Dash hinterlässt einen Glutstoß“.
- **Glut-Set:** Der 2er-Bonus verstärkt Brand; mit 4 Teilen setzt jeder Angriff in Brand.
- **Ausrüstung:** Angelegt wird vor dem Run. Die Teile sind an Vesper sichtbar.
- **Obergrenze:** Rüstung ist Meta-Macht mit festem Endzustand, wie der Glutbaum.

**Umgesetzt (M5.1):** Die Zuflucht ist begehbar. Man kommt am Lagerfeuer an, läuft mit Bewegung und Dash wie im Kampf zu Maren (Glutbaum), Nix (Stand) und Sel (Runenturm) und spricht sie an (E, Angriff oder der Sprechen-Knopf am Handy). Durch die Portalhalle im Norden bricht man zum Run auf. Am Lagerfeuer findet man Profil, Titelbildschirm und Statistik.

### 2.4 Die fünf Riss-Wesen (Segen-Fraktionen)
Die Wesen jenseits des Risses wollen, dass die Gebrandmarkte das Herz erreicht. Jedes hat dafür eigene Gründe. Sie sprechen in kurzen Zeilen, wenn sie Segen anbieten, und kommentieren Kombinationen mit anderen Wesen.

| Wesen | Element | Spielstil | Persönlichkeit | Farbe |
|---|---|---|---|---|
| **Ignara** | Flamme | Brand-Schaden über Zeit, Explosionen, Stapeln | stolz, leidenschaftlich, ungeduldig | Orange/Gold |
| **Vaelis** | Frost | Verlangsamen, Einfrieren, Zerschmettern, Kontrolle | ruhig, kalt, analytisch | Eisblau/Weiß |
| **Kyrr** | Sturm | Kettenblitze, Tempo, Mehrfachtreffer | hektisch, verspielt, frech | Gelb/Violett |
| **Nihl** | Leere | Kritische Treffer, Hinrichtung, Markieren | rätselhaft, leise, unheimlich | Tiefviolett/Schwarz-Magenta |
| **Cruor** | Blut | Lebensraub, Risiko, Stärke bei wenig Leben | verführerisch, gierig, ehrlich | Karmesin |

*Kandidat nach Version 1.0:* **Erz** (Rüstung, Gegenschlag, Verteidigung).

### 2.5 Biome (Fragmente)
| # | Fragment | Thema | Gegner-Thema | Boss (Arbeitsname) |
|---|---|---|---|---|
| 1 | **Aschefelder** | verkohlte Ebene, Glutregen | Schlacke-Wesen, die Grundgegner | **Der Glutwächter**: Koloss mit Flächenangriffen, lehrt das Ausweichen |
| 2 | **Gläserne See** | gefrorenes Meer, Spiegelungen | Kristall-Wesen, Fernkampf, Schilde | **Die Spiegelkönigin**: Klone und Täuschung |
| 3 | **Sturmzitadelle** | zerrissene Burg im ewigen Gewitter | schnelle Gegner, Kettenfallen | **Der Donnerkreis**: Arena-Wechsel, Geschwindigkeit |
| 4 | **Der Riss** | Leere, Geometrie bricht zusammen | Mischung aus allem, verzerrte Elite-Gegner | **Das Herz des Brandes**: mehrphasig, Story-Finale |

**Story-Bibel:** Hauptbogen, Figuren und Enden stehen verbindlich in [`docs/STORY.md`](./STORY.md) (vom PO freigegeben am 2026-10-25).

### 2.6 Erzählweise
- **Kurze Dialoge** mit Hub-Figuren nach jedem Run, ausgewählt nach Kontext: Wie bist du gestorben? Wer hat dich getötet? Welche Wesen hast du gewählt? Was ist neu freigeschaltet?
- Prioritätsgesteuertes Dialogsystem nach dem Vorbild von Hades: wichtige Story-Zeilen zuerst, danach kontextbezogene, danach Füllzeilen. Gesehene Zeilen werden gespeichert.
- **Lore** steckt zusätzlich in Codex-Einträgen, Relikt-Texten und Ereignis-Räumen.
- **Kein Voice-Over.** Stattdessen kurze „Gibberish“-Sounds pro Figur als Charakter-Audio.
- **Story-Bögen:**
  1. Erster Sieg: Das Herz wird besiegt, aber der Brand flammt neu auf. Damit beginnt die Schleife.
  2. Nach mehreren Siegen werden Geheimnisse und der wahre Boss freigeschaltet (siehe Abschnitt 8.7).
  3. Wahres Ende: Die Gebrandmarkte entscheidet, was mit dem Brand geschieht.

---

## 3. Spiel-Loops

```
Moment (Sekunden)  Ausweichen → Treffen → Feedback (Hitstop, Shake, Sound) → Gegner fällt
Raum (30–90 s)     Raum betreten → Spawn-Wellen bekämpfen → Belohnung wählen → nächster Knoten
Run (8–12 min)     Welt im Portal wählen → Map der Welt → Build aufbauen → Welt-Boss → Sieg oder Tod
Meta (Tage)        Glut/Rissstaub ausgeben → Freischaltungen → Story-Dialog → neue Welt offen → nächster Run
```

**Welten (seit M5.2):** Ein Run führt durch genau **eine** Welt (A3). In der Portalhalle der Zuflucht wählt man die Welt auf einer Weltkarte. Wer den Boss einer Welt zum ersten Mal besiegt, öffnet die nächste: Aschefelder → Gläserne See → Sturmzitadelle → Der Riss. Bisher ist nur die Aschefelder spielbar; die anderen Welten stehen schon auf der Karte und kommen mit M6. Der Durchmarsch durch alle Welten am Stück folgt als Endgame-Modus (M7).

**Rätsel-Welten (geplant, M6.0):** Manche Welten bestehen aus kleinen, verbundenen Räumen statt einer Pfad-Karte (ähnlich Cult of the Lamb). Man löst Rätsel mit den eigenen Fähigkeiten, um weiterzukommen: Brand entzündet Feuerschalen, Frost friert Wasser ein, das Riss-Geschoss trifft Kristall-Schalter, der Dash überwindet Lücken. Rätsel-Räume tauchen als Abwechslung auch in normalen Runs auf.

**Spannungsbogen über die Welten** (bis M5 „eines Runs“):
- **Biom 1:** taktisch, wenige Gegner, man lernt den Gegner kennen.
- **Biom 2–3:** Der Build nimmt Form an, Horde-Räume werden größer.
- **Biom 4:** Man ist übermächtig, aber die Bosse fordern trotzdem das Ausweichen.

---

## 4. Kampfsystem

### 4.1 Aktionen
| Aktion | Beschreibung | Kosten | Segen-Slot |
|---|---|---|---|
| **Angriff** | Waffen-Combo mit 3 Schlägen. Halten löst automatisch die Combo aus. | keine | Angriff |
| **Spezialangriff** | Waffenspezifische Fähigkeit | 1 Ausdauer | Spezial |
| **Riss-Geschoss** (Wurf) | Geschoss mit Reichweite. 2 Ladungen, die nach 3 s regenerieren. | 1 Ladung | Wurf |
| **Dash** | kurzer, schneller Sprint mit i-Frames | 1 Ausdauer | Dash |
| **Brandausbruch** (Ultimate) | Lädt sich durch ausgeteilten und erlittenen Schaden auf. Bildschirmweiter Effekt je nach dominantem Wesen. | volle Leiste | Ultimate |
| **Zauber** (aktiv, M3.2) | Zauber im aktiven Slot, z. B. Frostnova | Abklingzeit (10–15 s) | – |
| **Aura** (passiv, M3.2) | Wirkt von selbst in Pulsen um die Figur, z. B. Glutmantel | keine | – |

**Umgesetzt (M2.4), Startwerte:**
- Riss-Geschoss: 16 Schaden, 820 px/s, 480 px Reichweite, trifft den ersten Gegner. Touch: Ziehen vom Wurf-Button zielt (mit Vorschau), Loslassen wirft; Tippen nutzt die Zielhilfe.
- Brandausbruch: Leiste voll nach 900 ausgeteiltem oder 90 erlittenem Schaden und wird in den nächsten Raum mitgenommen. 0,35 s Aufladen (unverwundbar), dann Explosion um die Spielfigur mit kurzer Zeitlupe. Ignara-dominant: 330 px, 60 Schaden, 5 Brand. Vaelis-dominant: 330 px, 35 Schaden, friert alle ein. Ohne Segen: 300 px, 55 Schaden.

**Umgesetzt (M3.2), Zauber-Slots:** Vesper hat zwei Zauber-Slots: einen **aktiven Zauber** (eigene Taste, Abklingzeit) und eine **Aura** (keine Taste, wirkt in Pulsen um die Figur). Zauber sind Daten in `src/content/spells/`. Ein neues Profil startet mit diesen beiden; weitere schaltet man bei Sel frei (M3.6, §2.3):
- **Frostnova** (aktiv): 0,12 s Wirken, dann ein Kältering mit 150 px Radius, 35 Schaden (M3.7, vorher 18), friert alle Gegner darin ein. Abklingzeit 15 s.
- **Glutmantel** (Aura): jede Sekunde 1 Brand an allen Gegnern im Umkreis von 90 px.

**Umgesetzt (M3.3), erste Zauber-Schulen:**

| Schule | Aktiver Zauber | Aura |
|---|---|---|
| Flamme | **Meteor** (14 s): markiert die Zielstelle 240 px voraus, nach 0,5 s Einschlag mit 120 px Radius, 65 Schaden, 3 Brand, starker Rückstoß | **Glutmantel**: jede Sekunde 1 Brand im Umkreis von 90 px |
| Frost | **Frostnova** (15 s): Kältering, 150 px, 35 Schaden, friert ein | **Frosthauch**: alle 1,5 s 1 Kälte im Umkreis von 110 px |
| Gift | **Giftwolke** (12 s): Wolke 200 px voraus, 110 px Radius, 5 s lang alle 0,5 s 1 Gift | **Pestatem**: jede Sekunde 1 Gift im Umkreis von 100 px; vergiftete Gegner zerplatzen beim Tod zu einer kleinen Giftwolke (70 px, 2 s) |
| Licht | **Lichtlanze** (10 s): Strahl 420 px lang, 40 px breit, 50 Schaden, blendet, durchdringt alles | **Heiligenschein**: alle 2 s löst ein Lichtpuls das nächste gegnerische Geschoss im Umkreis von 140 px auf |

- **Quellen:** Kampfräume belohnen jetzt manchmal mit einer **Zauber-Auswahl** (3 Zauber, die man nicht ausgerüstet hat; violette Raute auf der Karte). Nix verkauft einen Zauber für 90 Scherben. Ein neuer Zauber ersetzt den im Slot seiner Art; dessen Stufe bleibt erhalten. Die Auswahl darf man überspringen.
- **Neue Segen:** Ignara „Glutkreis“ (+25 % Aura-Radius, +10 % Zauberschaden, mit Seltenheit mehr), Vaelis „Kalte Konzentration“ (Zauber laden 15 % schneller, mit Seltenheit mehr).
- Am Handy zeigt das Zielen mit dem Zauber-Button Reichweite und Landefläche in der Farbe des Zaubers.

**Umgesetzt (M3.4), Upgrade-Stufen:**
- Jeder Zauber, jede Aura und das Riss-Geschoss wachsen im Run von **Stufe 1 bis 5**. Jede Stufe gibt +20 % Schaden, +6 % Fläche und 6 % kürzere Abklingzeit bzw. schnellere Pulse.
- Auf **Stufe 3 und 5** wählt man zusätzlich einen von zwei **Zweigen**. Beispiele:
  - Riss-Geschoss: Doppel- → Dreifachgeschoss, oder Durchschlag → Schweres Geschoss
  - Meteor: Meteorschauer (3 kleinere) oder Riesenmeteor
  - Lichtlanze: Doppel- → Dreifachlanze, oder Prisma → Fokus
  - Frostnova: Weiter Ring oder Zerschmettern, dann Echo oder Tiefer Winter
- **Runenfragment** (neue Belohnung, weißer Pfeil auf der Karte): Wahl aus 3 Upgrades (bei einer Zweig-Stufe stehen beide Zweige als eigene Karten da). Quellen: 15 % der Kampfräume und alle Horde-Räume. Kampfraum-Belohnungen jetzt: 45 % Segen, 10 % Zauber, 15 % Runenfragment, 18 % Relikt, 12 % Scherben.
- **Glutsplitter** (GDD §7.1) sind Teil derselben Auswahl: Ein Segen steigt eine Stufe (bis Stufe 3); jede Stufe zählt wie 0,6 Seltenheits-Schritte.
- Wird ein Zauber getauscht, übernimmt der neue Stufe und Zweig-Wahl (A/B) des alten.
- Pause → Build zeigt Stufe und Zweige von Zaubern, Aura und Riss-Geschoss sowie Segen-Stufen.

Die Abklingzeit beginnt mit dem Wirken (Abbrechen erstattet nichts) und ist mit Abklingzeit-Verkürzung höchstens um 50 % kürzbar. Die Werte stehen im Debug-Menü unter „spell: …“. Zauber- und Aura-Schaden zählen getrennt für Segen (`spellDamage`) und für den Simulator-Bericht.

**Balancing (M3.7):** Zielwert: Zauber, Auren und Status-Effekte machen zusammen 15–30 % des ausgeteilten Schadens aus, die Waffe bleibt die Hauptsache. Der Simulator zeigt diesen „Magie-Anteil“, die Zauber pro Minute und die Tode durch Mini-Bosse. Stand nach M3.7 (balanced-Bot, 200 Runs): 17,7 % Magie-Anteil, davon 6 % direkter Zauberschaden; Waffe (Angriff, Spezial, Riss-Geschoss) knapp 70 %.

### 4.2 Bewegung und Dash (Startwerte)
- Laufgeschwindigkeit: 220 px/s, beschleunigt in 60 ms, kein Rutschen (sofortiges Abbremsen fühlt sich auf Touch präziser an).
- Dash: 0,18 s, ca. 170 px Weg, **i-Frames für die gesamte Dash-Dauer**. Richtung = Bewegungsrichtung, ohne Eingabe in Blickrichtung.
- Dash bricht die Erholungsphase von Angriffen ab („Animation Cancel“). Das ist wichtig für flüssiges Spielgefühl.
- **Perfekter Dash:** Liegt ein gegnerischer Treffer in den letzten 120 ms vor dem Dash, gibt es:
  - 0,4 s Zeitlupe (30 % Tempo) mit Farbverschiebung und einem „Klang“-Sound
  - der nächste Angriff ist ein garantierter kritischer Treffer
  - ein halbes Ausdauer-Segment zurück
  - Segen können daran anknüpfen (z. B. Vaelis: „Perfekter Dash friert Gegner in der Nähe ein“).

### 4.3 Ausdauer
- 3 Segmente. Regeneration 0,8 s pro Segment, beginnt 0,3 s nach dem letzten Verbrauch.
- Nur Dash und Spezialangriff kosten Ausdauer, normale Angriffe sind frei.
- Bei leerer Ausdauer: Die UI pulsiert, ein kurzer „Fehlschlag“-Sound ertönt, und die Eingabe wird gepuffert, bis wieder ein Segment verfügbar ist (max. 150 ms).

### 4.4 Zielen
- **Weiche Zielhilfe:** Angriffe richten sich auf den nächsten Gegner in einem Kegel von 30° um die Bewegungs- bzw. Zielrichtung (Reichweite waffenabhängig). Ohne Gegner im Kegel geht der Angriff in Blickrichtung.
- **Maus:** Ziel = Cursor, die Zielhilfe ist auf 10° reduziert (abschaltbar).
- **Rechter Stick:** freie Zielrichtung, die Zielhilfe greift im 20°-Kegel.
- **Touch:** Ziehen vom Angriffs- bzw. Wurf-Button aus zielt manuell (eine Zielvorschau wird angezeigt), Tippen nutzt die Zielhilfe.

### 4.5 Leben, Schaden, Heilung
- Start-Leben 100. Treffer geben 0,6 s Unverwundbarkeit mit Blinken.
- **Kein Kontaktschaden** durch bloßes Berühren von Gegnern. Schaden entsteht nur durch Angriffe und Geschosse.
- Heilung:
  - Rast-Knoten: 40 % Heilung **oder** ein Waffen-Upgrade
  - nach jedem Raum-Clear: +3 Leben (über Meta-Upgrades verbesserbar)
  - Shop
  - bestimmte Segen und Relikte
- **Letzter Funke:** Bei 0 Leben steht die Figur mit 50 % Leben wieder auf. Dazu kommen eine Schockwelle und 2 s Unverwundbarkeit. Freischaltbar über Meta, bis zu 2 Ladungen (Relikte können mehr geben).
- **Assist-Modus** (jederzeit in den Einstellungen):
  - Schadensreduktion, die pro Tod um 2 % steigt, bis maximal 80 %
  - Spielgeschwindigkeit einstellbar (70–100 %)
  - optional automatischer Angriff
  - Kein Abzug bei Belohnungen und Freischaltungen. Runs im Assist-Modus werden in der Bestenliste markiert.

### 4.6 Fairness-Regeln (verbindlich für alle Gegner und Bosse)
1. Jeder Angriff hat ein **Telegraph von mindestens 0,4 s** (Bosse mindestens 0,5 s). Es wird durch Aufleuchten, eine Form am Boden und einen Sound angekündigt, **nie nur durch Farbe**.
2. **Angriffs-Tokens:** Maximal 3 Gegner dürfen gleichzeitig nahkampfangreifen und maximal 4 gleichzeitig feuern. Die anderen positionieren sich und kreisen.
3. **Spawn-Warnung:** Gegner erscheinen nach 0,8 s Portal-Animation, nie in einem Radius von 150 px um den Spieler.
4. Gegnerische Geschosse sind langsamer (≤ 260 px/s), kontrastreich und rund oder rautenförmig. Eigene Geschosse sind länglich und heller.
5. Kein Schaden von außerhalb des Bildschirms ohne Randindikator.
6. Bosse haben feste, lernbare Muster mit Varianten. Zufall liegt nur in der Auswahl der Muster, nie in deren Ausführung.
7. Jede Todesursache wird auf dem Todesbildschirm benannt, inklusive einer kurzen Wiederholung der letzten 3 Sekunden (aus dem Input-Log nachgestellt).

### 4.7 Game-Feel-Spezifikation
Das ist der wichtigste Abschnitt für den Prototyp.

| Mittel | Startwert | Anmerkung |
|---|---|---|
| **Hitstop** | leichter Treffer 45 ms, schwerer 80 ms, Kill 60 ms, Boss-Phase 150 ms | friert die Simulation ein, Partikel und Shake laufen weiter |
| **Screenshake** | Trauma-Modell (Trauma², Perlin-Rauschen), Trauma klingt in 0,5 s ab | leichter Treffer 0,15, schwerer 0,3, Spieler getroffen 0,45 |
| **Treffer-Blitz** | Gegner 1 Frame weiß, danach 60 ms in Fraktionsfarbe | Spieler blinkt rot und Vignette pulsiert |
| **Rückstoß** | Gegner 120–300 px/s Impuls, gewichtsabhängig | schwere Gegner widerstehen ihm (Poise) |
| **Squash und Stretch** | Gegner 15 % bei Treffer, Spieler beim Dash 20 % | elastisches Zurückfedern in 120 ms |
| **Partikel** | Treffer 8–15 Funken in Schlagrichtung, Kill mit Zerfall in Fragmente | Menge abhängig von der Qualitätsstufe |
| **Sound** | jeder Treffer mit ±8 % Tonhöhe und ±2 dB Variation | Combos steigen in der Tonhöhe |
| **Haptik** | Treffer 10 ms, schwerer Treffer 25 ms, Spieler getroffen 40 ms | Vibration API bzw. Gamepad-Rumble |
| **Kamera** | Vorausschau 60 px in Bewegungsrichtung, Glättung | leichter Zoom-Impuls beim Kill des letzten Gegners |
| **Letzter Gegner im Raum** | 0,5 s Zeitlupe, Zoom, Raum-Clear-Klang | der „Ahh“-Moment |
| **Schadenszahlen** | optional (Standard an), kritischer Treffer größer und farbig | lassen sich in den Einstellungen abschalten |

Alle Intensitäten lassen sich in den Einstellungen skalieren (Shake, Blitze, Vibration jeweils 0–100 %).

### 4.8 Waffen
Fünf Waffen mit jeweils 3–4 **Aspekten** (Varianten mit eigenem Mechanik-Dreh, freischaltbar mit Rissstaub). Die Waffe wird **vor dem Run** in der Zuflucht gewählt.

| Waffe | Rolle | Angriff | Spezialangriff |
|---|---|---|---|
| **Brandklinge** (Start, Prototyp) | Allrounder | Combo mit 3 Schlägen (Bogen, Bogen, Stoß) | **Glutwirbel**: 360°-Drehung, Rückstoß |
| **Rissspeer** | Reichweite, Kontrolle | lange Stöße, Ladeangriff | Wurf, kehrt zurück, trifft doppelt |
| **Funkenfäuste** | schnell, nah | Combo mit 5 Schlägen, hohe Frequenz | Aufwärtshaken mit Sprung (kurze i-Frames) |
| **Splitterbogen** | Fernkampf | Schuss, beim Laden verstärkt | Fächer aus 5 Pfeilen |
| **Weltenhammer** | langsam, Fläche | schwere Schläge mit Schockwelle | Bodenstampfen, schleudert Gegner hoch |

**Brandklinge (Prototyp-Werte):**
- Schaden 12 / 12 / 20
- Reichweite 70 px, Bogen 110°
- Vorbereitung 60 ms, aktiv 80 ms, Erholung 160 ms
- Combo-Fenster 350 ms
- Glutwirbel: 25 Schaden, Radius 110 px, Rückstoß 300

### 4.9 Evolutionen (Vampire-Survivors-Moment)
Eine Waffe entwickelt sich, sobald eine bestimmte **Kombination** im Run vorhanden ist. Am nächsten Altar bzw. in der nächsten Rast erscheint dann ein Evolutions-Angebot mit großem Effekt. Unentdeckte Evolutionen sind im Codex als Silhouette mit einem Hinweis sichtbar.

Beispiele:
- **Phönixklinge** = Brandklinge + Ignara-Angriffssegen + Relikt „Funkenring“. Jede Combo-Vollendung entfesselt einen Feuervogel.
- **Gletscherspeer** = Rissspeer + Vaelis-Spezialsegen + Relikt „Kalter Kern“. Der Wurf hinterlässt eine Eisbahn, die Gegner einfriert.
- **Gewitterfäuste** = Funkenfäuste + Kyrr-Angriffssegen + Relikt „Leiter“. Jeder 5. Schlag ruft einen Blitzschlag herab.

**Umgesetzt (M2.4):** Phönixklinge = Brandklinge + „Sengender Schlag“ + „Funkenring“. Jede Combo-Vollendung schickt einen Feuervogel los (28 Schaden, durchdringt alle Gegner, 3 Brand), dazu +10 % Angriffsschaden. Das Angebot erscheint am Altar vor der Segen-Wahl (annehmen oder später) und in der Rast als Alternative zur Heilung.

### 4.10 Orbitale (später im Run)
Ab Biom 3 können **Orbitale** erscheinen: automatisch auslösende Begleit-Effekte zusätzlich zu den eigenen Aktionen, z. B. kreisende Glutkugeln, ein Leeren-Auge, das Kritische Treffer markiert, oder eine Sturmwolke, die alle 2 s blitzt. Sie skalieren mit den Tags des Builds und sorgen für das **Horden-Gefühl am Ende des Runs**, ohne das eigene Kämpfen zu ersetzen. Es gibt maximal 3 Orbital-Slots.

---

## 5. Gegner

### 5.1 Rollen-Taxonomie
| Rolle | Aufgabe im Design |
|---|---|
| **Jäger** (Nahkampf) | erzeugt Druck, zwingt zum Ausweichen |
| **Schütze** | erzwingt Bewegung, bestraft Stillstand |
| **Brecher** (schwer) | Flächenangriff, zu langsam zum Verfolgen, hohe Poise |
| **Schwarm** | viele, schwach, für Horde-Momente |
| **Stützer** | bufft, heilt oder beschwört. Ein Prioritätsziel. |
| **Fallensteller** | verwehrt Raum (Minen, Zonen) |

**Elite-Modifikatoren** (auf jeden Grundgegner anwendbar): *Geschirmt* (Frontschild), *Flüchtig* (explodiert beim Tod), *Hastig* (+40 % Tempo), *Gespalten* (teilt sich), *Riss-berührt* (teleportiert).

### 5.2 Prototyp-Gegner
| Gegner | Rolle | Leben | Verhalten | Telegraph |
|---|---|---|---|---|
| **Schlacke** | Jäger | 30 | läuft auf den Spieler zu, hält in 90 px Abstand, springt vor (Lunge, 140 px) | 0,5 s Aufleuchten und Zusammenziehen, dann Linie am Boden |
| **Funkenspucker** | Schütze | 22 | hält 250–350 px Abstand, weicht zurück, feuert 3 langsame Geschosse im Fächer | 0,6 s Aufblähen, Mündungsglühen |
| **Splitterkoloss** | Brecher | 120, Poise 40 | langsam, Bodenschlag mit Radius 130 px, danach 1,2 s verwundbar | 0,9 s roter Kreis am Boden, der sich füllt |

**Umgesetzt (M2.5):**

| Gegner | Rolle | Leben | Verhalten | Telegraph |
|---|---|---|---|---|
| **Glutmilbe** | Schwarm | 9 | sehr schnell, kurzer Sprung (70 px), billig (Wellenkosten 0,5) | 0,4 s Zusammenziehen, Linie am Boden |
| **Aschenpriester** | Stützer | 34 | hält 280–380 px Abstand, heilt alle Verbündeten im Umkreis von 220 px um 35 % ihres Lebens | 0,9 s grüner Ring, der sich zusammenzieht |
| **Glutleger** | Fallensteller | 40 | wirft 2 Minen: eine genau auf die Spielfigur, eine daneben. Sie explodieren nach 1,2 s (Radius 55 px). | Mündungsglühen, dann blinkende Bodenmarkierung, die sich füllt |

Elite-Modifikatoren (M2.5): *Hastig* (+40 % Tempo, kürzere Pausen), *Geschirmt* (Frontschild im 140°-Kegel: nur 20 % Schaden, kein Rückstoß, kein Stagger; Rückseite und gefrorene Gegner sind ungeschützt), *Flüchtig* (hinterlässt beim Tod eine Explosion nach 0,9 s, Radius 110 px). Elites haben 60 % mehr Leben, sind etwas größer und tragen einen farbigen Ring. Elite-Räume enthalten 2 Elites: den Splitterkoloss der ersten Welle und einen zufälligen Gegner der zweiten.

**Balancing (M2.8, per Simulator):** Kampfräume haben 3 Wellen (ab Ebene 2: 4) mit einem Budget von 7 + 1,8 pro Ebene, Horden dauern 60 s. Der Funkenspucker schießt seltener (alle 2,2–3,0 s) und schwächer (8 Schaden).

**Status-Effekte (M3.1):** Alle Status funktionieren gleich: Stapel bis zu einer Obergrenze, jede Anwendung erneuert die Dauer, und wenn sie abläuft, fallen alle Stapel auf einmal weg. Die Werte stehen in `src/content/statuses.ts` und sind im Debug-Menü tunbar.

| Status | Symbol | Stapel | Dauer | Wirkung |
|---|---|---|---|---|
| **Brand** (Ignara) | Flamme, orange | 10 | 3 s | 3 Schaden pro Stapel und Sekunde |
| **Kälte** (Vaelis) | Schneeflocke, eisblau | 5 | 4 s | −10 % Tempo pro Stapel; bei 5 Stapeln **gefroren** (1,6 s) |
| **Gift** (neu) | Tropfen, grün | 10 | 6 s | 1,6 Schaden pro Stapel und Sekunde; hält lange, wenn man nachlegt |
| **Blenden** (neu) | Auge, hellgelb | 1 | 3 s | Angriffs-Vorbereitung dauert 30 % länger, Salven verziehen um 25° |

Status-Resistenz (Bosse 50 %) halbiert Schaden über Zeit, Einfrier-Dauer und die Wirkung von Blenden. Sichtbar ist jeder Status am Körper (Glut, Eiskruste, grüner Dunst und Blasen, Lichtkranz) und als Symbol mit Stapelzahl über dem Gegner bzw. unter der Boss-Leiste. Die Symbole lassen sich in den Einstellungen ausblenden. Quellen: Brand und Kälte kommen von Segen, Relikten und Zaubern; Gift und Blenden bisher nur von Zaubern (Giftwolke, Pestatem, Lichtlanze).

**Umgesetzt (M3.5), Duell-Räume und Mini-Bosse:**
- **Duell-Raum** (Kartensymbol: gekreuzte Klingen im Kreis): 1–2 pro Map, ab Ebene 3, nie auf der Rast-Ebene vor dem Boss. Statt Wellen kämpft man gegen einen **Mini-Boss** (Rolle `champion`) mit Namen, Lebensleiste und 3 Phasen. Belohnung: ein Runenfragment, Scherben wie im Elite-Raum, Glut und Rissstaub wie ein Elite-Raum.
- **Glut-Duellant** (1800 Leben, Status-Resistenz 30 %):
  - Phase 1: kurzer und langer Stoß, **Parierhaltung**
  - Phase 2 ab 66 %: zusätzlich die Klingenwelle (5 Geschosse), pariert öfter
  - Phase 3 ab 33 %: zusätzlich der Glutsturm (380 px Ansturm durch eine markierte Bahn, belohnt den perfekten Dash), schneller
  - **Parierhaltung:** 0,8 s, blauer Ring und Schild in Blickrichtung. Ein Nahkampftreffer von vorn wird gekontert (kein Schaden, 16 Schaden zurück, wenn man nah steht). Riss-Geschoss, Zauber und Treffer von hinten brechen die Haltung: 1,2 s verwundbar.
- **Funke & Asche** (900 und 1100 Leben):
  - Funke wirft Feuerbälle, Asche schlägt auf den Boden.
  - **Band:** Stehen sie näher als 200 px beieinander, nehmen beide 40 % weniger Schaden (sichtbares Band zwischen ihnen).
  - Phase 2 bei 50 % des gemeinsamen Lebens: Funke zusätzlich mit Geschossring, Asche mit Ansturm.
  - Fällt einer, wird der andere zornig (Phase 3) und **belebt den Partner nach 8 s mit 30 % Leben wieder**, wenn er nicht vorher besiegt ist (schrumpfender roter Ring als Countdown).
  - Eine gemeinsame Lebensleiste.
- Simulator: Duelle dauern beim Bot im Schnitt 41 s; bei Menschen sind 1–2 min zu erwarten.

Jeder Gegner hat die Phasen **Vorbereitung → aktiv → Erholung**. Die Erholung ist das Strafbarkeitsfenster: Hier soll der Spieler zuschlagen.

### 5.3 Bosse
Jeder Boss hat 2–3 Phasen, 4–6 Muster pro Phase, eine zornige Phase unter 30 % Leben und mindestens ein Muster, das einen perfekten Dash belohnt. Mit Brand-Stufen kommen zusätzliche Muster bzw. Phasen hinzu.

**Umgesetzt (M2.5, Werte aus M2.8): Der Glutwächter** (3000 Leben, Poise 160, 50 % Status-Resistenz: Brand macht halben Schaden, Einfrieren hält halb so lang)
- **Phase 1:** Bodenschlag (Radius 170 px), Sturmangriff (360 px, belohnt den perfekten Dash), gezielter Fächer aus 7 Geschossen, 3 Minen um die Spielfigur.
- **Phase 2 ab 55 %:** Der Wächter brüllt und ist dabei 1,4 s verwundbar. Dann: größerer Bodenschlag (210 px), schnellerer und längerer Sturmangriff, Geschossring aus 16 Geschossen, Fächer aus 9 Geschossen, 5 Minen, Beschwörung von 3 Glutmilben (höchstens 6 Gegner gleichzeitig). 20 % kürzere Pausen, 20 % schneller.
- **Zorn ab 30 %:** gleiche Muster, 40 % kürzere Pausen, 35 % schneller, rote Lebensleiste.
- Kein Muster wird zweimal hintereinander gewählt. Stirbt der Wächter, zerfallen seine Milben.
- Die Boss-Leiste zeigt Namen und Phasengrenzen.

---

## 6. Run-Struktur

### 6.1 Map (Pfadwahl nach Slay the Spire)
- Jede Welt (früher: Biom) hat eine eigene **Map** aus 8–10 Ebenen und 2–4 Knoten pro Ebene. Pfade verzweigen sich und laufen wieder zusammen.
- Die Raumtypen sind als Icons **vorab sichtbar**, damit der Weg planbar ist.
- Am Ende jeder Welt steht ihr Boss. Davor gibt es garantiert eine Rast. Der Sieg über den Welt-Boss beendet den Run erfolgreich; danach steht man vor dem Portal in der Zuflucht.
- Die Generierung erfolgt per Seed. Regeln: kein Elite-Raum auf Ebene 1–2, maximal 2 Shops pro Biom, mindestens ein Horde-Raum.

### 6.2 Raumtypen
| Typ | Icon | Inhalt | Belohnung |
|---|---|---|---|
| **Kampf** | ⚔ | 2–3 Spawn-Wellen | Segen, Relikt, Glut oder Scherben (vorab angezeigt) |
| **Elite** | ☠ | Elite-Gegner und Kampf | garantiert ein seltenes Relikt und Rissstaub |
| **Duell** (M3.5) | ⚔◯ | ein Mini-Boss mit 3 Phasen statt Wellen (§5) | Runenfragment, Scherben, Glut und Rissstaub wie Elite |
| **Altar** | ✦ | kein Kampf, Wesen-Begegnung | Auswahl aus 3 Segen eines Wesens |
| **Horde** | ≋ | 60–90 s Wellen-Überleben, viele Schwarm-Gegner, Funken-XP-Regen | Orbital, Segen-Verbesserung, viele Scherben |
| **Shop** | ⛁ | Nix verkauft | Relikte, Heilung, Segen für **Scherben** (Run-Währung) |
| **Rast** | ☾ | Lagerfeuer | 40 % Heilung **oder** Waffen-Upgrade |
| **Ereignis** | ? | Text-Entscheidung mit Risiko gegen Belohnung | variabel, auch Fluch-Relikte |
| **Rätsel** (M6.0) | Puzzleteil | kein Kampf: Feuerschalen, Kristalle, Platten, Blöcke, Tore und Abgründe; lösbar mit Klinge, Dash und Riss-Geschoss. Reihenfolgen sind sichtbar, Iskra gibt Hinweise. Höchstens 2 pro Map, ab Ebene 2. | ein Relikt, 1–2 Materialien, Scherben |
| **Schatz** (M6.0b, nur im Raum-Netz) | Truhe | kein Kampf, eine Truhe | Auswahl aus 3 besseren Relikten |
| **Riss-Prüfung** | ◈ | Herausforderung (Zeitlimit, „nicht getroffen werden“, nur Dash-Schaden) | bei Erfolg großer Bonus, bei Misserfolg nichts |
| **Boss** | ♛ | Bosskampf | Rissstaub, Story, Heilung, Biom-Wechsel |

### 6.2b Raum-Netz (M6.0b)
- Manche Welten sind kein Pfad, sondern ein **Netz aus kleinen Räumen** auf einem Raster, mit Türen in alle Richtungen (wie ein kleiner Dungeon).
- Man läuft frei hin und her. Kampfräume schließen ihre Türen, bis der Kampf gewonnen ist; besiegte Räume bleiben ruhig.
- Der **Boss-Flügel** (Wächter-Duell, dann Boss) liegt hinter einer **verschlossenen Tür**. Jedes gelöste **Rätsel** gibt einen Schlüssel.
- Eine **Minikarte** zeigt besuchte Räume, ihre Türen und was hinter ihnen liegt.

### 6.3 Räume
- Arena-Räume aus **Vorlagen**: Form, Hindernisse, Gefahren, Spawn-Punkte. Varianten werden per Seed gebildet (Spiegelung, Hindernis-Sets).
- Eher quadratische Proportionen, damit sie in Hoch- und Querformat funktionieren.
- Zielzeit pro Kampfraum: 30–60 s, Horde: 60–90 s, Boss: 2–4 min.
- **Speicherpunkt:** Beim Betreten jedes Map-Knotens wird der Run-Zustand gespeichert.

---

## 7. Builds (Macht im Run)

### 7.1 Segen
- Angebot: 3 Segen eines Wesens, mit Seltenheit **Gewöhnlich → Selten → Episch → Heroisch**.
- **Slot-Segen** (Angriff, Spezial, Wurf, Dash, Ultimate): pro Slot immer nur ein Segen. Ein neuer ersetzt den alten.
- **Passive Segen:** unbegrenzt, z. B. „Brand-Schaden +20 %“.
- **Segen-Stufen:** Ein „Glutsplitter“ erhöht die Stufe eines Segens um 1, mit abnehmendem Ertrag.
- **Zauber-Stufen (M3.4):** Ein „Runenfragment“ hebt einen Zauber, die Aura oder das Riss-Geschoss um eine Stufe (1–5, Zweig-Wahl auf Stufe 3 und 5). Glutsplitter und Runenfragmente erscheinen in derselben Upgrade-Auswahl (Details §4.1).
- **Duo-Segen:** Sie erscheinen, wenn man Voraussetzungen von zwei Wesen erfüllt, z. B. Ignara + Vaelis = **Dampfbruch** (Einfrieren und Brennen am selben Ziel ergibt eine Explosion). Ziel: 10 Duo-Segen (alle Paare der 5 Wesen).
- **Legendäre Segen:** einer pro Wesen, mit Voraussetzungen, und Build-definierend.

**Umgesetzt (M2.2):**

| Wesen | Slot | Segen | Effekt (Seltenheit erhöht die Werte) |
|---|---|---|---|
| Ignara | Angriff | Sengender Schlag | Angriffe verursachen Brand |
| Ignara | Spezial | Inferno-Wirbel | Glutwirbel: +Schaden, viel Brand |
| Ignara | Dash | Funkenschweif | Dash-Start: Funken-Nova mit Schaden und Brand |
| Ignara | Passiv | Zündung | Gegner mit 3+ Brand explodieren beim Tod |
| Ignara | Passiv | Glutherz | +Schaden gegen brennende Gegner |
| Ignara | Passiv | Lodernde Wut | +Angriffsschaden |
| Ignara | Passiv | Asche zu Asche | +Brand-Schaden |
| Ignara | Passiv | Phönixglut | Heilung beim Töten brennender Gegner |
| Ignara | Wurf | Glutgeschoss | Riss-Geschoss: +Schaden, Brand (M2.4) |
| Vaelis | Angriff | Frostschlag | Angriffe verursachen Kälte (5 = gefroren) |
| Vaelis | Spezial | Gletscherwirbel | Glutwirbel: +Schaden, Kälte |
| Vaelis | Wurf | Eissplitter | Riss-Geschoss: +Schaden, Kälte (M2.4) |
| Vaelis | Dash | Frostschritt | Dash-Start kühlt Gegner im Umkreis ab |
| Vaelis | Passiv | Kalter Griff | Gefrieren dauert länger |
| Vaelis | Passiv | Zerschmettern | +Schaden gegen gefrorene Gegner |
| Vaelis | Passiv | Eiszeit | Perfekter Dash friert Gegner in der Nähe ein |
| Vaelis | Passiv | Gletscherhaut | Getroffen werden kühlt Gegner im Umkreis ab |
| Vaelis | Passiv | Beißende Kälte | +Schaden pro Kälte-Stufe |
| Ignara + Vaelis | Duo | Dampfbruch | Gefriert ein brennender Gegner (oder brennt ein gefrorener), werden beide Status verbraucht und er explodiert (45 Schaden, Radius 110 px). Voraussetzung: je ein Brand- und ein Frost-Segen (M2.4) |

### 7.2 Relikte (stapelbar)
- Gefunden in Elite-Räumen, im Shop, bei Ereignissen und als Kampfbelohnung.
- **Stapeln:** Jede Kopie verstärkt den Effekt. Chancen skalieren hyperbolisch (wie in Risk of Rain), damit 100 % nie ganz erreicht werden. Flache Werte skalieren linear.
- **Tags:** z. B. `fire`, `frost`, `storm`, `void`, `blood`, `crit`, `dash`, `projectile`, `orbital`, `kill`, `lowhp`. Viele Relikte skalieren mit der Anzahl der Tags im Build. Das ist der Balatro-Effekt: Ein fokussierter Build multipliziert sich.
- **Seltenheit:** Gewöhnlich (weiß), Selten (grün), Episch (violett), Mythisch (gold), Fluch (karmesin, mit Riss-Effekt).
- **Fluch-Relikte:** stark und mit Nachteil, z. B. „Gieriges Herz: +50 % Schaden, Heilung halbiert“ oder „Glasknochen: Kritische Treffer ×3, maximales Leben −40 %“. Sie werden immer klar als Fluch markiert und **nie aufgezwungen**, außer man wählt ein Ereignis, das ein Fluch-Relikt als Risiko ankündigt.
- Startumfang: 40 Relikte in der Alpha, 80 oder mehr in Version 1.0.

**Umgesetzt (M2.3), 12 Relikte:**
- **Gewöhnlich:** Glutstein (+Schaden), Herzsplitter (+max. Leben), Leichte Sohlen (+Tempo), Schleifstein (+Krit-Chance), Zweiter Atem (Heilung beim Raum-Clear)
- **Selten:** Funkenring (Kill-Explosion, Chance), Kalter Kern (Kälte bei Treffern, Chance), Henkersmal (+Krit-Schaden), Atemstein (+Ausdauer-Regeneration)
- **Episch:** Blutegel-Amulett (Heilung pro Kill)
- **Fluch:** Gieriges Herz (+Schaden, weniger Heilung), Glasknochen (+Krit, weniger max. Leben)

Fluch-Relikte gibt es nur im Shop (günstig) und bei Ereignissen, nie als normale Belohnung.

### 7.3 Run-Währung
**Scherben** werden nur im Run verwendet (Shop) und verfallen beim Tod.

---

## 8. Meta-Progression und Retention

### 8.1 Währungen
| Währung | Quelle | Verwendung |
|---|---|---|
| **Glut** | häufig: jeder Raum, jeder Kill-Bonus, auch bei einem Tod | Glutbaum (permanente Werte), gedeckelt |
| **Rissstaub** | selten: Elite-Räume, Bosse, Prophezeiungen | Waffen, Aspekte, Relikte für den Pool, Hub-Gebäude, Kosmetik |

### 8.2 Glutbaum (permanente Upgrades)
- Beispiele: +Leben, +1 Ausdauer-Segment (teuer), Letzter Funke (2 Stufen), +Heilung nach Raum, Start-Scherben, ein Segen-Neuwurf pro Run, Waffen-Grundschaden.
- **Obergrenze:** Nach ca. 15–20 Runs ist der Baum ausgeschöpft. Ab dann entsteht Macht nur noch aus Freischaltungen und Können.
- **Respec** jederzeit kostenlos. Experimentieren soll nie bestraft werden.

**Umgesetzt (M2.6):**

| Knoten | Wirkung | Stufen und Kosten |
|---|---|---|
| Lebenskraft | +10 maximales Leben pro Stufe | 30 / 60 / 100 Glut |
| Geschärfte Klinge | +6 % Schaden pro Stufe | 40 / 80 / 130 Glut |
| Glutheilung | 4 Leben nach jedem Kampf pro Stufe | 40 / 90 Glut |
| Notgroschen | +30 Start-Scherben pro Stufe | 35 / 70 Glut |
| Tiefer Atem | +12 % Ausdauer-Regeneration pro Stufe | 50 / 100 Glut |
| Letzter Funke (benötigt Lebenskraft) | einmal pro Run einen tödlichen Treffer überleben; Stufe 2 mit 40 % Leben | 120 Glut + 2 Staub / 200 Glut + 4 Staub |
| Zweite Wahl | ein Segen-Angebot pro Run neu würfeln | 80 Glut + 1 Staub |
| Viertes Segment (benötigt Tiefer Atem) | +1 Ausdauer-Segment | 250 Glut + 5 Staub |
| Runenkunde (M3.6) | der ausgerüstete aktive Zauber startet auf Stufe 2 | 160 Glut + 3 Staub |

Der ganze Baum kostet etwa 1500 Glut. Ein typischer verlorener Run bringt rund 60 Glut, ein Sieg rund 150, also ist der Baum nach etwa 15–25 Runs voll. Die Boni werden beim Run-Start festgehalten, Käufe wirken ab dem nächsten Run.

**Einnahmen (M2.6):** 7 Glut pro geschafftem Kampf- bzw. Horde-Raum, 10 Glut und 1 Rissstaub pro Elite, 25 Glut und 3 Rissstaub für den Boss, 1 Glut pro 5 Kills und 30 Glut Sieg-Bonus. Glut gibt es auch beim Tod und beim Aufgeben eines Runs.

### 8.3 Freischaltungs-Fahrplan (grob)
- **Runs 1–3:** Glutbaum-Grundlagen, Rast, Shop, zweites Wesen sichtbar
- **Runs 3–8:** zweite und dritte Waffe, Codex, Prophezeiungen, erste Aspekte
- **Erster Boss-Sieg in Biom 2:** Kartografin zieht ein
- **Erster Sieg:** Brand-Stufen und tägliche Seeds freigeschaltet
- **Danach:** restliche Aspekte, Geheimnisse, wahres Ende

### 8.4 Brand-Stufen (Heat)
Nach dem ersten Sieg wählt der Spieler vor dem Run **Pakt-Modifikatoren**. Jeder hat Rang-Punkte, und die Summe ergibt die Brand-Stufe. Höhere Stufen bringen mehr Rissstaub, eigene Belohnungen und Kosmetik.

Beispiele:
- Gegner +20 % Leben
- Gegner +15 % Tempo
- Elite-Räume ersetzen Kampfräume
- Bosse mit zusätzlichem Muster bzw. zusätzlicher Phase
- weniger Heilung
- Zeitlimit pro Biom
- Shop-Preise +50 %
- „Riss-Rauschen“ (Gegner hinterlassen beim Tod eine Gefahrenzone)
- weniger Segen-Auswahl (2 statt 3)

### 8.5 Tägliche und wöchentliche Seed-Runs
- Der Seed ergibt sich **deterministisch aus dem Datum**, ohne Server. Jeder Spieler weltweit spielt denselben Run.
- Feste Modifikatoren pro Tag bzw. Woche, z. B. „Nur Kyrr-Segen“ oder „Doppelte Horde-Räume“.
- Zunächst gibt es eine lokale Bestenliste. Zum Vergleichen kann man einen Ergebnis-Code teilen. Online-Bestenlisten folgen optional später.

### 8.6 Codex und Prophezeiungen
- **Codex (Bestiarium):** Gegner, Relikte, Segen, Evolutionen und Orte werden beim ersten Treffen freigeschaltet. Lore-Abschnitte schalten sich über Kill-Zahlen und Begegnungen frei. Unentdeckte Einträge erscheinen als Silhouette mit einem Hinweis.
- **Prophezeiungen:** Liste von Zielen mit Belohnung (Rissstaub, Kosmetik), z. B. „Gewinne mit jedem Wesen als dominantem Segen“, „Entdecke 5 Evolutionen“, „Besiege den Glutwächter ohne Treffer“. Prophezeiungen sind **im Run sichtbar**, damit man gezielt darauf hinspielen kann.

### 8.7 Geheimnisse und wahres Ende
- **Versteckte Pfade:** seltene Knoten auf der Map, die unter Bedingungen erscheinen, z. B. „Halte 3 Fluch-Relikte“ oder ein Ereignis in einer bestimmten Reihenfolge.
- **Geheim-Bosse** und ein Bonus-Fragment.
- **Wahres Ende:** freigeschaltet nach mehreren Siegen und einer Story-Kette. Danach gibt es einen Epilog und ein dauerhaft verändertes Erscheinungsbild der Zuflucht.

### 8.8 Weitere Retention-Mechaniken
| Mechanik | Warum sie wirkt |
|---|---|
| **Fortschrittsbalken nach dem Tod**, der die nächste Freischaltung zeigt („noch 40 Glut bis …“) | Das „Fast geschafft“-Gefühl löst einen weiteren Run aus. |
| **Run-Zusammenfassung** mit Build, Statistiken und Todesursache, teilbar als Seed-Code | Lernen und Stolz, organisches Teilen |
| **Onboarding in 2 Minuten:** Der erste Run ist kurz und geskriptet, die Steuerung wird im Spiel gelernt | Die ersten 5 Minuten entscheiden über die Retention. |
| **Kontextdialoge nach jedem Tod** | Das „Was sagen sie diesmal?“-Gefühl aus Hades |
| **Erste Freischaltung garantiert nach dem ersten Tod** | sofortiges Gefühl, voranzukommen |
| **Kosmetische Paletten** (Waffen- und Figurenfarben) als Belohnung für Prophezeiungen und Brand-Stufen | langfristige Ziele ohne Macht-Inflation |
| **Unterbrechbare Runs** (Speichern an Knoten) | Mobile-Sessions sind kurz. Wer unterbricht, darf nichts verlieren. |
| **Keine Energie- oder Wartesysteme, kein FOMO** außer dem täglichen Seed (der kein Muss ist) | Respekt vor dem Spieler, gute Bewertungen |

---

## 9. Schwierigkeit
- **Feste Kurve pro Biom**, keine versteckte dynamische Schwierigkeit.
- Pro Biom steigen Gegner-Leben und -Schaden um ca. +35 %, die Zahl der Wellen nimmt zu, und Elite-Modifikatoren tauchen ab Biom 2 auf.
- Zielwerte (gemessen über Simulation und Playtests):
  - Erster Sieg nach 8–15 Runs bei durchschnittlichen Spielern
  - Biom 1 wird ab dem 3. Run zuverlässig geschafft
- Freiwillige zusätzliche Härte kommt aus den Brand-Stufen, weniger Härte aus dem Assist-Modus.

---

## 10. Steuerung

### 10.1 Touch
- **Querformat:**
  - Linke Bildschirmhälfte: Floating Joystick (erscheint unter dem Daumen, Totzone 10 %, Radius 60 px).
  - Rechts: großer Angriffs-Button. Im Bogen darum liegen Dash (groß), Spezialangriff, Wurf, Zauber (mit Abklingzeit-Ring, Ziehen zielt mit Vorschau der Landefläche) und Ultimate (mit Lade-Ring).
- **Hochformat:** Die Steuerung sitzt im unteren Drittel. Die Kamera zeigt mehr vertikalen Raum, das HUD sitzt oben.
- **Anpassbar:** Größe, Position und Deckkraft jedes Buttons über einen Layout-Editor, mit Profilen pro Ausrichtung. _(M2.7: Pause → Einstellungen → „Touch-Layout anpassen“. Position und Größe pro Button, Deckkraft für alle Buttons zusammen.)_
- **Input-Buffer** von 150 ms für alle Aktionen.
- Pause durch Antippen des Pause-Icons. Die App pausiert außerdem automatisch, wenn sie den Fokus verliert.

### 10.2 Maus und Tastatur (Standardbelegung, frei änderbar)
| Aktion | Taste |
|---|---|
| Bewegen | WASD / Pfeiltasten |
| Angriff | Linksklick / J |
| Spezialangriff | Rechtsklick / K |
| Dash | Leertaste / Shift |
| Wurf | Q / L |
| Ultimate | R |
| Zauber | F |
| Interagieren | E |
| Map / Pause | Tab / Esc |

### 10.3 Gamepad
- Linker Stick: bewegen. Rechter Stick: zielen.
- Belegung: A/✕ Dash, X/□ Angriff, Y/△ Spezialangriff, B/○ Wurf, RB/R1 Zauber, RT/R2 Ultimate, LB/L1 Interagieren.
- Button-Icons wechseln je nach erkanntem Controller-Typ. Rumble ist abschaltbar.

### 10.4 Automatische Geräteerkennung
Die zuletzt verwendete Eingabemethode bestimmt die angezeigten Hinweise und die Sichtbarkeit der Touch-Steuerung. Der Wechsel ist jederzeit nahtlos möglich.

---

## 11. Benutzeroberfläche
- **HUD (minimal):**
  - Leben, Ausdauer-Segmente, Wurf-Ladungen, Ultimate-Leiste
  - Scherben
  - Mini-Indikator für den Raumfortschritt
  - aktive Prophezeiung (optional)
- **Bildschirmfluss:** Titel → Zuflucht (Hub) → Waffenwahl → Run (Map ⇄ Raum) → Ergebnis bzw. Tod → Zuflucht. _(M2.6: ohne Waffenwahl, es gibt erst eine Waffe. Der Ergebnis-Bildschirm zeigt Räume, Kills, Zeit, Todesursache, Einnahmen und den Fortschrittsbalken zum nächsten Glutbaum-Knoten.)_
- **Belohnungs-Auswahl:** große Karten, auch mit Daumen gut bedienbar. Tags und Synergien werden hervorgehoben, z. B. „Passt zu: Brennen“.
- **Pause-Menü:** Build-Übersicht mit allen Segen und Relikten inklusive Tags, Map, Einstellungen.
- Die gesamte Oberfläche ist mit Touch, Gamepad (Fokus-Navigation) und Maus bedienbar.

---

## 12. Kunst- und Audio-Richtung

### 12.1 Look: Bilderbuch (seit M4.5)
Der PO hat aus drei Richtungen das **Bilderbuch** gewählt (2026-10-24, ROADMAP E15). Vorbild in der Stimmung: Cult of the Lamb, niedlich und frech mit dunklem Unterton.
- **Farben:**
  - kräftige, warme Farben auf einer grünen Wiese
  - Tinte (`#2a1d2e`) für alle Konturen und Schatten
  - kein Neon-Leuchten und kein Bloom; Licht nur als weiche Flächen (Lagerfeuer, gebaute Plätze)
- **Figuren:**
  - Körper aus Teilen (M4) mit **dicker Tintenkontur**
  - **große Augen**, die blinzeln
  - Vesper in Creme mit rotem Umhang
  - Gegner behalten ihre Farbe, leicht aufgehellt.
- **Umgebung:**
  - Wiese mit helleren und dunkleren Flächen, Gekritzel aus Gras, Kieseln und Pilzen
  - Steinblöcke mit Moos und Rissen
  - fallende Blätter
  - Die Zuflucht hat gezeichnete Wahrzeichen: Herbstbaum, gestreifte Markise, Turm mit Spitzdach, steinerner Portalbogen.
- **Bewegung:** Squash & Stretch wie bisher, dazu Blinzeln und ein **Freudensprung** von Vesper, wenn ein Raum geschafft ist.
- **Oberfläche:**
  - Schrift **Baloo 2**, im Spiel gebündelt
  - Buttons und Karten mit Tintenkontur und Versatz-Schatten
  - warme braune Flächen statt Nachtschwarz
  - Icons als braune Karten mit Tintenrand und eingefärbtem Symbol
- **Lesbarkeits-Regeln (gelten weiter):**
  1. Der Spieler ist das hellste bzw. markanteste Element: cremeweiß mit Tintenkontur (ein Test prüft den Kontrast zum Boden).
  2. Gegnerische Angriffe sind warm und rot-orange mit runden Formen. Eigene Angriffe haben die Farbe des Wesens und längliche Formen.
  3. Telegraphs = Form + Füllanimation + Sound (bei Farbenblindheit zusätzlich ein Muster).
- Weitere Welten bekommen eigene Paletten im selben Bilderbuch-Stil (z. B. Gläserne See: Türkis und Weiß).

### 12.2 Audio
- **Soundeffekte:** prozedural mit einem Synthesizer im Stil von ZzFX. Sie werden beim Laden einmal erzeugt und dann mit Variation in Tonhöhe und Lautstärke abgespielt.
- **Musik:** freie Musik (CC0/CC-BY) in Schichten:
  - Erkundung bzw. Map: ruhige Schicht
  - Kampf: Schlagzeug und Bass kommen dazu
  - Boss: eigener Track
- **Prioritäten und Ducking:** Wichtige Sounds (Telegraphs, Spieler getroffen) sind immer hörbar.
- **Stil (offen, zu klären):** Vorschlag Darksynth bzw. Synthwave mit orchestralen Elementen, passend zum Neon-Look und zur mythischen Stimmung.
- **Umgesetzt (M2.7):** prozedurale Darksynth-Musik aus dem eigenen Synthesizer (ADR 0004). Aschefelder: a-Moll, 110 BPM, Pad und Arpeggio beim Erkunden, Bass, Kick, Snare und Hi-Hats kommen im Kampf dazu und verschwinden nach dem Raum-Clear wieder. Glutwächter: d-Moll, 128 BPM, eigener Track mit Lead-Melodie. Treffer, Ultimate und Boss-Brüllen ducken die Musik kurz. Musik hat einen eigenen Lautstärkeregler.

---

## 13. Einstellungen und Barrierefreiheit
- Lautstärke getrennt für Master, Musik, Soundeffekte und UI
- Screenshake 0–100 %, Blitz-Intensität 0–100 %, Modus mit reduzierten Effekten (Photosensitivität)
- Vibration an/aus und Stärke
- Farbenblind-Modi (Deuteranopie, Protanopie, Tritanopie) mit form-basierten Telegraphs als Standard
- Assist-Modus und Spielgeschwindigkeit 70–100 %
- Textgröße in 3 Stufen, Sprache Englisch und Deutsch
- Schadenszahlen an/aus, Zielhilfe-Stärke
- Touch-Layout-Editor, freie Tastenbelegung
- Qualitätsstufe: Automatisch, Niedrig, Mittel oder Hoch, dazu eine FPS-Anzeige

---

## 14. Plattformen und Monetarisierung
- **Plattformen:**
  - Alpha und Beta: Web-PWA über GitHub Pages, dazu itch.io
  - Version 1.0: Steam (Desktop-Wrapper)
  - Web-Portale und App-Stores bleiben technisch möglich.
- **Monetarisierung: offen, Entscheidung zur Beta.** Bis dahin wird das Spiel **monetarisierungs-neutral** gebaut. Kandidaten:
  - Premium mit kostenloser Web-Demo (bevorzugt)
  - Web-Portale mit optionaler Belohnungswerbung
  - Kosmetik
  - Spenden bzw. „Pay what you want“

  **Feste Regel:** keine Pay-to-Win-Mechaniken, keine Energie-Systeme, keine Lootboxen.
- **Online:** zunächst nichts. Spielstände sind lokal und lassen sich exportieren bzw. importieren. Ein Backend für Online-Bestenlisten und Cloud-Speicherstände kann später ergänzt werden.

---

## 15. Offene Fragen
1. Musik-Stil festlegen (Vorschlag: Darksynth mit orchestralen Elementen).
2. Namen von Figuren, Wesen und Bossen sind Arbeitsnamen. Finale Namen und eine englische Lokalisierung der Namen festlegen.
3. Monetarisierungsmodell (Entscheidung zur Beta).
4. ~~Hochformat: Nach dem Prototyp-Test bestätigen oder auf Querformat beschränken.~~ → Entschieden nach M1: Hoch- und Querformat bleiben beide.
5. Ein 6. Wesen (Erz) nach Version 1.0?
6. Gift und Licht sind Zauber-Schulen (entschieden 2026-10-23). Offen: zusätzlich eigene Wesen mit Segen? (ROADMAP A1, vor M6.4)
7. ~~Zuflucht „wie Cult of the Lamb“: Wiederaufbau ja, Anhänger-Management nein?~~ → Entschieden 2026-10-23: genau so (ROADMAP A2).
