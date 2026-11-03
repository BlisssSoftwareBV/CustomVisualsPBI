import type powerbi from "powerbi-visuals-api";
import { formattingSettings as fs } from "powerbi-visuals-utils-formattingmodel";
import { trendNames } from "./trendlines";

export const trendItems = Object.entries(trendNames).map(([value, displayName]) => ({ value, displayName }));
export const minimumValidator: powerbi.visuals.ValidatorType.Min = 0;
export const maximumValidator: powerbi.visuals.ValidatorType.Max = 1;
const toggle = (name: string, displayName: string, value: boolean) => new fs.ToggleSwitch({ name, displayName, value });
const color = (name: string, displayName: string, value: string) => new fs.ColorPicker({ name, displayName, value: { value } });
const dropdown = (name: string, displayName: string, choices: [string, string][], selected: string) => {
    const items = choices.map(([value, label]) => ({ value, displayName: label }));
    return new fs.ItemDropdown({ name, displayName, items, value: items.find(item => item.value === selected)! });
};
const number = (name: string, displayName: string, value: number, minimum: number, maximum: number) => new fs.NumUpDown({
    name, displayName, value,
    options: {
        minValue: { type: minimumValidator, value: minimum },
        maxValue: { type: maximumValidator, value: maximum }
    }
});

class ChartCard extends fs.SimpleCard {
    name = "chart";
    displayName = "Kolommen";
    orientation = new fs.ItemDropdown({ name: "orientation", displayName: "Richting", items: [
        { value: "bar", displayName: "Horizontale balken" }, { value: "column", displayName: "Verticale kolommen" }
    ], value: { value: "column", displayName: "Verticale kolommen" } });
    legend = toggle("legend", "Legenda", true);
    labels = toggle("labels", "Gegevenslabels", false);
    gridlines = toggle("gridlines", "Rasterlijnen", true);
    fontSize = number("fontSize", "Tekstgrootte", 10, 8, 24);
    decimals = number("decimals", "Decimalen", 0, 0, 8);
    gap = number("gap", "Ruimte tussen categorieen (%)", 25, 5, 70);
    innerGap = number("innerGap", "Ruimte tussen reeksen (%)", 8, 0, 70);
    transparency = number("transparency", "Transparantie (%)", 0, 0, 100);
    displayUnits = dropdown("displayUnits", "Weergave-eenheden", [["none", "Geen"], ["auto", "Automatisch"], ["1000", "Duizenden"], ["1000000", "Miljoenen"], ["1000000000", "Miljarden"]], "auto");
    slices = [this.orientation, this.gap, this.innerGap, this.transparency, this.displayUnits, this.decimals];
}
class CategoryAxisCard extends fs.SimpleCard {
    name = "categoryAxis";
    displayName = "Categorie-as";
    show = toggle("show", "As tonen", true);
    title = toggle("title", "Titel tonen", false);
    titleText = new fs.TextInput({ name: "titleText", displayName: "Titel", value: "", placeholder: "Veldnaam" });
    fontSize = number("fontSize", "Tekstgrootte", 11, 8, 24);
    color = color("color", "Tekstkleur", "#444444");
    slices = [this.show, this.title, this.titleText, this.fontSize, this.color];
}
class ValueAxisCard extends fs.SimpleCard {
    name = "valueAxis";
    displayName = "Waarde-as";
    show = toggle("show", "As tonen", true);
    title = toggle("title", "Titel tonen", false);
    titleText = new fs.TextInput({ name: "titleText", displayName: "Titel", value: "", placeholder: "Veldnaam" });
    fontSize = number("fontSize", "Tekstgrootte", 11, 8, 24);
    color = color("color", "Tekstkleur", "#444444");
    customMinimum = toggle("customMinimum", "Minimum instellen", false);
    minimum = number("minimum", "Minimum", 0, -1e15, 1e15);
    customMaximum = toggle("customMaximum", "Maximum instellen", false);
    maximum = number("maximum", "Maximum", 100, -1e15, 1e15);
    gridlines = toggle("gridlines", "Rasterlijnen", true);
    gridColor = color("gridColor", "Rasterlijnkleur", "#dddddd");
    gridWidth = number("gridWidth", "Rasterlijndikte", 1, 1, 5);
    gridDashed = toggle("gridDashed", "Gestreepte rasterlijnen", false);
    slices = [this.show, this.title, this.titleText, this.fontSize, this.color, this.customMinimum, this.minimum,
        this.customMaximum, this.maximum, this.gridlines, this.gridColor, this.gridWidth, this.gridDashed];
}
class LegendCard extends fs.SimpleCard {
    name = "legendStyle";
    displayName = "Legenda";
    show = toggle("show", "Legenda tonen", true);
    position = dropdown("position", "Positie", [["top", "Boven"], ["bottom", "Onder"]], "top");
    title = toggle("title", "Titel tonen", false);
    titleText = new fs.TextInput({ name: "titleText", displayName: "Titel", value: "", placeholder: "Legendaveld" });
    fontSize = number("fontSize", "Tekstgrootte", 11, 8, 24);
    color = color("color", "Tekstkleur", "#444444");
    showTrends = toggle("showTrends", "Trendlijnen in legenda", false);
    slices = [this.show, this.position, this.title, this.titleText, this.fontSize, this.color, this.showTrends];
}
class LabelsCard extends fs.SimpleCard {
    name = "labelStyle";
    displayName = "Gegevenslabels";
    show = toggle("show", "Labels tonen", false);
    position = dropdown("position", "Positie", [["outside", "Buiten einde"], ["inside", "Binnen einde"], ["center", "Midden"]], "outside");
    fontSize = number("fontSize", "Tekstgrootte", 11, 8, 24);
    color = color("color", "Tekstkleur", "#444444");
    background = toggle("background", "Labelachtergrond", true);
    backgroundColor = color("backgroundColor", "Achtergrondkleur", "#e0e0e0");
    slices = [this.show, this.position, this.fontSize, this.color, this.background, this.backgroundColor];
}
class TrendCard extends fs.SimpleCard {
    name = "trend";
    displayName = "Trendlijnen";
    show = toggle("show", "Trendlijnen", true);
    type = new fs.ItemDropdown({ name: "type", displayName: "Type", items: trendItems, value: trendItems[0] });
    order = number("order", "Polynomiale graad", 2, 2, 6);
    period = number("period", "Periode gemiddelde", 3, 2, 1000);
    forward = number("forward", "Vooruit (X-eenheden)", 0, 0, 1000);
    backward = number("backward", "Achteruit (X-eenheden)", 0, 0, 1000);
    fixedIntercept = toggle("fixedIntercept", "Vaste intercept (alleen lineair)", false);
    intercept = number("intercept", "Intercept", 0, -1e15, 1e15);
    equation = toggle("equation", "Vergelijking tonen", false);
    r2 = toggle("r2", "R-kwadraat tonen", false);
    width = number("width", "Lijndikte", 2.5, 1, 8);
    dashed = toggle("dashed", "Stippellijn", true);
    slices = [this.show, this.type, this.order, this.period, this.forward, this.backward, this.fixedIntercept,
        this.intercept, this.equation, this.r2, this.width, this.dashed];
}
export class SeriesCard extends fs.CompositeCard {
    name = "seriesStyle";
    displayName = "Kolomkleuren";
    groups: fs.Group[] = [];
}
export class TrendStyleCard extends fs.CompositeCard {
    name = "trendStyle";
    displayName = "Trendlijnopmaak";
    groups: fs.Group[] = [];
}
export class VisualSettings extends fs.Model {
    chart = new ChartCard();
    categoryAxis = new CategoryAxisCard();
    valueAxis = new ValueAxisCard();
    legendStyle = new LegendCard();
    labelStyle = new LabelsCard();
    trend = new TrendCard();
    seriesStyle = new SeriesCard();
    trendStyle = new TrendStyleCard();
    cards = [this.chart, this.seriesStyle, this.categoryAxis, this.valueAxis, this.legendStyle, this.labelStyle, this.trend, this.trendStyle];
}

export function applyNativeFormatting(settings: VisualSettings, objects?: powerbi.DataViewObjects): void {
    if (!objects) return;
    const booleanSetting = (target: { value: boolean }, current: unknown, legacy: unknown) => {
        if (current === undefined && typeof legacy === "boolean") target.value = legacy;
    };
    const numericSetting = (target: { value: number }, current: unknown, legacy: unknown) => {
        if (current === undefined && typeof legacy === "number" && Number.isFinite(legacy)) target.value = legacy;
    };
    const colorSetting = (target: fs.ColorPicker, current: unknown, legacy: unknown) => {
        const value = typeof legacy === "string" ? legacy : (legacy as powerbi.Fill | undefined)?.solid?.color;
        if (current === undefined && typeof value === "string") target.value = { value };
    };
    const category = objects.categoryAxis;
    const axis = objects.valueAxis;
    booleanSetting(settings.categoryAxis.title, category?.title, category?.showAxisTitle);
    booleanSetting(settings.valueAxis.title, axis?.title, axis?.showAxisTitle);
    colorSetting(settings.categoryAxis.color, category?.color, category?.axisColor);
    colorSetting(settings.valueAxis.color, axis?.color, axis?.axisColor);
    booleanSetting(settings.valueAxis.gridlines, axis?.gridlines, axis?.gridlineShow);
    colorSetting(settings.valueAxis.gridColor, axis?.gridColor, axis?.gridlineColor);
    numericSetting(settings.valueAxis.gridWidth, axis?.gridWidth, axis?.gridlineThickness);
    if (axis?.gridDashed === undefined && typeof axis?.gridlineStyle === "string") settings.valueAxis.gridDashed.value = axis.gridlineStyle !== "solid";
    numericSetting(settings.chart.gap, objects.chart?.gap, category?.innerPadding);
    if (objects.chart?.displayUnits === undefined && typeof axis?.labelDisplayUnits === "number") {
        const unit = axis.labelDisplayUnits === 0 ? "auto" : axis.labelDisplayUnits === 1 ? "none" : String(axis.labelDisplayUnits);
        const item = settings.chart.displayUnits.items.find(item => item.value === unit);
        if (item) settings.chart.displayUnits.value = item;
    }
    numericSetting(settings.chart.decimals, objects.chart?.decimals, axis?.labelPrecision ?? objects.labels?.labelPrecision);
    if (axis?.customMinimum === undefined && typeof axis?.start === "number" && Number.isFinite(axis.start)) {
        settings.valueAxis.customMinimum.value = true;
        numericSetting(settings.valueAxis.minimum, axis.minimum, axis.start);
    }
    if (axis?.customMaximum === undefined && typeof axis?.end === "number" && Number.isFinite(axis.end)) {
        settings.valueAxis.customMaximum.value = true;
        numericSetting(settings.valueAxis.maximum, axis.maximum, axis.end);
    }
    const labels = objects.labels;
    const labelStyle = objects.labelStyle;
    booleanSetting(settings.labelStyle.show, labelStyle?.show ?? objects.chart?.labels, labels?.show);
    numericSetting(settings.labelStyle.fontSize, labelStyle?.fontSize, labels?.fontSize);
    colorSetting(settings.labelStyle.color, labelStyle?.color, labels?.color);
    booleanSetting(settings.labelStyle.background, labelStyle?.background, labels?.enableBackground);
    colorSetting(settings.labelStyle.backgroundColor, labelStyle?.backgroundColor, labels?.backgroundColor);
    if (labelStyle?.position === undefined && typeof labels?.labelPosition === "string") {
        const positions: Record<string, string> = { OutsideEnd: "outside", InsideEnd: "inside", InsideCenter: "center" };
        const item = settings.labelStyle.position.items.find(item => item.value === positions[String(labels.labelPosition)]);
        if (item) settings.labelStyle.position.value = item;
    }
    const legend = objects.legend;
    const legendStyle = objects.legendStyle;
    booleanSetting(settings.legendStyle.show, legendStyle?.show ?? objects.chart?.legend, legend?.show);
    booleanSetting(settings.legendStyle.title, legendStyle?.title, legend?.showTitle);
    numericSetting(settings.legendStyle.fontSize, legendStyle?.fontSize, legend?.fontSize);
    colorSetting(settings.legendStyle.color, legendStyle?.color, legend?.labelColor);
    if (legendStyle?.titleText === undefined && typeof legend?.titleText === "string") settings.legendStyle.titleText.value = legend.titleText;
    if (legendStyle?.position === undefined && typeof legend?.position === "string") {
        const position = legend.position.startsWith("Bottom") ? "bottom" : "top";
        settings.legendStyle.position.value = settings.legendStyle.position.items.find(item => item.value === position)!;
    }
}