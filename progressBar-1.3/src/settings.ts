import type powerbi from "powerbi-visuals-api";
import { formattingSettings as fs } from "powerbi-visuals-utils-formattingmodel";

const minimumValidator: powerbi.visuals.ValidatorType.Min = 0;
const maximumValidator: powerbi.visuals.ValidatorType.Max = 1;
const number = (name: string, displayName: string, value: number, minimum = -1e15, maximum = 1e15) => new fs.NumUpDown({
    name, displayName, value, options: { minValue: { type: minimumValidator, value: minimum }, maxValue: { type: maximumValidator, value: maximum } }
});
const toggle = (name: string, displayName: string, value: boolean) => new fs.ToggleSwitch({ name, displayName, value });
const color = (name: string, displayName: string, value: string) => new fs.ColorPicker({ name, displayName, value: { value } });
const dropdown = (name: string, displayName: string, choices: [string, string][], selected: string) => {
    const items = choices.map(([value, label]) => ({ value, displayName: label }));
    return new fs.ItemDropdown({ name, displayName, items, value: items.find(item => item.value === selected)! });
};

class RangeCard extends fs.SimpleCard {
    name = "range";
    displayName = "Bereik en target";
    minimum = number("minimum", "Bodem (zonder veld)", 0);
    maximum = number("maximum", "Top (zonder veld)", 100);
    targetEnabled = toggle("targetEnabled", "Target gebruiken", true);
    target = number("target", "Target (zonder veld)", 80);
    slices = [this.minimum, this.maximum, this.targetEnabled, this.target];
}

class ColorsCard extends fs.SimpleCard {
    name = "colors";
    displayName = "Kleuren";
    mode = dropdown("mode", "Kleurmodus", [["status", "Statuskleuren"], ["blend", "Meekleurende balk"], ["gradient", "Verloop over de balk"]], "gradient");
    start = color("start", "Onder target / bodem", "#c74c3c");
    midpoint = color("midpoint", "Tussenkleur (50% target/top)", "#e4be36");
    target = color("target", "Target bereikt", "#2ca25f");
    top = color("top", "Top bereikt", "#16806a");
    track = color("track", "Resterend bereik", "#e9edee");
    marker = color("marker", "Targetmarkering", "#333b3d");
    slices = [this.mode, this.start, this.midpoint, this.target, this.top, this.track, this.marker];
}

class OverflowCard extends fs.SimpleCard {
    name = "overflow";
    displayName = "Overschrijding";
    recolor = toggle("recolor", "Afwijkende kleur boven top", true);
    color = color("color", "Overschrijdingskleur", "#b52f55");
    showMessage = toggle("showMessage", "Melding boven top", true);
    message = new fs.TextInput({ name: "message", displayName: "Melding", value: "Boven top", placeholder: "Boven top" });
    slices = [this.recolor, this.color, this.showMessage, this.message];
}

class LabelsCard extends fs.SimpleCard {
    name = "labels";
    displayName = "Labels en opmaak";
    format = dropdown("format", "Waardeopmaak", [["auto", "Veldopmaak"], ["number", "Getal"], ["percent", "Percentage (0 tot 1)"], ["percent100", "Percentage (0 tot 100)"]], "auto");
    decimals = number("decimals", "Decimalen", 0, 0, 6);
    showProgress = toggle("showProgress", "Voortgang van bereik (%)", true);
    progressPosition = dropdown("progressPosition", "Positie voortgang (%)", [["right", "Rechtsboven"], ["center", "Midden in de vulling"], ["end", "Einde van de vulling"]], "right");
    showBounds = toggle("showBounds", "Bodem en top tonen", true);
    showTarget = toggle("showTarget", "Targetlabel tonen", true);
    valueMatchColor = toggle("valueMatchColor", "Actuele waarde meekleuren", false);
    valuePosition = dropdown("valuePosition", "Positie actuele waarde", [["right", "Rechts"], ["fill", "Boven actuele voortgang"]], "right");
    showTargetTitle = toggle("showTargetTitle", "Targettitel tonen", true);
    showTargetValue = toggle("showTargetValue", "Targetwaarde tonen", true);
    targetTitle = new fs.TextInput({ name: "targetTitle", displayName: "Targettitel", value: "Target", placeholder: "Target" });
    fontSize = number("fontSize", "Tekstgrootte", 12, 8, 24);
    color = color("color", "Tekstkleur", "#303b3b");
    slices = [this.format, this.decimals, this.valueMatchColor, this.valuePosition, this.showProgress, this.progressPosition, this.showBounds, this.showTarget, this.showTargetTitle, this.showTargetValue, this.targetTitle, this.fontSize, this.color];
}

class LayoutCard extends fs.SimpleCard {
    name = "layout";
    displayName = "Balken";
    barHeight = number("barHeight", "Balkhoogte", 18, 6, 48);
    customRounding = toggle("customRounding", "Eigen hoekafronding", false);
    rounding = number("rounding", "Hoekafronding (%)", 100, 0, 100);
    segmented = toggle("segmented", "Stappen tonen", false);
    stepSize = number("stepSize", "Stapgrootte", 1, 0.000001, 1e15);
    stepUnit = dropdown("stepUnit", "Eenheid stapgrootte", [["value", "Meetwaarde"], ["percent", "Percentage van bereik"]], "value");
    segmentGap = number("segmentGap", "Tussenruimte stappen (px)", 4, 0, 24);
    spacing = number("spacing", "Ruimte tussen balken", 24, 8, 64);
    sort = dropdown("sort", "Volgorde", [["data", "Volgorde Power BI"], ["ascending", "Voortgang oplopend"], ["descending", "Voortgang aflopend"]], "data");
    slices = [this.barHeight, this.customRounding, this.rounding, this.segmented, this.stepSize, this.stepUnit, this.segmentGap, this.spacing, this.sort];
}

export class VisualSettings extends fs.Model {
    range = new RangeCard();
    colors = new ColorsCard();
    overflow = new OverflowCard();
    labels = new LabelsCard();
    layout = new LayoutCard();
    cards = [this.range, this.colors, this.overflow, this.labels, this.layout];
}