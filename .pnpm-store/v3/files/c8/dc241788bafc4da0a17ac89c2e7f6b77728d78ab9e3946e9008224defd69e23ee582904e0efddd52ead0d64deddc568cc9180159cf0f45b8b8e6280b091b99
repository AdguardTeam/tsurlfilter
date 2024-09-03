import { ExtCssRuleData, ParsedSelectorData, RawCssRuleData, SelectorPartData, RawResults } from './types';
import { ExtCssDocument } from '../selector';
/**
 * Checks the presence of :remove() pseudo-class and validates it while parsing the selector part of css rule.
 *
 * @param rawSelector Selector which may contain :remove() pseudo-class.
 *
 * @returns Parsed selector data with selector and styles.
 * @throws An error on invalid :remove() position.
 */
export declare const parseRemoveSelector: (rawSelector: string) => ParsedSelectorData;
/**
 * Parses cropped selector part found before `{`.
 *
 * @param selectorBuffer Buffered selector to parse.
 * @param extCssDoc Needed for caching of selector ast.
 *
 * @returns Parsed validation data for cropped part of stylesheet which may be a selector.
 * @throws An error on unsupported CSS features, e.g. at-rules.
 */
export declare const parseSelectorRulePart: (selectorBuffer: string, extCssDoc: ExtCssDocument) => SelectorPartData;
/**
 * Creates a map for storing raw results of css rules parsing.
 * Used for merging styles for same selector.
 *
 * @returns Map where **key** is `selector`
 * and **value** is object with `ast` and `styles`.
 */
export declare const createRawResultsMap: () => RawResults;
/**
 * Saves rules data for unique selectors.
 *
 * @param rawResults Previously collected results of parsing.
 * @param rawRuleData Parsed rule data.
 *
 * @throws An error if there is no rawRuleData.styles or rawRuleData.ast.
 */
export declare const saveToRawResults: (rawResults: RawResults, rawRuleData: RawCssRuleData) => void;
/**
 * Prepares final RuleData.
 * Handles `debug` and `remove` in raw rule data styles.
 *
 * @param rawRuleData Raw data of selector css rule parsing.
 *
 * @returns Parsed ExtendedCss rule data.
 * @throws An error if rawRuleData.ast or rawRuleData.rawStyles not defined.
 */
export declare const prepareRuleData: (rawRuleData: RawCssRuleData) => ExtCssRuleData;
/**
 * Combines previously parsed css rules data objects
 * into rules which are ready to apply.
 *
 * @param rawResults Previously parsed css rules data objects.
 *
 * @returns Parsed ExtendedCss rule data.
 */
export declare const combineRulesData: (rawResults: RawResults) => ExtCssRuleData[];
