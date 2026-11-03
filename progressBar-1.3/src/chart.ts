import { rgb, scaleLinear } from "d3";
import { createSegments, evaluateProgress, ProgressInput } from "./progress";

export interface ProgressDatum extends ProgressInput {
    category: string;
    identity: unknown;
    highlight?: number | null;
    format: (value: number) => string;
    tooltip: { displayName: string; value: string }[];
    warning?: string;
}

export interface ChartOptions {
    mode: string;
    colors: { start: string; midpoint: string; target: string; top: string; track: string; marker: string; overflow: string };
    overflowColor: boolean;
    overflowMessage: string | null;
    showProgress: boolean;
    progressPosition: string;
    showBounds: boolean;
    showTarget: boolean;
    valueMatchColor: boolean;
    valuePosition: string;
    showTargetTitle: boolean;
    showTargetValue: boolean;
    targetTitle: string;
    fontSize: number;
    barHeight: number;
    customRounding: boolean;
    rounding: number;
    segmented: boolean;
    stepSize: number;
    stepUnit: string;
    segmentGap: number;
    spacing: number;
    textColor: string;
    background: string;
    highContrast: boolean;
    sort: string;
    percent: (value: number) => string;
    onSelect: (datum: ProgressDatum, multi: boolean) => void;
    onClear: () => void;
    onContext: (datum: ProgressDatum, event: MouseEvent) => void;
    onTooltip: (datum: ProgressDatum, event: PointerEvent) => void;
    onHideTooltip: () => void;
}

function colorStops(targetPosition: number | null, colors: ChartOptions["colors"]): [number, string][] {
    const stops: [number, string][] = [[0, colors.start], [(targetPosition ?? 1) / 2, colors.midpoint]];
    if (targetPosition !== null) stops.push([targetPosition, colors.target]);
    stops.push([1, colors.top]);
    return stops;
}

export function progressColor(datum: ProgressInput, options: Pick<ChartOptions, "colors" | "mode" | "overflowColor">): string {
    const state = evaluateProgress(datum);
    const colors = options.colors;
    if (state.overflow && options.overflowColor) return colors.overflow;
    if (state.fill >= 1) return colors.top;
    if (options.mode === "status") return state.ratio >= 1 ? colors.top : state.targetReached ? colors.target : colors.start;
    const stops = colorStops(state.targetPosition, colors);
    return scaleLinear<string>().domain(stops.map(([position]) => position)).range(stops.map(([, color]) => color)).clamp(true)(state.fill);
}

function node(tag: string, className: string, text?: string): HTMLElement {
    const element = document.createElement(tag);
    element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
}

function labelLane(className: string, label: HTMLElement, position: number): HTMLElement {
    const lane = node("div", `anchored-label-lane ${className}`);
    label.classList.add("anchored-label");
    label.dataset.position = String(position);
    label.style.left = `${position * 100}%`;
    lane.append(label);
    return lane;
}

function contrastColor(background: string): string {
    const color = rgb(background);
    const channels = [color.r, color.g, color.b].map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 > 0.179 ? "#000000" : "#ffffff";
}

export function renderChart(root: HTMLElement, data: ProgressDatum[], options: ChartOptions): void {
    root.replaceChildren();
    root.className = "progress-visual";
    root.style.setProperty("--text", options.textColor);
    root.style.setProperty("--surface", options.background);
    root.style.setProperty("--font-size", `${options.fontSize}px`);
    root.style.setProperty("--row-gap", `${options.spacing}px`);
    root.onclick = event => { if (event.target === root) options.onClear(); };
    if (!data.length) {
        root.append(node("div", "empty-state", "Voeg een numeriek veld toe aan Voortgang."));
        return;
    }
    const rows = [...data];
    if (options.sort !== "data") rows.sort((left, right) => {
        const first = evaluateProgress(left), second = evaluateProgress(right);
        if (first.valid !== second.valid) return first.valid ? -1 : 1;
        return (first.ratio - second.ratio) * (options.sort === "ascending" ? 1 : -1);
    });
    const insideLabels: { label: HTMLElement; track: HTMLElement; datum: ProgressDatum }[] = [];
    rows.forEach(datum => {
        const state = evaluateProgress(datum);
        const row = node("div", "progress-row");
        (row as HTMLElement & { __datum__: ProgressDatum }).__datum__ = datum;
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.setAttribute("aria-pressed", "false");
        row.title = datum.tooltip.map(item => `${item.displayName}: ${item.value}`).join("\n");
        row.setAttribute("aria-label", row.title.replaceAll("\n", ". "));
        row.onclick = event => { event.stopPropagation(); options.onSelect(datum, event.ctrlKey || event.metaKey); };
        row.onkeydown = event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault(); options.onSelect(datum, event.ctrlKey || event.metaKey);
            } else if (event.key === "Escape") options.onClear();
        };
        row.oncontextmenu = event => { event.preventDefault(); options.onContext(datum, event); };
        row.onpointermove = event => options.onTooltip(datum, event);
        row.onpointerleave = options.onHideTooltip;
        const header = node("div", "row-header");
        header.append(node("span", "category", datum.category));
        const values = node("div", "row-values");
        const actual = node("strong", "actual-value", datum.value === null ? "\u2014" : datum.format(datum.value));
        if (state.valid && options.valueMatchColor) actual.style.color = options.highContrast ? options.textColor : progressColor(datum, options);
        const anchoredValue = state.valid && options.valuePosition === "fill";
        if (!anchoredValue) values.append(actual);
        const percentage = state.valid && options.showProgress ? node("span", "progress-percent", options.percent(state.ratio)) : null;
        const insideProgress = percentage !== null && state.fill > 0 && options.barHeight >= options.fontSize + 4
            && (options.progressPosition === "center" || options.progressPosition === "end");
        if (percentage && !insideProgress) values.append(percentage);
        if (values.childNodes.length) header.append(values);
        row.append(header);
        if (!state.valid) {
            row.append(node("div", "data-warning", state.message));
            root.append(row);
            return;
        }
        if (anchoredValue) row.append(labelLane("actual-label-lane", actual, state.fill));
        const track = node("div", "bar-track");
        track.style.height = `${options.barHeight}px`;
        track.style.background = options.colors.track;
        track.style.borderColor = options.highContrast ? options.textColor : "transparent";
        const rounding = Math.max(0, Math.min(100, options.rounding)) / 100;
        if (options.customRounding) track.style.borderRadius = `${options.barHeight / 2 * rounding}px`;
        track.setAttribute("role", "meter");
        track.setAttribute("aria-label", datum.category);
        track.setAttribute("aria-valuemin", String(datum.minimum));
        track.setAttribute("aria-valuemax", String(datum.maximum));
        track.setAttribute("aria-valuenow", String(Math.max(datum.minimum!, Math.min(datum.maximum!, datum.value!))));
        track.setAttribute("aria-valuetext", `${datum.format(datum.value!)}; ${options.percent(state.ratio)}`);
        const color = progressColor(datum, options);
        const gradient = options.mode === "gradient" && !options.highContrast && !(state.overflow && options.overflowColor);
        const gradientStops = colorStops(state.targetPosition, options.colors).map(([position, color]) => `${color} ${position * 100}%`).join(", ");
        const highlightRatio = datum.highlight === undefined ? undefined : evaluateProgress({ ...datum, value: datum.highlight }).fill;
        const appendLayers = (surface: HTMLElement, start: number, end: number) => {
            const fill = node("div", "bar-fill");
            const localFill = Math.max(0, Math.min(1, (state.fill - start) / (end - start)));
            const paintedRange = localFill * (end - start);
            fill.style.width = `${localFill * 100}%`;
            fill.style.background = options.highContrast ? options.textColor : color;
            if (options.customRounding) fill.style.borderRadius = `${Math.max(0, options.barHeight - 2) / 2 * rounding}px`;
            if (gradient) {
                fill.style.background = `linear-gradient(to right, ${gradientStops})`;
                fill.style.backgroundSize = `${paintedRange > 0 ? 100 / paintedRange : 100}% 100%`;
                fill.style.backgroundPosition = `${paintedRange < 1 ? start / (1 - paintedRange) * 100 : 0}% 0%`;
            }
            surface.append(fill);
            if (highlightRatio !== undefined) {
                fill.style.opacity = "0.25";
                const highlight = node("div", "bar-highlight");
                highlight.style.width = `${Math.max(0, Math.min(1, (highlightRatio - start) / (end - start))) * 100}%`;
                highlight.style.background = options.highContrast ? options.textColor : color;
                if (options.customRounding) highlight.style.borderRadius = fill.style.borderRadius;
                surface.append(highlight);
            }
        };
        const steps = options.segmented ? createSegments(datum.minimum!, datum.maximum!, options.stepSize, options.stepUnit) : { segments: [] };
        if (steps.segments.length) {
            track.classList.add("segmented-track");
            track.style.background = "transparent";
            track.style.borderColor = "transparent";
            const smallest = Math.min(...steps.segments.map(segment => segment.end - segment.start));
            const gap = Math.max(0, Math.min(24, options.segmentGap));
            const halfGap = `min(${gap / 2}px, ${smallest * 25}%)`;
            const fullGap = `min(${gap}px, ${smallest * 50}%)`;
            steps.segments.forEach((segment, index) => {
                const surface = node("div", "bar-segment");
                surface.style.left = index === 0 ? "0%" : `calc(${segment.start * 100}% + ${halfGap})`;
                const edges = (index > 0 ? 1 : 0) + (index < steps.segments.length - 1 ? 1 : 0);
                surface.style.width = edges === 0 ? "100%" : `calc(${(segment.end - segment.start) * 100}% - ${edges === 2 ? fullGap : halfGap})`;
                surface.style.background = options.colors.track;
                if (options.highContrast) surface.style.border = `1px solid ${options.textColor}`;
                if (options.customRounding) surface.style.borderRadius = track.style.borderRadius;
                appendLayers(surface, segment.start, segment.end);
                track.append(surface);
            });
        } else appendLayers(track, 0, 1);
        if (percentage && insideProgress) {
            percentage.classList.add("inside-progress");
            percentage.style.left = `${state.fill * (options.progressPosition === "center" ? 50 : 100)}%`;
            percentage.style.transform = `translate(${options.progressPosition === "center" ? "-50%" : "-100%"}, -50%)`;
            percentage.style.color = options.highContrast ? options.background : contrastColor(color);
            track.append(percentage);
            insideLabels.push({ label: percentage, track, datum });
        }
        if (state.targetPosition !== null) {
            const marker = node("div", "target-marker");
            marker.style.left = `${state.targetPosition * 100}%`;
            marker.style.background = options.colors.marker;
            marker.title = `Target: ${datum.format(datum.target!)}`;
            track.append(marker);
        }
        if (state.overflow || state.underflow) {
            const indicator = node("span", `range-indicator ${state.overflow ? "above" : "below"}`, state.overflow ? ">" : "<");
            indicator.style.color = options.highContrast ? options.textColor : color;
            indicator.setAttribute("aria-hidden", "true");
            track.append(indicator);
        }
        row.append(track);
        if (options.showTarget && datum.target !== null && state.targetPosition !== null) {
            const parts: string[] = [];
            if (options.showTargetTitle) parts.push(options.targetTitle || "Target");
            if (options.showTargetValue) parts.push(datum.format(datum.target));
            if (parts.length) row.append(labelLane("target-label-lane", node("span", "target-label", parts.join(" ")), state.targetPosition));
        }
        if (options.showBounds) {
            const bounds = node("div", "bounds");
            bounds.append(node("span", "minimum", datum.format(datum.minimum!)), node("span", "maximum", datum.format(datum.maximum!)));
            row.append(bounds);
        }
        const footer = node("div", "row-footer");
        if (state.overflow && options.overflowMessage !== null) {
            const message = node("span", "overflow-message", `${options.overflowMessage} (+${datum.format(datum.value! - datum.maximum!)})`);
            message.style.color = options.highContrast ? options.textColor : options.colors.overflow;
            footer.append(message);
        }
        if (state.underflow) footer.append(node("span", "data-warning", "Onder bodem"));
        if (datum.target !== null && (datum.target < datum.minimum! || datum.target > datum.maximum!)) footer.append(node("span", "data-warning", "Target buiten bereik"));
        if (datum.warning) footer.append(node("span", "data-warning", datum.warning));
        if (steps.warning) footer.append(node("span", "data-warning", `${steps.warning} Doorlopende balk getoond.`));
        if (footer.childNodes.length) row.append(footer);
        root.append(row);
    });
    root.querySelectorAll<HTMLElement>(".anchored-label").forEach(label => {
        const width = label.getBoundingClientRect().width;
        if (width > 0) {
            const position = Number(label.dataset.position) * 100;
            label.style.left = `clamp(0px, calc(${position}% - ${width / 2}px), max(0px, calc(100% - ${width}px)))`;
            label.style.transform = "none";
        }
    });
    insideLabels.forEach(({ label, track, datum }) => {
        const text = label.getBoundingClientRect();
        if (text.width <= 0) return;
        const trackBox = track.getBoundingClientRect();
        const state = evaluateProgress(datum);
        const desired = trackBox.left + 1 + track.clientWidth * state.fill * (options.progressPosition === "center" ? 0.5 : 1)
            - (options.progressPosition === "end" ? text.width / 2 + 4 : 0);
        const candidates = Array.from(track.querySelectorAll<HTMLElement>(".bar-fill"))
            .map(fill => fill.getBoundingClientRect())
            .filter(box => box.width >= text.width + 8 && box.height >= text.height + 2)
            .map(box => Math.max(box.left + text.width / 2 + 4, Math.min(box.right - text.width / 2 - 4, desired)))
            .sort((left, right) => Math.abs(left - desired) - Math.abs(right - desired));
        if (!candidates.length) {
            label.classList.remove("inside-progress");
            label.removeAttribute("style");
            const header = track.parentElement!.querySelector<HTMLElement>(".row-header")!;
            let values = header.querySelector<HTMLElement>(".row-values");
            if (!values) { values = node("div", "row-values"); header.append(values); }
            values.append(label);
            return;
        }
        const center = candidates[0] - trackBox.left - 1;
        label.style.left = `${center}px`;
        label.style.transform = "translate(-50%, -50%)";
        const gradient = options.mode === "gradient" && !(state.overflow && options.overflowColor);
        const background = gradient ? progressColor({ ...datum, value: datum.minimum! + (datum.maximum! - datum.minimum!) * center / track.clientWidth }, options) : progressColor(datum, options);
        label.style.color = options.highContrast ? options.background : contrastColor(background);
    });
}