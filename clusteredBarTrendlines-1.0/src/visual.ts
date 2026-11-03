import powerbi from "powerbi-visuals-api";
import { formattingSettings as fs, FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { ChartDatum, ChartOptions, ChartSeries, renderChart } from "./chart";
import { VisualSettings, trendItems } from "./settings";
import { TrendType } from "./trendlines";
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
            const categorical = view?.categorical;
            const category = categorical?.categories?.find(column => column.source.roles?.category);
            const values = categorical?.values;
            const palette = this.host.colorPalette;
            const series: ChartSeries[] = [];
            let numericX = false;
            if (category && values) {
                values.grouped().forEach((group, groupIndex) => {
                    const measures = group.values.filter(column => column.source.roles?.value);
                    const xColumn = group.values.find(column => column.source.roles?.x);
                    numericX ||= !!xColumn;
                    measures.forEach((measure, measureIndex) => {
                        const name = group.name === undefined ? measure.source.displayName : `${String(group.name)}${measures.length > 1 ? ` - ${measure.source.displayName}` : ""}`;
                        const builder = this.host.createSelectionIdBuilder().withMeasure(measure.source.queryName!);
                        if (values.source) builder.withSeries(values, group);
                        const seriesId = builder.createSelectionId() as powerbi.visuals.ISelectionId;
                        const selector = seriesId.getSelector();
                        const style = group.objects?.seriesStyle || measure.source.objects?.seriesStyle;
                        const configuredColor = style?.color as powerbi.Fill | undefined;
                        const color = palette.isHighContrast ? palette.foreground.value : configuredColor?.solid?.color || palette.getColor(name).value;
                        const configuredType = String(style?.trendType || "default");
                        const trendType = (configuredType === "default" ? this.settings.trend.type.value.value : configuredType) as TrendType;
                        const formatter = valueFormatter.create({ format: measure.source.format, precision: Math.trunc(this.settings.chart.decimals.value), cultureSelector: this.host.locale });
                        const format = (value: number) => formatter.format(value);
                        const data: ChartDatum[] = category.values.map((categoryValue, index) => {
                            const identityBuilder = this.host.createSelectionIdBuilder().withCategory(category, index).withMeasure(measure.source.queryName!);
                            if (values.source) identityBuilder.withSeries(values, group);
                            const value = typeof measure.values[index] === "number" && Number.isFinite(measure.values[index]) ? measure.values[index] as number : null;
                            const categoryLabel = valueFormatter.format(categoryValue, category.source.format, undefined, this.host.locale);
                            const xValue = xColumn?.values[index];
                            const tooltip = [{ displayName: category.source.displayName, value: categoryLabel },
                                { displayName: name, value: value === null ? "(Leeg)" : format(value) }];
                            if (xColumn) tooltip.push({ displayName: xColumn.source.displayName, value: String(xValue ?? "(Leeg)") });
                            group.values.filter(column => column.source.roles?.tooltips).forEach(column => {
                                tooltip.push({ displayName: column.source.displayName,
                                    value: valueFormatter.format(column.values[index], column.source.format, undefined, this.host.locale) });
                            });
                            return { category: categoryLabel, value, x: xColumn ? (typeof xValue === "number" ? xValue : NaN) : index + 1,
                                highlight: measure.highlights ? (typeof measure.highlights[index] === "number" ? measure.highlights[index] as number : null) : undefined,
                                identity: identityBuilder.createSelectionId(), tooltip };
                        });
                        series.push({ name, color, data, trendType, trendShow: style?.trendShow !== false, format });
                        this.settings.seriesStyle.groups.push(new fs.Group({ name: `series_${groupIndex}_${measureIndex}`, displayName: name, slices: [
                            new fs.ColorPicker({ name: "color", displayName: "Kleur", value: { value: color }, selector }),
                            new fs.ToggleSwitch({ name: "trendShow", displayName: "Trendlijn", value: style?.trendShow !== false, selector }),
                            new fs.ItemDropdown({ name: "trendType", displayName: "Trendlijntype", items: [{ value: "default", displayName: "Algemene instelling" }, ...trendItems],
                                value: { value: configuredType, displayName: configuredType }, selector })
                        ] }));
                    });
                });
            }
            const chart = this.settings.chart;
            const trend = this.settings.trend;
            const chartOptions: ChartOptions = {
                width: options.viewport.width, height: options.viewport.height,
                orientation: chart.orientation.value.value as "bar" | "column",
                legend: chart.legend.value, labels: chart.labels.value, gridlines: chart.gridlines.value,
                fontSize: chart.fontSize.value, gap: chart.gap.value,
                foreground: palette.isHighContrast ? palette.foreground.value : "#444444",
                background: palette.isHighContrast ? palette.background.value : "transparent", highContrast: palette.isHighContrast,
                trendShow: trend.show.value, equation: trend.equation.value, r2: trend.r2.value,
                lineWidth: trend.width.value, dashed: trend.dashed.value,
                trend: { order: trend.order.value, period: trend.period.value, forward: trend.forward.value, backward: trend.backward.value,
                    intercept: trend.fixedIntercept.value ? trend.intercept.value : null },
                numericX, categoryTitle: category?.source.displayName || "Categorie",
                valueTitle: values?.filter(column => column.source.roles?.value).map(column => column.source.displayName).filter((name, index, names) => names.indexOf(name) === index).join(", ") || "Waarde",
                onSelect: (datum, multi) => { void this.selection.select(datum.identity as powerbi.extensibility.ISelectionId, multi).then(() => this.applySelection()); },
                onClear: () => { void this.selection.clear().then(() => this.applySelection()); },
                onContext: (datum, event) => { void this.selection.showContextMenu(datum.identity as powerbi.extensibility.ISelectionId, { x: event.clientX, y: event.clientY }); },
                onTooltip: (datum, event) => this.host.tooltipService.show({ coordinates: [event.clientX, event.clientY], isTouchEvent: false,
                    dataItems: datum.tooltip, identities: [datum.identity as powerbi.visuals.ISelectionId] }),
                onHideTooltip: () => this.host.tooltipService.hide({ isTouchEvent: false, immediately: true })
            };
            renderChart(this.root, series, chartOptions);
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
        this.root.querySelectorAll<SVGRectElement>(".data-bar").forEach(element => {
            const datum = (element as SVGRectElement & { __data__: ChartDatum }).__data__;
            const identity = datum.identity as powerbi.visuals.ISelectionId;
            const active = !selected.length || selected.some(item => item.includes(identity));
            element.style.opacity = active ? "" : "0.2";
            element.setAttribute("aria-pressed", String(selected.length > 0 && active));
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