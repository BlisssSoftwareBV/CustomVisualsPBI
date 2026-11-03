import type powerbi from "powerbi-visuals-api";
import { FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { ChartOptions, ProgressDatum, renderChart } from "./chart";
import { evaluateProgress, finiteNumber } from "./progress";
import { VisualSettings } from "./settings";
import "../style/visual.less";

export class Visual implements powerbi.extensibility.visual.IVisual {
    private root: HTMLElement;
    private host: powerbi.extensibility.visual.IVisualHost;
    private selection: powerbi.extensibility.ISelectionManager;
    private formatting = new FormattingSettingsService();
    private settings = new VisualSettings();

    constructor(options?: powerbi.extensibility.visual.VisualConstructorOptions) {
        if (!options) throw new Error("Power BI-constructoropties ontbreken.");
        this.host = options.host;
        this.root = document.createElement("div");
        options.element.append(this.root);
        this.selection = this.host.createSelectionManager();
        this.selection.registerOnSelectCallback(() => this.applySelection());
    }

    public update(options: powerbi.extensibility.visual.VisualUpdateOptions): void {
        this.host.eventService.renderingStarted(options);
        try {
            const view = options.dataViews?.[0];
            this.settings = view ? this.formatting.populateFormattingSettingsModel(VisualSettings, view) : new VisualSettings();
            const settings = this.settings;
            const labels = settings.labels;
            const categorical = view?.categorical;
            const category = categorical?.categories?.find(column => column.source.roles?.category);
            const columns = categorical?.values;
            const column = (role: string) => columns?.find(item => item.source.roles?.[role]);
            const measure = column("value");
            const minimum = column("minimum"), maximum = column("maximum"), target = column("target");
            const formatMode = String(labels.format.value.value);
            const precision = Math.max(0, Math.min(6, Math.trunc(labels.decimals.value)));
            const percentFormatter = new Intl.NumberFormat(this.host.locale, { style: "percent", maximumFractionDigits: precision });
            const formatFor = (source?: powerbi.DataViewMetadataColumn) => {
                const format = formatMode === "number" ? "#,0.############" : formatMode === "percent" || formatMode === "percent100" ? "0.######%" : source?.format || measure?.source.format;
                const formatter = valueFormatter.create({ format, precision, value: 1, cultureSelector: this.host.locale });
                return (value: number) => formatter.format(formatMode === "percent100" ? value / 100 : value);
            };
            const format = formatFor(measure?.source);
            const read = (field: powerbi.DataViewValueColumn | undefined, index: number, fallback: number) => field ? finiteNumber(field.values[index]) : finiteNumber(fallback);
            const data: ProgressDatum[] = measure ? (category ? category.values : measure.values.slice(0, 1)).map((categoryValue, index) => {
                const builder = this.host.createSelectionIdBuilder();
                if (category) builder.withCategory(category, index);
                if (measure.source.queryName) builder.withMeasure(measure.source.queryName);
                const name = category ? valueFormatter.format(categoryValue, category.source.format, undefined, this.host.locale) : measure.source.displayName;
                const datum: ProgressDatum = {
                    category: name || "(Leeg)", identity: builder.createSelectionId(),
                    value: finiteNumber(measure.values[index]),
                    minimum: read(minimum, index, settings.range.minimum.value),
                    maximum: read(maximum, index, settings.range.maximum.value),
                    target: settings.range.targetEnabled.value ? read(target, index, settings.range.target.value) : null,
                    highlight: measure.highlights ? finiteNumber(measure.highlights[index]) : undefined,
                    format, tooltip: []
                };
                const state = evaluateProgress(datum);
                datum.tooltip = [
                    { displayName: category?.source.displayName || "Meting", value: datum.category },
                    { displayName: measure.source.displayName, value: datum.value === null ? "(Leeg)" : format(datum.value) },
                    { displayName: "Bodem", value: datum.minimum === null ? "(Leeg)" : format(datum.minimum) },
                    { displayName: "Top", value: datum.maximum === null ? "(Leeg)" : format(datum.maximum) }
                ];
                if (settings.range.targetEnabled.value) datum.tooltip.push({ displayName: "Target", value: datum.target === null ? "(Leeg)" : format(datum.target) });
                if (state.valid) datum.tooltip.push({ displayName: "Voortgang van bereik", value: percentFormatter.format(state.ratio) });
                else datum.tooltip.push({ displayName: "Status", value: state.message });
                if (target && settings.range.targetEnabled.value && datum.target === null) datum.warning = "Target ontbreekt";
                if (state.overflow) datum.tooltip.push({ displayName: "Boven top", value: format(datum.value! - datum.maximum!) });
                columns?.filter(item => item.source.roles?.tooltips).forEach(item => datum.tooltip.push({ displayName: item.source.displayName,
                    value: valueFormatter.format(item.values[index], item.source.format, undefined, this.host.locale) }));
                return datum;
            }) : [];
            const palette = this.host.colorPalette;
            const contrast = (color: string) => palette.isHighContrast ? palette.foreground.value : color;
            const chartOptions: ChartOptions = {
                mode: String(settings.colors.mode.value.value),
                colors: { start: settings.colors.start.value.value, midpoint: settings.colors.midpoint.value.value, target: settings.colors.target.value.value,
                    top: settings.colors.top.value.value, track: palette.isHighContrast ? palette.background.value : settings.colors.track.value.value,
                    marker: contrast(settings.colors.marker.value.value), overflow: settings.overflow.color.value.value },
                overflowColor: settings.overflow.recolor.value,
                overflowMessage: settings.overflow.showMessage.value ? settings.overflow.message.value || "Boven top" : null,
                showProgress: labels.showProgress.value, showBounds: labels.showBounds.value, showTarget: labels.showTarget.value,
                progressPosition: String(labels.progressPosition.value.value),
                valueMatchColor: labels.valueMatchColor.value, valuePosition: String(labels.valuePosition.value.value),
                showTargetTitle: labels.showTargetTitle.value, showTargetValue: labels.showTargetValue.value, targetTitle: labels.targetTitle.value,
                fontSize: Math.min(24, Math.max(8, labels.fontSize.value)), barHeight: Math.min(48, Math.max(6, settings.layout.barHeight.value)),
                customRounding: settings.layout.customRounding.value, rounding: settings.layout.rounding.value,
                segmented: settings.layout.segmented.value, stepSize: settings.layout.stepSize.value,
                stepUnit: String(settings.layout.stepUnit.value.value), segmentGap: settings.layout.segmentGap.value,
                spacing: Math.min(64, Math.max(8, settings.layout.spacing.value)), textColor: contrast(labels.color.value.value),
                background: palette.isHighContrast ? palette.background.value : "transparent", highContrast: palette.isHighContrast,
                sort: String(settings.layout.sort.value.value), percent: value => percentFormatter.format(value),
                onSelect: (datum, multi) => { void this.selection.select(datum.identity as powerbi.extensibility.ISelectionId, multi).then(() => this.applySelection()); },
                onClear: () => { void this.selection.clear().then(() => this.applySelection()); },
                onContext: (datum, event) => { void this.selection.showContextMenu(datum.identity as powerbi.extensibility.ISelectionId, { x: event.clientX, y: event.clientY }); },
                onTooltip: (datum, event) => this.host.tooltipService.show({ coordinates: [event.clientX, event.clientY], isTouchEvent: event.pointerType === "touch",
                    dataItems: datum.tooltip, identities: [datum.identity as powerbi.visuals.ISelectionId] }),
                onHideTooltip: () => this.host.tooltipService.hide({ isTouchEvent: false, immediately: true })
            };
            this.root.style.width = `${Math.max(0, options.viewport.width)}px`;
            this.root.style.height = `${Math.max(0, options.viewport.height)}px`;
            renderChart(this.root, data, chartOptions);
            if (view?.metadata.segment) {
                const notice = document.createElement("div");
                notice.className = "data-warning";
                notice.textContent = "Niet alle categorieen worden getoond. Verfijn de filters.";
                this.root.append(notice);
            }
            this.applySelection();
            this.host.eventService.renderingFinished(options);
        } catch (error) {
            this.root.replaceChildren();
            this.root.textContent = "De visual kon niet worden weergegeven.";
            this.host.eventService.renderingFailed(options, String(error));
        }
    }

    private applySelection(): void {
        const selected = this.selection.getSelectionIds() as powerbi.visuals.ISelectionId[];
        this.root.querySelectorAll<HTMLElement>(".progress-row").forEach(row => {
            const datum = (row as HTMLElement & { __datum__: ProgressDatum }).__datum__;
            const active = !selected.length || selected.some(identity => identity.includes(datum.identity as powerbi.visuals.ISelectionId));
            row.style.opacity = active ? "1" : "0.3";
            row.setAttribute("aria-pressed", String(selected.length > 0 && active));
        });
    }

    public getFormattingModel(): powerbi.visuals.FormattingModel {
        return this.formatting.buildFormattingModel(this.settings);
    }

    public destroy(): void {
        this.host.tooltipService.hide({ immediately: true, isTouchEvent: false });
        this.root.replaceChildren();
    }
}