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
    format: (value: number) => string;
}
export interface ChartOptions {
    width: number; height: number;
    orientation: "bar" | "column";
    legend: boolean; labels: boolean; gridlines: boolean;
    fontSize: number; gap: number;
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
        series.forEach((item, index) => {
            const entry = document.createElement("span");
            const swatch = document.createElement("i");
            swatch.style.backgroundColor = item.color;
            entry.append(swatch, document.createTextNode(item.name));
            if (fits[index]?.points.length) {
                const line = document.createElement("i");
                line.className = "legend-line";
                line.style.borderColor = item.color;
                entry.append(line, document.createTextNode(trendNames[item.trendType]));
            }
            legend.append(entry);
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
            row.style.borderLeftColor = series[index].color;
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
    const margin = { top: 14, right: options.labels ? 70 : 26, bottom: bar ? 48 : 82, left: bar ? Math.min(150, options.width * 0.3) : 68 };
    const availableHeight = Math.max(130, options.height - (root.querySelector<HTMLElement>(".chart-legend")?.offsetHeight || 0) - details.offsetHeight);
    const width = Math.max(options.width, bar ? 280 : count * Math.max(38, series.length * 12) + margin.left + margin.right);
    const height = bar ? Math.max(availableHeight, count * Math.max(28, series.length * 12) + margin.top + margin.bottom) : availableHeight;
    const plotWidth = Math.max(60, width - margin.left - margin.right);
    const plotHeight = Math.max(60, height - margin.top - margin.bottom);
    const svg = d3.select(viewport).append("svg").attr("width", width).attr("height", height)
        .attr("role", "img").attr("aria-label", `${options.categoryTitle}: ${options.valueTitle}, gegroepeerd diagram met trendlijnen`);
    const plot = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    const finiteValues = series.flatMap(item => item.data.flatMap(datum => [datum.value, datum.highlight]))
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
    fits.forEach(fit => fit?.points.forEach(point => finiteValues.push(point.y)));
    let minimum = Math.min(0, ...finiteValues);
    let maximum = Math.max(0, ...finiteValues);
    if (minimum === maximum) { minimum -= 1; maximum += 1; }
    const valueScale = d3.scaleLinear().domain([minimum, maximum]).nice().range(bar ? [0, plotWidth] : [plotHeight, 0]);
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
    const innerScale = d3.scaleBand<number>().domain(d3.range(series.length)).range([0, categoryScale.bandwidth()]).padding(0.08);
    const categoryAxis = bar ? d3.axisLeft(categoryScale) : d3.axisBottom(categoryScale);
    const stride = Math.max(1, Math.ceil(count / ((bar ? plotHeight : plotWidth) / (bar ? 22 : 65))));
    categoryAxis.tickValues(d3.range(count).filter(index => index % stride === 0)).tickFormat(index => series[0].data[index].category);
    const categoryGroup = plot.append("g").attr("class", "category-axis")
        .attr("transform", bar ? "translate(0,0)" : `translate(0,${plotHeight})`).call(categoryAxis);
    categoryGroup.selectAll<SVGTextElement, number>("text").each(function(index) {
        const full = series[0].data[index].category;
        const maximumCharacters = bar ? Math.max(5, Math.floor((margin.left - 15) / (options.fontSize * 0.6))) : 10;
        const label = d3.select(this);
        label.text(full.length > maximumCharacters ? `${full.slice(0, maximumCharacters - 3)}...` : full);
        label.append("title").text(full);
    });
    const valueAxis = bar ? d3.axisBottom(valueScale) : d3.axisLeft(valueScale);
    valueAxis.ticks(Math.max(2, Math.floor((bar ? plotWidth : plotHeight) / 85))).tickFormat(value => series[0].format(Number(value)));
    plot.append("g").attr("class", "value-axis").attr("transform", bar ? `translate(0,${plotHeight})` : "translate(0,0)").call(valueAxis);
    if (options.gridlines) {
        const grid = bar ? d3.axisBottom(valueScale) : d3.axisLeft(valueScale);
        grid.ticks(Math.max(2, Math.floor((bar ? plotWidth : plotHeight) / 85))).tickSize(-(bar ? plotHeight : plotWidth)).tickFormat(() => "");
        plot.append("g").attr("class", "gridlines").attr("transform", bar ? `translate(0,${plotHeight})` : "translate(0,0)").call(grid);
    }
    plot.append("line").attr("class", "zero-line")
        .attr("x1", bar ? valueScale(0) : 0).attr("x2", bar ? valueScale(0) : plotWidth)
        .attr("y1", bar ? 0 : valueScale(0)).attr("y2", bar ? plotHeight : valueScale(0));
    svg.append("text").attr("class", "axis-title").attr("x", margin.left + plotWidth / 2).attr("y", height - 8)
        .attr("text-anchor", "middle").text(bar ? options.valueTitle : options.categoryTitle);
    const hasHighlights = series.some(item => item.data.some(datum => datum.highlight !== undefined));
    series.forEach((item, seriesIndex) => {
        item.data.forEach((datum, index) => {
            if (datum.value === null || !Number.isFinite(datum.value)) return;
            const position = categoryScale(index)! + innerScale(seriesIndex)!;
            const thickness = innerScale.bandwidth();
            const rectangle = (value: number, highlight: boolean) => {
                const start = Math.min(valueScale(0), valueScale(value));
                const length = Math.max(0.5, Math.abs(valueScale(value) - valueScale(0)));
                const rect = plot.append("rect").datum(datum).attr("class", highlight ? "highlight-bar" : "data-bar")
                    .attr("x", bar ? start : position).attr("y", bar ? position : start)
                    .attr("width", bar ? length : thickness).attr("height", bar ? thickness : length)
                    .attr("fill", item.color).attr("opacity", !highlight && hasHighlights ? 0.3 : 1)
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
                plot.append("text").attr("class", "data-label")
                    .attr("x", bar ? valueScale(datum.value) + (datum.value >= 0 ? 4 : -4) : position + thickness / 2)
                    .attr("y", bar ? position + thickness / 2 : valueScale(datum.value) + (datum.value >= 0 ? -5 : 12))
                    .attr("dy", bar ? "0.35em" : "0").attr("text-anchor", bar ? (datum.value >= 0 ? "start" : "end") : "middle")
                    .text(item.format(datum.value));
            }
        });
    });
    const clipId = `trend-clip-${renderSequence++}`;
    plot.append("defs").append("clipPath").attr("id", clipId).append("rect").attr("width", plotWidth).attr("height", plotHeight);
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
            .attr("fill", "none").attr("stroke", series[index].color).attr("stroke-width", options.lineWidth)
            .attr("stroke-dasharray", options.dashed ? "7,4" : "none");
        path.append("title").text(`${series[index].name}: ${fit.equation}${fit.r2 === null ? "" : `; R\u00b2 = ${fit.r2.toFixed(4)}`}`);
    });
    svg.on("click", () => options.onClear?.());
}
let renderSequence = 0;