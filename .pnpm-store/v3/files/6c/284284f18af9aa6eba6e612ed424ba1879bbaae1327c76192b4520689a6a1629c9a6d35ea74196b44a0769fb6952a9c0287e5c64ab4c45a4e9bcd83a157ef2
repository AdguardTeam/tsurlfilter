import type { ExtCssRuleData } from '../../css-rule';
import type { EventTracker } from './event-tracker';
import type { ExtMutationObserver } from './mutation-observer';
import type { ThrottleWrapper } from './throttle-wrapper';
export declare type MainCallback = () => void;
export declare type ProtectionCallback = (m: MutationRecord[], o: ExtMutationObserver) => void;
/**
 * Prototype interface for:
 *  - `AffectedElement` for internal lib usage
 *     where no required style properties in rules;
 *  - `IAffectedElement` for export
 *     where 'originalStyle' property is not required.
 */
interface AffectedElementProto {
    node: HTMLElement;
    originalStyle: string;
    protectionObserver?: ExtMutationObserver | null;
    removed?: boolean;
}
/**
 * Interface for internal lib usage.
 */
export interface AffectedElement extends AffectedElementProto {
    rules: ExtCssRuleData[];
}
/**
 * API interface.
 */
export interface IAffectedElement extends Partial<AffectedElementProto> {
    node: HTMLElement;
    rules: Partial<ExtCssRuleData>[];
}
/**
 * Data pairs for selector and number of times the element was removed by ExtendedCss.
 * Needed to avoid infinite loop of re-setting styles.
 */
declare type RemovalsStatistic = {
    [key: string]: number;
};
/**
 * Needed for getting affected node elements and handle style properties
 * before they are applied to them if it is necessary.
 *
 * Used by AdGuard Browser extension to display rules in Filtering log
 * and `collect-hits-count` (via tsurlfilter's CssHitsCounter).
 */
export declare type BeforeStyleAppliedCallback = (x: IAffectedElement) => IAffectedElement;
/**
 * Interface for ExtendedCss context. Needed to store affected elements, collect removal stats, etc.
 */
export declare type Context = {
    /**
     * Callback that handles affected elements.
     */
    beforeStyleApplied?: BeforeStyleAppliedCallback;
    /**
     * Array of data which represents parsed rules, matched dom node, etc.
     */
    affectedElements: AffectedElement[];
    /**
     * Flag for mainObserve() and mainDisconnect(), used while rules applying.
     */
    isDomObserved: boolean;
    /**
     * Instance of EventTracker for document observing.
     */
    eventTracker?: EventTracker;
    /**
     * Main document mutation observer.
     */
    domMutationObserver?: MutationObserver;
    /**
     * Scheduler to throttle calls to the function that applies rules
     * when a lot of DOM events are being tracked by {@link domMutationObserver}.
     */
    scheduler: ThrottleWrapper;
    /**
     * Info about element selectors and their removing counter.
     */
    removalsStatistic: RemovalsStatistic;
    /**
     * Array of parsed rules data needed for elements selecting and processing by ExtendedCss.
     */
    parsedRules: ExtCssRuleData[];
    /**
     * Flag for global debugging mode
     * which can be set in either ExtCssConfiguration or rules.
     */
    debug: boolean;
    /**
     * Flag for printing information about applied rules.
     */
    areTimingsPrinted?: boolean;
};
export {};
