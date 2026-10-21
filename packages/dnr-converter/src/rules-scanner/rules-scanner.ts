import { RuleCategory } from '@adguard/agtree';
import { FilterListParser, type ParserOptions } from '@adguard/agtree/parser';

import { MaxScannedRulesError } from '../errors/limitation-errors';
import { RuleScanError } from '../errors/scan-errors';
import { type IFilter } from '../filter/types';
import { OPTION_NAMES } from '../rule/option-names';
import { Rule } from '../rule/rule';

/**
 * Interface that represents a scanned filter.
 */
export interface ScannedFilter {
    /**
     * The filter ID.
     */
    id: number;

    /**
     * List of scanned network rules.
     */
    rules: Rule[];

    /**
     * List of scanned network rules with `$badfilter` option.
     */
    badFilterRules: Rule[];
}

/**
 * Interface that represents result of scanning a list of filters.
 */
interface ScannedFiltersWithErrors {
    /**
     * List of errors occurred during the scan.
     */
    errors: Error[];

    /**
     * List of scanned filters.
     */
    filters: ScannedFilter[];
}

/**
 * Interface that represents scanned rules with errors.
 */
interface ScannedRulesWithErrors {
    /**
     * List of scanned {@link Rule}.
     */
    rules: Rule[];

    /**
     * List of errors occurred during the scan.
     */
    errors: Error[];
}

/**
 * Predicate to preselect raw filter lines before parsing.
 */
type LineSelector = (line: string) => boolean;

/**
 * Segment of filter content selected for parsing.
 */
interface LineSegment {
    /**
     * Selected line.
     */
    text: string;

    /**
     * Offset of the line in the filter content.
     */
    offset: number;
}

/**
 * Class that responsible for scanning filter rules and converting them into {@link Rule}.
 */
export class RulesScanner {
    /**
     * Parser options for filter scanning.
     *
     * The parser is tolerant, so all errors are collected in the result instead
     * of being thrown. Location info is required for source mapping, raw text —
     * for error reporting. Rules of all syntaxes are parsed, while comments and
     * host rules are ignored.
     */
    private static readonly PARSER_OPTIONS: ParserOptions = {
        tolerant: true,
        isLocIncluded: true,
        parseAbpSpecificRules: true,
        parseUboSpecificRules: true,
        includeRaws: true,
        ignoreComments: true,
        parseHostRules: false,
    };

    /**
     * Line separator in filter lists.
     */
    private static readonly LINE_BREAK = '\n';

    /**
     * Scans the list of filters for network rules.
     *
     * @param filters List of {@link IFilter}.
     * @param filterFn If this function is specified, it will be applied to each
     * rule after it has been parsed and transformed. This function is needed
     * for example to apply `$badfilter`: to exclude negated rules from the array
     * of rules that will be returned.
     * @param maxScannedRules Maximum number of network rules to
     * scan, all other rules will be ignored. It will be applied to each filter
     * separately, not for cumulative scope of rules from all filters, because
     * it looks simpler and more predictable solution to prevent too long scan.
     * @param lineSelector If this function is specified, only lines matching it
     * are parsed. It keeps the scan cost proportional to the number of
     * candidate lines, and original offsets of the rules are preserved.
     * @param skipErrorLineSelector If this function is specified, parse errors
     * of lines matching it are not reported. It is used when another pass owns
     * such lines and reports their errors itself.
     *
     * @returns Result object of {@link ScannedFiltersWithErrors}.
     */
    public static async scanFilters(
        filters: IFilter[],
        filterFn?: (r: Rule) => boolean,
        maxScannedRules?: number,
        lineSelector?: LineSelector,
        skipErrorLineSelector?: LineSelector,
    ): Promise<ScannedFiltersWithErrors> {
        const result: ScannedFiltersWithErrors = {
            errors: [],
            filters: [],
        };

        for (let i = 0; i < filters.length; i += 1) {
            const filter = filters[i];

            // eslint-disable-next-line no-await-in-loop
            const { errors, rules } = await RulesScanner.scanRules(
                filter,
                filterFn,
                maxScannedRules,
                lineSelector,
                skipErrorLineSelector,
            );
            const badFilterRules = rules.filter(RulesScanner.isBadFilterRule);

            result.errors = result.errors.concat(errors);
            result.filters.push({
                id: filter.getId(),
                rules,
                badFilterRules,
            });
        }

        return result;
    }

    /**
     * Extracts only the network rules (ignore cosmetic and host rules)
     * and tries to convert each line into {@link Rule}.
     *
     * @param filter From which filter the rules should be scanned.
     * @param filterFn If this function is specified, it will be applied to each
     * rule after it has been parsed and transformed. This function is needed
     * for example to apply `$badfilter`: to exclude negated rules from the array
     * of rules that will be returned.
     * @param maxScannedRules Maximum number of network rules to
     * scan, all other rules will be ignored and an error {@link MaxScannedRulesError}
     * will be added to the list of result errors.
     * @param lineSelector If this function is specified, only lines matching it
     * are parsed, and their original offsets are preserved.
     * @param skipErrorLineSelector If this function is specified, parse errors
     * of lines matching it are not reported.
     *
     * @returns Result object of {@link ScannedRulesWithErrors}.
     */
    private static async scanRules(
        filter: IFilter,
        filterFn?: (r: Rule) => boolean,
        maxScannedRules?: number,
        lineSelector?: LineSelector,
        skipErrorLineSelector?: LineSelector,
    ): Promise<ScannedRulesWithErrors> {
        const filterId = filter.getId();
        const content = await filter.getContent();
        const segments = RulesScanner.getSegments(content, lineSelector);

        const result: ScannedRulesWithErrors = {
            errors: [],
            rules: [],
        };

        for (const segment of segments) {
            const isLimitReached = RulesScanner.parseSegment(
                result,
                filterId,
                segment,
                filterFn,
                maxScannedRules,
                skipErrorLineSelector,
            );

            if (isLimitReached) {
                break;
            }
        }

        return result;
    }

    /**
     * Splits the filter content into segments to parse.
     *
     * Without a selector the whole content is parsed as a single segment,
     * otherwise only lines matching the selector are returned.
     *
     * @param content Filter list content.
     * @param lineSelector If this function is specified, only lines matching it
     * are selected.
     *
     * @returns Segments to parse.
     */
    private static getSegments(content: string, lineSelector?: LineSelector): LineSegment[] {
        if (!lineSelector) {
            return [{ text: content, offset: 0 }];
        }

        const segments: LineSegment[] = [];
        let offset = 0;

        for (const line of content.split(RulesScanner.LINE_BREAK)) {
            if (lineSelector(line)) {
                segments.push({ text: line, offset });
            }

            offset += line.length + RulesScanner.LINE_BREAK.length;
        }

        return segments;
    }

    /**
     * Parses a segment of the filter content and appends network rules and
     * errors to the scan result.
     *
     * Location info and raw rule text are always present in
     * {@link RulesScanner.PARSER_OPTIONS}, so they are used without additional
     * checks.
     *
     * @param result Scan result to append to.
     * @param filterId Id of the filter the segment belongs to.
     * @param segment Segment of the filter content.
     * @param filterFn If this function is specified, it will be applied to each
     * parsed rule.
     * @param maxScannedRules Maximum number of rules to scan, `undefined` if
     * there is no limit.
     * @param skipErrorLineSelector If this function is specified, parse errors
     * of lines matching it are not reported.
     *
     * @returns Whether the limit of scanned rules has been reached.
     */
    private static parseSegment(
        result: ScannedRulesWithErrors,
        filterId: number,
        segment: LineSegment,
        filterFn?: (r: Rule) => boolean,
        maxScannedRules?: number,
        skipErrorLineSelector?: LineSelector,
    ): boolean {
        const ast = FilterListParser.parse(segment.text, RulesScanner.PARSER_OPTIONS);

        for (const node of ast.children) {
            const index = segment.offset + node.start!;
            const raw = node.raws!.text!;
            const isErrorSkipped = skipErrorLineSelector !== undefined && skipErrorLineSelector(raw);

            if (node.category === RuleCategory.Invalid) {
                if (isErrorSkipped) {
                    continue;
                }

                const { name, message } = node.error;
                const msg = `[${name}] ${message}: filter id - ${filterId}, `
                    + `line index - ${index}, line - ${raw}`;

                result.errors.push(new RuleScanError(msg, filterId, index));
                continue;
            }

            try {
                const rules = Rule.parseFromNode(filterId, index, node);
                const filteredRules = filterFn
                    ? rules.filter(filterFn)
                    : rules;

                result.rules.push(...filteredRules);

                if (maxScannedRules !== undefined && result.rules.length >= maxScannedRules) {
                    const lastRuleIndex = rules[rules.length - 1].index;
                    result.errors.push(RulesScanner.createLimitReachedError(lastRuleIndex));

                    return true;
                }
            } catch (error) {
                if (!isErrorSkipped) {
                    result.errors.push(RulesScanner.createRuleParseError(error, filterId, index, raw));
                }
            }
        }

        return false;
    }

    /**
     * Creates an error for a network rule which cannot be parsed.
     *
     * @param error Error thrown during rule creation.
     * @param filterId Id of the filter the rule belongs to.
     * @param index Index of the rule in the filter list.
     * @param raw Raw text of the rule.
     *
     * @returns Error to report.
     */
    private static createRuleParseError(
        error: unknown,
        filterId: number,
        index: number,
        raw: string,
    ): RuleScanError {
        const message = error instanceof Error
            ? error.message
            : 'Unknown error during creating network rule from raw string: '
                + `filter id - ${filterId}, line index - ${index}, line - ${raw}`;

        return new RuleScanError(message, filterId, index, error);
    }

    /**
     * Creates a limitation error for a filter whose scan limit has been reached.
     *
     * The error is reported to make the skipped rules visible, for example in
     * the UI.
     *
     * @param lastRuleIndex Index of the last scanned rule.
     *
     * @returns Limitation error to report.
     */
    private static createLimitReachedError(lastRuleIndex: number): MaxScannedRulesError {
        const msg = 'Maximum number of scanned network rules reached at line index '
            + `${lastRuleIndex}.`;

        return new MaxScannedRulesError(msg, lastRuleIndex);
    }

    /**
     * Checks whether the given rule is a bad filter rule.
     *
     * @param rule {@link Rule} to check.
     *
     * @returns `true` if the rule is a bad filter rule, `false` otherwise.
     */
    private static isBadFilterRule(rule: Rule): boolean {
        return rule.isModifierEnabled(OPTION_NAMES.BADFILTER);
    }
}
