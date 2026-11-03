import { formattingSettings as fs } from "powerbi-visuals-utils-formattingmodel";

type Choice = [string, string];

const toItems = (choices: Choice[]) => choices.map(([value, displayName]) => ({ value, displayName }));

const shapeItems = toItems([["semi", "Semi circle"], ["gauge270", "270 degree"], ["full", "Full circle"], ["bar", "Bar"]]);
const valueTypeItems = toItems([["number", "Number"], ["percentage", "Percentage"]]);
const percentInputItems = toItems([["zeroToOne", "0 to 1"], ["zeroToHundred", "0 to 100"]]);
const scaleModeItems = toItems([["equal", "Equal segments"], ["linear", "Linear"], ["log", "Logarithmic"]]);
const segmentItems = toItems([
    ["1", "Segment 1"], ["2", "Segment 2"], ["3", "Segment 3"], ["4", "Segment 4"], ["5", "Segment 5"],
    ["6", "Segment 6"], ["7", "Segment 7"], ["8", "Segment 8"], ["9", "Segment 9"], ["10", "Segment 10"]
]);
const segmentLabelPositionItems = toItems([["auto", "Auto"], ["outside", "Outside arc/bar"], ["inside", "Inside segment"], ["below", "Below visual"], ["none", "Hide all segment labels"]]);
const fontItems = toItems([
    ["Segoe UI", "Segoe UI"], ["Arial", "Arial"], ["Calibri", "Calibri"], ["Verdana", "Verdana"], ["Tahoma", "Tahoma"],
    ["Trebuchet MS", "Trebuchet MS"], ["Georgia", "Georgia"], ["Times New Roman", "Times New Roman"], ["Courier New", "Courier New"]
]);
const markerLabelPositionItems = toItems([["center", "Center"], ["atMarker", "At marker"], ["below", "Below"], ["above", "Above"]]);
const markerStyleItems = toItems([["line", "Line"], ["pointer", "Arrow pointer"], ["triangle", "Triangle head"], ["dot", "Dot on segment band"]]);
const markerThemeItems = toItems([["modern", "Modern calm"], ["minimal", "Minimal"], ["classic", "Classic"]]);
const lineStyleItems = toItems([["solid", "Solid"], ["dash", "Dashed"], ["dot", "Dotted"]]);

const toggle = (name: string, displayName: string, value: boolean) => new fs.ToggleSwitch({ name, displayName, value });
const color = (name: string, displayName: string, value: string) => new fs.ColorPicker({ name, displayName, value: { value } });
const text = (name: string, displayName: string, value: string) => new fs.TextInput({ name, displayName, value, placeholder: value });
const number = (name: string, displayName: string, value: number) => new fs.NumUpDown({ name, displayName, value });
const dropdown = (name: string, displayName: string, items: { value: string; displayName: string }[], selected: string) =>
    new fs.ItemDropdown({ name, displayName, items, value: items.find(item => item.value === selected)! });

class GeneralCard extends fs.SimpleCard {
    name = "general";
    displayName = "General";
    shape = dropdown("shape", "Shape", shapeItems, "semi");
    segmentCount = number("segmentCount", "Segments", 4);
    valueType = dropdown("valueType", "Value type", valueTypeItems, "percentage");
    percentInput = dropdown("percentInput", "Percentage input", percentInputItems, "zeroToOne");
    scaleMode = dropdown("scaleMode", "Scale mode", scaleModeItems, "equal");
    showWarnings = toggle("showWarnings", "Show warnings", true);
    slices = [this.shape, this.segmentCount, this.valueType, this.percentInput, this.scaleMode, this.showWarnings];
}

class SegmentSelectorCard extends fs.SimpleCard {
    name = "segmentSelector";
    displayName = "Segmenten";
    selectedSegment = dropdown("selectedSegment", "Segment", segmentItems, "1");
    slices = [this.selectedSegment];
}

class SegmentCard extends fs.SimpleCard {
    name: string;
    displayName = "Segment options";
    min = number("min", "Min", 0);
    max = number("max", "Max", 0.25);
    color = color("color", "Color", "#E74C3C");
    label = text("label", "Label", "Segment 1");
    showMin = toggle("showMin", "Show min", true);
    showMax = toggle("showMax", "Show max", false);
    showLabel = toggle("showLabel", "Show name", false);
    slices = [this.min, this.max, this.color, this.label, this.showMin, this.showMax, this.showLabel];

    constructor(index: number, min: number, max: number, defaultColor: string, showMax: boolean) {
        super();
        this.name = `segment${index}`;
        this.min.value = min;
        this.max.value = max;
        this.color.value = { value: defaultColor };
        this.label.value = `Segment ${index}`;
        this.showMax.value = showMax;
    }
}

class SegmentLabelsCard extends fs.SimpleCard {
    name = "segmentLabels";
    displayName = "Segment labels";
    position = dropdown("position", "Position", segmentLabelPositionItems, "auto");
    fontFamily = dropdown("fontFamily", "Font family", fontItems, "Segoe UI");
    fontSize = number("fontSize", "Font size", 10);
    fontColor = color("fontColor", "Font color", "#333333");
    bold = toggle("bold", "Bold", false);
    italic = toggle("italic", "Italic", false);
    underline = toggle("underline", "Underline", false);
    slices = [this.position, this.fontFamily, this.fontSize, this.fontColor, this.bold, this.italic, this.underline];
}

class MarkerCard extends fs.SimpleCard {
    name = "marker";
    displayName = "Marker";
    show = toggle("show", "Show marker", true);
    color = color("color", "Color", "#111111");
    followsSegmentColor = toggle("followsSegmentColor", "Color follows active segment", false);
    style = dropdown("style", "Style", markerStyleItems, "line");
    theme = dropdown("theme", "Theme", markerThemeItems, "modern");
    shadow = toggle("shadow", "Subtle shadow", true);
    lineThickness = number("lineThickness", "Line thickness %", 2);
    headSize = number("headSize", "Arrow/dot size %", 7);
    length = number("length", "Length %", 86);
    opacity = number("opacity", "Opacity %", 100);
    slices = [this.show, this.color, this.followsSegmentColor, this.style, this.theme, this.shadow, this.lineThickness, this.headSize, this.length, this.opacity];
}

class MarkerLabelCard extends fs.SimpleCard {
    name = "markerLabel";
    displayName = "Marker label";
    show = toggle("show", "Show value", true);
    position = dropdown("position", "Position", markerLabelPositionItems, "center");
    fontFamily = dropdown("fontFamily", "Font family", fontItems, "Segoe UI");
    fontSize = number("fontSize", "Font size", 13);
    fontColor = color("fontColor", "Font color", "#111111");
    bold = toggle("bold", "Bold", true);
    italic = toggle("italic", "Italic", false);
    underline = toggle("underline", "Underline", false);
    decimalPlaces = number("decimalPlaces", "Decimals", 0);
    prefix = text("prefix", "Prefix", "");
    suffix = text("suffix", "Suffix", "");
    slices = [this.show, this.position, this.fontFamily, this.fontSize, this.fontColor, this.bold, this.italic, this.underline, this.decimalPlaces, this.prefix, this.suffix];
}

class TargetLineCard extends fs.SimpleCard {
    name = "targetLine";
    displayName = "Target line";
    show = toggle("show", "Show target line", false);
    value = number("value", "Target value", 0.75);
    color = color("color", "Color", "#4E79A7");
    thickness = number("thickness", "Thickness %", 2);
    lineStyle = dropdown("lineStyle", "Line style", lineStyleItems, "solid");
    showLabel = toggle("showLabel", "Show label", true);
    label = text("label", "Label", "Target");
    slices = [this.show, this.value, this.color, this.thickness, this.lineStyle, this.showLabel, this.label];
}

class StyleCard extends fs.SimpleCard {
    name = "style";
    displayName = "Style";
    backgroundColor = color("backgroundColor", "Background", "#FFFFFF");
    segmentThickness = number("segmentThickness", "Segment thickness", 34);
    segmentGap = number("segmentGap", "Segment gap", 1);
    borderColor = color("borderColor", "Border color", "#FFFFFF");
    selectedOpacity = number("selectedOpacity", "Unselected opacity %", 35);
    slices = [this.backgroundColor, this.segmentThickness, this.segmentGap, this.borderColor, this.selectedOpacity];
}

class InteractionCard extends fs.SimpleCard {
    name = "interaction";
    displayName = "Interaction";
    enableSelection = toggle("enableSelection", "Enable internal segment selection", true);
    showTooltips = toggle("showTooltips", "Show tooltips", true);
    slices = [this.enableSelection, this.showTooltips];
}

export class VisualFormattingSettingsModel extends fs.Model {
    general = new GeneralCard();
    segmentSelector = new SegmentSelectorCard();
    segment1 = new SegmentCard(1, 0, 0.25, "#E74C3C", false);
    segment2 = new SegmentCard(2, 0.25, 0.5, "#EB984E", false);
    segment3 = new SegmentCard(3, 0.5, 0.75, "#F4D03F", false);
    segment4 = new SegmentCard(4, 0.75, 1, "#2ECC71", true);
    segment5 = new SegmentCard(5, 1, 2, "#85C1E9", false);
    segment6 = new SegmentCard(6, 2, 3, "#82E0AA", false);
    segment7 = new SegmentCard(7, 3, 4, "#F7DC6F", false);
    segment8 = new SegmentCard(8, 4, 5, "#F0B27A", false);
    segment9 = new SegmentCard(9, 5, 6, "#CD6155", false);
    segment10 = new SegmentCard(10, 6, 7, "#AF7AC5", false);
    segmentLabels = new SegmentLabelsCard();
    marker = new MarkerCard();
    markerLabel = new MarkerLabelCard();
    targetLine = new TargetLineCard();
    style = new StyleCard();
    interaction = new InteractionCard();

    get segmentCards(): SegmentCard[] {
        return [this.segment1, this.segment2, this.segment3, this.segment4, this.segment5,
            this.segment6, this.segment7, this.segment8, this.segment9, this.segment10];
    }

    cards = [this.general, this.segmentSelector, ...this.segmentCards, this.segmentLabels, this.marker,
        this.markerLabel, this.targetLine, this.style, this.interaction];
}
