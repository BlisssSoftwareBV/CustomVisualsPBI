export interface ProgressInput {
    value: number | null;
    minimum: number | null;
    maximum: number | null;
    target: number | null;
}

export interface ProgressState {
    valid: boolean;
    message: string;
    ratio: number;
    fill: number;
    targetPosition: number | null;
    overflow: boolean;
    underflow: boolean;
    targetReached: boolean;
}

export function finiteNumber(value: unknown): number | null {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export interface ProgressSegment {
    start: number;
    end: number;
}

export function createSegments(minimum: number, maximum: number, stepSize: number, unit: string): { segments: ProgressSegment[]; warning?: string } {
    const span = maximum - minimum;
    if (!Number.isFinite(span) || span <= 0 || !Number.isFinite(stepSize) || stepSize <= 0) {
        return { segments: [], warning: "Stapgrootte moet positief zijn en het bereik geldig." };
    }
    const frequency = unit === "percent" ? stepSize / 100 : stepSize / span;
    const count = Math.ceil(1 / frequency - 1e-10);
    if (!Number.isFinite(count) || count > 200 || frequency <= 0) {
        return { segments: [], warning: "Te veel stappen (maximaal 200). Vergroot de stapgrootte." };
    }
    const length = Math.max(1, count);
    return { segments: Array.from({ length }, (_unused, index) => ({
        start: index * frequency,
        end: index === length - 1 ? 1 : (index + 1) * frequency
    })) };
}

export function evaluateProgress(input: ProgressInput): ProgressState {
    const empty: ProgressState = { valid: false, message: "", ratio: 0, fill: 0, targetPosition: null,
        overflow: false, underflow: false, targetReached: false };
    const { value, minimum, maximum, target } = input;
    if (finiteNumber(value) === null) return { ...empty, message: "Geen waarde" };
    if (finiteNumber(minimum) === null || finiteNumber(maximum) === null) return { ...empty, message: "Bodem of top ontbreekt" };
    if (maximum! <= minimum!) return { ...empty, message: "Top moet hoger zijn dan bodem" };
    const span = maximum! - minimum!;
    const ratio = (value! - minimum!) / span;
    if (!Number.isFinite(span) || !Number.isFinite(ratio)) return { ...empty, message: "Bereik is te groot" };
    const hasTarget = finiteNumber(target) !== null;
    return { valid: true, message: "", ratio, fill: Math.max(0, Math.min(1, ratio)),
        targetPosition: hasTarget ? Math.max(0, Math.min(1, (target! - minimum!) / span)) : null,
        overflow: value! > maximum!, underflow: value! < minimum!, targetReached: hasTarget && value! >= target! };
}