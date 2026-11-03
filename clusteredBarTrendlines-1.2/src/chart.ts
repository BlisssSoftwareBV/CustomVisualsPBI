import * as d3 from "d3";
import { calculateTrend, Point, TrendOptions, TrendResult, TrendType, trendNames } from "./trendlines";

export interface ChartDatum {
    category: string;
    x: number;
    value: number | null;
    highlight?: number | null;
    tooltip: { displayName: string; value: string }[];
    identity?: unknown;
}
export interface ChartSeries {
    name: string;
    color: string;
    data: ChartDatum[];
    trendShow: boolean;
    trendType: TrendType;
    trendColor: string;
    trendWidth: number;
    trendDashed: boolean;
    trendOpacity: number;
    format: (value: number) => string;
}
interface AxisStyle { show: boolean; title: boolean; fontSize: number; color: string }
export function resolveDisplayUnit(units: string, values: readonly unknown[]): number {
    if (units === "none") return 1;
    if (units !== "auto") return [1, 1e3, 1e6, 1e9, 1e12].includes(Number(units)) ? Number(units) : 1;
    const magnitude = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value))
        .reduce((maximum, value) => Math.max(maximum, Math.abs(value)), 0);
    return [1e12, 1e9, 1e6, 1e3, 1].find(unit => magnitude >= unit) ?? 1;
}
export interface ChartOptions {
    width: number; height: number;
    orientation: "bar" | "column";
    legend: boolean; labels: boolean; gridlines: boolean;
    fontSize: number; gap: number;
    innerGap: number; columnOpacity: number;
    categoryAxis: AxisStyle;
    valueAxis: AxisStyle & { minimum: number | null; maximum: number | null; gridColor: string; gridWidth: number; gridDashed: boolean };
    legendStyle: { position: "top" | "bottom"; fontSize: number; color: string; title: string; showTrends: boolean };
    labelStyle: { position: "outside" | "inside" | "center"; fontSize: number; color: string; background?: boolean; backgroundColor?: string };
    foreground: string; background: string; highContrast: boolean;
    trendShow: boolean; equation: boolean; r2: boolean; lineWidth: number; dashed: boolean;
    trend: Omit<TrendOptions, "type">;
    numericX: boolean;
    categoryTitle: string;
    valueTitle: string;
    onSelect?: (datum: ChartDatum, multi: boolean) => void;
    onClear?: () => void;
    onContext?: (datum: ChartDatum, event: MouseEvent) => void;
    onTooltip?: (datum: ChartDatum, event: MouseEvent) => void;
    onHideTooltip?: () => void;
}

export function renderChart(root: HTMLElement, series: ChartSeries[], options: ChartOptions): void {
    root.replaceChildren();
    root.className = "trend-visual";
    root.style.color = options.foreground;
    root.style.backgroundColor = options.background;
    root.style.fontSize = `${options.fontSize}px`;
    root.style.width = `${options.width}px`;
    root.style.height = `${options.height}px`;
    if (!series.length || !series[0].data.length) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent = "Voeg een categorie en minimaal een waarde toe.";
        root.append(empty);
        return;
    }
    const fits = series.map(item => options.trendShow && item.trendShow ? calculateTrend(
        item.data.filter(datum => datum.value !== null).map(datum => ({ x: datum.x, y: datum.value! })),
        { ...options.trend, type: item.trendType }
    ) : null);
    if (options.legend) {
        const legend = document.createElement("div");
        legend.className = "chart-legend";
        legend.style.order = options.legendStyle.position === "bottom" ? "3" : "0";
        legend.style.fontSize = `${options.legendStyle.fontSize}px`;
        legend.style.color = options.legendStyle.color;
        if (options.legendStyle.title) {
            const title = document.createElement("strong");
            title.textContent = options.legendStyle.title;
            legend.append(title);
        }
        series.forEach((item, index) => {
            const entry = document.createElement("span");
            const swatch = document.createElement("i");
            swatch.style.backgroundColor = item.color;
            swatch.style.opacity = String(options.columnOpacity);
            const name = document.createElement("span");
            name.className = "legend-name";
            name.textContent = item.name;
            name.title = item.name;
            entry.append(swatch, name);
            legend.append(entry);
            if (options.legendStyle.showTrends && fits[index]?.points.length) {
                const trendEntry = document.createElement("span");
                const line = document.createElement("i");
                line.className = "legend-line";
                line.style.borderColor = item.trendColor;
                line.style.borderTopWidth = `${item.trendWidth}px`;
                line.style.borderTopStyle = item.trendDashed ? "dashed" : "solid";
                line.style.opacity = String(item.trendOpacity);
                const trendName = document.createElement("span");
                trendName.className = "legend-name";
                trendName.textContent = trendNames[item.trendType];
                trendEntry.title = `${item.name}: ${trendNames[item.trendType]}`;
                trendEntry.append(line, trendName);
                legend.append(trendEntry);
            }
        });
        root.append(legend);
    }
    const details = document.createElement("div");
    details.className = "trend-details";
    fits.forEach((fit, index) => {
        if (!fit) return;
        const fragments = fit.error ? [fit.error] : [
            options.equation ? fit.equation : "",
            options.r2 && fit.r2 !== null ? `R\u00b2 = ${fit.r2.toFixed(4)}` : ""
        ].filter(Boolean);
        if (fragments.length) {
            const row = document.createElement("div");
            row.style.borderLeftColor = series[index].trendColor;
            row.textContent = `${series[index].name}: ${fragments.join("; ")}`;
            details.append(row);
        }
    });
    if (details.childElementCount) root.append(details);
    const viewport = document.createElement("div");
    viewport.className = "chart-viewport";
    root.append(viewport);
    const bar = options.orientation === "bar";
    const count = series[0].data.length;
    const horizontalAxis = bar ? options.valueAxis : options.categoryAxis;
    const verticalAxis = bar ? options.categoryAxis : options.valueAxis;
    const outsideLabels = options.labels && options.labelStyle.position === "outside";
    const finiteValues = series.flatMap(item => item.data.flatMap(datum => [datum.value, datum.highlight]))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    fits.forEach(fit => fit?.points.forEach(point => finiteValues.push(point.y)));
    const valueLabelWidth = Math.max(...[Math.min(0, ...finiteValues), Math.max(0, ...finiteValues),
        options.valueAxis.minimum ?? 0, options.valueAxis.maximum ?? 0].map(value => series[0].format(value).length * options.valueAxis.fontSize * 0.56));
    const categoryLabelWidth = Math.max(...series[0].data.map(datum => datum.category.length * options.categoryAxis.fontSize * 0.56));
    const verticalLabelWidth = bar ? Math.min(categoryLabelWidth, options.width * 0.35) : valueLabelWidth;
    const margin = { top: outsideLabels ? options.labelStyle.fontSize + 14 : 8, right: outsideLabels && bar ? valueLabelWidth + 8 : 6,
        bottom: horizontalAxis.show ? horizontalAxis.fontSize + 12 + (horizontalAxis.title ? horizontalAxis.fontSize + 12 : 0) : 6,
        left: verticalAxis.show ? verticalLabelWidth + 10 + (verticalAxis.title ? verticalAxis.fontSize + 12 : 0) : 6 };
    const availableHeight = Math.max(1, options.height - (root.querySelector<HTMLElement>(".chart-legend")?.offsetHeight || 0) - details.offsetHeight);
    const width = Math.max(1, options.width);
    const height = availableHeight;
    const plotWidth = Math.max(1, width - margin.left - margin.right);
    const plotHeight = Math.max(1, height - margin.top - margin.bottom);
    const svg = d3.select(viewport).append("svg").attr("width", width).attr("height", height)
        .attr("role", "img").attr("aria-label", `${options.categoryTitle}: ${options.valueTitle}, gegroepeerd diagram met trendlijnen`);
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    let minimum = Math.min(0, ...finiteValues);
    let maximum = Math.max(0, ...finiteValues);
    if (minimum === maximum) { minimum -= 1; maximum += 1; }
    const requestedMinimum = options.valueAxis.minimum ?? minimum;
    const requestedMaximum = options.valueAxis.maximum ?? maximum;
    if (Number.isFinite(requestedMinimum) && Number.isFinite(requestedMaximum) && requestedMinimum < requestedMaximum) {
        minimum = requestedMinimum;
        maximum = requestedMaximum;
    }
    const valueScale = d3.scaleLinear().domain([minimum, maximum]).range(bar ? [0, plotWidth] : [plotHeight, 0]);
    if (options.valueAxis.minimum === null && options.valueAxis.maximum === null) valueScale.nice();
    const hasForecast = fits.some((fit, index) => fit?.points.length && series[index].trendType !== "movingAverage");
    const categoryExtent = bar ? plotHeight : plotWidth;
    const allX = series.flatMap(item => item.data.map(datum => datum.x)).filter(Number.isFinite);
    const xSpan = options.numericX ? Math.max(1, Math.max(...allX) - Math.min(...allX)) : Math.max(1, count - 1);
    const unit = options.numericX ? xSpan / Math.max(1, count - 1) : 1;
    const backward = hasForecast ? Math.max(0, options.trend.backward) : 0;
    const forward = hasForecast ? Math.max(0, options.trend.forward) : 0;
    const fullSpan = xSpan + unit + backward + forward;
    const categoryScale = d3.scaleBand<number>().domain(d3.range(count))
        .range([categoryExtent * backward / fullSpan, categoryExtent * (fullSpan - forward) / fullSpan])
        .paddingInner(Math.min(0.7, Math.max(0.05, options.gap / 100))).paddingOuter(0.12);
    const innerScale = d3.scaleBand<number>().domain(d3.range(series.length)).range([0, categoryScale.bandwidth()]).padding(Math.min(0.7, Math.max(0, options.innerGap / 100)));
    const categoryAxis = bar ? d3.axisLeft(categoryScale) : d3.axisBottom(categoryScale);
    const labelSpace = bar ? options.categoryAxis.fontSize + 6
        : Math.max(...series[0].data.map(datum => datum.category.length * options.categoryAxis.fontSize * 0.56)) + 4;
    const stride = Math.max(1, Math.ceil(labelSpace / Math.max(1, categoryScale.step())));
    categoryAxis.tickValues(d3.range(count).filter(index => index % stride === 0)).tickFormat(index => series[0].data[index].category);
    const categoryGroup = plot.append("g").attr("class", "category-axis")
        .attr("transform", bar ? "translate(0,0)" : `translate(0,${plotHeight})`).call(categoryAxis)
        .style("display", options.categoryAxis.show ? "" : "none").style("color", options.categoryAxis.color);
    categoryGroup.selectAll("text").style("fill", options.categoryAxis.color).style("font-size", `${options.categoryAxis.fontSize}px`);
    categoryGroup.selectAll<SVGTextElement, number>("text").each(function(index) {
        const full = series[0].data[index].category;
        const maximumCharacters = Math.max(3, Math.floor((bar ? margin.left - (options.categoryAxis.title ? 35 : 15) : categoryScale.step() * stride - 4) / (options.categoryAxis.fontSize * 0.56)));
        const label = d3.select(this);
        label.text(full.length > maximumCharacters ? `${full.slice(0, maximumCharacters - 3)}...` : full);
        label.append("title").text(full);
    });
    const valueAxis = bar ? d3.axisBottom(valueScale) : d3.axisLeft(valueScale);
    const valueTickCount = Math.max(2, Math.floor((bar ? plotWidth : plotHeight) / (options.valueAxis.fontSize * 4)));
    valueAxis.ticks(valueTickCount).tickFormat(value => series[0].format(Number(value)));
    const valueGroup = plot.append("g").attr("class", "value-axis").attr("transform", bar ? `translate(0,${plotHeight})` : "translate(0,0)").call(valueAxis)
        .style("display", options.valueAxis.show ? "" : "none").style("color", options.valueAxis.color);
    valueGroup.selectAll("text").style("fill", options.valueAxis.color).style("font-size", `${options.valueAxis.fontSize}px`);
    if (options.gridlines) {
        const grid = bar ? d3.axisBottom(valueScale) : d3.axisLeft(valueScale);
        grid.ticks(valueTickCount).tickSize(-(bar ? plotHeight : plotWidth)).tickFormat(() => "");
        const gridGroup = plot.append("g").attr("class", "gridlines").attr("transform", bar ? `translate(0,${plotHeight})` : "translate(0,0)").call(grid);
        gridGroup.selectAll(".tick line").style("stroke", options.valueAxis.gridColor).style("stroke-opacity", 1)
            .style("stroke-width", options.valueAxis.gridWidth).style("stroke-dasharray", options.valueAxis.gridDashed ? "4,3" : "none");
    }
    plot.append("line").attr("class", "zero-line")
        .style("display", minimum <= 0 && maximum >= 0 ? "" : "none")
        .attr("x1", bar ? valueScale(0) : 0).attr("x2", bar ? valueScale(0) : plotWidth)
        .attr("y1", bar ? 0 : valueScale(0)).attr("y2", bar ? plotHeight : valueScale(0));
    if (horizontalAxis.show && horizontalAxis.title) svg.append("text").attr("class", "axis-title horizontal-title")
        .attr("x", margin.left + plotWidth / 2).attr("y", height - 8).attr("text-anchor", "middle")
        .style("fill", horizontalAxis.color).style("font-size", `${horizontalAxis.fontSize}px`).text(bar ? options.valueTitle : options.categoryTitle);
    if (verticalAxis.show && verticalAxis.title) svg.append("text").attr("class", "axis-title vertical-title")
        .attr("transform", `translate(16,${margin.top + plotHeight / 2}) rotate(-90)`).attr("text-anchor", "middle")
        .style("fill", verticalAxis.color).style("font-size", `${verticalAxis.fontSize}px`).text(bar ? options.categoryTitle : options.valueTitle);
    svg.selectAll<SVGTextElement, unknown>(".axis-title").each(function() {
        const text = d3.select(this);
        const full = text.text();
        const limit = Math.max(3, Math.floor((this.classList.contains("vertical-title") ? plotHeight : plotWidth) / (Number.parseFloat(this.style.fontSize) * 0.6)));
        if (full.length > limit) text.text(`${full.slice(0, limit - 3)}...`);
        text.append("title").text(full);
    });
    const clipId = `trend-clip-${renderSequence++}`;
    plot.append("defs").append("clipPath").attr("id", clipId).append("rect").attr("width", plotWidth).attr("height", plotHeight);
    const barLayer = plot.append("g").attr("class", "columns").attr("clip-path", `url(#${clipId})`);
    const labelLayer = plot.append("g").attr("class", "data-labels");
    const labelBounds: { left: number; right: number; top: number; bottom: number }[] = [];
    const hasHighlights = series.some(item => item.data.some(datum => datum.highlight !== undefined));
    series.forEach((item, seriesIndex) => {
        item.data.forEach((datum, index) => {
            if (datum.value === null || !Number.isFinite(datum.value)) return;
            const position = categoryScale(index)! + innerScale(seriesIndex)!;
            const thickness = innerScale.bandwidth();
            const rectangle = (value: number, highlight: boolean) => {
                const start = Math.min(valueScale(0), valueScale(value));
                const length = Math.max(0.5, Math.abs(valueScale(value) - valueScale(0)));
                const rect = barLayer.append("rect").datum(datum).attr("class", highlight ? "highlight-bar" : "data-bar")
                    .attr("x", bar ? start : position).attr("y", bar ? position : start)
                    .attr("width", bar ? length : thickness).attr("height", bar ? thickness : length)
                    .attr("fill", item.color).attr("opacity", options.columnOpacity * (!highlight && hasHighlights ? 0.3 : 1))
                    .attr("stroke", options.highContrast ? options.foreground : "none");
                rect.append("title").text(datum.tooltip.map(field => `${field.displayName}: ${field.value}`).join("\n"));
                if (!highlight) {
                    rect.attr("tabindex", 0).attr("role", "button").attr("aria-label", `${datum.category}, ${item.name}, ${item.format(value)}`)
                        .on("click", (event: MouseEvent) => { event.stopPropagation(); options.onSelect?.(datum, event.ctrlKey || event.metaKey); })
                        .on("keydown", (event: KeyboardEvent) => {
                            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); options.onSelect?.(datum, event.ctrlKey || event.metaKey); }
                        });
                }
                rect.on("contextmenu", (event: MouseEvent) => { event.preventDefault(); options.onContext?.(datum, event); })
                    .on("pointermove", (event: MouseEvent) => options.onTooltip?.(datum, event))
                    .on("pointerleave", () => options.onHideTooltip?.());
            };
            rectangle(datum.value, false);
            if (typeof datum.highlight === "number" && Number.isFinite(datum.highlight)) rectangle(datum.highlight, true);
            if (options.labels && thickness >= 10) {
                const direction = datum.value >= 0 ? 1 : -1;
                const baseline = valueScale(0);
                const endpoint = valueScale(datum.value);
                const labelText = item.format(datum.value);
                const labelWidth = labelText.length * options.labelStyle.fontSize * 0.6;
                const inside = options.labelStyle.position !== "outside";
                if (datum.value < minimum || datum.value > maximum || (!bar && inside && labelWidth > thickness - 2)
                    || (inside && Math.abs(endpoint - baseline) < (bar ? labelWidth + 10 : options.labelStyle.fontSize + 8))) return;
                const labelPosition = options.labelStyle.position === "center" ? (baseline + endpoint) / 2
                    : endpoint + (inside ? -1 : 1) * direction * (bar ? 5 : -options.labelStyle.fontSize / 2 - 4);
                const label = labelLayer.append("text").attr("class", "data-label")
                    .attr("x", bar ? labelPosition : position + thickness / 2)
                    .attr("y", bar ? position + thickness / 2 : labelPosition)
                    .attr("dy", "0.35em").attr("text-anchor", bar && options.labelStyle.position !== "center" ? (direction * (inside ? -1 : 1) > 0 ? "start" : "end") : "middle")
                    .style("fill", options.labelStyle.color).style("font-size", `${options.labelStyle.fontSize}px`).text(labelText);
                const node = label.node()!;
                const textWidth = typeof node.getComputedTextLength === "function" ? node.getComputedTextLength() : labelWidth;
                if (!bar && !inside) label.attr("x", Math.min(plotWidth - textWidth / 2 - 3, Math.max(textWidth / 2 + 3, position + thickness / 2)));
                const anchor = label.attr("text-anchor");
                const labelX = Number(label.attr("x"));
                const labelY = Number(label.attr("y"));
                const left = labelX - (anchor === "middle" ? textWidth / 2 : anchor === "end" ? textWidth : 0) - 3;
                const right = left + textWidth + 6;
                const top = labelY - options.labelStyle.fontSize / 2 - 3;
                const bottom = labelY + options.labelStyle.fontSize / 2 + 3;
                if (labelBounds.some(bounds => left < bounds.right && right > bounds.left && top < bounds.bottom && bottom > bounds.top)) {
                    label.remove();
                    return;
                }
                labelBounds.push({ left, right, top, bottom });
                if (options.labelStyle.background) labelLayer.insert("rect", () => node).attr("class", "data-label-background")
                    .attr("x", left).attr("y", top).attr("width", right - left).attr("height", bottom - top).attr("rx", 3)
                    .attr("fill", options.labelStyle.backgroundColor ?? "#e0e0e0");
            }
        });
    });
    const trendLayer = plot.append("g").attr("clip-path", `url(#${clipId})`);
    fits.forEach((fit: TrendResult | null, index) => {
        if (!fit?.points.length) return;
        const positions = series[index].data.map((datum, categoryIndex) => ({
            x: datum.x, position: categoryScale(categoryIndex)! + categoryScale.bandwidth() / 2
        })).filter(point => Number.isFinite(point.x)).sort((first, second) => first.x - second.x);
        const xToPosition = (x: number) => {
            if (!options.numericX) return categoryScale(0)! + categoryScale.bandwidth() / 2 + (x - 1) * categoryScale.step();
            if (positions.length < 2) return positions[0]?.position || 0;
            const upper = Math.min(positions.length - 1, Math.max(1, d3.bisector<{ x: number }, number>(point => point.x).left(positions, x)));
            const first = positions[upper - 1];
            const second = positions[upper];
            return second.x === first.x ? first.position : first.position + (x - first.x) / (second.x - first.x) * (second.position - first.position);
        };
        const line = d3.line<Point>().x(point => bar ? valueScale(point.y) : xToPosition(point.x))
            .y(point => bar ? xToPosition(point.x) : valueScale(point.y));
        const path = trendLayer.append("path").attr("class", "trend-line").attr("d", line(fit.points))
            .attr("fill", "none").attr("stroke", series[index].trendColor).attr("stroke-width", series[index].trendWidth)
            .attr("stroke-opacity", series[index].trendOpacity).attr("stroke-dasharray", series[index].trendDashed ? "7,4" : "none");
        path.append("title").text(`${series[index].name}: ${fit.equation}${fit.r2 === null ? "" : `; R\u00b2 = ${fit.r2.toFixed(4)}`}`);
    });
    labelLayer.raise();
    svg.on("click", () => options.onClear?.());
}
let renderSequence = 0;