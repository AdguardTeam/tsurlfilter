import { type AnyRule } from '@adguard/agtree';
import { RuleConverter } from '@adguard/agtree/converter';

import { getErrorMessage } from '../../common/error';
import { fastHash31, fastHash } from '../../utils/string-utils';
import { NetworkRule } from '../network-rule';
import { IndexedRule, type IRule } from '../rule';
import { RuleFactory } from '../rule-factory';

/**
 * Network rule with index and hashes for pattern and rule's text.
 *
 * This class is "wrapper" around simple IndexedRule for the needs of DNR converter:
 * pattern hashes are needed to quickly compare two different network rules with the same,
 * while rule's text hash is needed to keep ID of the rule in the filter the same
 * between several runs. Thus is needed to be able to use "skip review" option in CWS.
 */
export class IndexedNetworkRuleWithHash extends IndexedRule {
    /**
     * Rule's hash created with {@link fastHash}. Needed to quickly compare
     * two different network rules with the same pattern part for future
     * checking of $badfilter application from one of them to another.
     *
     * Hash is create only from "pattern" part of the rule.
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
     * @returns Hash for pattern part of the network rule.
     */
    public static createRulePatternHash(networkRule: NetworkRule): number {
        // TODO: Improve this part: maybe use trie-lookup-table and .getShortcut()?
        // or use agtree to collect pattern + all enabled network options without values
        const significantPart = networkRule.getPattern();

        return fastHash(significantPart);
    }

    /**
     * Gets hash for whole text of the network rule and return it. Needed
     * to keep ID of the rule in the filter the same between several runs. Thus
     * is needed to be able to use "skip review" option in CWS.
     *
     * @param salt Salt for hash, needed to make hash unique event if the rule
     * is the same (e.g. for different filters). To keep check simple, we just
     * use numbers.
     *
     * @returns Hash for pattern part of the network rule.
     */
    public getRuleTextHash(salt?: number): number {
        const textOfNetworkRule = this.rule.getText();

        // Append a null-char to not collide with legitimate rule text.
        const trialText = salt === undefined ? textOfNetworkRule : `${textOfNetworkRule}\0${salt}`;

        return fastHash31(trialText);
    }

    /**
     * Create {@link IndexedNetworkRuleWithHash} from rule. If an error
     * was detected during the conversion - return it.
     *
     * @param filterId Filter id.
     * @param index Rule's buffer index in that filter.
     * @param ruleConvertedToAGSyntax Rule which was converted to AG syntax.
     *
     * @throws Error when conversion failed.
     *
     * @returns Item of {@link IndexedNetworkRuleWithHash} or Error.
     */
    private static createIndexedNetworkRuleWithHash(
        filterId: number,
        index: number,
        ruleConvertedToAGSyntax: AnyRule,
    ): IndexedNetworkRuleWithHash | null {
        // Create indexed network rule from AG rule. These rules will be used in
        // declarative rules, that's why we ignore cosmetic and host rules.
        let networkRule: IRule | null;
        try {
            // Note: for correct throwing error it is important to use setConfiguration(),
            // because it will set compatibility type and future parsing options
            // for network rules will take it into account.
            networkRule = RuleFactory.createRule(
                ruleConvertedToAGSyntax,
                filterId,
                index,
                false, // convert only network rules
                true, // ignore cosmetic rules
                true, // ignore host rules
                false, // do not use a logger and throw an exception on rule creation error
            );
        } catch (e) {
            // eslint-disable-next-line max-len
            throw new Error(`Cannot create IRule from filter "${filterId}" and byte offset "${index}": ${getErrorMessage(e)}`);
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
            throw new Error(`Rule from filter "${filterId}" and byte offset "${index}" is not network rule: ${networkRule}`);
        }

        const patternHash = IndexedNetworkRuleWithHash.createRulePatternHash(networkRule);

        // If rule is not empty - pack to IndexedNetworkRuleWithHash and add it
        // to the result array.
        const indexedNetworkRuleWithHash = new IndexedNetworkRuleWithHash(
            networkRule,
            index,
            patternHash,
        );

        if (!indexedNetworkRuleWithHash) {
            // eslint-disable-next-line max-len
            throw new Error(`Cannot create indexed network rule with hash from filter "${filterId}" and byte offset "${index}"`);
        }

        return indexedNetworkRuleWithHash;
    }

    /**
     * Creates {@link IndexedNetworkRuleWithHash} from rule node.
     *
     * @param filterId Filter's id from which rule was extracted.
     * @param ruleIndex Buffer index of rule in that filter.
     * @param node Rule node.
     *
     * @throws Error when rule cannot be converted to AG syntax or when indexed
     * rule cannot be created from the rule which is already converted to AG
     * syntax.
     *
     * @returns Item of {@link IndexedNetworkRuleWithHash}.
     */
    public static createFromNode(
        filterId: number,
        ruleIndex: number,
        node: AnyRule,
    ): IndexedNetworkRuleWithHash[] {
        // Converts a raw string rule to AG syntax (apply aliases, etc.)
        let rulesConvertedToAGSyntax: AnyRule[];
        try {
            const conversionResult = RuleConverter.convertToAdg(node);
            if (conversionResult.isConverted) {
                rulesConvertedToAGSyntax = conversionResult.result;
            } else {
                rulesConvertedToAGSyntax = [node];
            }
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
                    ruleIndex,
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
