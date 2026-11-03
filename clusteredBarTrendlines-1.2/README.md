# Gegroepeerde kolommen met trendlijnen

Versie 1.2. De projectmap heet `clusteredBarTrendlines-1.2`; Git verzorgt het versiebeheer.
Verhoog bij iedere nieuwe versie de minor-versie met 0.1 in `package.json`, de rootgegevens van `package-lock.json` en `pbiviz.json`. Hernoem de bestaande projectmap naar die versie, zonder een kopie te maken. Alleen op expliciet verzoek volgt een grote release, bijvoorbeeld 2.0.

## Importeren

Importeer `dist/clusteredBarTrendlinesA873EFC4235A498BADF96C534070C211.1.2.0.0.pbiviz` via **Visual importeren uit een bestand** in Power BI.
De visual-GUID is behouden, zodat deze versie dezelfde visual kan bijwerken.
Gebruik **Categorie**, **Waarden** en eventueel **Legenda** en **Tooltips**.

## Opmaak

- **Kolommen**: standaard verticale gegroepeerde kolommen; richting, categorieafstand, reeksafstand, transparantie, weergave-eenheden en decimalen.
- **Kolomkleuren**: afzonderlijke kolomkleur per reeks.
- **Categorie-as** en **Waarde-as**: zichtbaarheid, astitels, tekstgrootte en tekstkleur. Het diagram past binnen de visual zonder interne scrollbar. Korte categorielabels, zoals jaren, blijven zichtbaar zolang zij werkelijk passen. De waarde-as heeft een instelbaar minimum en maximum en opmaak voor rasterlijnen.
- **Legenda**: boven of onder, titel, tekstkleur, tekstgrootte en optionele trendlijnvermeldingen.
- **Gegevenslabels**: buiten einde, binnen einde of midden; tekstkleur, tekstgrootte en achtergrond. Buitenlabels mogen breder zijn dan de kolom; overlappende labels worden weggelaten.
- **Trendlijnen**: de bestaande zes Excel-stijl rekenmethoden, prognose, vergelijking, R-kwadraat en algemene lijninstellingen.
- **Trendlijnopmaak**: eigen zichtbaarheid, type, kleur en transparantie per reeks. Schakel **Algemene lijndikte en lijnstijl** uit voor een eigen lijndikte en gestreepte of doorgetrokken lijn. Kolomkleuren en lijnkleuren zijn onafhankelijk.

Auto kiest een hele eenheid op basis van alle meetwaarden en eventuele handmatige asgrenzen: bedragen tot 183 miljoen krijgen miljoenen, geen fractie van een miljard. Valuta en andere bronformaten worden door de Power BI-formatter toegepast. Nieuwe visuals hebben standaard geen astitels en bij een enkele meetreeks zonder legendaveld geen legenda.

De oorspronkelijke custom legenda-, label-, rasterlijn- en tekstgrootte-instellingen blijven als terugval behouden. Gangbare native opmaakvelden voor kolomkleuren, labels, legenda en assen worden eveneens gebruikt wanneer Power BI die doorgeeft bij het vervangen. Expliciete custom-instellingen krijgen voorrang. Dit kan niet garanderen dat Power BI alle opmaak van een ingebouwde visual overdraagt. Hoog contrast gebruikt de kleuren van Power BI.

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