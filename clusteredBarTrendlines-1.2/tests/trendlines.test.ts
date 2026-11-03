import { strict as assert } from "node:assert";
import { test } from "node:test";
import { calculateTrend, TrendOptions, TrendType } from "../src/trendlines";

const defaults: TrendOptions = { type: "linear", order: 2, period: 2, forward: 0, backward: 0, intercept: null };
const cases: [TrendType, (x: number) => number][] = [
    ["linear", x => 3 * x + 2], ["exponential", x => 2 * Math.exp(0.3 * x)],
    ["logarithmic", x => 4 + 2 * Math.log(x)], ["polynomial", x => x * x + 2 * x + 1],
    ["power", x => 3 * x ** 1.5]
];
for (const [type, formula] of cases) {
    test(`${type}: known curve and R2`, () => {
        const result = calculateTrend([1, 2, 3, 4, 5].map(x => ({ x, y: formula(x) })), { ...defaults, type });
        assert.equal(result.error, undefined);
        assert.ok(Math.abs(result.points[80].y - formula(3)) < 1e-6);
        assert.ok(Math.abs(result.r2! - 1) < 1e-8);
    });
}
test("moving average is trailing and has no equation R2", () => {
    const result = calculateTrend([2, 4, 6, 8].map((y, index) => ({ x: index + 1, y })), { ...defaults, type: "movingAverage", period: 3 });
    assert.deepEqual(result.points, [{ x: 3, y: 4 }, { x: 4, y: 6 }]);
    assert.equal(result.r2, null);
});
test("invalid domains and insufficient data do not silently discard values", () => {
    assert.ok(calculateTrend([{ x: 1, y: 0 }, { x: 2, y: 3 }], { ...defaults, type: "exponential" }).error);
    assert.ok(calculateTrend([{ x: 0, y: 2 }, { x: 2, y: 3 }], { ...defaults, type: "logarithmic" }).error);
    assert.ok(calculateTrend([{ x: 1, y: 2 }, { x: 1, y: 3 }], defaults).error);
    assert.ok(calculateTrend([{ x: 1, y: 2 }, { x: 2, y: 3 }], { ...defaults, type: "polynomial" }).error);
});
test("forecast and fixed linear intercept", () => {
    const result = calculateTrend([{ x: 1, y: 3 }, { x: 2, y: 5 }], { ...defaults, intercept: 1, forward: 2, backward: 1 });
    assert.deepEqual(result.points[0], { x: 0, y: 1 });
    assert.deepEqual(result.points.at(-1), { x: 4, y: 9 });
});
test("constant series and missing data remain finite", () => {
    const result = calculateTrend([{ x: 1, y: 5 }, { x: 2, y: 5 }, { x: 3, y: NaN }], defaults);
    assert.equal(result.r2, null);
    assert.ok(result.points.every(point => Number.isFinite(point.y)));
});