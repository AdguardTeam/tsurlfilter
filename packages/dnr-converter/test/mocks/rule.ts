import { type NetworkRule as NetworkRuleNode, RuleGenerator, SYNTAX_ADG } from '@adguard/agtree';

import { type RequestMethod, type ResourceType } from '../../src/declarative-rule';
import { type HttpHeaderMatcher, type Rule } from '../../src/rule/rule';
import { fastHash, fastHash31 } from '../../src/utils/string';

/**
 * Options for creating a Rule mock.
 */
interface CreateRuleMockOptions {
    /**
     * The filter list ID to be returned by the mock. Defaults to `1`.
     */
    filterListId?: number;

    /**
     * The index of the rule to be returned by the mock. Defaults to `1`.
     */
    index?: number;

    /**
     * The network rule node to be returned by the mock. Defaults to basic node with empty pattern.
     */
    node?: NetworkRuleNode;

    /**
     * The pattern of the rule to be returned by the mock. Defaults to {@link node.pattern.value}.
     */
    pattern?: string;

    /**
     * The allowlist status of the rule to be returned by the mock. Defaults to {@link node.exception}.
     */
    allowlist?: boolean;

    /**
     * The hash of the rule to be returned by the mock. Defaults to `fastHash({@link hash})`.
     */
    hash?: number;

    /**
     * The priority of the rule to be returned by the mock. Defaults to `1`.
     */
    priority?: number;

    /**
     * Mocks `Rule.isFilteringDisabled` method to return this value. Defaults to `false`.
     */
    isFilteringDisabled?: boolean;

    /**
     * Mocks `Rule.isRegexRule` method to return this value. Defaults to `false`.
     */
    isRegexRule?: boolean;

    /**
     * Mocks enabled options for the rule. Defaults to `[]`.
     */
    enabledOptions?: string[];

    /**
     * Mocks disabled options for the rule. Defaults to `[]`.
     */
    disabledOptions?: string[];

    /**
     * Mocks permitted domains for the rule. Defaults to `null`.
     */
    permittedDomains?: string[] | null;

    /**
     * Mocks restricted domains for the rule. Defaults to `null`.
     */
    restrictedDomains?: string[] | null;

    /**
     * Mocks permitted `$to` domains for the rule. Defaults to `null`.
     */
    permittedToDomains?: string[] | null;

    /**
     * Mocks restricted `$to` domains for the rule. Defaults to `null`.
     */
    restrictedToDomains?: string[] | null;

    /**
     * Mocks deny/allow domains for the rule. Defaults to `null`.
     */
    denyAllowDomains?: string[] | null;

    /**
     * Mocks permitted resource types for the rule. Defaults to `[]`.
     */
    permittedResourceTypes?: ResourceType[];

    /**
     * Mocks restricted resource types for the rule. Defaults to `[]`.
     */
    restrictedResourceTypes?: ResourceType[];

    /**
     * Mocks permitted request methods for the rule. Defaults to `[]`.
     */
    permittedMethods?: RequestMethod[];

    /**
     * Mocks restricted request methods for the rule. Defaults to `[]`.
     */
    restrictedMethods?: RequestMethod[];

    /**
     * Mocks advanced modifier value for the rule. Defaults to `null`.
     */
    advancedModifierValue?: string | null;

    /**
     * Mocks header modifier matcher for the rule. Defaults to `null`.
     */
    headerModifierMatcher?: HttpHeaderMatcher | null;

    /**
     * Mocks response header name to remove for the rule. Defaults to `null`.
     */
    responseHeaderNameToRemove?: string | null;

    /**
     * Mocks request header name to remove for the rule. Defaults to `null`.
     */
    requestHeaderNameToRemove?: string | null;

    /**
     * Mocks `Rule.getRuleTextHash` method for the rule.
     * Defaults to actual implementation that hashes text generated from the {@link node}.
     *
     * @param salt Optional salt value.
     *
     * @returns The hash number.
     */
    getRuleTextHash?: (salt?: number) => number;

    /**
     * Returns `true` if this rule negates the `ruleToCheck`.
     * Only makes sense when this rule has a `$badfilter` modifier.
     *
     * @param ruleToCheck Rule to check.
     *
     * @returns `true` if this rule negates the specified rule, `false` otherwise.
     */
    negatesBadfilter?: (rule: Rule) => boolean;
}

/**
 * Creates a mock of Rule for testing purposes.
 *
 * @param options Options for creating the mock.
 *
 * @returns A mock Rule object.
 */
export function createRuleMock(options: CreateRuleMockOptions = {}): Rule {
    const {
        filterListId = 1,
        index = 1,
        node = {
            category: 'Network',
            syntax: SYNTAX_ADG,
            type: 'NetworkRule',
            exception: options.allowlist ?? false,
            pattern: {
                type: 'Value',
                value: options.pattern ?? '',
            },
        },
        pattern = node.pattern.value,
        allowlist = node.exception,
        hash = fastHash(pattern),
        priority = 1,
        isFilteringDisabled = false,
        isRegexRule = false,
        enabledOptions = [],
        disabledOptions = [],
        permittedDomains = null,
        restrictedDomains = null,
        permittedToDomains = null,
        restrictedToDomains = null,
        denyAllowDomains = null,
        permittedResourceTypes = [],
        restrictedResourceTypes = [],
        permittedMethods = [],
        restrictedMethods = [],
        advancedModifierValue = null,
        headerModifierMatcher = null,
        responseHeaderNameToRemove = null,
        requestHeaderNameToRemove = null,
        getRuleTextHash = (salt?: number) => {
            const textOfRule = RuleGenerator.generate(node);

            // Append a null-char to not collide with legitimate rule text.
            const trialText = salt === undefined ? textOfRule : `${textOfRule}\0${salt}`;

            return fastHash31(trialText);
        },
        negatesBadfilter = () => false,
    } = options;

    const enabledOptionsSet = new Set<string>(enabledOptions);
    const disabledOptionsSet = new Set<string>(disabledOptions);

    // Derive removeHeaderName / removeHeaderIsRequestType from the two legacy
    // options so getApplicableHeaderName() behaves consistently.
    const removeHeaderIsRequestType = requestHeaderNameToRemove !== null;
    const removeHeaderName = requestHeaderNameToRemove ?? responseHeaderNameToRemove ?? null;

    return {
        filterListId,
        index,
        node,
        pattern,
        allowlist,
        hash,
        priority,
        enabledModifiers: enabledOptionsSet as ReadonlySet<string>,
        disabledModifiers: disabledOptionsSet as ReadonlySet<string>,
        permittedDomains,
        restrictedDomains,
        permittedToDomains,
        restrictedToDomains,
        denyAllowDomains,
        permittedResourceTypes,
        restrictedResourceTypes,
        permittedMethods: permittedMethods ?? null,
        restrictedMethods: restrictedMethods ?? null,
        advancedModifierName: null as string | null,
        advancedModifierValue,
        headerMatcher: headerModifierMatcher,
        removeHeaderName,
        removeHeaderIsRequestType,
        isRedirectRuleModifier: false,
        isFilteringDisabled: () => isFilteringDisabled,
        isRegexRule: () => isRegexRule,
        isModifierEnabled: (modifier: string) => enabledOptionsSet.has(modifier),
        isModifierDisabled: (modifier: string) => disabledOptionsSet.has(modifier),
        isSingleModifierEnabled: (modifier: string) => (
            enabledOptionsSet.size === 1 && enabledOptionsSet.has(modifier)
        ),
        getText: () => RuleGenerator.generate(node),
        getTextHash: getRuleTextHash,
        getApplicableHeaderName: (isRequestHeader: boolean) => (
            isRequestHeader
                ? requestHeaderNameToRemove
                : responseHeaderNameToRemove
        ),
        negatesBadfilter,
    } as unknown as Rule;
}
