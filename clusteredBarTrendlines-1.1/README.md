# Gegroepeerde kolommen met trendlijnen

Versie 1.1. De projectmap heet `clusteredBarTrendlines-1.1`; Git verzorgt het versiebeheer.
Verhoog bij iedere nieuwe versie de minor-versie met 0.1 in `package.json`, de rootgegevens van `package-lock.json` en `pbiviz.json`. Hernoem de bestaande projectmap naar die versie, zonder een kopie te maken. Alleen op expliciet verzoek volgt een grote release, bijvoorbeeld 2.0.

## Importeren

Importeer `dist/clusteredBarTrendlinesA873EFC4235A498BADF96C534070C211.1.1.0.0.pbiviz` via **Visual importeren uit een bestand** in Power BI.
De visual-GUID is behouden, zodat deze versie dezelfde visual kan bijwerken.
Gebruik **Categorie**, **Waarden** en eventueel **Legenda** en **Tooltips**.

## Opmaak

- **Kolommen**: standaard verticale gegroepeerde kolommen; richting, categorieafstand, reeksafstand, transparantie, weergave-eenheden en decimalen.
- **Kolomkleuren**: afzonderlijke kolomkleur per reeks.
- **Categorie-as** en **Waarde-as**: zichtbaarheid, astitels, tekstgrootte en tekstkleur. De waarde-as heeft een instelbaar minimum en maximum en opmaak voor rasterlijnen.
- **Legenda**: boven of onder, titel, tekstkleur, tekstgrootte en optionele trendlijnvermeldingen.
- **Gegevenslabels**: buiten einde, binnen einde of midden; tekstkleur en tekstgrootte. Labels die niet passen worden weggelaten.
- **Trendlijnen**: de bestaande zes Excel-stijl rekenmethoden, prognose, vergelijking, R-kwadraat en algemene lijninstellingen.
- **Trendlijnopmaak per reeks**: eigen zichtbaarheid, type, kleur en transparantie. Schakel **Algemene lijndikte en lijnstijl** uit voor een eigen lijndikte en gestreepte of doorgetrokken lijn. Kolomkleuren en lijnkleuren zijn onafhankelijk.

De oorspronkelijke legenda-, label-, rasterlijn- en tekstgrootte-instellingen blijven als terugval behouden voor oudere rapporten. Hoog contrast gebruikt de kleuren van Power BI.

## Trendlijngegevens

Zonder numeriek X-veld gebruikt de berekening de categorievolgorde: 1, 2, 3, enzovoort. Power BI-sortering verandert dus de X-volgorde.
Met **Numerieke X voor trendlijn** gebruikt iedere reeks haar eigen X-waarden. De kolomposities blijven categorisch, niet een continue numerieke as.
Ongeldige domeinen en onvoldoende gegevens leveren een melding op. Het voortschrijdend gemiddelde heeft geen vergelijking, R-kwadraat of prognose.

Dit is een zelfstandige custom visual die gangbare opmaakopties van het gegroepeerde kolomdiagram benadert, geen volledige kopie van de ingebouwde Microsoft-visual. De daadwerkelijke opmaakopslag en interactie tussen visuals moeten ook in Power BI worden getest.

## Ontwikkelen

Voer vanuit deze map uit:

```powershell
npm install
npm test
npm run typecheck
npm run package
npm run preview
```

Open voor de browserpreview `/preview.html` op de door Vite getoonde lokale URL. Deze gebruikt dezelfde visualklasse met een gesimuleerde Power BI-host.
De pakketbuild kan slagen ondanks een certificaatwaarschuwing voor de Power BI-ontwikkelserver. Het placeholder-auteuradres moet voor publicatie worden vervangen.