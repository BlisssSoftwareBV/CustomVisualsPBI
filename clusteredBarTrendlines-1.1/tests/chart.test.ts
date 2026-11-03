import { strict as assert } from "node:assert";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { ChartOptions, ChartSeries, renderChart } from "../src/chart";

const defaults: ChartOptions = {
    width: 800, height: 500, orientation: "column", legend: true, labels: false, gridlines: true,
    fontSize: 11, gap: 25, innerGap: 8, columnOpacity: 1,
    categoryAxis: { show: true, title: true, fontSize: 11, color: "#444444" },
    valueAxis: { show: true, title: true, fontSize: 11, color: "#444444", minimum: null, maximum: null,
        gridColor: "#dddddd", gridWidth: 1, gridDashed: false },
    legendStyle: { position: "top", fontSize: 11, color: "#444444", title: "", showTrends: true },
    labelStyle: { position: "outside", fontSize: 11, color: "#444444" },
    foreground: "#444444", background: "transparent", highContrast: false,
    trendShow: true, equation: false, r2: false, lineWidth: 2.5, dashed: true,
    trend: { order: 2, period: 3, forward: 0, backward: 0, intercept: null },
    numericX: false, categoryTitle: "Maand", valueTitle: "Omzet"
};
const sample = (name = "Reeks A", color = "#118dff"): ChartSeries => ({
    name, color, trendColor: "#e63746", trendWidth: 4, trendDashed: false, trendOpacity: 0.6,
    trendType: "linear", trendShow: true, format: value => String(value),
    data: [10, 20, 30, 40].map((value, index) => ({ category: `Maand ${index + 1}`, x: index + 1, value, tooltip: [] }))
});
function render(series = [sample()], options = defaults): HTMLElement {
    const dom = new JSDOM("<!doctype html><div id='chart'></div>");
    globalThis.document = dom.window.document;
    const root = document.getElementById("chart")!;
    renderChart(root, series, options);
    return root;
}
test("trend stroke, legend and equation color are independent from columns", () => {
    const root = render([sample()], { ...defaults, columnOpacity: 0.3, equation: true });
    assert.equal(root.querySelector(".data-bar")!.getAttribute("fill"), "#118dff");
    assert.equal(root.querySelector(".data-bar")!.getAttribute("opacity"), "0.3");
    const path = root.querySelector(".trend-line")!;
    assert.equal(path.getAttribute("stroke"), "#e63746");
    assert.equal(path.getAttribute("stroke-width"), "4");
    assert.equal(path.getAttribute("stroke-dasharray"), "none");
    assert.equal(path.getAttribute("stroke-opacity"), "0.6");
    const swatch = root.querySelector<HTMLElement>(".legend-line")!;
    assert.equal(swatch.style.borderTopStyle, "solid");
    assert.equal(swatch.style.opacity, "0.6");
    assert.equal(root.querySelector<HTMLElement>(".trend-details div")!.style.borderLeftColor, swatch.style.borderColor);
});
test("each series retains its own line color, width, dash and visibility", () => {
    const second = { ...sample("Reeks B", "#20a080"), trendColor: "#222222", trendWidth: 1, trendDashed: true };
    const root = render([sample(), second]);
    const paths = root.querySelectorAll(".trend-line");
    assert.equal(paths.length, 2);
    assert.equal(paths[1].getAttribute("stroke"), "#222222");
    assert.equal(paths[1].getAttribute("stroke-width"), "1");
    assert.equal(paths[1].getAttribute("stroke-dasharray"), "7,4");
    assert.equal(render([sample(), { ...second, trendShow: false }]).querySelectorAll(".trend-line").length, 1);
    assert.equal(render([sample()], { ...defaults, trendShow: false }).querySelectorAll(".trend-line").length, 0);
});
test("axis visibility, titles, font and grid styling are applied", () => {
    const root = render([sample()], { ...defaults,
        categoryAxis: { ...defaults.categoryAxis, show: false },
        valueAxis: { ...defaults.valueAxis, fontSize: 16, color: "#008000", gridColor: "#ff0000", gridWidth: 3, gridDashed: true }
    });
    assert.equal(root.querySelector<SVGElement>(".category-axis")!.style.display, "none");
    assert.equal(root.querySelectorAll(".horizontal-title").length, 0);
    assert.equal(root.querySelector(".vertical-title")!.childNodes[0].textContent, "Omzet");
    assert.equal(root.querySelector<SVGElement>(".value-axis text")!.style.fontSize, "16px");
    const grid = root.querySelector<SVGElement>(".gridlines .tick line")!;
    assert.equal(grid.style.strokeWidth, "3");
    assert.equal(grid.style.strokeDasharray, "4,3");
    assert.equal(render([sample()], { ...defaults, gridlines: false }).querySelectorAll(".gridlines").length, 0);
});
test("explicit axis bounds are exact and clipped; reversed bounds fall back safely", () => {
    const root = render([sample()], { ...defaults, valueAxis: { ...defaults.valueAxis, minimum: 10, maximum: 30 } });
    const ticks = Array.from(root.querySelectorAll(".value-axis .tick text"), element => Number(element.textContent));
    assert.ok(ticks.every(value => value >= 10 && value <= 30));
    assert.ok(ticks.includes(10) && ticks.includes(30));
    assert.equal(root.querySelector<SVGElement>(".zero-line")!.style.display, "none");
    assert.ok(root.querySelector(".columns")!.getAttribute("clip-path")!.startsWith("url(#trend-clip-"));
    const fallback = render([sample()], { ...defaults, valueAxis: { ...defaults.valueAxis, minimum: 50, maximum: 10 } });
    assert.ok(!fallback.querySelector("svg")!.outerHTML.includes("NaN"));
    assert.equal(fallback.querySelectorAll(".data-bar").length, 4);
});
test("legend bottom, title and trend entries can be configured independently", () => {
    const root = render([sample()], { ...defaults, legendStyle: { ...defaults.legendStyle, position: "bottom", title: "Regio", showTrends: false } });
    assert.equal(root.querySelector<HTMLElement>(".chart-legend")!.style.order, "3");
    assert.equal(root.querySelector(".chart-legend strong")!.textContent, "Regio");
    assert.equal(root.querySelectorAll(".legend-line").length, 0);
    assert.equal(root.querySelectorAll(".data-bar").length, 4);
});
test("label positions and colors work with positive and negative columns and bars", () => {
    const mixed = sample();
    mixed.data[1].value = -20;
    for (const orientation of ["column", "bar"] as const) {
        const roots = ["outside", "inside", "center"].map(position => render([mixed], { ...defaults, orientation, labels: true,
            labelStyle: { position: position as "outside" | "inside" | "center", fontSize: 12, color: "#000080" } }));
        assert.ok(roots.every(root => root.querySelectorAll(".data-label").length === 4));
        assert.equal(roots[0].querySelector<SVGElement>(".data-label")!.style.fontSize, "12px");
        const coordinate = orientation === "column" ? "y" : "x";
        const offsets = roots.map(root => {
            const rectangle = root.querySelector(".data-bar")!;
            const endpoint = Number(rectangle.getAttribute(coordinate)) + (orientation === "bar" ? Number(rectangle.getAttribute("width")) : 0);
            return Number(root.querySelector(".data-label")!.getAttribute(coordinate)) - endpoint;
        });
        const [positiveOutside, positiveInside] = offsets;
        assert.ok(orientation === "column" ? positiveOutside < positiveInside : positiveOutside > positiveInside,
            `${orientation}: outside=${positiveOutside}, inside=${positiveInside}`);
        assert.ok(roots.every(root => !root.querySelector("svg")!.outerHTML.includes("NaN")));
    }
});
test("series gap changes column width without changing trends", () => {
    const series = [sample(), sample("Reeks B")];
    const packed = render(series, { ...defaults, innerGap: 0 });
    const spaced = render(series, { ...defaults, innerGap: 60 });
    assert.ok(Number(packed.querySelector(".data-bar")!.getAttribute("width")) > Number(spaced.querySelector(".data-bar")!.getAttribute("width")));
    assert.equal(packed.querySelector(".trend-line")!.getAttribute("d"), spaced.querySelector(".trend-line")!.getAttribute("d"));
});