import { type NetworkRule as NetworkRuleNode, RuleGenerator } from '@adguard/agtree';

import { type RequestMethod, type ResourceType } from '../../src/declarative-rule';
import { type NetworkRule, type NetworkRuleOption } from '../../src/network-rule';
import { fastHash, fastHash31 } from '../../src/utils/string';

/**
 * Options for creating a NetworkRule mock.
 */
interface CreateNetworkRuleMockOptions {
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
     * Mocks `NetworkRule.isFilteringDisabled` method to return this value. Defaults to `false`.
     */
    isFilteringDisabled?: boolean;

    /**
     * Mocks `NetworkRule.isRegexRule` method to return this value. Defaults to `false`.
     */
    isRegexRule?: boolean;

    /**
     * Mocks enabled options for the rule. Defaults to `[]`.
     */
    enabledOptions?: NetworkRuleOption[];

    /**
     * Mocks disabled options for the rule. Defaults to `[]`.
     */
    disabledOptions?: NetworkRuleOption[];

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
     * Mocks response header name to remove for the rule. Defaults to `null`.
     */
    responseHeaderNameToRemove?: string | null;

    /**
     * Mocks request header name to remove for the rule. Defaults to `null`.
     */
    requestHeaderNameToRemove?: string | null;

    /**
     * Mocks `NetworkRule.getRuleTextHash` method for the rule.
     * Defaults to actual implementation that hashes text generated from the {@link node}.
     *
     * @param salt Optional salt value.
     *
     * @returns The hash number.
     */
    getRuleTextHash?: (salt?: number) => number;
}

/**
 * Creates a mock of NetworkRule for testing purposes.
 *
 * @param options Options for creating the mock.
 *
 * @returns A mock NetworkRule object.
 */
export function createNetworkRuleMock(options: CreateNetworkRuleMockOptions = {}): NetworkRule {
    const {
        filterListId = 1,
        index = 1,
        node = {
            category: 'Network',
            syntax: 'AdGuard',
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
        responseHeaderNameToRemove = null,
        requestHeaderNameToRemove = null,
        getRuleTextHash = (salt?: number) => {
            const textOfNetworkRule = RuleGenerator.generate(node);

            // Append a null-char to not collide with legitimate rule text.
            const trialText = salt === undefined ? textOfNetworkRule : `${textOfNetworkRule}\0${salt}`;

            return fastHash31(trialText);
        },
    } = options;

    const enabledOptionsSet = new Set(enabledOptions);
    const disabledOptionsSet = new Set(disabledOptions);

    // @ts-expect-error Implementing only required members for test purposes
    return {
        filterListId,
        getFilterListId: () => filterListId,
        index,
        getIndex: () => index,
        node,
        getNode: () => node,
        pattern,
        getPattern: () => pattern,
        allowlist,
        isAllowlist: () => allowlist,
        hash,
        getHash: () => hash,
        priority,
        getPriority: () => priority,
        isFilteringDisabled: () => isFilteringDisabled,
        isRegexRule: () => isRegexRule,
        isOptionEnabled: (option: NetworkRuleOption) => enabledOptionsSet.has(option),
        isOptionDisabled: (option: NetworkRuleOption) => disabledOptionsSet.has(option),
        getPermittedDomains: () => permittedDomains,
        getRestrictedDomains: () => restrictedDomains,
        getPermittedToDomains: () => permittedToDomains,
        getRestrictedToDomains: () => restrictedToDomains,
        getDenyAllowDomains: () => denyAllowDomains,
        getPermittedResourceTypes: () => permittedResourceTypes,
        getRestrictedResourceTypes: () => restrictedResourceTypes,
        getPermittedMethods: () => permittedMethods,
        getRestrictedMethods: () => restrictedMethods,
        getAdvancedModifierValue: () => advancedModifierValue,
        getApplicableHeaderName: (isRequestHeader: boolean) => (
            isRequestHeader
                ? requestHeaderNameToRemove
                : responseHeaderNameToRemove
        ),
        getRuleTextHash,
    };
}
