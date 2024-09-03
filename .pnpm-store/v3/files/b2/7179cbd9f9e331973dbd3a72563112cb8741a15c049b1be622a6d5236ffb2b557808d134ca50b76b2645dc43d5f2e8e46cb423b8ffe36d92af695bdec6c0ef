import { getErrorMessage } from '../../common/error';
import { fastHash } from '../../utils/string-utils';
import { NetworkRule } from '../network-rule';
import { IndexedRule, type IRule } from '../rule';
import { RuleConverter } from '../rule-converter';
import { RuleFactory } from '../rule-factory';

/**
 * Network rule with index and hash.
 */
export class IndexedNetworkRuleWithHash extends IndexedRule {
    /**
     * Rule's hash created with {@link fastHash}. Needed to quickly compare
     * two different network rules with the same pattern part for future
     * checking of $badfilter application from one of them to another.
     */
    public hash: number;

    /**
     * Overrided rule from {@link IndexedRule} with type {@link NetworkRule}
     * but not {@link IRule}.
     *
     * By using 'declare', we instruct the compiler not to generate runtime
     * code. Instead, it will use the property of the base class with
     * the overridden type.
     *
     * @see {@link https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-7.html#the-usedefineforclassfields-flag-and-the-declare-property-modifier}
     */
    public declare rule: NetworkRule;

    /**
     * Constructor.
     *
     * @param rule Item of {@link NetworkRule}.
     * @param index Rule's index.
     * @param hash Hash of the rule.
     */
    constructor(rule: NetworkRule, index: number, hash: number) {
        super(rule, index);

        this.hash = hash;
        this.rule = rule;
    }

    /**
     * Creates hash for pattern part of the network rule and return it. Needed
     * to quickly compare two different rules with the same pattern part for
     * future checking of $badfilter application from one of them to another.
     *
     * @param networkRule Item of {@link NetworkRule}.
     *
     * @returns Hash for patter part of the network rule.
     */
    public static createRuleHash(networkRule: NetworkRule): number {
        // TODO: Improve this part: maybe use trie-lookup-table and .getShortcut()?
        // or use agtree to collect pattern + all enabled network options without values
        const significantPart = networkRule.getPattern();
        const hash = fastHash(significantPart);

        return hash;
    }

    /**
     * Create {@link IndexedNetworkRuleWithHash} from rule. If an error
     * was detected during the conversion - return it.
     *
     * @param filterId Filter id.
     * @param lineIndex Rule's line index in that filter.
     * @param ruleConvertedToAGSyntax Rule which was converted to AG syntax.
     *
     * @throws Error when conversion failed.
     *
     * @returns Item of {@link IndexedNetworkRuleWithHash} or Error.
     */
    private static createIndexedNetworkRuleWithHash(
        filterId: number,
        lineIndex: number,
        ruleConvertedToAGSyntax: string,
    ): IndexedNetworkRuleWithHash | null {
        // Create indexed network rule from AG rule. These rules will be used in
        // declarative rules, that's why we ignore cosmetic and host rules.
        let networkRule: IRule | null;
        try {
            networkRule = RuleFactory.createRule(
                ruleConvertedToAGSyntax,
                filterId,
                false, // convert only network rules
                true, // ignore cosmetic rules
                true, // ignore host rules
                false, // do not use a logger and throw an exception on rule creation error
            );
        } catch (e) {
            // eslint-disable-next-line max-len
            throw new Error(`Cannot create IRule from filter "${filterId}" and line "${lineIndex}": ${getErrorMessage(e)}`);
        }

        /**
         * The converted rule will be null when there was a comment or
         * an ignored cosmetic/host rule.
         */
        if (networkRule === null) {
            return null;
        }

        if (!(networkRule instanceof NetworkRule)) {
            // eslint-disable-next-line max-len
            throw new Error(`Rule from filter "${filterId}" and line "${lineIndex}" is not network rule: ${networkRule}`);
        }

        const hash = IndexedNetworkRuleWithHash.createRuleHash(networkRule);

        // If rule is not empty - pack to IndexedNetworkRuleWithHash and add it
        // to the result array.
        const indexedNetworkRuleWithHash = new IndexedNetworkRuleWithHash(networkRule, lineIndex, hash);

        if (!indexedNetworkRuleWithHash) {
            // eslint-disable-next-line max-len
            throw new Error(`Cannot create indexed network rule with hash from filter "${filterId}" and line "${lineIndex}"`);
        }

        return indexedNetworkRuleWithHash;
    }

    /**
     * Creates {@link IndexedNetworkRuleWithHash} from text string.
     *
     * @param filterId Filter's id from which rule was extracted.
     * @param lineIndex Line index of rule in that filter.
     * @param rawString Text string.
     *
     * @throws Error when rule cannot be converted to AG syntax or when indexed
     * rule cannot be created from the rule which is already converted to AG
     * syntax.
     *
     * @returns Item of {@link IndexedNetworkRuleWithHash}.
     */
    public static createFromRawString(
        filterId: number,
        lineIndex: number,
        rawString: string,
    ): IndexedNetworkRuleWithHash[] {
        // Converts a raw string rule to AG syntax (apply aliases, etc.)
        let rulesConvertedToAGSyntax: string[];
        try {
            rulesConvertedToAGSyntax = RuleConverter.convertRule(rawString);
        } catch (e) {
            // eslint-disable-next-line max-len
            throw new Error(`Unknown error during conversion rule to AG syntax: ${getErrorMessage(e)}`);
        }

        const rules: IndexedNetworkRuleWithHash[] = [];

        const convertedAGRules = rulesConvertedToAGSyntax;
        // Now convert to IRule and then IndexedRule.
        for (let rulesIndex = 0; rulesIndex < convertedAGRules.length; rulesIndex += 1) {
            const ruleConvertedToAGSyntax = convertedAGRules[rulesIndex];

            try {
                const networkIndexedRuleWithHash = IndexedNetworkRuleWithHash.createIndexedNetworkRuleWithHash(
                    filterId,
                    lineIndex,
                    ruleConvertedToAGSyntax,
                );

                if (networkIndexedRuleWithHash) {
                    rules.push(networkIndexedRuleWithHash);
                }
            } catch (e: unknown) {
                // eslint-disable-next-line max-len
                throw new Error(`Error during creating indexed rule with hash: ${getErrorMessage(e)}`);
            }
        }

        return rules;
    }
}
