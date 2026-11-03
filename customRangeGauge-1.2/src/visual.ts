"use strict";

import "./../style/visual.less";

import powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { VisualFormattingSettingsModel } from "./settings";

import DataView = powerbi.DataView;
import IVisual = powerbi.extensibility.visual.IVisual;
import IVisualEventService = powerbi.extensibility.IVisualEventService;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import FormattingCard = powerbi.visuals.FormattingCard;
import FormattingGroup = powerbi.visuals.FormattingGroup;

const SVG_NS = "http://www.w3.org/2000/svg";
const MIN_VALUE = Number.MIN_VALUE;

interface Point {
    x: number;
    y: number;
}

interface Angles {
    s: number;
    e: number;
}

interface Segment {
    index: number;
    min: number;
    max: number;
    color: string;
    label: string;
    showMin: boolean;
    showMax: boolean;
    showLabel: boolean;
    startRatio: number;
    endRatio: number;
}

export class Visual implements IVisual {
    private events: IVisualEventService;
    private svg: SVGSVGElement;
    private formattingSettings!: VisualFormattingSettingsModel;
    private formattingSettingsService = new FormattingSettingsService();
    private selected: number | null = null;
    private last: VisualUpdateOptions | null = null;

    constructor(options?: VisualConstructorOptions) {
        this.events = options!.host.eventService;
        options!.element.classList.add("customRangeGauge");
        this.svg = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
        this.svg.classList.add("rangeGaugeSvg");
        options!.element.appendChild(this.svg);
        this.svg.onclick = (e: MouseEvent) => {
            if (e.target === this.svg) {
                this.selected = null;
                this.redraw();
            }
        };
    }

    public update(options: VisualUpdateOptions): void {
        this.events.renderingStarted(options);
        try {
            this.last = options;
            this.formattingSettings = this.formattingSettingsService.populateFormattingSettingsModel(
                VisualFormattingSettingsModel,
                options.dataViews && options.dataViews[0] as DataView
            );
            this.render(options);
            this.events.renderingFinished(options);
        } catch (error) {
            console.log(error);
            this.events.renderingFailed(options, String(error));
        }
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        this.applySegmentCardVisibility();
        const model = this.formattingSettingsService.buildFormattingModel(this.formattingSettings);
        this.mergeCards(model);
        return model;
    }

    private selectedSegmentValue(): string {
        return String(this.formattingSettings.segmentSelector.selectedSegment.value.value || "1");
    }

    private applySegmentCardVisibility(): void {
        const selected = this.selectedSegmentValue();
        this.formattingSettings.segmentCards.forEach((card, i) => {
            card.visible = String(i + 1) === selected;
            card.displayName = "Segment options";
        });
    }

    private mergeCards(model: powerbi.visuals.FormattingModel): void {
        const selected = this.selectedSegmentValue();
        const cards = model.cards as FormattingCard[];
        this.mergeInto(cards, "segmentSelector-card", [`segment${selected}-card`, "segmentLabels-card"],
            ["Instellingen toepassen op", "Opties", "Segment labels"], "Segmenten");
        this.mergeInto(cards, "marker-card", ["markerLabel-card"], ["Settings", "Label"], "Marker");
        model.cards = cards.filter(card => !/^segment\d+-card$/.test(card.uid) || card.uid === `segment${selected}-card`);
        model.cards = (model.cards as FormattingCard[]).filter(card =>
            card.uid !== `segment${selected}-card` && card.uid !== "segmentLabels-card" && card.uid !== "markerLabel-card");
    }

    private mergeInto(cards: FormattingCard[], targetUid: string, sourceUids: string[],
        groupNames: string[], displayName: string): void {
        const target = cards.find(card => card.uid === targetUid);
        if (!target) {
            return;
        }
        const targetGroups = target.groups as FormattingGroup[];
        target.displayName = displayName;
        if (targetGroups[0]) {
            targetGroups[0].displayName = groupNames[0];
            targetGroups[0].collapsible = false;
        }
        sourceUids.forEach((uid, i) => {
            const group = (cards.find(card => card.uid === uid)?.groups?.[0]) as FormattingGroup | undefined;
            if (group) {
                group.displayName = groupNames[i + 1];
                group.collapsible = true;
                targetGroups.push(group);
            }
        });
    }

    private redraw(): void {
        if (this.last) {
            this.render(this.last);
        }
    }

    private render(options: VisualUpdateOptions): void {
        const width = Math.max(10, options.viewport.width);
        const height = Math.max(10, options.viewport.height);
        this.clear(width, height);
        this.svg.style.background = this.col(this.formattingSettings.style.backgroundColor.value, "#fff");

        const actual = this.actual(options.dataViews && options.dataViews[0]);
        if (actual === null || isNaN(actual)) {
            this.text(width / 2, height / 2, "Add Actual value", "middle", 13, "#333", "marker", false);
            return;
        }

        const shape = String(this.formattingSettings.general.shape.value.value);
        const scaleMode = String(this.formattingSettings.general.scaleMode.value.value);
        const segments = this.segments(scaleMode);
        const warnings = this.validate(segments, scaleMode);
        const active = segments.find(seg => actual >= seg.min && actual <= seg.max) || null;
        const ratio = this.clamp(this.ratio(actual, segments, scaleMode), 0, 1);

        if (shape === "bar") {
            this.bar(width, height, segments, ratio, actual, active, warnings);
        } else {
            this.gauge(width, height, shape, segments, ratio, actual, active, warnings);
        }
    }

    private clear(width: number, height: number): void {
        while (this.svg.firstChild) {
            this.svg.removeChild(this.svg.firstChild);
        }
        this.svg.setAttribute("width", String(width));
        this.svg.setAttribute("height", String(height));
        this.svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    }

    private actual(dataView?: DataView): number | null {
        const values = dataView?.categorical?.values;
        if (values?.length && values[0].values?.length) {
            return Number(values[0].values[0]);
        }
        const table = dataView?.table;
        if (table?.rows?.length && table.rows[0]?.length) {
            return Number(table.rows[0][0]);
        }
        const single = dataView?.single;
        return single && single.value !== undefined ? Number(single.value) : null;
    }

    private segments(scaleMode: string): Segment[] {
        const count = Math.round(this.clamp(this.formattingSettings.general.segmentCount.value || 1, 1, 10));
        const segments: Segment[] = [];
        for (let i = 1; i <= count; i++) {
            const card = this.formattingSettings.segmentCards[i - 1];
            segments.push({
                index: i,
                min: Number(card.min.value),
                max: Number(card.max.value),
                color: this.col(card.color.value, "#5DADE2"),
                label: card.label.value || `Segment ${i}`,
                showMin: card.showMin.value,
                showMax: card.showMax.value,
                showLabel: card.showLabel.value,
                startRatio: 0,
                endRatio: 0
            });
        }

        if (scaleMode === "equal") {
            segments.forEach((seg, i) => {
                seg.startRatio = i / segments.length;
                seg.endRatio = (i + 1) / segments.length;
            });
            return segments;
        }

        const minAll = Math.min(...segments.map(seg => seg.min));
        const maxAll = Math.max(...segments.map(seg => seg.max));
        segments.forEach(seg => {
            if (scaleMode === "log") {
                const logMin = Math.log(Math.max(minAll, MIN_VALUE));
                const logMax = Math.log(Math.max(maxAll, MIN_VALUE));
                seg.startRatio = this.safe(Math.log(Math.max(seg.min, MIN_VALUE)) - logMin, logMax - logMin);
                seg.endRatio = this.safe(Math.log(Math.max(seg.max, MIN_VALUE)) - logMin, logMax - logMin);
            } else {
                seg.startRatio = this.safe(seg.min - minAll, maxAll - minAll);
                seg.endRatio = this.safe(seg.max - minAll, maxAll - minAll);
            }
        });
        return segments;
    }

    private ratio(value: number, segments: Segment[], scaleMode: string): number {
        const minAll = Math.min(...segments.map(seg => seg.min));
        const maxAll = Math.max(...segments.map(seg => seg.max));
        if (scaleMode === "equal") {
            const seg = segments.find(s => value >= s.min && value <= s.max);
            if (seg) {
                return seg.startRatio + this.safe(value - seg.min, seg.max - seg.min) * (seg.endRatio - seg.startRatio);
            }
            return value < minAll ? -0.05 : 1.05;
        }
        if (scaleMode === "log") {
            return value <= 0 || minAll <= 0 || maxAll <= 0
                ? 0
                : this.safe(Math.log(value) - Math.log(minAll), Math.log(maxAll) - Math.log(minAll));
        }
        return this.safe(value - minAll, maxAll - minAll);
    }

    private validate(segments: Segment[], scaleMode: string): string[] {
        const messages: string[] = [];
        if (segments.some(seg => !isFinite(seg.min) || !isFinite(seg.max) || seg.max <= seg.min)) {
            messages.push("Invalid segment min/max.");
        }
        if (scaleMode === "log" && segments.some(seg => seg.min <= 0 || seg.max <= 0)) {
            messages.push("Log scale needs values > 0.");
        }
        return [...new Set(messages)];
    }

    private gauge(width: number, height: number, shape: string, segments: Segment[], ratio: number,
        actual: number, active: Segment | null, warnings: string[]): void {
        const fs = this.formattingSettings;
        const fontSize = fs.segmentLabels.fontSize.value || 10;
        const labelPosition = String(fs.segmentLabels.position.value.value);
        const labelSpace = labelPosition === "outside" ? 3.35 * fontSize
            : labelPosition === "auto" ? 0.95 * fontSize : 0.4 * fontSize;
        const topPad = labelPosition === "inside" ? 4 : 1.25 * fontSize;
        const bottomPad = labelPosition === "below" || labelPosition === "auto"
            || String(fs.markerLabel.position.value.value) === "below" ? 2.8 * fontSize : 1.15 * fontSize;
        const radius = Math.max(18, Math.min((width - 2 * labelSpace) / 2,
            shape === "semi" ? height - topPad - bottomPad : (height - topPad - bottomPad) / 2));
        const cx = width / 2;
        const cy = topPad + radius;
        const thickness = Math.min(fs.style.segmentThickness.value || 34, 0.62 * radius);
        const angles = this.angles(shape);

        segments.forEach(seg => {
            const start = this.interpolateAngle(angles.s, angles.e, seg.startRatio);
            const end = this.interpolateAngle(angles.s, angles.e, seg.endRatio);
            const path = this.el("path");
            path.setAttribute("d", this.arc(cx, cy, radius, thickness, start, end, fs.style.segmentGap.value || 0));
            path.setAttribute("fill", seg.color);
            path.setAttribute("stroke", this.col(fs.style.borderColor.value, "#fff"));
            path.style.cursor = "pointer";
            this.title(path, `${seg.label}: ${this.fmt(seg.min)} - ${this.fmt(seg.max)}`);
            this.sel(path, seg.index);
            path.onclick = (e: MouseEvent) => {
                e.stopPropagation();
                if (fs.interaction.enableSelection.value) {
                    this.selected = this.selected === seg.index ? null : seg.index;
                    this.redraw();
                }
            };
            this.svg.appendChild(path);
            this.segLabels(cx, cy, radius, thickness, start, end, seg, labelPosition, width, height);
        });

        this.targetLine(cx, cy, radius, thickness, angles, segments);
        this.marker(cx, cy, radius, thickness, angles, ratio, active);
        this.markerText(width, height, cx, cy, radius, angles, ratio, actual);
        this.warn(width, height, warnings, actual, segments);
    }

    private bar(width: number, height: number, segments: Segment[], ratio: number, actual: number,
        active: Segment | null, warnings: string[]): void {
        const fs = this.formattingSettings;
        const labelPosition = String(fs.segmentLabels.position.value.value);
        const fontSize = fs.segmentLabels.fontSize.value || 10;
        const trackWidth = width - 12;
        const thickness = Math.min(fs.style.segmentThickness.value || 34, 0.42 * height);
        const top = height / 2 - thickness / 2;
        const gap = fs.style.segmentGap.value || 0;
        const labelColor = this.col(fs.segmentLabels.fontColor.value, "#333");

        segments.forEach(seg => {
            const x1 = 6 + trackWidth * seg.startRatio;
            const x2 = 6 + trackWidth * seg.endRatio;
            const rect = this.el("rect");
            rect.setAttribute("x", String(x1 + gap / 2));
            rect.setAttribute("y", String(top));
            rect.setAttribute("width", String(Math.max(0, x2 - x1 - gap)));
            rect.setAttribute("height", String(thickness));
            rect.setAttribute("fill", seg.color);
            rect.setAttribute("stroke", this.col(fs.style.borderColor.value, "#fff"));
            this.title(rect, `${seg.label}: ${this.fmt(seg.min)} - ${this.fmt(seg.max)}`);
            this.sel(rect, seg.index);
            rect.onclick = (e: MouseEvent) => {
                e.stopPropagation();
                if (fs.interaction.enableSelection.value) {
                    this.selected = this.selected === seg.index ? null : seg.index;
                    this.redraw();
                }
            };
            this.svg.appendChild(rect);

            if (labelPosition !== "none") {
                const labelY = labelPosition === "inside" ? top + thickness / 2
                    : labelPosition === "below" || labelPosition === "auto"
                        ? Math.min(height - fontSize - 4, top + thickness + fontSize + 8)
                        : top + thickness + fontSize + 3;
                if (seg.showMin) {
                    this.text(x1, labelY, this.fmt(seg.min), this.anchorFor(x1, width), fontSize, labelColor, "segment", false);
                }
                if (seg.showMax) {
                    this.text(x2, labelY, this.fmt(seg.max), this.anchorFor(x2, width), fontSize, labelColor, "segment", false);
                }
                if (seg.showLabel) {
                    this.text((x1 + x2) / 2, labelPosition === "inside" ? top + thickness / 2 : top - 8,
                        seg.label, "middle", fontSize, labelColor, "segment", false);
                }
            }
        });

        const markerX = 6 + trackWidth * ratio;
        this.targetBar(6, trackWidth, top, thickness, segments);
        this.barMarker(markerX, top, thickness, active);
        this.markerText(width, height, markerX, top + thickness / 2, 0, { s: 0, e: 0 }, ratio, actual);
        this.warn(width, height, warnings, actual, segments);
    }

    private segLabels(cx: number, cy: number, radius: number, thickness: number, start: number, end: number,
        seg: Segment, position: string, width: number, height: number): void {
        if (position === "none") {
            return;
        }
        const fontSize = this.formattingSettings.segmentLabels.fontSize.value || 10;
        const color = this.col(this.formattingSettings.segmentLabels.fontColor.value, "#333");
        const pad = Math.max(5, 0.5 * fontSize);
        const baseY = this.clamp(cy + Math.max(1.65 * fontSize, 0.1 * radius + 1.55 * fontSize), fontSize + 2, height - fontSize - 3);
        const xAt = (t: number) => this.clamp(cx + 1.98 * radius * (t - 0.5), pad, width - pad);

        if (position === "below") {
            const x1 = xAt(seg.startRatio);
            const x2 = xAt(seg.endRatio);
            const xm = xAt((seg.startRatio + seg.endRatio) / 2);
            if (seg.showMin) {
                this.text(x1, baseY, this.fmt(seg.min), this.anchorFor(x1, width), fontSize, color, "segment", false);
            }
            if (seg.showMax) {
                this.text(x2, baseY, this.fmt(seg.max), this.anchorFor(x2, width), fontSize, color, "segment", false);
            }
            if (seg.showLabel) {
                this.text(xm, baseY - fontSize - 5, seg.label, this.anchorFor(xm, width), fontSize, color, "segment", false);
            }
            return;
        }

        if (position === "auto") {
            const startsAtZero = seg.startRatio <= 1e-4;
            const endsAtOne = seg.endRatio >= 0.9999;
            const edgeRadius = radius + Math.max(0.95 * fontSize, 9);
            if (startsAtZero && seg.showMin) {
                const x = xAt(0);
                this.text(x, baseY, this.fmt(seg.min), this.anchorFor(x, width), fontSize, color, "segment", false);
            } else if (seg.showMin) {
                this.tlabel(cx, cy, edgeRadius, start, this.fmt(seg.min), fontSize, color, width, height);
            }
            if (endsAtOne && seg.showMax) {
                const x = xAt(1);
                this.text(x, baseY, this.fmt(seg.max), this.anchorFor(x, width), fontSize, color, "segment", false);
            } else if (seg.showMax) {
                this.tlabel(cx, cy, edgeRadius, end, this.fmt(seg.max), fontSize, color, width, height);
            }
            if (seg.showLabel) {
                this.tlabel(cx, cy, radius - thickness / 2, (start + end) / 2, seg.label, fontSize, color, width, height);
            }
            return;
        }

        const labelRadius = position === "inside" ? radius - thickness / 2 : radius + Math.max(1.15 * fontSize, 10);
        if (seg.showMin) {
            this.tlabel(cx, cy, labelRadius, start, this.fmt(seg.min), fontSize, color, width, height);
        }
        if (seg.showMax) {
            this.tlabel(cx, cy, labelRadius, end, this.fmt(seg.max), fontSize, color, width, height);
        }
        if (seg.showLabel) {
            this.tlabel(cx, cy, radius - thickness / 2, (start + end) / 2, seg.label, fontSize, color, width, height);
        }
    }

    private marker(cx: number, cy: number, radius: number, thickness: number, angles: Angles,
        ratio: number, active: Segment | null): void {
        const m = this.formattingSettings.marker;
        if (!m.show.value) {
            return;
        }
        const color = m.followsSegmentColor.value && active ? active.color : this.col(m.color.value, "#111");
        const lineWidth = Math.max(1, radius * ((m.lineThickness.value || 2) / 100));
        const head = Math.max(3, radius * ((m.headSize.value || 7) / 100));
        const opacity = String(this.clamp((m.opacity.value || 100) / 100, 0, 1));
        const angle = this.interpolateAngle(angles.s, angles.e, ratio);
        const style = String(m.style.value.value);
        const shadow = !!m.shadow.value;

        if (style === "dot") {
            const p = this.polar(cx, cy, radius - thickness / 2, angle);
            this.circle(p.x, p.y, head, color, opacity, true, shadow);
            return;
        }

        if (style === "triangle") {
            const tip = this.polar(cx, cy, radius - thickness - 0.15 * head, angle);
            const base = this.polar(cx, cy, radius - thickness - 1.45 * head, angle);
            const left = this.offset(base, angle + 90, 0.68 * head);
            const right = this.offset(base, angle - 90, 0.68 * head);
            this.poly(`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`, color, opacity, shadow);
            return;
        }

        const length = radius * ((m.length.value || 86) / 100);
        const tip = this.polar(cx, cy, length, angle);
        const shaftEnd = style === "pointer" ? this.polar(cx, cy, Math.max(0, length - 1.35 * head), angle) : tip;
        this.line(cx, cy, shaftEnd.x, shaftEnd.y, color, lineWidth, opacity, shadow);
        if (style === "pointer") {
            const base = this.polar(cx, cy, Math.max(0, length - 1.55 * head), angle);
            const left = this.offset(base, angle + 92, 0.64 * head);
            const right = this.offset(base, angle - 92, 0.64 * head);
            this.poly(`${tip.x},${tip.y} ${left.x},${left.y} ${right.x},${right.y}`, color, opacity, shadow);
        }
    }

    private barMarker(x: number, top: number, thickness: number, active: Segment | null): void {
        const m = this.formattingSettings.marker;
        if (!m.show.value) {
            return;
        }
        const size = Math.max(18, thickness);
        const color = m.followsSegmentColor.value && active ? active.color : this.col(m.color.value, "#111");
        const lineWidth = Math.max(1, size * ((m.lineThickness.value || 2) / 100));
        const head = Math.max(3, size * ((m.headSize.value || 7) / 100));
        const style = String(m.style.value.value);
        const shadow = !!m.shadow.value;

        if (style === "dot") {
            this.circle(x, top + thickness / 2, head, color, "1", true, shadow);
            return;
        }
        if (style !== "triangle") {
            this.line(x, top + thickness + 4, x, top - 4, color, lineWidth, "1", shadow);
        }
        if (style === "pointer" || style === "triangle") {
            const triangle = this.el("polygon");
            triangle.setAttribute("points", `${x},${top - 6 - head} ${x - 0.65 * head},${top - 6} ${x + 0.65 * head},${top - 6}`);
            triangle.setAttribute("fill", color);
            this.svg.appendChild(triangle);
        }
    }

    private targetLine(cx: number, cy: number, radius: number, thickness: number, angles: Angles,
        segments: Segment[]): void {
        const target = this.formattingSettings.targetLine;
        if (!target.show.value) {
            return;
        }
        const ratio = this.clamp(this.ratio(target.value.value, segments, String(this.formattingSettings.general.scaleMode.value.value)), 0, 1);
        const angle = this.interpolateAngle(angles.s, angles.e, ratio);
        const outer = this.polar(cx, cy, radius + 2, angle);
        const inner = this.polar(cx, cy, radius - thickness - 3, angle);
        const color = this.col(target.color.value, "#4E79A7");
        const lineWidth = Math.max(1, radius * ((target.thickness.value || 2) / 100));
        this.line(inner.x, inner.y, outer.x, outer.y, color, lineWidth, "1", true, this.dash(String(target.lineStyle.value.value)));
        if (target.showLabel.value) {
            const p = this.polar(cx, cy, radius + 14, angle);
            this.text(p.x, p.y, target.label.value || "Target", "middle", 10, color, "segment", true);
        }
    }

    private targetBar(x0: number, trackWidth: number, top: number, thickness: number, segments: Segment[]): void {
        const target = this.formattingSettings.targetLine;
        if (!target.show.value) {
            return;
        }
        const ratio = this.clamp(this.ratio(target.value.value, segments, String(this.formattingSettings.general.scaleMode.value.value)), 0, 1);
        const x = x0 + trackWidth * ratio;
        const color = this.col(target.color.value, "#4E79A7");
        const lineWidth = Math.max(1, thickness * ((target.thickness.value || 2) / 100));
        this.line(x, top - 6, x, top + thickness + 6, color, lineWidth, "1", true, this.dash(String(target.lineStyle.value.value)));
        if (target.showLabel.value) {
            this.text(x, top - 12, target.label.value || "Target", "middle", 10, color, "segment", true);
        }
    }

    private markerText(width: number, height: number, cx: number, cy: number, radius: number, angles: Angles,
        ratio: number, actual: number): void {
        const m = this.formattingSettings.markerLabel;
        if (!m.show.value) {
            return;
        }
        let x = width / 2;
        let y = height / 2;
        const position = String(m.position.value.value);
        const fontSize = m.fontSize.value || 13;
        if (position === "center") {
            x = cx;
            y = this.clamp(cy + 1.9 * fontSize, fontSize + 2, height - fontSize - 2);
        } else if (position === "below") {
            x = cx;
            y = this.clamp(cy + 2.2 * fontSize, fontSize + 2, height - fontSize - 3);
        } else if (position === "above") {
            x = cx;
            y = fontSize + 4;
        } else if (radius > 0) {
            const p = this.polar(cx, cy, 0.55 * radius, this.interpolateAngle(angles.s, angles.e, ratio));
            x = p.x;
            y = p.y;
        }
        this.text(x, y, `${m.prefix.value || ""}${this.fmt(actual)}${m.suffix.value || ""}`, "middle", fontSize,
            this.col(m.fontColor.value, "#111"), "marker", false);
    }

    private warn(width: number, height: number, warnings: string[], actual: number, segments: Segment[]): void {
        if (!this.formattingSettings.general.showWarnings.value) {
            return;
        }
        const minAll = Math.min(...segments.map(seg => seg.min));
        const maxAll = Math.max(...segments.map(seg => seg.max));
        const messages = [...warnings];
        if (actual < minAll || actual > maxAll) {
            messages.push("Value outside range.");
        }
        if (messages.length) {
            const suffix = messages.length > 1 ? ` (+${messages.length - 1})` : "";
            this.text(width / 2, height - 4, messages[0] + suffix, "middle", 10, "#A15C00", "segment", false);
        }
    }

    private angles(shape: string): Angles {
        if (shape === "full") {
            return { s: -90, e: 270 };
        }
        if (shape === "gauge270") {
            return { s: 135, e: 405 };
        }
        return { s: 180, e: 360 };
    }

    private arc(cx: number, cy: number, radius: number, thickness: number, a: number, b: number, gap: number): string {
        const start = a + gap / 2;
        const end = b - gap / 2;
        const outerStart = this.polar(cx, cy, radius, start);
        const outerEnd = this.polar(cx, cy, radius, end);
        const innerStart = this.polar(cx, cy, radius - thickness, start);
        const innerEnd = this.polar(cx, cy, radius - thickness, end);
        const largeArc = Math.abs(end - start) > 180 ? 1 : 0;
        return `M ${outerStart.x} ${outerStart.y} A ${radius} ${radius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y} `
            + `L ${innerEnd.x} ${innerEnd.y} A ${radius - thickness} ${radius - thickness} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y} Z`;
    }

    private tlabel(cx: number, cy: number, radius: number, angle: number, content: string, fontSize: number,
        color: string, width: number, height: number): void {
        const p = this.polar(cx, cy, radius, angle);
        const x = width ? this.clamp(p.x, 4, width - 4) : p.x;
        const y = height ? this.clamp(p.y, fontSize / 2 + 2, height - fontSize / 2 - 2) : p.y;
        this.text(x, y, content, this.anchorFor(x, width || 999), fontSize, color, "segment", false);
    }

    private text(x: number, y: number, content: string, anchor: string, size: number, fill: string,
        kind: "marker" | "segment", bold = false): void {
        const style = kind === "marker" ? this.formattingSettings.markerLabel : this.formattingSettings.segmentLabels;
        const t = this.el("text");
        t.textContent = content;
        t.setAttribute("x", String(x));
        t.setAttribute("y", String(y));
        t.setAttribute("text-anchor", anchor);
        t.setAttribute("dominant-baseline", "middle");
        t.setAttribute("font-size", String(size));
        t.setAttribute("font-family", String(style.fontFamily.value.value || "Segoe UI"));
        t.setAttribute("font-weight", bold || style.bold.value ? "600" : "400");
        t.setAttribute("font-style", style.italic.value ? "italic" : "normal");
        if (style.underline.value) {
            t.setAttribute("text-decoration", "underline");
        }
        t.setAttribute("fill", fill);
        this.svg.appendChild(t);
    }

    private fmt(value: number): string {
        const decimals = Math.round(this.clamp(this.formattingSettings.markerLabel.decimalPlaces.value || 0, 0, 6));
        const valueType = String(this.formattingSettings.general.valueType.value.value);
        const percentInput = String(this.formattingSettings.general.percentInput.value.value);
        const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals };
        if (valueType === "percentage") {
            const scaled = percentInput === "zeroToOne" ? value * 100 : value;
            return `${scaled.toLocaleString(undefined, options)}%`;
        }
        return value.toLocaleString(undefined, options);
    }

    private line(x1: number, y1: number, x2: number, y2: number, stroke: string, width: number,
        opacity: string, shadow = false, dash = ""): void {
        if (shadow) {
            const s = this.el("line");
            s.setAttribute("x1", String(x1 + 1));
            s.setAttribute("y1", String(y1 + 1));
            s.setAttribute("x2", String(x2 + 1));
            s.setAttribute("y2", String(y2 + 1));
            s.setAttribute("stroke", "#000");
            s.setAttribute("stroke-width", String(width + 1));
            s.setAttribute("opacity", "0.10");
            this.svg.appendChild(s);
        }
        const l = this.el("line");
        l.setAttribute("x1", String(x1));
        l.setAttribute("y1", String(y1));
        l.setAttribute("x2", String(x2));
        l.setAttribute("y2", String(y2));
        l.setAttribute("stroke", stroke);
        l.setAttribute("stroke-width", String(width));
        l.setAttribute("stroke-linecap", "round");
        if (dash) {
            l.setAttribute("stroke-dasharray", dash);
        }
        l.setAttribute("opacity", opacity);
        this.svg.appendChild(l);
    }

    private circle(cx: number, cy: number, r: number, fill: string, opacity: string,
        outline = false, shadow = false): void {
        if (shadow) {
            const s = this.el("circle");
            s.setAttribute("cx", String(cx + 1));
            s.setAttribute("cy", String(cy + 1));
            s.setAttribute("r", String(r));
            s.setAttribute("fill", "#000");
            s.setAttribute("opacity", "0.10");
            this.svg.appendChild(s);
        }
        const c = this.el("circle");
        c.setAttribute("cx", String(cx));
        c.setAttribute("cy", String(cy));
        c.setAttribute("r", String(r));
        c.setAttribute("fill", fill);
        if (outline) {
            c.setAttribute("stroke", "#FFFFFF");
            c.setAttribute("stroke-width", String(Math.max(1, 0.25 * r)));
        }
        c.setAttribute("opacity", opacity);
        this.svg.appendChild(c);
    }

    private poly(points: string, fill: string, opacity: string, shadow = false): void {
        if (shadow) {
            const s = this.el("polygon");
            s.setAttribute("points", points);
            s.setAttribute("fill", "#000");
            s.setAttribute("opacity", "0.10");
            s.setAttribute("transform", "translate(1,1)");
            this.svg.appendChild(s);
        }
        const p = this.el("polygon");
        p.setAttribute("points", points);
        p.setAttribute("fill", fill);
        p.setAttribute("opacity", opacity);
        this.svg.appendChild(p);
    }

    private sel(element: SVGElement, index: number): void {
        if (this.selected !== null && this.selected !== index) {
            element.setAttribute("opacity", String((this.formattingSettings.style.selectedOpacity.value || 35) / 100));
        }
    }

    private title(element: SVGElement, content: string): void {
        if (!this.formattingSettings.interaction.showTooltips.value) {
            return;
        }
        const t = this.el("title");
        t.textContent = content;
        element.appendChild(t);
    }

    private polar(cx: number, cy: number, radius: number, angleDeg: number): Point {
        const rad = angleDeg * Math.PI / 180;
        return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
    }

    private offset(point: Point, angleDeg: number, distance: number): Point {
        const rad = angleDeg * Math.PI / 180;
        return { x: point.x + distance * Math.cos(rad), y: point.y + distance * Math.sin(rad) };
    }

    private interpolateAngle(start: number, end: number, t: number): number {
        return start + (end - start) * t;
    }

    private safe(numerator: number, denominator: number): number {
        return denominator && isFinite(denominator) ? numerator / denominator : 0;
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.max(min, Math.min(max, value));
    }

    private col(color: { value: string } | undefined | null, fallback: string): string {
        return color && color.value ? color.value : fallback;
    }

    private anchorFor(x: number, width: number): string {
        if (x < 24) {
            return "start";
        }
        return x > width - 24 ? "end" : "middle";
    }

    private dash(style: string): string {
        if (style === "dash") {
            return "5 4";
        }
        return style === "dot" ? "1 4" : "";
    }

    private el(tag: string): SVGElement {
        return document.createElementNS(SVG_NS, tag) as SVGElement;
    }
}
