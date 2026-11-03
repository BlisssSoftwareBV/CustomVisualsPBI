import powerbi from "powerbi-visuals-api";
import { formattingSettings as fs } from "powerbi-visuals-utils-formattingmodel";
import { trendNames } from "./trendlines";

export const trendItems = Object.entries(trendNames).map(([value, displayName]) => ({ value, displayName }));
const toggle = (name: string, displayName: string, value: boolean) => new fs.ToggleSwitch({ name, displayName, value });
const number = (name: string, displayName: string, value: number, minimum: number, maximum: number) => new fs.NumUpDown({
    name, displayName, value,
    options: {
        minValue: { type: powerbi.visuals.ValidatorType.Min, value: minimum },
        maxValue: { type: powerbi.visuals.ValidatorType.Max, value: maximum }
    }
});

class ChartCard extends fs.SimpleCard {
    name = "chart";
    displayName = "Diagram";
    orientation = new fs.ItemDropdown({ name: "orientation", displayName: "Richting", items: [
        { value: "bar", displayName: "Horizontale balken" }, { value: "column", displayName: "Verticale kolommen" }
    ], value: { value: "bar", displayName: "Horizontale balken" } });
    legend = toggle("legend", "Legenda", true);
    labels = toggle("labels", "Gegevenslabels", false);
    gridlines = toggle("gridlines", "Rasterlijnen", true);
    fontSize = number("fontSize", "Tekstgrootte", 11, 8, 24);
    decimals = number("decimals", "Decimalen", 1, 0, 8);
    gap = number("gap", "Ruimte tussen categorieen (%)", 25, 5, 70);
    slices = [this.orientation, this.legend, this.labels, this.gridlines, this.fontSize, this.decimals, this.gap];
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
    displayName = "Reeksen";
    groups: fs.Group[] = [];
}
export class VisualSettings extends fs.Model {
    chart = new ChartCard();
    trend = new TrendCard();
    seriesStyle = new SeriesCard();
    cards = [this.chart, this.trend, this.seriesStyle];
}