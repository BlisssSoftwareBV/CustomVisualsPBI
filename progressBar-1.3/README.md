# Voortgangsbalk 1.3

Power BI custom visual voor een totale voortgang of een balk per dimensiewaarde.
Zelfstandig project, naast de bestaande visuals. De GUID is uniek voor deze visual.

## Importeren

Importeer het bestand uit `dist/*.pbiviz` via **Visualisaties > Visual importeren uit bestand** in Power BI Desktop.

## Velden

| Veld | Gebruik |
| --- | --- |
| Voortgang | Een numerieke kolom of measure, verplicht. |
| Dimensie | Optioneel, bijvoorbeeld afdeling, project of jaar. Zonder dimensie toont Power BI de geaggregeerde measure in een balk. |
| Bodem | Optionele numerieke kolom of measure, per categorie. |
| Top | Optionele numerieke kolom of measure, per categorie. |
| Target | Optionele numerieke kolom of measure, per categorie. |
| Tooltips | Optionele extra measures. |

Gekoppelde velden hebben voorrang op de vaste waarden in **Bereik en target**.
Een leeg gekoppeld veld valt niet terug op de vaste waarde. Ontbrekende waarden en
ongeldige grenzen krijgen een melding; ontbrekende targets laten de balk wel zien.
Kies voor grenzen en target een geschikte aggregatie (bijvoorbeeld MAX of een measure),
zodat een vaste grens niet onbedoeld per bronrij wordt opgeteld.
Een totaal wordt door Power BI berekend, niet door deze visual uit categorieen opgeteld.
Gebruik voor verhoudingen bij voorkeur een measure zoals `DIVIDE([Realisatie], [Begroot])`.

## Bereik en percentages

Voortgang van het bereik = `(waarde - bodem) / (top - bodem)`.
De standaardwaarden zijn bodem **0**, top **100** en target **80**.
De balk wordt begrensd tot 0-100%, maar het voortgangslabel kan boven 100% of onder 0% liggen.
De waarde boven de balk is de oorspronkelijke meetwaarde, niet deze berekende verhouding.

- **Veldopmaak** volgt de Power BI-measure (ook valuta of percentages).
- **Getal** toont getallen zonder schaalverkleining.
- **Percentage (0 tot 1)**: gebruik bijvoorbeeld waarde `0.65`, bodem `0`, top `1`, target `0.8`.
- **Percentage (0 tot 100)**: gebruik bijvoorbeeld waarde `65`, bodem `0`, top `100`, target `80`.

De opmaakinstelling verandert de grenzen niet automatisch. Alle waarden, grenzen en
targets moeten dezelfde eenheid hebben. Vaste grenzen/targets gebruiken de opmaak van
Voortgang, zodat die ook op een valutabalk hetzelfde worden weergegeven.

## Kleuren en overschrijding

- **Statuskleuren**: bodemkleur onder target, targetkleur vanaf target, topkleur vanaf top.
- **Meekleurende balk**: de hele balk verandert geleidelijk van bodemkleur via tussenkleur en targetkleur naar topkleur.
- **Verloop over de balk**: de kleurposities liggen vast op het bereik; een halfgevulde balk toont alleen het eerste deel van het verloop.
- **Tussenkleur (50% target/top)**: instelbaar onder Kleuren, standaard geel. Bij een target ligt dit kleurpunt halverwege bodem en target, anders halverwege bodem en top. Bijvoorbeeld bodem 0, target 80: tussenkleur op 40; zonder target en met top 100: op 50. De vaste statuskleuren blijven ongewijzigd.
- Zonder target loopt het verloop van bodemkleur via tussenkleur naar topkleur. Met rood als bodemkleur en groen als target- en topkleur ontstaat rood -> geel -> groen in beide gevallen.
- Bij een target buiten het bereik wordt de kleurpositie begrensd tot bodem/top, net als de targetmarkering.
- Boven top zijn een afwijkende kleur en een eigen melding afzonderlijk instelbaar. De melding toont ook het absolute verschil boven top.
- Onder bodem verschijnt een markering en melding. Een target buiten het bereik wordt aan de rand gemarkeerd met een waarschuwing.

Er wordt uitgegaan van **hoger is meer voortgang**. Omgekeerde doelen (lager is beter) en
meerdere voortgangsmeasures naast elkaar vallen buiten deze eerste versie.

Versie 1.1 behoudt de GUID en bestaande kleurinstellingen uit 1.0. De nieuwe tussenkleur
is standaard geel; de standaard targetkleur is nu groen. Een eerder opgeslagen
targetkleur wordt niet overschreven: kies hiervoor zo nodig zelf groen.

## Balkvorm en stappen

De bestaande opmaak blijft standaard actief. Beide nieuwe opties staan onder **Balken**
en kunnen afzonderlijk worden ingeschakeld.

- **Eigen hoekafronding**: schakel in voor controle via **Hoekafronding (%)**. 0% geeft rechte hoeken, 100% een volledige pilvorm; tussenwaarden geven een kleinere afronding. Uitschakelen herstelt de oorspronkelijke afronding.
- **Stappen tonen**: verdeelt het bereik vanaf de bodem in losse segmenten.
- **Stapgrootte / Meetwaarde**: bijvoorbeeld 1 bij bodem 0 en top 5 geeft vijf segmenten. Bij fractionele percentages kun je 0.1 gebruiken voor stappen van 10 procentpunt.
- **Stapgrootte / Percentage van bereik**: bijvoorbeeld 10 geeft tien stappen, ongeacht of je meetwaarde 0-1, 0-100 of een ander bereik gebruikt.
- **Tussenruimte stappen (px)**: instelbaar van 0 tot 24. Op smalle balken wordt de tussenruimte automatisch verkleind zodat segmenten zichtbaar blijven.

Bij een waarde tussen twee stappen wordt het volgende segment gedeeltelijk gevuld.
Een laatste onvolledige stap blijft proportioneel kleiner, bijvoorbeeld bij bereik 0-5
en stapgrootte 2. Het kleurverloop loopt over de hele schaal door en begint niet in
ieder segment opnieuw. De targetmarkering blijft op zijn schaalpositie staan.
Afronding geldt ook voor de losse segmenten. Hoog contrast, selectie en overschrijding
blijven ondersteund. De tussenruimtes zijn transparant.

Er worden maximaal 200 segmenten per balk getekend. Bij een ongeldige of te kleine
stapgrootte verschijnt een waarschuwing en blijft de doorlopende balk zichtbaar.
Versie 1.2 behoudt de GUID en de opgeslagen opmaak van eerdere versies.

## Actuele waarde en targetlabel

Onder **Labels en opmaak** staan de volgende opties:

- **Actuele waarde meekleuren**: de waarde krijgt dezelfde kleur als het uiteinde van de vulling. Dit volgt de statuskleur of het kleurverloop en, indien ingeschakeld, de overschrijdingskleur. Standaard uit; hoog contrast gebruikt altijd de ingestelde hostvoorgrondkleur.
- **Positie actuele waarde**: **Rechts** behoudt de oorspronkelijke uitlijning. **Boven actuele voortgang** centreert de waarde boven het einde van de vulling op een eigen regel. Het voortgangspercentage volgt zijn eigen positie-instelling. Onder bodem of boven top staat de waarde bij de rand van de balk.
- **Positie voortgang (%)**: **Rechtsboven** is de oorspronkelijke plek. **Midden in de vulling** plaatst het percentage halverwege het gevulde gedeelte, **Einde van de vulling** plaatst het tegen het einde, maar binnen de vulling. Zwart/wit tekstcontrast wordt automatisch bepaald. Bij stappen wordt het dichtstbijzijnde passende gevulde segment gebruikt. Past het label niet in de vulling (of is de balk leeg of te laag), dan staat het leesbaar rechtsboven. De getoonde verhouding blijft onbegrensd, dus bijvoorbeeld 120% blijft 120%.
- **Targetlabel tonen**: het label staat nu gecentreerd onder de targetmarkering, op een aparte regel boven de bodem- en toplabels.
- **Targettitel tonen** en **Targetwaarde tonen**: afzonderlijk instelbaar, zodat je de titel, de waarde, beide of geen label kunt tonen. De targetmarkering blijft onafhankelijk hiervan zichtbaar.
- **Targettitel**: eigen tekst, standaard **Target**.

Bij de randen worden labels zo nodig naar binnen verschoven om afkappen te voorkomen.
Lange labels kunnen binnen hun eigen regel afbreken. De labelopties werken ook met
pilvormen, stappen en percentages. Ontbrekende of ongeldige meetwaarden blijven in de
kopregel staan en krijgen geen voortgangskleur. Versie 1.3 behoudt de bestaande GUID.

## Interactie en toegankelijkheid

Klik om een categorie te selecteren; Ctrl/Cmd-klik voor meerdere selecties.
Enter/spatie selecteert de gefocuste balk; Escape wist de selectie.
Rechtsklikken opent het Power BI-contextmenu. Tooltips, cross-highlights en hoogcontrastkleuren
worden ondersteund. Een lange categorielijst scrolt binnen de visual.
Er worden maximaal 1000 categorieen opgevraagd; bij een datasegment verschijnt een melding.
Gebruik filters om grote lijsten te beperken. De visual vraagt geen externe toegangsrechten.

## Ontwikkelen

```powershell
npm install
npm test
npm run typecheck
npm run package
npm run preview
```

Open de URL van Vite met `/preview.html`. De preview gebruikt de echte `Visual` met een
gemockte Power BI-host en bevat totaal-, dimensie-, percentage- en grensgevallendata.
Werkelijke Power BI-selectie-interacties, queryaggregatie en opslag van opmaak moeten
ook in Power BI Desktop worden gecontroleerd.