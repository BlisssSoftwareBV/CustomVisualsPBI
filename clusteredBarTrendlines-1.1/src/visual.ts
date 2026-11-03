import type powerbi from "powerbi-visuals-api";
import { formattingSettings as fs, FormattingSettingsService } from "powerbi-visuals-utils-formattingmodel";
import { valueFormatter } from "powerbi-visuals-utils-formattingutils";
import { ChartDatum, ChartOptions, ChartSeries, renderChart } from "./chart";
import { VisualSettings, trendItems, minimumValidator, maximumValidator } from "./settings";
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
            const objects = view?.metadata.objects;
            if (objects?.legendStyle?.show === undefined) this.settings.legendStyle.show.value = this.settings.chart.legend.value;
            if (objects?.labelStyle?.show === undefined) this.settings.labelStyle.show.value = this.settings.chart.labels.value;
            if (objects?.valueAxis?.gridlines === undefined) this.settings.valueAxis.gridlines.value = this.settings.chart.gridlines.value;
            if (objects?.categoryAxis?.fontSize === undefined) this.settings.categoryAxis.fontSize.value = this.settings.chart.fontSize.value;
            if (objects?.valueAxis?.fontSize === undefined) this.settings.valueAxis.fontSize.value = this.settings.chart.fontSize.value;
            if (objects?.legendStyle?.fontSize === undefined) this.settings.legendStyle.fontSize.value = this.settings.chart.fontSize.value;
            if (objects?.labelStyle?.fontSize === undefined) this.settings.labelStyle.fontSize.value = this.settings.chart.fontSize.value;
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
                        const lineStyle = group.objects?.trendStyle || measure.source.objects?.trendStyle;
                        const configuredColor = style?.color as powerbi.Fill | undefined;
                        const color = palette.isHighContrast ? palette.foreground.value : configuredColor?.solid?.color || palette.getColor(name).value;
                        const configuredLineColor = lineStyle?.color as powerbi.Fill | undefined;
                        const trendColor = palette.isHighContrast ? palette.foreground.value : configuredLineColor?.solid?.color || palette.getColor(name).value;
                        const useDefaultStroke = lineStyle?.useDefaultStroke !== false;
                        const trendWidth = useDefaultStroke ? this.settings.trend.width.value : Number(lineStyle?.width ?? this.settings.trend.width.value);
                        const trendDashed = useDefaultStroke ? this.settings.trend.dashed.value : (lineStyle?.dashed ?? this.settings.trend.dashed.value) === true;
                        const trendTransparency = Number(lineStyle?.transparency ?? 0);
                        const trendShow = (lineStyle?.show ?? style?.trendShow ?? true) === true;
                        const configuredType = String(lineStyle?.type ?? style?.trendType ?? "default");
                        const trendType = (configuredType === "default" ? this.settings.trend.type.value.value : configuredType) as TrendType;
                        const units = String(this.settings.chart.displayUnits.value.value);
                        const magnitude = Math.max(0, ...measure.values.filter((value): value is number => typeof value === "number" && Number.isFinite(value)).map(Math.abs));
                        const formatter = valueFormatter.create({ format: measure.source.format, precision: Math.trunc(this.settings.chart.decimals.value),
                            value: units === "auto" ? magnitude : units === "none" ? 1 : Number(units), cultureSelector: this.host.locale });
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
                        series.push({ name, color, data, trendType, trendShow, trendColor,
                            trendWidth: Math.min(8, Math.max(1, trendWidth)), trendDashed,
                            trendOpacity: palette.isHighContrast ? 1 : 1 - Math.min(100, Math.max(0, trendTransparency)) / 100, format });
                        this.settings.seriesStyle.groups.push(new fs.Group({ name: `series_${groupIndex}_${measureIndex}`, displayName: name, slices: [
                            new fs.ColorPicker({ name: "color", displayName: "Kolomkleur", value: { value: color }, selector })
                        ] }));
                        this.settings.trendStyle.groups.push(new fs.Group({ name: `trend_${groupIndex}_${measureIndex}`, displayName: name, slices: [
                            new fs.ToggleSwitch({ name: "show", displayName: "Trendlijn tonen", value: trendShow, selector }),
                            new fs.ItemDropdown({ name: "type", displayName: "Trendlijntype", items: [{ value: "default", displayName: "Algemene instelling" }, ...trendItems],
                                value: { value: configuredType, displayName: configuredType === "default" ? "Algemene instelling" : trendItems.find(item => item.value === configuredType)?.displayName || configuredType }, selector }),
                            new fs.ColorPicker({ name: "color", displayName: "Lijnkleur", value: { value: trendColor }, selector }),
                            new fs.ToggleSwitch({ name: "useDefaultStroke", displayName: "Algemene lijndikte en lijnstijl", value: useDefaultStroke, selector }),
                            new fs.NumUpDown({ name: "width", displayName: "Lijndikte", value: Number(lineStyle?.width ?? this.settings.trend.width.value), selector,
                                visible: !useDefaultStroke, options: { minValue: { type: minimumValidator, value: 1 }, maxValue: { type: maximumValidator, value: 8 } } }),
                            new fs.ToggleSwitch({ name: "dashed", displayName: "Gestreepte lijn", value: (lineStyle?.dashed ?? this.settings.trend.dashed.value) === true, selector, visible: !useDefaultStroke }),
                            new fs.NumUpDown({ name: "transparency", displayName: "Transparantie (%)", value: trendTransparency, selector,
                                options: { minValue: { type: minimumValidator, value: 0 }, maxValue: { type: maximumValidator, value: 100 } } })
                        ] }));
                    });
                });
            }
            const chart = this.settings.chart;
            const trend = this.settings.trend;
            const categoryAxis = this.settings.categoryAxis;
            const valueAxis = this.settings.valueAxis;
            const legend = this.settings.legendStyle;
            const labels = this.settings.labelStyle;
            const textColor = (color: string) => palette.isHighContrast ? palette.foreground.value : color;
            const chartOptions: ChartOptions = {
                width: options.viewport.width, height: options.viewport.height,
                orientation: chart.orientation.value.value as "bar" | "column",
                legend: legend.show.value, labels: labels.show.value, gridlines: valueAxis.gridlines.value,
                fontSize: chart.fontSize.value, gap: chart.gap.value, innerGap: chart.innerGap.value,
                columnOpacity: palette.isHighContrast ? 1 : 1 - chart.transparency.value / 100,
                categoryAxis: { show: categoryAxis.show.value, title: categoryAxis.title.value, fontSize: categoryAxis.fontSize.value, color: textColor(categoryAxis.color.value.value) },
                valueAxis: { show: valueAxis.show.value, title: valueAxis.title.value, fontSize: valueAxis.fontSize.value, color: textColor(valueAxis.color.value.value),
                    minimum: valueAxis.customMinimum.value ? valueAxis.minimum.value : null, maximum: valueAxis.customMaximum.value ? valueAxis.maximum.value : null,
                    gridColor: textColor(valueAxis.gridColor.value.value), gridWidth: valueAxis.gridWidth.value, gridDashed: valueAxis.gridDashed.value },
                legendStyle: { position: legend.position.value.value as "top" | "bottom", fontSize: legend.fontSize.value, color: textColor(legend.color.value.value),
                    title: legend.title.value ? legend.titleText.value || values?.source?.displayName || "" : "", showTrends: legend.showTrends.value },
                labelStyle: { position: labels.position.value.value as "outside" | "inside" | "center", fontSize: labels.fontSize.value, color: textColor(labels.color.value.value) },
                foreground: palette.isHighContrast ? palette.foreground.value : "#444444",
                background: palette.isHighContrast ? palette.background.value : "transparent", highContrast: palette.isHighContrast,
                trendShow: trend.show.value, equation: trend.equation.value, r2: trend.r2.value,
                lineWidth: trend.width.value, dashed: trend.dashed.value,
                trend: { order: trend.order.value, period: trend.period.value, forward: trend.forward.value, backward: trend.backward.value,
                    intercept: trend.fixedIntercept.value ? trend.intercept.value : null },
                numericX, categoryTitle: categoryAxis.titleText.value || category?.source.displayName || "Categorie",
                valueTitle: valueAxis.titleText.value || values?.filter(column => column.source.roles?.value).map(column => column.source.displayName).filter((name, index, names) => names.indexOf(name) === index).join(", ") || "Waarde",
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