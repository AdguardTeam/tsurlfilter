import { AffectedElement, BeforeStyleAppliedCallback } from './helpers/types';
/**
 * Result of selector validation.
 */
export declare type SelectorValidationResult = {
    ok: boolean;
    error: string | null;
};
/**
 * Interface for ExtendedCss constructor argument. Needed to create the instance of ExtendedCss.
 *
 * ExtendedCss configuration may contain:
 * - `styleSheet` — CSS stylesheet of rules to apply;
 * - `cssRules` — list of separated CSS rules instead of or additionally to the CSS stylesheet;
 * - `beforeStyleApplied` — the callback for matched elements;
 * - `debug` — flag for global logging which is useful for selectors debugging.
 *
 * > Both `styleSheet` and `cssRules` are optional but at least one of them should be set.
 *
 * > If both `styleSheet` and `cssRules` are set, both of them are to be applied.
 *
 * CSS stylesheet and list of CSS rules can contain not just extended selectors
 * but standard ones, and all of them will be applied by the lib.
 *
 * CSS comments and at-rules are not supported.
 */
export interface ExtCssConfiguration {
    /**
     * Standard CSS stylesheet — a set of CSS rules
     * which generally consists of selector and style (except `:remove()` pseudo-class).
     *
     * ExtendedCss is able to parse and apply almost any CSS stylesheet, not just extended selectors
     * but there are some limitations - for example, CSS comments and at-rules are not supported;
     * learn more about the Limitations in README.md.
     */
    styleSheet?: string;
    /**
     * Array of CSS rules which consist of selector and style.
     * In fact it is similar to `styleSheet` but it is needed
     * for more convenient and flexible parsing of selectors and styles.
     *
     * As an advantage of such approach, invalid rules are skipped
     * in contradistinction to `styleSheet` which might cause its total failure
     * during the applying with some tricky invalid selector in it.
     *
     * Invalid rules reasons are to be logged.
     */
    cssRules?: string[];
    /**
     * The callback that handles affected elements.
     *
     * Needed for getting affected node elements and handle style properties
     * before they are applied to them if it is necessary.
     *
     * Used by AdGuard Browser extension to display rules in Filtering log
     * and `collect-hits-count` (via tsurlfilter's CssHitsCounter).
     */
    beforeStyleApplied?: BeforeStyleAppliedCallback;
    /**
     * Optional flag for global debugging mode.
     *
     * Alternatively can be set by extended pseudo-property `debug: global` in styleSheet rules.
     *
     * Learn more about Selectors debugging mode in README.md.
     */
    debug?: boolean;
}
/**
 * Main class of ExtendedCss lib.
 *
 * Parses css stylesheet with any selectors (passed to its argument as styleSheet),
 * and guarantee its applying as mutation observer is used to prevent the restyling of needed elements by other scripts.
 * This style protection is limited to 50 times to avoid infinite loop (MAX_STYLE_PROTECTION_COUNT).
 * Our own ThrottleWrapper is used for styles applying to avoid too often lib reactions on page mutations.
 *
 * Constructor creates the instance of class which should be run be `apply()` method to apply the rules,
 * and the applying can be stopped by `dispose()`.
 *
 * Can be used to select page elements by selector with `query()` method (similar to `Document.querySelectorAll()`),
 * which does not require instance creating.
 */
export declare class ExtendedCss {
    private context;
    /**
     * Creates new ExtendedCss.
     *
     * @param configuration ExtendedCss configuration.
     */
    constructor(configuration: ExtCssConfiguration);
    /**
     * Invokes {@link applyRules} function with current app context.
     *
     * This method is bound to the class instance in the constructor because it is called
     * in {@link ThrottleWrapper} and on the DOMContentLoaded event.
     */
    private applyRulesCallbackListener;
    /**
     * Initializes ExtendedCss.
     *
     * Should be executed on page ASAP,
     * otherwise the :contains() pseudo-class may work incorrectly.
     */
    init(): void;
    /**
     * Applies stylesheet rules on page.
     */
    apply(): void;
    /**
     * Disposes ExtendedCss and removes our styles from matched elements.
     */
    dispose(): void;
    /**
     * Exposed for testing purposes only.
     *
     * @returns Array of AffectedElement data objects.
     */
    getAffectedElements(): AffectedElement[];
    /**
     * Returns a list of the document's elements that match the specified selector.
     * Uses ExtCssDocument.querySelectorAll().
     *
     * @param selector Selector text.
     * @param [noTiming=true] If true — do not print the timings to the console.
     *
     * @throws An error if selector is not valid.
     * @returns A list of elements that match the selector.
     */
    static query(selector: string, noTiming?: boolean): HTMLElement[];
    /**
     * Validates selector.
     *
     * @param inputSelector Selector text to validate.
     *
     * @returns Result of selector validation.
     */
    static validate(inputSelector: string): SelectorValidationResult;
}
