import { TimingStats } from '../extended-css';
import { AnySelectorNodeInterface } from '../selector';
import { StyleDeclaration } from '../style-block';
export declare type ParsedSelectorData = {
    selector: string;
    stylesOfSelector: StyleDeclaration[];
};
export declare type CssStyleMap = {
    [key: string]: string;
};
/**
 * Type for storing data parsed from selector part of css rule.
 */
export declare type SelectorPartData = {
    /**
     * Success status.
     */
    success: boolean;
    /**
     * Parsed selector.
     */
    selector: string;
    /**
     * Selector ast to query elements by,
     * might be not defined if selector is not valid.
     */
    ast?: AnySelectorNodeInterface;
    /**
     * Styles parsed from selector rule part,
     * relevant to rules with `:remove()` pseudo-class which may not have actual style declaration.
     */
    stylesOfSelector?: StyleDeclaration[];
};
export declare type RawCssRuleData = {
    /**
     * String selector.
     */
    selector: string;
    /**
     * Parsed selector ast.
     */
    ast?: AnySelectorNodeInterface;
    /**
     * Array of previously collected styles which may contain 'remove' and 'debug'.
     */
    rawStyles?: StyleDeclaration[];
};
export declare type RawResultValue = {
    ast: AnySelectorNodeInterface;
    styles: StyleDeclaration[];
};
export declare type RawResults = Map<string, RawResultValue>;
/**
 * Interface for rules data parsed from passed styleSheet.
 */
export declare type ExtCssRuleData = {
    /**
     * Selector text.
     */
    selector: string;
    /**
     * Selector ast to query dom elements.
     */
    ast: AnySelectorNodeInterface;
    /**
     * Styles to apply to matched dom elements.
     */
    style?: CssStyleMap;
    /**
     * Rule debugging mode value.
     */
    debug?: 'true' | 'global';
    /**
     * Log data, available only for debugging mode.
     */
    timingStats?: TimingStats;
    /**
     * Dom elements matched by rule, available only for debugging mode.
     */
    matchedElements?: HTMLElement[];
};
