import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createSegments, evaluateProgress, finiteNumber } from "../src/progress";

test("value steps start at the floor and preserve a proportionally smaller final step", () => {
    const result = createSegments(2, 7, 2, "value");
    assert.deepEqual(result.segments, [{ start: 0, end: 0.4 }, { start: 0.4, end: 0.8 }, { start: 0.8, end: 1 }]);
    assert.equal(result.warning, undefined);
});

test("percentage steps are relative to the range, independent of the measure unit", () => {
    assert.equal(createSegments(0, 1, 10, "percent").segments.length, 10);
    assert.deepEqual(createSegments(-50, 150, 25, "percent").segments,
        [{ start: 0, end: 0.25 }, { start: 0.25, end: 0.5 }, { start: 0.5, end: 0.75 }, { start: 0.75, end: 1 }]);
});

test("floating point steps do not create a spurious final segment", () => {
    assert.equal(createSegments(0, 0.3, 0.1, "value").segments.length, 3);
    assert.deepEqual(createSegments(0, 5, 10, "value").segments, [{ start: 0, end: 1 }]);
});

test("invalid or excessive steps fall back with an explicit warning", () => {
    for (const step of [0, -1, NaN, Infinity, 0.00001]) {
        const result = createSegments(0, 100, step, "value");
        assert.equal(result.segments.length, 0);
        assert.ok(result.warning);
    }
    assert.equal(createSegments(0, 100, 0.5, "value").segments.length, 200);
});

test("progress is relative to the configured floor, not zero", () => {
    const state = evaluateProgress({ value: 25, minimum: -50, maximum: 100, target: 20 });
    assert.equal(state.ratio, 0.5);
    assert.equal(state.targetReached, true);
    assert.equal(state.targetPosition, 70 / 150);
});

test("overflow and underflow retain their real ratio but clamp the bar", () => {
    const above = evaluateProgress({ value: 125, minimum: 0, maximum: 100, target: 80 });
    assert.equal(above.ratio, 1.25);
    assert.equal(above.fill, 1);
    assert.equal(above.overflow, true);
    const below = evaluateProgress({ value: -10, minimum: 0, maximum: 100, target: null });
    assert.equal(below.fill, 0);
    assert.equal(below.underflow, true);
    assert.equal(below.targetPosition, null);
});

test("fractional percentages use exactly the same range calculation", () => {
    assert.equal(evaluateProgress({ value: 0.6, minimum: 0, maximum: 1, target: 0.8 }).ratio, 0.6);
});

test("invalid values and ranges are not silently converted to zero", () => {
    for (const value of [null, NaN, Infinity]) {
        assert.equal(evaluateProgress({ value, minimum: 0, maximum: 100, target: 80 }).valid, false);
    }
    for (const maximum of [0, -1, null]) {
        assert.equal(evaluateProgress({ value: 5, minimum: 0, maximum, target: 80 }).valid, false);
    }
    assert.equal(finiteNumber("42"), null);
    assert.equal(finiteNumber(0), 0);
});

test("out-of-range targets clamp their marker, not the attainment calculation", () => {
    const state = evaluateProgress({ value: 110, minimum: 0, maximum: 100, target: 120 });
    assert.equal(state.targetPosition, 1);
    assert.equal(state.targetReached, false);
});