import regression from "regression";

export type TrendType = "linear" | "exponential" | "logarithmic" | "polynomial" | "power" | "movingAverage";
export interface Point { x: number; y: number; }
export interface TrendOptions {
    type: TrendType;
    order: number;
    period: number;
    forward: number;
    backward: number;
    intercept: number | null;
}
export interface TrendResult {
    points: Point[];
    equation: string;
    r2: number | null;
    error?: string;
}

export const trendNames: Record<TrendType, string> = {
    linear: "Lineair", exponential: "Exponentieel", logarithmic: "Logaritmisch",
    polynomial: "Polynomiaal", power: "Macht", movingAverage: "Voortschrijdend gemiddelde"
};

export function calculateTrend(input: Point[], options: TrendOptions): TrendResult {
    const points = input.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));
    const failure = (error: string): TrendResult => ({ points: [], equation: "", r2: null, error });
    if (points.length < 2) return failure("Minimaal twee geldige datapunten nodig.");
    if (options.type === "movingAverage") {
        const period = Math.trunc(options.period);
        if (period < 2 || period > points.length) return failure("Periode moet tussen 2 en het aantal datapunten liggen.");
        const averaged = points.slice(period - 1).map((point, index) => ({
            x: point.x,
            y: points.slice(index, index + period).reduce((sum, item) => sum + item.y, 0) / period
        }));
        return { points: averaged, equation: `Gemiddelde (${period})`, r2: null };
    }
    if ((options.type === "exponential" || options.type === "power") && points.some(point => point.y <= 0)) {
        return failure("Dit trendlijntype vereist uitsluitend positieve Y-waarden.");
    }
    if ((options.type === "logarithmic" || options.type === "power") && points.some(point => point.x <= 0)) {
        return failure("Dit trendlijntype vereist uitsluitend positieve X-waarden.");
    }
    const distinct = new Set(points.map(point => point.x)).size;
    const order = Math.min(6, Math.max(2, Math.trunc(options.order)));
    if (distinct < (options.type === "polynomial" ? order + 1 : 2)) {
        return failure("Onvoldoende verschillende X-waarden voor deze trendlijn.");
    }
    const pairs: [number, number][] = points.map(point => [point.x, point.y]);
    let predict: (x: number) => number;
    let equation: string;
    if (options.type === "linear" && options.intercept !== null) {
        const denominator = points.reduce((sum, point) => sum + point.x ** 2, 0);
        if (!denominator) return failure("Kan de vaste intercept niet berekenen.");
        const slope = points.reduce((sum, point) => sum + point.x * (point.y - options.intercept!), 0) / denominator;
        predict = x => slope * x + options.intercept!;
        equation = `y = ${Number(slope.toPrecision(6))}x + ${options.intercept}`;
    } else {
        const fit = regression[options.type](pairs, { order, precision: 12 });
        predict = x => fit.predict(x)[1];
        equation = fit.string;
    }
    const average = points.reduce((sum, point) => sum + point.y, 0) / points.length;
    const total = points.reduce((sum, point) => sum + (point.y - average) ** 2, 0);
    const residual = points.reduce((sum, point) => sum + (point.y - predict(point.x)) ** 2, 0);
    const r2 = total === 0 ? null : 1 - residual / total;
    const minimum = Math.min(...points.map(point => point.x)) - Math.max(0, options.backward);
    const maximum = Math.max(...points.map(point => point.x)) + Math.max(0, options.forward);
    const sampled = Array.from({ length: 161 }, (_, index) => {
        const x = minimum + (maximum - minimum) * index / 160;
        return { x, y: predict(x) };
    }).filter(point => Number.isFinite(point.y) &&
        (!(options.type === "power" || options.type === "logarithmic") || point.x > 0));
    if (!sampled.length || !Number.isFinite(residual)) return failure("De trendlijn is numeriek niet berekenbaar.");
    return { points: sampled, equation, r2: r2 !== null && Number.isFinite(r2) ? r2 : null };
}