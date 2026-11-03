import type powerbi from "powerbi-visuals-api";
import { Visual } from "../src/visual";

const element = document.getElementById("visual")!;
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const selectedValue = (id: string) => (document.getElementById(id) as HTMLSelectElement).value;
let selected: ReturnType<typeof identity>[] = [];
const identity = (key: string) => ({ getKey: () => key, getSelector: () => ({ metadata: key }), includes: (other: { getKey: () => string }) => other.getKey() === key });
const failures: string[] = [];
const tooltips: unknown[] = [];
const host = {
    locale: "nl-NL",
    colorPalette: { isHighContrast: false, foreground: { value: "#ffffff" }, background: { value: "#000000" } },
    createSelectionManager: () => ({ registerOnSelectCallback() {}, getSelectionIds: () => selected,
        select: async (id: ReturnType<typeof identity>, multi: boolean) => {
            const exists = selected.some(item => item.getKey() === id.getKey());
            selected = multi ? exists ? selected.filter(item => item.getKey() !== id.getKey()) : [...selected, id] : exists && selected.length === 1 ? [] : [id];
            return selected;
        }, clear: async () => { selected = []; return selected; }, showContextMenu: async () => {} }),
    createSelectionIdBuilder: () => {
        let key = "";
        const builder = { withMeasure: (measure: string) => { key += measure; return builder; },
            withCategory: (_category: unknown, index: number) => { key += `:${index}`; return builder; },
            createSelectionId: () => identity(key) };
        return builder;
    },
    eventService: { renderingStarted() {}, renderingFinished() {}, renderingFailed: (_options: unknown, message: string) => failures.push(message) },
    tooltipService: { show: (tooltip: unknown) => { tooltips.splice(0, tooltips.length, tooltip); }, hide() {} }
};
const visual = new Visual({ element, host } as unknown as powerbi.extensibility.visual.VisualConstructorOptions);
let view: powerbi.DataView;
const names = ["Dienstverlening", "Bedrijfsvoering", "Digitalisering", "Duurzaamheid", "Ontwikkeling"];

function redraw(): void {
    visual.update({ viewport: { width: element.clientWidth, height: element.clientHeight }, dataViews: [view], type: 2 } as powerbi.extensibility.visual.VisualUpdateOptions);
}

function update(): void {
    const dataset = selectedValue("dataset");
    const isPercent = dataset === "percent";
    const isTotal = dataset === "total";
    const isEdge = dataset === "edge";
    const isSteps = dataset === "steps";
    const values = isTotal ? [387] : isPercent ? [0.62, 0.84, 1.08, 0.37, 0.96] : isEdge ? [null, 50, -12, 118, 65] : isSteps ? [1, 2.5, 4, 0, 5] : [62, 84, 108, 37, 96];
    const categoryNames = isEdge ? ["Ontbrekende waarde", "Ongeldig bereik", "Onder bodem", "Boven top", "Target buiten bereik"] : names;
    const minimum = Number(input("minimum").value), maximum = Number(input("maximum").value), target = Number(input("target").value);
    const measure = (role: string, label: string, data: (number | null)[]) => ({ source: { displayName: label, queryName: role, roles: { [role]: true }, format: isPercent ? "0%" : "#,0" }, values: data });
    const columns = [measure("value", "Realisatie", values)];
    if (input("fields").checked) columns.push(
        measure("minimum", "Bodem", values.map(() => minimum)),
        measure("maximum", "Top", values.map((_value, index) => isEdge && index === 1 ? minimum : maximum)),
        measure("target", "Target", values.map((_value, index) => isEdge && index === 4 ? maximum * 1.2 : target))
    );
    view = { metadata: { columns: columns.map(item => item.source), objects: {
        range: { minimum, maximum, target, targetEnabled: input("targetEnabled").checked },
        colors: { mode: selectedValue("mode"), start: { solid: { color: input("startColor").value } },
            midpoint: { solid: { color: input("midpointColor").value } },
            target: { solid: { color: input("targetColor").value } }, top: { solid: { color: input("topColor").value } } },
        overflow: { recolor: input("overflow").checked, showMessage: input("message").checked },
        labels: { format: "auto", decimals: isSteps ? 1 : 0,
            valueMatchColor: input("valueMatchColor").checked, valuePosition: selectedValue("valuePosition"),
            progressPosition: selectedValue("progressPosition"),
            showTargetTitle: input("showTargetTitle").checked, showTargetValue: input("showTargetValue").checked, targetTitle: input("targetTitle").value },
        layout: { customRounding: input("customRounding").checked, rounding: Number(input("rounding").value),
            segmented: input("segmented").checked, stepSize: Number(input("stepSize").value), stepUnit: selectedValue("stepUnit"),
            segmentGap: Number(input("segmentGap").value) }
    } }, categorical: { categories: isTotal ? undefined : [{ source: { displayName: "Afdeling", roles: { category: true } }, values: categoryNames }],
        values: Object.assign(columns, { grouped: () => [{ values: columns }] }) as unknown as powerbi.DataViewValueColumns } };
    host.colorPalette.isHighContrast = input("contrast").checked;
    input("rounding").disabled = !input("customRounding").checked;
    input("targetTitle").disabled = !input("showTargetTitle").checked;
    document.getElementById("roundingValue")!.textContent = `${input("rounding").value}%`;
    ["stepSize", "stepUnit", "segmentGap"].forEach(id => (document.getElementById(id) as HTMLInputElement | HTMLSelectElement).disabled = !input("segmented").checked);
    document.getElementById("chartTitle")!.textContent = isTotal ? "Totale voortgang" : isPercent ? "Voortgang in percentages" : isEdge ? "Datakwaliteit en grenzen" : isSteps ? "Voortgang in stappen" : "Voortgang per afdeling";
    redraw();
}

document.getElementById("dataset")!.addEventListener("change", () => {
    const dataset = selectedValue("dataset");
    input("minimum").value = "0";
    input("maximum").value = dataset === "percent" ? "1" : dataset === "total" ? "500" : dataset === "steps" ? "5" : "100";
    input("target").value = dataset === "percent" ? "0.8" : dataset === "total" ? "400" : dataset === "steps" ? "4" : "80";
    if (dataset === "steps") {
        input("segmented").checked = true;
        input("customRounding").checked = true;
        input("rounding").value = "100";
        input("stepSize").value = "1";
        (document.getElementById("stepUnit") as HTMLSelectElement).value = "value";
    } else if (dataset === "percent") {
        input("stepSize").value = "10";
        (document.getElementById("stepUnit") as HTMLSelectElement).value = "percent";
    }
    selected = [];
    update();
});
document.querySelectorAll("header input, header select:not(#dataset)").forEach(control => control.addEventListener("input", update));
new ResizeObserver(redraw).observe(element);
update();
Object.assign(window, { preview: { visual, host, failures, tooltips, redraw, update, get view() { return view; } } });