import { type RuleInfoText } from './utils/rule-text-provider';

/**
 * Basic rule information, e.g. we store these data in the CSS's content attribute.
 */
export type RuleInfoBasic = {
    /**
     * ID of the filter that the rule belongs to.
     */
    filterId: number;

    /**
     * Index that points to the original rule text in the filter list.
     */
    ruleIndex: number;
};

/**
 * Information about the rule. Including basics and rule texts.
 */
export type RuleInfo = RuleInfoBasic & RuleInfoText;

/**
 * Information about the rule. Including basics and rule texts.
 *
 * Fields can be `null` if the rule cannot be matched for the request,
 * e.g. during onErrorOccurred for company category matching.
 */
export type RuleInfoOptional = {
    [K in keyof RuleInfo]: RuleInfo[K] | null;
};
