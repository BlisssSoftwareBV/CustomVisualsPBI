import { strict as assert } from "node:assert";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { ChartOptions, ProgressDatum, progressColor, renderChart } from "../src/chart";

const options: ChartOptions = {
    mode: "gradient", colors: { start: "#ff0000", midpoint: "#ffff00", target: "#00aa00", top: "#008000", track: "#eeeeee", marker: "#000000", overflow: "#b52f55" },
    overflowColor: true, overflowMessage: "Boven top", showProgress: true, showBounds: true, showTarget: true,
    progressPosition: "right",
    valueMatchColor: false, valuePosition: "right", showTargetTitle: true, showTargetValue: true, targetTitle: "Target",
    fontSize: 12, barHeight: 18, spacing: 24, textColor: "#333333", background: "transparent", highContrast: false, sort: "data",
    customRounding: false, rounding: 100, segmented: false, stepSize: 1, stepUnit: "value", segmentGap: 4,
    percent: value => `${Math.round(value * 100)}%`, onSelect() {}, onClear() {}, onContext() {}, onTooltip() {}, onHideTooltip() {}
};
const datum = (value: number | null): ProgressDatum => ({ category: "Project A", value, minimum: 0, maximum: 100, target: 80,
    identity: {}, format: String, tooltip: [{ displayName: "Waarde", value: String(value) }] });
const root = () => {
    const dom = new JSDOM("<div id='root'></div>");
    globalThis.document = dom.window.document;
    return document.getElementById("root")!;
};

test("renderer draws exact fill and target positions with full-range gradient", () => {
    const element = root();
    renderChart(element, [datum(60)], options);
    assert.equal(element.querySelector<HTMLElement>(".bar-fill")!.style.width, "60%");
    assert.equal(element.querySelector<HTMLElement>(".target-marker")!.style.left, "80%");
    assert.match(element.querySelector<HTMLElement>(".bar-fill")!.style.backgroundSize, /166.666/);
    assert.equal(element.querySelector(".progress-percent")!.textContent, "60%");
});

test("overflow is capped and explicitly reported, and options can disable both treatments", () => {
    const element = root();
    renderChart(element, [datum(120)], options);
    assert.equal(element.querySelector<HTMLElement>(".bar-fill")!.style.width, "100%");
    assert.equal(element.querySelector(".overflow-message")!.textContent, "Boven top (+20)");
    assert.equal(progressColor(datum(120), options), options.colors.overflow);
    renderChart(element, [datum(120)], { ...options, overflowColor: false, overflowMessage: null });
    assert.equal(element.querySelector(".overflow-message"), null);
    assert.notEqual(progressColor(datum(120), { ...options, overflowColor: false }), options.colors.overflow);
});

test("status colors distinguish before target, target and top", () => {
    const status = { ...options, mode: "status" };
    assert.equal(progressColor(datum(60), status), options.colors.start);
    assert.equal(progressColor(datum(80), status), options.colors.target);
    assert.equal(progressColor(datum(100), status), options.colors.top);
});

test("the top color wins when the target coincides with the top", () => {
    assert.equal(progressColor({ ...datum(100), target: 100 }, { ...options, mode: "blend" }), options.colors.top);
    assert.equal(progressColor({ ...datum(120), target: 120 }, { ...options, mode: "blend", overflowColor: false }), options.colors.top);
});

test("blend passes through the midpoint at half the target with smooth colors on both sides", () => {
    const blend = { ...options, mode: "blend" };
    assert.equal(progressColor(datum(20), blend), "rgb(255, 128, 0)");
    assert.equal(progressColor(datum(40), blend), "rgb(255, 255, 0)");
    assert.equal(progressColor(datum(60), blend), "rgb(128, 213, 0)");
    assert.equal(progressColor(datum(80), blend), "rgb(0, 170, 0)");
});

test("without a target the midpoint is at half the top", () => {
    assert.equal(progressColor({ ...datum(50), target: null }, options), "rgb(255, 255, 0)");
    const element = root();
    renderChart(element, [{ ...datum(75), target: null }], options);
    const background = element.querySelector<HTMLElement>(".bar-fill")!.style.background;
    assert.match(background, /(?:#ffff00|rgb\(255, 255, 0\)) 50%/);
    assert.equal(element.querySelector(".target-marker"), null);
});

test("midpoint follows the target relative to the floor, including fractional percentages", () => {
    assert.equal(progressColor({ ...datum(50), minimum: 20, maximum: 120, target: 80 }, options), "rgb(255, 255, 0)");
    assert.equal(progressColor({ ...datum(0.4), maximum: 1, target: 0.8 }, options), "rgb(255, 255, 0)");
});

test("gradient uses the same midpoint and target stops as the blended color", () => {
    const element = root();
    renderChart(element, [datum(60)], options);
    const background = element.querySelector<HTMLElement>(".bar-fill")!.style.background;
    assert.match(background, /(?:#ffff00|rgb\(255, 255, 0\)) 40%/);
    assert.match(background, /(?:#00aa00|rgb\(0, 170, 0\)) 80%/);
});

test("missing data is a warning instead of a zero-length progress bar", () => {
    const element = root();
    renderChart(element, [datum(null)], options);
    assert.equal(element.querySelector(".bar-track"), null);
    assert.match(element.textContent!, /Geen waarde/);
});

test("selection works with keyboard and multiselect", () => {
    const element = root();
    let selected: ProgressDatum | null = null;
    let multi = false;
    renderChart(element, [datum(40)], { ...options, onSelect: (row, multiple) => { selected = row; multi = multiple; } });
    const row = element.querySelector<HTMLElement>(".progress-row")!;
    row.dispatchEvent(new document.defaultView!.KeyboardEvent("keydown", { key: "Enter", ctrlKey: true }));
    assert.equal(selected!.value, 40);
    assert.equal(multi, true);
});

test("high contrast disables gradients and cross-highlights retain original value", () => {
    const element = root();
    renderChart(element, [{ ...datum(60), highlight: 30 }], { ...options, highContrast: true });
    assert.equal(element.querySelector<HTMLElement>(".bar-fill")!.style.backgroundImage, "");
    assert.equal(element.querySelector<HTMLElement>(".bar-highlight")!.style.width, "30%");
    assert.equal(element.querySelector(".actual-value")!.textContent, "60");
});

test("the original bar stays the default while custom rounding spans square to pill", () => {
    const element = root();
    renderChart(element, [datum(60)], options);
    assert.equal(element.querySelector<HTMLElement>(".bar-track")!.style.borderRadius, "");
    assert.equal(element.querySelector(".bar-segment"), null);
    for (const rounding of [0, 25, 100]) {
        renderChart(element, [datum(60)], { ...options, customRounding: true, rounding });
        assert.equal(element.querySelector<HTMLElement>(".bar-track")!.style.borderRadius, `${9 * rounding / 100}px`);
        assert.equal(element.querySelector<HTMLElement>(".bar-fill")!.style.borderRadius, `${8 * rounding / 100}px`);
    }
});

test("segmented bars preserve partial progress, target and gradient positions", () => {
    const element = root();
    renderChart(element, [datum(25)], { ...options, segmented: true, stepSize: 10, stepUnit: "percent", customRounding: true });
    const segments = element.querySelectorAll<HTMLElement>(".bar-segment");
    assert.equal(segments.length, 10);
    assert.equal(segments[0].querySelector<HTMLElement>(".bar-fill")!.style.width, "100%");
    assert.ok(Math.abs(parseFloat(segments[2].querySelector<HTMLElement>(".bar-fill")!.style.width) - 50) < 1e-10);
    assert.equal(segments[3].querySelector<HTMLElement>(".bar-fill")!.style.width, "0%");
    assert.match(segments[2].querySelector<HTMLElement>(".bar-fill")!.style.backgroundSize, /2000/);
    assert.ok(parseFloat(segments[2].querySelector<HTMLElement>(".bar-fill")!.style.backgroundPosition) > 0);
    assert.equal(segments[0].style.borderRadius, "9px");
    assert.equal(element.querySelector<HTMLElement>(".target-marker")!.style.left, "80%");
    assert.equal(element.querySelector(".progress-percent")!.textContent, "25%");
});

test("segmented highlights and overflow remain visible in high contrast", () => {
    const element = root();
    renderChart(element, [{ ...datum(120), highlight: 25 }], { ...options, segmented: true, stepSize: 20, highContrast: true });
    const segments = element.querySelectorAll<HTMLElement>(".bar-segment");
    assert.equal(segments.length, 5);
    assert.ok(Math.abs(parseFloat(segments[1].querySelector<HTMLElement>(".bar-highlight")!.style.width) - 25) < 1e-10);
    assert.equal(segments[0].querySelector<HTMLElement>(".bar-fill")!.style.backgroundImage, "");
    assert.match(segments[0].style.border, /1px solid/);
    assert.match(element.querySelector(".overflow-message")!.textContent!, /Boven top/);
});

test("too many segments fall back without losing the progress bar", () => {
    const element = root();
    renderChart(element, [datum(25)], { ...options, segmented: true, stepSize: 0.001 });
    assert.equal(element.querySelector(".bar-segment"), null);
    assert.equal(element.querySelector<HTMLElement>(".bar-fill")!.style.width, "25%");
    assert.match(element.querySelector(".data-warning")!.textContent!, /maximaal 200/);
});

test("actual value can follow the bar endpoint color, including overflow and high contrast", () => {
    const element = root();
    renderChart(element, [datum(40)], { ...options, valueMatchColor: true });
    assert.equal(element.querySelector<HTMLElement>(".actual-value")!.style.color, "rgb(255, 255, 0)");
    renderChart(element, [datum(120)], { ...options, valueMatchColor: true });
    assert.equal(element.querySelector<HTMLElement>(".actual-value")!.style.color, "rgb(181, 47, 85)");
    renderChart(element, [datum(40)], { ...options, valueMatchColor: true, highContrast: true });
    assert.equal(element.querySelector<HTMLElement>(".actual-value")!.style.color, "rgb(51, 51, 51)");
    renderChart(element, [datum(40)], options);
    assert.equal(element.querySelector<HTMLElement>(".actual-value")!.style.color, "");
});

test("actual value can be positioned above the clamped fill without moving the progress percentage", () => {
    const element = root();
    for (const [value, position] of [[40, "40%"], [120, "100%"], [-10, "0%"]] as const) {
        renderChart(element, [datum(value)], { ...options, valuePosition: "fill", segmented: true, stepSize: 10 });
        assert.equal(element.querySelector<HTMLElement>(".actual-label-lane .actual-value")!.style.left, position);
        assert.equal(element.querySelector(".row-header .actual-value"), null);
        assert.ok(element.querySelector(".row-header .progress-percent"));
    }
    renderChart(element, [datum(null)], { ...options, valuePosition: "fill" });
    assert.ok(element.querySelector(".row-header .actual-value"));
    assert.equal(element.querySelector(".actual-label-lane"), null);
});

test("target label is under its marker with independently configurable title and value", () => {
    const element = root();
    for (const [showTargetTitle, showTargetValue, expected] of [
        [true, true, "Doel 80"], [true, false, "Doel"], [false, true, "80"], [false, false, null]
    ] as const) {
        renderChart(element, [datum(40)], { ...options, showTargetTitle, showTargetValue, targetTitle: "Doel" });
        assert.equal(element.querySelector(".target-label")?.textContent ?? null, expected);
        if (expected !== null) assert.equal(element.querySelector<HTMLElement>(".target-label-lane .target-label")!.style.left, "80%");
        assert.equal(element.querySelector(".row-footer .target-label"), null);
        assert.ok(element.querySelector(".target-marker"));
    }
    renderChart(element, [datum(40)], { ...options, showTarget: false });
    assert.equal(element.querySelector(".target-label-lane"), null);
    renderChart(element, [{ ...datum(40), target: null }], options);
    assert.equal(element.querySelector(".target-label-lane"), null);
});

test("percentage can sit in the center or end of the filled range without changing the displayed ratio", () => {
    const element = root();
    for (const [progressPosition, left] of [["center", "30%"], ["end", "60%"]] as const) {
        renderChart(element, [datum(60)], { ...options, progressPosition });
        const label = element.querySelector<HTMLElement>(".bar-track .inside-progress")!;
        assert.equal(label.textContent, "60%");
        assert.equal(label.style.left, left);
        assert.equal(element.querySelector(".row-header .progress-percent"), null);
    }
    renderChart(element, [datum(120)], { ...options, progressPosition: "end" });
    assert.equal(element.querySelector<HTMLElement>(".inside-progress")!.style.left, "100%");
    assert.equal(element.querySelector(".inside-progress")!.textContent, "120%");
});

test("zero fill and low bars keep the percentage readable in the header", () => {
    const element = root();
    for (const value of [0, -10]) {
        renderChart(element, [datum(value)], { ...options, progressPosition: "center" });
        assert.equal(element.querySelector(".inside-progress"), null);
        assert.ok(element.querySelector(".row-header .progress-percent"));
    }
    renderChart(element, [datum(60)], { ...options, progressPosition: "end", barHeight: 6 });
    assert.equal(element.querySelector(".inside-progress"), null);
    assert.ok(element.querySelector(".row-header .progress-percent"));
    renderChart(element, [datum(60)], { ...options, progressPosition: "center", showProgress: false });
    assert.equal(element.querySelector(".progress-percent"), null);
});