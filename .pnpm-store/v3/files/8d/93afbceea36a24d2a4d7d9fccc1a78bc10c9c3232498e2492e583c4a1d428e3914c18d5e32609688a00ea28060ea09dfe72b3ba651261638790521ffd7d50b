import { Context } from './types';
export interface TimingStatsInterface {
    appliesTimings: number[];
    appliesCount: number;
    timingsSum: number;
    meanTiming: number;
    standardDeviation: number;
}
/**
 * A helper class for applied rule stats.
 */
export declare class TimingStats implements TimingStatsInterface {
    appliesTimings: number[];
    appliesCount: number;
    timingsSum: number;
    meanTiming: number;
    private squaredSum;
    standardDeviation: number;
    /**
     * Creates new TimingStats.
     */
    constructor();
    /**
     * Observe target element and mark observer as active.
     *
     * @param elapsedTimeMs Time in ms.
     */
    push(elapsedTimeMs: number): void;
}
/**
 * Prints timing information if debugging mode is enabled.
 *
 * @param context ExtendedCss context.
 */
export declare const printTimingInfo: (context: Context) => void;
