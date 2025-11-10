import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { CSP_HEADER_NAME, PERMISSIONS_POLICY_HEADER_NAME } from '../../../src/constants';
import {
    type DeclarativeRule,
    DomainType,
    HeaderOperation,
    type ModifyHeaderInfo,
    RequestMethod,
    ResourceType,
    RuleActionType,
} from '../../../src/declarative-rule';
import {
    EmptyDomainsError,
    EmptyResourcesError,
    UnsupportedModifierError,
    UnsupportedRegexpError,
} from '../../../src/errors/conversion-errors';
import { ResourcesPathError } from '../../../src/errors/converter-options-errors';
import { type NetworkRule, NetworkRuleOption } from '../../../src/network-rule';
import { re2Validator } from '../../../src/re2-regexp/re2-validator';
import { type ConvertedRules } from '../../../src/rule-converters';
import { RuleConverter } from '../../../src/rule-converters/rule-converter';
import { createNetworkRuleMock } from '../../mocks/network-rule';

vi.mock('@adguard/scriptlets/redirects', () => ({
    getRedirectFilename: vi.fn((value) => `wrapped(${value})`),
}));

vi.mock('../../../src/utils/string', async () => ({
    ...await vi.importActual('../../../src/utils/string'),
    removeSlashes: (str: string) => `removedSlashes(${str})`,
    prepareASCII: (str: string) => `asciiPrepared(${str})`,
}));

/**
 * Test converter class used to test methods,
 * this is needed because we can't create directly
 * an instance of abstract class.
 */
class TestConverter extends RuleConverter {
    /**
     * Just a stub method to satisfy abstract class requirements.
     *
     * @param filterListId Filter list ID.
     * @param rules List of {@link NetworkRule}.
     * @param usedIds Set with already used IDs to exclude duplications in IDs.
     *
     * @throws Method not implemented error.
     */
    // eslint-disable-next-line class-methods-use-this
    public convert(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        filterListId: number,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        rules: NetworkRule[],
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        usedIds: Set<number>,
    ): Promise<ConvertedRules> {
        throw new Error('Method not implemented.');
    }
}

describe('RuleConverter', () => {
    const webAccessibleResourcesPath = '/war';
    let converter: TestConverter;
    beforeEach(() => {
        converter = new TestConverter(webAccessibleResourcesPath);
    });

    describe('catchConversionError', () => {
        const index = 1;
        const id = 1;
        const expectedMessage = `Non-categorized error during a conversion rule (index - ${index}, id - ${id})`;

        it('should return conversion error as-is', () => {
            const conversionError = new UnsupportedModifierError('Test unsupported modifier error', {} as NetworkRule);
            // @ts-expect-error Accessing private member for test purposes
            const error = RuleConverter.catchConversionError(index, id, conversionError);

            expect(error).toEqual(conversionError);
        });

        it('should wrap other error types into plain Error', () => {
            // @ts-expect-error Accessing private member for test purposes
            const error = RuleConverter.catchConversionError(index, id, 'Test error');

            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe(expectedMessage);
        });

        it('should include error as cause if provided error is instance of Error', () => {
            const originalError = new Error('Original error');
            // @ts-expect-error Accessing private member for test purposes
            const error = RuleConverter.catchConversionError(index, id, originalError);

            expect(error).toBeInstanceOf(Error);
            expect(error.message).toBe(expectedMessage);
            expect(error.cause).toEqual(originalError);
        });
    });

    describe('generateId', () => {
        it('should generate unique ID', () => {
            const usedIds = new Set<number>();
            const networkRule = createNetworkRuleMock({
                getRuleTextHash(salt) {
                    return salt ?? 1;
                },
            });

            // @ts-expect-error Accessing private member for test purposes
            const id1 = RuleConverter.generateId(networkRule, usedIds);
            expect(id1).toBe(1);
            expect(usedIds.has(id1)).toBe(true);
            expect(usedIds.size).toBe(1);

            // @ts-expect-error Accessing private member for test purposes
            const id2 = RuleConverter.generateId(networkRule, usedIds);
            expect(id2).not.toBe(id1);
            expect(id2).toBe(2);
            expect(usedIds.has(id2)).toBe(true);
            expect(usedIds.size).toBe(2);

            // @ts-expect-error Accessing private member for test purposes
            const id3 = RuleConverter.generateId(networkRule, usedIds);
            expect(id3).not.toBe(id1);
            expect(id3).not.toBe(id2);
            expect(id3).toBe(3);
            expect(usedIds.has(id3)).toBe(true);
            expect(usedIds.size).toBe(3);
        });
    });

    describe('isCompatibleWithAllowAllRequests', () => {
        it('returns true if rule contains only main_frame and/or sub_frame resource types', () => {
            const networkRule1 = createNetworkRuleMock({
                permittedResourceTypes: [ResourceType.MainFrame, ResourceType.SubFrame],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result1 = RuleConverter.isCompatibleWithAllowAllRequests(networkRule1);
            expect(result1).toBe(true);

            const networkRule2 = createNetworkRuleMock({
                permittedResourceTypes: [ResourceType.MainFrame],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result2 = RuleConverter.isCompatibleWithAllowAllRequests(networkRule2);
            expect(result2).toBe(true);

            const networkRule3 = createNetworkRuleMock({
                permittedResourceTypes: [ResourceType.SubFrame],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result3 = RuleConverter.isCompatibleWithAllowAllRequests(networkRule3);
            expect(result3).toBe(true);
        });

        it('returns false if rule contains other resource types', () => {
            const networkRule1 = createNetworkRuleMock({
                permittedResourceTypes: [ResourceType.Script],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result1 = RuleConverter.isCompatibleWithAllowAllRequests(networkRule1);
            expect(result1).toBe(false);

            const networkRule2 = createNetworkRuleMock({
                permittedResourceTypes: [ResourceType.MainFrame, ResourceType.Script],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result2 = RuleConverter.isCompatibleWithAllowAllRequests(networkRule2);
            expect(result2).toBe(false);

            const networkRule3 = createNetworkRuleMock({
                permittedResourceTypes: [ResourceType.SubFrame, ResourceType.Script],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result3 = RuleConverter.isCompatibleWithAllowAllRequests(networkRule3);
            expect(result3).toBe(false);

            const networkRule4 = createNetworkRuleMock({
                permittedResourceTypes: [ResourceType.MainFrame, ResourceType.SubFrame, ResourceType.Script],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result4 = RuleConverter.isCompatibleWithAllowAllRequests(networkRule4);
            expect(result4).toBe(false);
        });

        it('returns true if rule has no permitted resource types defined', () => {
            const networkRule3 = createNetworkRuleMock({
                permittedResourceTypes: [],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result3 = RuleConverter.isCompatibleWithAllowAllRequests(networkRule3);
            expect(result3).toBe(true);
        });
    });

    describe('checkRuleApplication', () => {
        it('returns EmptyResourcesError if resource types are empty', async () => {
            const networkRule = createNetworkRuleMock();
            const declarativeRule: DeclarativeRule = {
                id: 2,
                condition: { resourceTypes: [] },
                action: { type: RuleActionType.Block },
            };
            // @ts-expect-error Accessing private member for test purposes
            const result = await RuleConverter.checkRuleApplication(networkRule, declarativeRule);
            expect(result).toBeInstanceOf(EmptyResourcesError);
        });

        it('returns EmptyDomainsError if permitted domains exists and initiator domains are empty', async () => {
            const networkRule1 = createNetworkRuleMock({
                permittedDomains: ['example.com'],
            });
            const declarativeRule1: DeclarativeRule = {
                id: 1,
                condition: {},
                action: { type: RuleActionType.Block },
            };
            // @ts-expect-error Accessing private member for test purposes
            const result1 = await RuleConverter.checkRuleApplication(networkRule1, declarativeRule1);
            expect(result1).toBeInstanceOf(EmptyDomainsError);

            const networkRule2 = createNetworkRuleMock({
                permittedDomains: ['example.com'],
            });
            const declarativeRule2: DeclarativeRule = {
                id: 1,
                condition: { initiatorDomains: [] },
                action: { type: RuleActionType.Block },
            };
            // @ts-expect-error Accessing private member for test purposes
            const result2 = await RuleConverter.checkRuleApplication(networkRule2, declarativeRule2);
            expect(result2).toBeInstanceOf(EmptyDomainsError);
        });

        it('returns UnsupportedRegexpError if regex is unsupported', async () => {
            vi.spyOn(re2Validator, 'isRegexSupported').mockImplementationOnce(async () => {
                throw new Error('Unsupported regexp');
            });

            const networkRule = createNetworkRuleMock();
            const declarativeRule: DeclarativeRule = {
                id: 1,
                condition: { regexFilter: '/some-regex/' },
                action: { type: RuleActionType.Block },
            };
            // @ts-expect-error Accessing private member for test purposes
            const result = await RuleConverter.checkRuleApplication(networkRule, declarativeRule);
            expect(result).toBeInstanceOf(UnsupportedRegexpError);
        });

        it('returns null if no issues found', async () => {
            vi.spyOn(re2Validator, 'isRegexSupported').mockResolvedValueOnce(true);

            const networkRule = createNetworkRuleMock({
                permittedDomains: ['example.com'],
            });
            const declarativeRule: DeclarativeRule = {
                id: 1,
                condition: {
                    resourceTypes: [ResourceType.Script],
                    regexFilter: '/some-regex/',
                    initiatorDomains: ['example.com'],
                },
                action: { type: RuleActionType.Block },
            };
            // @ts-expect-error Accessing private member for test purposes
            const result = await RuleConverter.checkRuleApplication(networkRule, declarativeRule);
            expect(result).toBeNull();
        });
    });

    describe('getAction', () => {
        it('returns AllowAllRequests action if compatible', () => {
            const networkRule = createNetworkRuleMock({
                allowlist: true,
                isFilteringDisabled: true,
                permittedResourceTypes: [ResourceType.MainFrame, ResourceType.SubFrame],
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = converter.getAction(networkRule);
            expect(action).toEqual({ type: RuleActionType.AllowAllRequests });
        });

        it('returns Allow action if rule is allowlisted', () => {
            const networkRule = createNetworkRuleMock({
                allowlist: true,
                isFilteringDisabled: false,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = converter.getAction(networkRule);
            expect(action).toEqual({ type: RuleActionType.Allow });
        });

        it('uses getRedirectAction if Redirect option is enabled', () => {
            // @ts-expect-error Accessing private member for test purposes
            const getRedirectActionSpy = vi.spyOn(converter, 'getRedirectAction').mockReturnValueOnce({});
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Redirect],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getRedirectActionSpy).toHaveBeenCalledTimes(1);
            expect(getRedirectActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({
                type: RuleActionType.Redirect,
                redirect: {},
            });
        });

        it('returns Block action if Redirect option is enabled but couldn\'t generate action', () => {
            // @ts-expect-error Accessing private member for test purposes
            const getRedirectActionSpy = vi.spyOn(converter, 'getRedirectAction').mockReturnValueOnce(null);
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Redirect],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getRedirectActionSpy).toHaveBeenCalledTimes(1);
            expect(getRedirectActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({ type: RuleActionType.Block });
        });

        it('uses getRemoveParamRedirectAction if RemoveParam option is enabled', () => {
            const getRemoveParamRedirectActionSpy = vi
                // @ts-expect-error Accessing private member for test purposes
                .spyOn(RuleConverter, 'getRemoveParamRedirectAction')
                .mockReturnValueOnce({} as any);
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveParam],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledTimes(1);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({
                type: RuleActionType.Redirect,
                redirect: {},
            });
        });

        it('returns Block action if RemoveParam option is enabled but couldn\'t generate action', () => {
            const getRemoveParamRedirectActionSpy = vi
                // @ts-expect-error Accessing private member for test purposes
                .spyOn(RuleConverter, 'getRemoveParamRedirectAction')
                .mockReturnValueOnce(null as any);
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveParam],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledTimes(1);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({ type: RuleActionType.Block });
        });

        it('uses getModifyHeadersAction if ModifyHeaders option is enabled', () => {
            // @ts-expect-error Accessing private member for test purposes
            const getRemoveParamRedirectActionSpy = vi.spyOn(RuleConverter, 'getModifyHeadersAction');
            const requestHeaders: ModifyHeaderInfo[] = [{
                header: 'Test-Request-Header',
                operation: HeaderOperation.Remove,
            }];
            const responseHeaders: ModifyHeaderInfo[] = [{
                header: 'Test-Response-Header',
                operation: HeaderOperation.Remove,
            }];

            // Case 1: Request headers has precedence over response headers
            getRemoveParamRedirectActionSpy.mockReturnValueOnce({
                requestHeaders,
                responseHeaders,
            } as any);
            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveHeader],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result1 = converter.getAction(networkRule1);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledTimes(1);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledWith(networkRule1);
            expect(result1).toEqual({
                type: RuleActionType.ModifyHeaders,
                requestHeaders,
            });

            // Case 2: Only response headers are present
            getRemoveParamRedirectActionSpy.mockReturnValueOnce({
                responseHeaders,
            } as any);
            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveHeader],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result2 = converter.getAction(networkRule2);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledTimes(2);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledWith(networkRule2);
            expect(result2).toEqual({
                type: RuleActionType.ModifyHeaders,
                responseHeaders,
            });
        });

        it('returns Block action if ModifyHeaders option is enabled but couldn\'t generate action', () => {
            const getRemoveParamRedirectActionSpy = vi
                // @ts-expect-error Accessing private member for test purposes
                .spyOn(RuleConverter, 'getModifyHeadersAction')
                .mockReturnValueOnce(null as any);
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveHeader],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledTimes(1);
            expect(getRemoveParamRedirectActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({ type: RuleActionType.Block });
        });

        it('uses getAddingCspHeadersAction if Csp option is enabled', () => {
            const getAddingCspHeadersActionSpy = vi
                // @ts-expect-error Accessing private member for test purposes
                .spyOn(RuleConverter, 'getAddingCspHeadersAction')
                .mockReturnValueOnce({} as any);
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Csp],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getAddingCspHeadersActionSpy).toHaveBeenCalledTimes(1);
            expect(getAddingCspHeadersActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({
                type: RuleActionType.ModifyHeaders,
                responseHeaders: [{}],
            });
        });

        it('returns Block action if Csp option is enabled but couldn\'t generate action', () => {
            const getAddingCspHeadersActionSpy = vi
                // @ts-expect-error Accessing private member for test purposes
                .spyOn(RuleConverter, 'getAddingCspHeadersAction')
                .mockReturnValueOnce(null as any);
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Csp],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getAddingCspHeadersActionSpy).toHaveBeenCalledTimes(1);
            expect(getAddingCspHeadersActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({ type: RuleActionType.Block });
        });

        it('uses getAddingPermissionsHeadersAction if Permissions option is enabled', () => {
            const getAddingPermissionsHeadersActionSpy = vi
                // @ts-expect-error Accessing private member for test purposes
                .spyOn(RuleConverter, 'getAddingPermissionsHeadersAction')
                .mockReturnValueOnce({} as any);
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Permissions],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getAddingPermissionsHeadersActionSpy).toHaveBeenCalledTimes(1);
            expect(getAddingPermissionsHeadersActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({
                type: RuleActionType.ModifyHeaders,
                responseHeaders: [{}],
            });
        });

        it('returns Block action if Permissions option is enabled but couldn\'t generate action', () => {
            const getAddingPermissionsHeadersActionSpy = vi
                // @ts-expect-error Accessing private member for test purposes
                .spyOn(RuleConverter, 'getAddingPermissionsHeadersAction')
                .mockReturnValueOnce(null as any);
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Permissions],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getAddingPermissionsHeadersActionSpy).toHaveBeenCalledTimes(1);
            expect(getAddingPermissionsHeadersActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({ type: RuleActionType.Block });
        });

        it('uses getRemovingCookieHeadersAction if Cookie option is enabled', () => {
            // @ts-expect-error Accessing private member for test purposes
            const getRemovingCookieHeadersActionSpy = vi.spyOn(RuleConverter, 'getRemovingCookieHeadersAction');
            const requestHeaders: ModifyHeaderInfo[] = [{
                header: 'Test-Request-Header',
                operation: HeaderOperation.Remove,
            }];
            const responseHeaders: ModifyHeaderInfo[] = [{
                header: 'Test-Response-Header',
                operation: HeaderOperation.Remove,
            }];

            // Case 1: Both headers provided
            getRemovingCookieHeadersActionSpy.mockReturnValueOnce({
                requestHeaders,
                responseHeaders,
            } as any);
            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Cookie],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result1 = converter.getAction(networkRule1);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledTimes(1);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledWith(networkRule1);
            expect(result1).toEqual({
                type: RuleActionType.ModifyHeaders,
                requestHeaders,
                responseHeaders,
            });

            // Case 2: Only request headers provided
            getRemovingCookieHeadersActionSpy.mockReturnValueOnce({
                requestHeaders,
            } as any);
            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Cookie],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result2 = converter.getAction(networkRule2);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledTimes(2);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledWith(networkRule2);
            expect(result2).toEqual({
                type: RuleActionType.ModifyHeaders,
                requestHeaders,
            });

            // Case 3: Only response headers provided
            getRemovingCookieHeadersActionSpy.mockReturnValueOnce({
                responseHeaders,
            } as any);
            const networkRule3 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Cookie],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result3 = converter.getAction(networkRule3);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledTimes(3);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledWith(networkRule3);
            expect(result3).toEqual({
                type: RuleActionType.ModifyHeaders,
                responseHeaders,
            });

            // Case 4: None of the headers provided
            getRemovingCookieHeadersActionSpy.mockReturnValueOnce({} as any);
            const networkRule4 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Cookie],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result4 = converter.getAction(networkRule4);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledTimes(4);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledWith(networkRule4);
            expect(result4).toEqual({ type: RuleActionType.ModifyHeaders });
        });

        it('returns Block action if Cookie option is enabled but couldn\'t generate action', () => {
            const getRemovingCookieHeadersActionSpy = vi
                // @ts-expect-error Accessing private member for test purposes
                .spyOn(RuleConverter, 'getRemovingCookieHeadersAction')
                .mockReturnValueOnce(null as any);

            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Cookie],
            });
            // @ts-expect-error Accessing private member for test purposes
            const result = converter.getAction(networkRule);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledTimes(1);
            expect(getRemovingCookieHeadersActionSpy).toHaveBeenCalledWith(networkRule);
            expect(result).toEqual({ type: RuleActionType.Block });
        });

        it('returns Block action by default', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const action = converter.getAction(networkRule);
            expect(action).toEqual({ type: RuleActionType.Block });
        });
    });

    describe('getRedirectAction', () => {
        it('returns null if option is not enabled', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const action = converter.getRedirectAction(networkRule);
            expect(action).toBeNull();
        });

        it('returns null if advanced modifier value is empty or null', () => {
            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Redirect],
                advancedModifierValue: null,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action1 = converter.getRedirectAction(networkRule1);
            expect(action1).toBeNull();

            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Redirect],
                advancedModifierValue: '',
            });
            // @ts-expect-error Accessing private member for test purposes
            const action2 = converter.getRedirectAction(networkRule2);
            expect(action2).toBeNull();
        });

        it('throws ResourcesPathError if web accessible resources path is empty', () => {
            const converterWithoutWar = new TestConverter();
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Redirect],
                advancedModifierValue: 'redirect-file.html',
            });
            expect(() => {
                // @ts-expect-error Accessing private member for test purposes
                converterWithoutWar.getRedirectAction(networkRule);
            }).toThrow(ResourcesPathError);
        });

        it('correctly generates redirect action', () => {
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Redirect],
                advancedModifierValue: 'redirect-file.html',
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = converter.getRedirectAction(networkRule);
            expect(action).toEqual({
                extensionPath: `${webAccessibleResourcesPath}/wrapped(redirect-file.html)`,
            });
        });
    });

    describe('getRemoveParamRedirectAction', () => {
        it('returns null if option is not enabled', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getRemoveParamRedirectAction(networkRule);
            expect(action).toBeNull();
        });

        it('returns null if advanced modifier value is null', () => {
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveParam],
                advancedModifierValue: null,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getRemoveParamRedirectAction(networkRule);
            expect(action).toBeNull();
        });

        it('returns correct query removal if advanced modifier value is empty', () => {
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveParam],
                advancedModifierValue: '',
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getRemoveParamRedirectAction(networkRule);
            expect(action).toEqual({
                transform: {
                    query: '',
                },
            });
        });

        it('returns correct query removal if advanced modifier value is provided', () => {
            // Case 1: Decoding URI component is not needed
            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveParam],
                advancedModifierValue: 'param',
            });
            // @ts-expect-error Accessing private member for test purposes
            const action1 = RuleConverter.getRemoveParamRedirectAction(networkRule1);
            expect(action1).toEqual({
                transform: {
                    queryTransform: {
                        removeParams: ['param'],
                    },
                },
            });

            // Case 1: Decoding URI component is not needed
            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveParam],
                advancedModifierValue: 'param$@',
            });
            // @ts-expect-error Accessing private member for test purposes
            const action2 = RuleConverter.getRemoveParamRedirectAction(networkRule2);
            expect(action2).toEqual({
                transform: {
                    queryTransform: {
                        removeParams: [decodeURIComponent('param$@')],
                    },
                },
            });
        });
    });

    describe('getModifyHeadersAction', () => {
        it('returns null if option is not enabled', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getModifyHeadersAction(networkRule);
            expect(action).toBeNull();
        });

        it('returns request headers if both (response and request) or only (request) headers provided', () => {
            const requestHeaderNameToRemove = 'Test-Request-Header';
            const responseHeaderNameToRemove = 'Test-Response-Header';
            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveHeader],
                requestHeaderNameToRemove,
                responseHeaderNameToRemove,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action1 = RuleConverter.getModifyHeadersAction(networkRule1);
            expect(action1).toEqual({
                requestHeaders: [{
                    header: requestHeaderNameToRemove,
                    operation: HeaderOperation.Remove,
                }],
            });

            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveHeader],
                requestHeaderNameToRemove,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action2 = RuleConverter.getModifyHeadersAction(networkRule2);
            expect(action2).toEqual({
                requestHeaders: [{
                    header: requestHeaderNameToRemove,
                    operation: HeaderOperation.Remove,
                }],
            });
        });

        it('returns response headers if only response headers provided', () => {
            const responseHeaderNameToRemove = 'Test-Response-Header';
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveHeader],
                responseHeaderNameToRemove,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getModifyHeadersAction(networkRule);
            expect(action).toEqual({
                responseHeaders: [{
                    header: responseHeaderNameToRemove,
                    operation: HeaderOperation.Remove,
                }],
            });
        });

        it('returns null if neither request nor response headers provided', () => {
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveHeader],
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getModifyHeadersAction(networkRule);
            expect(action).toBeNull();
        });
    });

    describe('getRemovingCookieHeadersAction', () => {
        it('returns null if option is not enabled', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getRemovingCookieHeadersAction(networkRule);
            expect(action).toBeNull();
        });

        it('returns correct headers to remove cookies', () => {
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Cookie],
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getRemovingCookieHeadersAction(networkRule);
            expect(action).toEqual({
                requestHeaders: [{
                    header: 'Cookie',
                    operation: HeaderOperation.Remove,
                }],
                responseHeaders: [{
                    header: 'Set-Cookie',
                    operation: HeaderOperation.Remove,
                }],
            });
        });
    });

    describe('getAddingCspHeadersAction', () => {
        it('returns null if option is not enabled', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getAddingCspHeadersAction(networkRule);
            expect(action).toBeNull();
        });

        it('returns null if advanced modifier value is empty or null', () => {
            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Csp],
                advancedModifierValue: null,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action1 = RuleConverter.getAddingCspHeadersAction(networkRule1);
            expect(action1).toBeNull();

            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Csp],
                advancedModifierValue: '',
            });
            // @ts-expect-error Accessing private member for test purposes
            const action2 = RuleConverter.getAddingCspHeadersAction(networkRule2);
            expect(action2).toBeNull();
        });

        it('returns correct header to add CSP', () => {
            const testCspValue = "default-src 'self'";
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Csp],
                advancedModifierValue: testCspValue,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getAddingCspHeadersAction(networkRule);
            expect(action).toEqual({
                operation: HeaderOperation.Append,
                header: CSP_HEADER_NAME,
                value: testCspValue,
            });
        });
    });

    describe('getAddingPermissionsHeadersAction', () => {
        it('returns null if option is not enabled', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getAddingPermissionsHeadersAction(networkRule);
            expect(action).toBeNull();
        });

        it('returns null if advanced modifier value is empty or null', () => {
            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Permissions],
                advancedModifierValue: null,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action1 = RuleConverter.getAddingPermissionsHeadersAction(networkRule1);
            expect(action1).toBeNull();

            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Permissions],
                advancedModifierValue: '',
            });
            // @ts-expect-error Accessing private member for test purposes
            const action2 = RuleConverter.getAddingPermissionsHeadersAction(networkRule2);
            expect(action2).toBeNull();
        });

        it('returns correct header to add Permissions Policy', () => {
            const testPermissionsValue = 'geolocation=(self)';
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Permissions],
                advancedModifierValue: testPermissionsValue,
            });
            // @ts-expect-error Accessing private member for test purposes
            const action = RuleConverter.getAddingPermissionsHeadersAction(networkRule);
            expect(action).toEqual({
                header: PERMISSIONS_POLICY_HEADER_NAME,
                operation: HeaderOperation.Append,
                value: testPermissionsValue,
            });
        });
    });

    describe('getCondition', () => {
        it('correctly specifies urlFilter', () => {
            const networkRule = createNetworkRuleMock({
                pattern: 'example.com/path',
                isRegexRule: false,
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.urlFilter).toBe('asciiPrepared(example.com/path)');
        });

        it('removes || from ||* prefix from urlFilter', () => {
            const networkRule = createNetworkRuleMock({
                pattern: '||*example.com/path',
                isRegexRule: false,
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.urlFilter).toBe('asciiPrepared(*example.com/path)');
        });

        it('correctly specifies regexFilter', () => {
            const networkRule = createNetworkRuleMock({
                pattern: '/some-regex-pattern/',
                isRegexRule: true,
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.regexFilter).toBe('asciiPrepared(removedSlashes(/some-regex-pattern/))');
        });

        it('correctly specifies domainType (third-party)', () => {
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.ThirdParty],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.domainType).toBe(DomainType.ThirdParty);
        });

        it('correctly specifies domainType (first-party)', () => {
            const networkRule = createNetworkRuleMock({
                disabledOptions: [NetworkRuleOption.ThirdParty],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.domainType).toBe(DomainType.FirstParty);
        });

        it('should skip initiatorDomains if permitted domains are not specified or empty', () => {
            const networkRule1 = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const condition1 = RuleConverter.getCondition(networkRule1);
            expect(condition1.initiatorDomains).toBeUndefined();

            const networkRule2 = createNetworkRuleMock({
                permittedDomains: [],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition2 = RuleConverter.getCondition(networkRule2);
            expect(condition2.initiatorDomains).toBeUndefined();
        });

        it('correctly specifies initiatorDomains by skipping regex permitted domains', () => {
            const networkRule = createNetworkRuleMock({
                permittedDomains: ['example.com', '/.*\\.example\\.org/'],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.initiatorDomains).toEqual(['example.com']);
        });

        it('should skip excludedInitiatorDomains if restricted domains are not specified or empty', () => {
            const networkRule1 = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const condition1 = RuleConverter.getCondition(networkRule1);
            expect(condition1.excludedInitiatorDomains).toBeUndefined();

            const networkRule2 = createNetworkRuleMock({
                restrictedDomains: [],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition2 = RuleConverter.getCondition(networkRule2);
            expect(condition2.excludedInitiatorDomains).toBeUndefined();
        });

        it('correctly specifies excludedInitiatorDomains', () => {
            const networkRule = createNetworkRuleMock({
                restrictedDomains: ['example.com'],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.excludedInitiatorDomains).toEqual(['example.com']);
        });

        it('should skip requestDomains if permitted to domains are not specified or empty', () => {
            const networkRule1 = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const condition1 = RuleConverter.getCondition(networkRule1);
            expect(condition1.requestDomains).toBeUndefined();

            const networkRule2 = createNetworkRuleMock({
                permittedToDomains: [],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition2 = RuleConverter.getCondition(networkRule2);
            expect(condition2.requestDomains).toBeUndefined();
        });

        it('correctly specifies requestDomains', () => {
            const networkRule = createNetworkRuleMock({
                permittedToDomains: ['example.com'],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.requestDomains).toEqual(['example.com']);
        });

        it('correctly specifies excludedRequestDomains if both (deny allow and restricted to) or only provided', () => {
            const networkRule1 = createNetworkRuleMock({
                denyAllowDomains: ['example1.com'],
                restrictedToDomains: ['example2.com'],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition1 = RuleConverter.getCondition(networkRule1);
            expect(condition1.excludedRequestDomains).toEqual(['example1.com']);

            const networkRule2 = createNetworkRuleMock({
                denyAllowDomains: ['example1.com'],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition2 = RuleConverter.getCondition(networkRule2);
            expect(condition2.excludedRequestDomains).toEqual(['example1.com']);
        });

        it('correctly specifies excludedRequestDomains if only restricted domains are specified', () => {
            const networkRule = createNetworkRuleMock({
                restrictedToDomains: ['example.com'],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.excludedRequestDomains).toEqual(['example.com']);
        });

        it('should skip excludedResourceTypes if restricted resource types are empty', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.excludedResourceTypes).toBeUndefined();
        });

        it('correctly specifies excludedResourceTypes', () => {
            const networkRule = createNetworkRuleMock({
                restrictedResourceTypes: [ResourceType.Font, ResourceType.Image],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.excludedResourceTypes).toEqual([
                ResourceType.Font,
                ResourceType.Image,
                ResourceType.MainFrame,
            ]);
        });

        it('should skip resourceTypes if permitted resource types are empty', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.resourceTypes).toBeUndefined();
        });

        it('should skip resourceTypes if excludedResourceTypes already specified', () => {
            const networkRule = createNetworkRuleMock({
                restrictedResourceTypes: [ResourceType.Media],
                permittedResourceTypes: [ResourceType.Font],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.resourceTypes).toBeUndefined();
        });

        it('correctly specifies resourceTypes', () => {
            const networkRule = createNetworkRuleMock({
                permittedResourceTypes: [ResourceType.Font, ResourceType.Image],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.resourceTypes).toEqual([ResourceType.Font, ResourceType.Image]);
        });

        it('should skip requestMethods if permitted methods are empty', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.requestMethods).toBeUndefined();
        });

        it('correctly specifies requestMethods', () => {
            const networkRule = createNetworkRuleMock({
                permittedMethods: [RequestMethod.Get, RequestMethod.Connect],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.requestMethods).toEqual([RequestMethod.Get, RequestMethod.Connect]);
        });

        it('should skip excludedRequestMethods if restricted methods are empty', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.excludedRequestMethods).toBeUndefined();
        });

        it('correctly specifies excludedRequestMethods', () => {
            const networkRule = createNetworkRuleMock({
                restrictedMethods: [RequestMethod.Get, RequestMethod.Connect],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.excludedRequestMethods).toEqual([RequestMethod.Get, RequestMethod.Connect]);
        });

        it('should skip isUrlFilterCaseSensitive if match case option is not enabled', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.isUrlFilterCaseSensitive).toBeUndefined();
        });

        it('correctly specifies isUrlFilterCaseSensitive', () => {
            const networkRule = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.MatchCase],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.isUrlFilterCaseSensitive).toBe(true);
        });

        it('skips ResourceType.MainFrame in resourceTypes if popup option is not enabled', () => {
            const networkRule = createNetworkRuleMock();
            // @ts-expect-error Accessing private member for test purposes
            const condition = RuleConverter.getCondition(networkRule);
            expect(condition.resourceTypes).toBeUndefined();
        });

        it('correctly specifies ResourceType.MainFrame in resourceTypes if popup option is enabled', () => {
            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Popup],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition1 = RuleConverter.getCondition(networkRule1);
            expect(condition1.resourceTypes).toEqual([ResourceType.MainFrame]);

            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Popup],
                permittedResourceTypes: [ResourceType.Font],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition2 = RuleConverter.getCondition(networkRule2);
            expect(condition2.resourceTypes).toEqual([ResourceType.Font, ResourceType.MainFrame]);
        });

        it('correctly specifies all resourceTypes for different options', () => {
            const allResourceTypes = Object.values(ResourceType);

            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveHeader],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition1 = RuleConverter.getCondition(networkRule1);
            expect(condition1.resourceTypes).toEqual(allResourceTypes);

            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Csp],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition2 = RuleConverter.getCondition(networkRule2);
            expect(condition2.resourceTypes).toEqual(allResourceTypes);

            const networkRule3 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Cookie],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition3 = RuleConverter.getCondition(networkRule3);
            expect(condition3.resourceTypes).toEqual(allResourceTypes);

            const networkRule4 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.To],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition4 = RuleConverter.getCondition(networkRule4);
            expect(condition4.resourceTypes).toEqual(allResourceTypes);

            const networkRule5 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Method],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition5 = RuleConverter.getCondition(networkRule5);
            expect(condition5.resourceTypes).toEqual(allResourceTypes);

            const networkRule6 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Header],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition6 = RuleConverter.getCondition(networkRule6);
            expect(condition6.resourceTypes).toBeUndefined();
        });

        it('correctly specifies document resourceTypes for different options', () => {
            const documentResourceTypes = [ResourceType.MainFrame, ResourceType.SubFrame];

            const networkRule1 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.RemoveParam],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition1 = RuleConverter.getCondition(networkRule1);
            expect(condition1.resourceTypes).toEqual(documentResourceTypes);

            const networkRule2 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Permissions],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition2 = RuleConverter.getCondition(networkRule2);
            expect(condition2.resourceTypes).toEqual(documentResourceTypes);

            const networkRule3 = createNetworkRuleMock({
                enabledOptions: [NetworkRuleOption.Header],
            });
            // @ts-expect-error Accessing private member for test purposes
            const condition3 = RuleConverter.getCondition(networkRule3);
            expect(condition3.resourceTypes).toBeUndefined();
        });
    });

    describe('convertRule', () => {
        const id = 1;
        const priority = 999;
        const networkRule = createNetworkRuleMock({ priority });

        it('should throw an conversion error if it\'s not applicable', async () => {
            const regexNetworkRule = createNetworkRuleMock({
                priority,
                pattern: '/regex-pattern/',
                isRegexRule: true,
            });
            vi.spyOn(re2Validator, 'isRegexSupported').mockImplementationOnce(async () => {
                throw new Error('Unsupported regexp');
            });
            await expect(async () => {
                // @ts-expect-error Accessing private member for test purposes
                await converter.convertRule(id, regexNetworkRule);
            }).rejects.toThrowError(UnsupportedRegexpError);
        });

        it('correctly converts rule', async () => {
            // @ts-expect-error Accessing private member for test purposes
            const result = await converter.convertRule(id, networkRule);
            expect(result).toEqual({
                id,
                priority,
                action: { type: RuleActionType.Block },
                condition: {},
            });
        });
    });

    describe('convertRules', () => {
        it('should return empty result for empty rules array', async () => {
            const filterListId = 1;
            const rules: NetworkRule[] = [];
            const usedIds = new Set<number>();

            // @ts-expect-error Accessing protected member for test purposes
            const result = await converter.convertRules(filterListId, rules, usedIds);

            expect(result).toEqual({
                declarativeRules: [],
                errors: [],
                sourceMapValues: [],
            });
        });

        it('should successfully convert multiple valid rules', async () => {
            const filterListId = 1;
            const rule1 = createNetworkRuleMock({
                index: 0,
                getRuleTextHash: (salt?: number) => (salt ? 100 + salt : 100),
            });
            const rule2 = createNetworkRuleMock({
                index: 1,
                getRuleTextHash: (salt?: number) => (salt ? 200 + salt : 200),
            });
            const rules = [rule1, rule2];
            const usedIds = new Set<number>();

            // Mock convertRule to return valid declarative rules
            const mockDeclarativeRule1: DeclarativeRule = {
                id: 100,
                action: { type: RuleActionType.Block },
                condition: {},
                priority: 1,
            };
            const mockDeclarativeRule2: DeclarativeRule = {
                id: 200,
                action: { type: RuleActionType.Block },
                condition: {},
                priority: 1,
            };

            // @ts-expect-error Accessing protected member for test purposes
            const convertRuleSpy = vi.spyOn(converter, 'convertRule')
                .mockResolvedValueOnce(mockDeclarativeRule1 as never)
                .mockResolvedValueOnce(mockDeclarativeRule2 as never);

            // @ts-expect-error Accessing protected member for test purposes
            const result = await converter.convertRules(filterListId, rules, usedIds);

            expect(convertRuleSpy).toHaveBeenCalledTimes(2);
            expect(convertRuleSpy).toHaveBeenCalledWith(100, rule1);
            expect(convertRuleSpy).toHaveBeenCalledWith(200, rule2);
            expect(result).toEqual({
                declarativeRules: [mockDeclarativeRule1, mockDeclarativeRule2],
                sourceMapValues: [

                    {
                        declarativeRuleId: 100,
                        sourceRuleIndex: 0,
                        filterId: filterListId,
                    },
                    {
                        declarativeRuleId: 200,
                        sourceRuleIndex: 1,
                        filterId: filterListId,
                    },
                ],
                errors: [],
            });
            expect(usedIds.has(100)).toBe(true);
            expect(usedIds.has(200)).toBe(true);
        });

        it('should handle conversion errors and continue processing other rules', async () => {
            const filterListId = 1;
            const rule1 = createNetworkRuleMock({
                index: 0,
                getRuleTextHash: (salt?: number) => (salt ? 100 + salt : 100),
            });
            const rule2 = createNetworkRuleMock({
                index: 1,
                getRuleTextHash: (salt?: number) => (salt ? 200 + salt : 200),
            });
            const rule3 = createNetworkRuleMock({
                index: 2,
                getRuleTextHash: (salt?: number) => (salt ? 300 + salt : 300),
            });
            const rules = [rule1, rule2, rule3];
            const usedIds = new Set<number>();

            const mockDeclarativeRule1: DeclarativeRule = {
                id: 100,
                action: { type: RuleActionType.Block },
                condition: {},
                priority: 1,
            };
            const mockDeclarativeRule3: DeclarativeRule = {
                id: 300,
                action: { type: RuleActionType.Block },
                condition: {},
                priority: 1,
            };

            const conversionError = new UnsupportedModifierError('Test error', rule2);

            // @ts-expect-error Accessing protected member for test purposes
            const convertRuleSpy = vi.spyOn(converter, 'convertRule')
                .mockResolvedValueOnce(mockDeclarativeRule1 as never)
                .mockRejectedValueOnce(conversionError as never)
                .mockResolvedValueOnce(mockDeclarativeRule3 as never);

            // @ts-expect-error Accessing protected member for test purposes
            const result = await converter.convertRules(filterListId, rules, usedIds);

            expect(convertRuleSpy).toHaveBeenCalledTimes(3);
            expect(result).toEqual({
                declarativeRules: [mockDeclarativeRule1, mockDeclarativeRule3],
                sourceMapValues: [
                    {
                        declarativeRuleId: 100,
                        filterId: filterListId,
                        sourceRuleIndex: 0,
                    },
                    {
                        declarativeRuleId: 300,
                        filterId: filterListId,
                        sourceRuleIndex: 2,
                    },
                ],
                errors: [conversionError],
            });
        });

        it('should handle non-conversion errors and wrap them', async () => {
            const filterListId = 1;
            const rule1 = createNetworkRuleMock({
                index: 0,
                getRuleTextHash: (salt?: number) => (salt ? 100 + salt : 100),
            });
            const rules = [rule1];
            const usedIds = new Set<number>();

            const genericError = new Error('Generic error');

            // @ts-expect-error Accessing protected member for test purposes
            const convertRuleSpy = vi.spyOn(converter, 'convertRule')
                .mockRejectedValueOnce(genericError);

            // @ts-expect-error Accessing protected member for test purposes
            const result = await converter.convertRules(filterListId, rules, usedIds);

            expect(convertRuleSpy).toHaveBeenCalledTimes(1);

            expect(result.declarativeRules).toHaveLength(0);
            expect(result.sourceMapValues).toHaveLength(0);
            expect(result.errors).toHaveLength(1);

            const wrappedError = result.errors[0];
            expect(wrappedError).toBeInstanceOf(Error);
            expect(wrappedError.message).toBe('Non-categorized error during a conversion rule (index - 0, id - 100)');
            expect(wrappedError.cause).toBe(genericError);
        });

        it('should generate unique IDs when hash collisions occur', async () => {
            const filterListId = 1;
            const rule1 = createNetworkRuleMock({
                index: 0,
                getRuleTextHash: (salt?: number) => (salt ? 100 + salt : 100),
            });
            const rule2 = createNetworkRuleMock({
                index: 1,
                getRuleTextHash: (salt?: number) => (salt ? 100 + salt : 100), // Same hash as rule1
            });
            const rules = [rule1, rule2];
            const usedIds = new Set<number>();

            const mockDeclarativeRule1: DeclarativeRule = {
                id: 100,
                action: { type: RuleActionType.Block },
                condition: {},
                priority: 1,
            };
            const mockDeclarativeRule2: DeclarativeRule = {
                id: 101, // Should be 100 + 1 due to collision
                action: { type: RuleActionType.Block },
                condition: {},
                priority: 1,
            };

            // @ts-expect-error Accessing protected member for test purposes
            const convertRuleSpy = vi.spyOn(converter, 'convertRule')
                .mockResolvedValueOnce(mockDeclarativeRule1 as never)
                .mockResolvedValueOnce(mockDeclarativeRule2 as never);

            // @ts-expect-error Accessing protected member for test purposes
            const result = await converter.convertRules(filterListId, rules, usedIds);

            expect(convertRuleSpy).toHaveBeenCalledWith(100, rule1);
            expect(convertRuleSpy).toHaveBeenCalledWith(101, rule2);

            expect(result.declarativeRules).toHaveLength(2);
            expect(result.sourceMapValues).toHaveLength(2);
            expect(result.errors).toHaveLength(0);

            expect(usedIds.has(100)).toBe(true);
            expect(usedIds.has(101)).toBe(true);
        });

        it('should preserve existing used IDs and avoid collisions', async () => {
            const filterListId = 1;
            const rule1 = createNetworkRuleMock({
                index: 0,
                getRuleTextHash: (salt?: number) => (salt ? 100 + salt : 100),
            });
            const rules = [rule1];
            const usedIds = new Set<number>([100, 101, 102]); // Pre-populate with used IDs

            const mockDeclarativeRule1: DeclarativeRule = {
                id: 103, // Should be 100 + 3 due to collisions with existing IDs
                action: { type: RuleActionType.Block },
                condition: {},
                priority: 1,
            };

            // @ts-expect-error Accessing protected member for test purposes
            const convertRuleSpy = vi.spyOn(converter, 'convertRule')
                .mockResolvedValueOnce(mockDeclarativeRule1 as never);

            // @ts-expect-error Accessing protected member for test purposes
            const result = await converter.convertRules(filterListId, rules, usedIds);

            expect(convertRuleSpy).toHaveBeenCalledWith(103, rule1);
            expect(result.declarativeRules).toHaveLength(1);
            expect(result.sourceMapValues).toHaveLength(1);
            expect(result.errors).toHaveLength(0);

            expect(usedIds.has(103)).toBe(true);
            expect(usedIds.size).toBe(4); // Original 3 + new 1
        });

        it('should handle mixed success and error scenarios correctly', async () => {
            const filterListId = 42;
            const rule1 = createNetworkRuleMock({
                index: 10,
                getRuleTextHash: (salt?: number) => (salt ? 1000 + salt : 1000),
            });
            const rule2 = createNetworkRuleMock({
                index: 11,
                getRuleTextHash: (salt?: number) => (salt ? 2000 + salt : 2000),
            });
            const rule3 = createNetworkRuleMock({
                index: 12,
                getRuleTextHash: (salt?: number) => (salt ? 3000 + salt : 3000),
            });
            const rules = [rule1, rule2, rule3];
            const usedIds = new Set<number>();

            const mockDeclarativeRule1: DeclarativeRule = {
                id: 1000,
                action: { type: RuleActionType.Allow },
                condition: { urlFilter: 'example.com' },
                priority: 2,
            };
            const mockDeclarativeRule4: DeclarativeRule = {
                id: 4000,
                action: { type: RuleActionType.Block },
                condition: { regexFilter: '.*\\.ads\\.' },
                priority: 1,
            };

            const emptyResourcesError = new EmptyResourcesError('Empty resources', rule2, {} as DeclarativeRule);

            // @ts-expect-error Accessing protected member for test purposes
            const convertRuleSpy = vi.spyOn(converter, 'convertRule')
                .mockResolvedValueOnce(mockDeclarativeRule1 as never) // rule1: success
                .mockRejectedValueOnce(emptyResourcesError) // rule2: error
                .mockResolvedValueOnce(mockDeclarativeRule4 as never); // rule4: success

            // @ts-expect-error Accessing protected member for test purposes
            const result = await converter.convertRules(filterListId, rules, usedIds);

            expect(convertRuleSpy).toHaveBeenCalledTimes(3);

            // Should have 2 successful conversions
            expect(result.declarativeRules).toHaveLength(2);
            expect(result.declarativeRules).toContain(mockDeclarativeRule1);
            expect(result.declarativeRules).toContain(mockDeclarativeRule4);

            // Should have 2 source map entries (for successful conversions only)
            expect(result.sourceMapValues).toHaveLength(2);
            expect(result.sourceMapValues).toContainEqual({
                declarativeRuleId: 1000,
                sourceRuleIndex: 10,
                filterId: 42,
            });
            expect(result.sourceMapValues).toContainEqual({
                declarativeRuleId: 4000,
                sourceRuleIndex: 12,
                filterId: 42,
            });

            // Should have 1 error (from rule2)
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toBe(emptyResourcesError);

            // Should have correct used IDs
            expect(usedIds.has(1000)).toBe(true);
            expect(usedIds.has(2000)).toBe(true); // ID was generated even though conversion failed
            expect(usedIds.has(3000)).toBe(true);
        });
    });

    describe('groupConvertedRules', () => {
        it('should group similar rules using createRuleTemplate and combineRulePair', () => {
            // Mock declarative rules
            const rule1: DeclarativeRule = {
                id: 1,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            const rule2: DeclarativeRule = {
                id: 2,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            const rule3: DeclarativeRule = {
                id: 3,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'different.com' },
            };

            // Mock source mappings
            const sourceMapValues = [
                { declarativeRuleId: 1, sourceRuleIndex: 0, filterId: 1 },
                { declarativeRuleId: 2, sourceRuleIndex: 1, filterId: 1 },
                { declarativeRuleId: 3, sourceRuleIndex: 2, filterId: 1 },
            ];

            const converted: ConvertedRules = {
                declarativeRules: [rule1, rule2, rule3],
                sourceMapValues,
                errors: [],
            };

            // Mock template creation function - rules with same urlFilter get same template
            const createRuleTemplate = vi.fn((rule: DeclarativeRule) => rule.condition?.urlFilter || '');

            // Mock combine function - creates new rule with combined ID
            const combineRulePair = vi.fn((sourceRule: DeclarativeRule, ruleToMerge: DeclarativeRule) => ({
                ...sourceRule,
                id: sourceRule.id + ruleToMerge.id, // Simple combination logic for testing
            }));

            // @ts-expect-error Accessing protected static method for testing purposes
            const result = RuleConverter.groupConvertedRules(converted, createRuleTemplate, combineRulePair);

            // Should have 2 rules: one combined (rule1 + rule2) and one standalone (rule3)
            expect(result.declarativeRules).toHaveLength(2);

            // Should have called createRuleTemplate for each rule
            expect(createRuleTemplate).toHaveBeenCalledTimes(6); // 3 initial + 3 for saving templates

            // Should have called combineRulePair once (rule1 + rule2)
            expect(combineRulePair).toHaveBeenCalledTimes(1);
            expect(combineRulePair).toHaveBeenCalledWith(rule1, rule2);

            // Should preserve errors from original
            expect(result.errors).toEqual([]);

            // Should have 3 source mappings (one for each original rule)
            expect(result.sourceMapValues).toHaveLength(3);
        });

        it('should handle case with no similar rules', () => {
            const rule1: DeclarativeRule = {
                id: 1,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            const rule2: DeclarativeRule = {
                id: 2,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'different.com' },
            };

            const sourceMapValues = [
                { declarativeRuleId: 1, sourceRuleIndex: 0, filterId: 1 },
                { declarativeRuleId: 2, sourceRuleIndex: 1, filterId: 1 },
            ];

            const converted: ConvertedRules = {
                declarativeRules: [rule1, rule2],
                sourceMapValues,
                errors: [],
            };

            const createRuleTemplate = vi.fn((rule: DeclarativeRule) => rule.condition?.urlFilter || '');
            const combineRulePair = vi.fn();

            // @ts-expect-error Accessing protected static method for testing purposes
            const result = RuleConverter.groupConvertedRules(converted, createRuleTemplate, combineRulePair);

            // Should have 2 rules (no grouping occurred)
            expect(result.declarativeRules).toHaveLength(2);

            // Should not have called combineRulePair
            expect(combineRulePair).not.toHaveBeenCalled();

            // Should have 2 source mappings unchanged
            expect(result.sourceMapValues).toHaveLength(2);
            expect(result.sourceMapValues).toEqual(sourceMapValues);
        });

        it('should handle missing source mapping and add error', () => {
            const rule1: DeclarativeRule = {
                id: 1,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            const rule2: DeclarativeRule = {
                id: 2,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            // Missing source mapping for rule2
            const sourceMapValues = [
                { declarativeRuleId: 1, sourceRuleIndex: 0, filterId: 1 },
            ];

            const converted: ConvertedRules = {
                declarativeRules: [rule1, rule2],
                sourceMapValues,
                errors: [],
            };

            const createRuleTemplate = vi.fn((rule: DeclarativeRule) => rule.condition?.urlFilter || '');
            const combineRulePair = vi.fn();

            // @ts-expect-error Accessing protected static method for testing purposes
            const result = RuleConverter.groupConvertedRules(converted, createRuleTemplate, combineRulePair);

            // Should have 1 rule (only rule1 processed successfully)
            expect(result.declarativeRules).toHaveLength(1);

            // Should have 1 error for missing source mapping
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toBeInstanceOf(Error);
            expect(result.errors[0].message).toContain('Cannot find source for converted rule');

            // Should have 1 source mapping (only for rule1)
            expect(result.sourceMapValues).toHaveLength(1);
        });

        it('should preserve existing errors from converted input', () => {
            const rule1: DeclarativeRule = {
                id: 1,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            const existingError = new Error('Existing conversion error');
            const sourceMapValues = [
                { declarativeRuleId: 1, sourceRuleIndex: 0, filterId: 1 },
            ];

            const converted: ConvertedRules = {
                declarativeRules: [rule1],
                sourceMapValues,
                errors: [existingError],
            };

            const createRuleTemplate = vi.fn((rule: DeclarativeRule) => rule.condition?.urlFilter || '');
            const combineRulePair = vi.fn();

            // @ts-expect-error Accessing protected static method for testing purposes
            const result = RuleConverter.groupConvertedRules(converted, createRuleTemplate, combineRulePair);

            // Should preserve existing error
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toBe(existingError);
        });

        it('should update source mapping with combined rule ID', () => {
            const rule1: DeclarativeRule = {
                id: 100,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            const rule2: DeclarativeRule = {
                id: 200,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            const sourceMapValues = [
                { declarativeRuleId: 100, sourceRuleIndex: 0, filterId: 1 },
                { declarativeRuleId: 200, sourceRuleIndex: 1, filterId: 2 },
            ];

            const converted: ConvertedRules = {
                declarativeRules: [rule1, rule2],
                sourceMapValues,
                errors: [],
            };

            const createRuleTemplate = vi.fn((rule: DeclarativeRule) => rule.condition?.urlFilter || '');

            // Mock combine function that creates rule with ID 999
            const combineRulePair = vi.fn((sourceRule: DeclarativeRule) => ({
                ...sourceRule,
                id: 999,
            }));

            // @ts-expect-error Accessing protected static method for testing purposes
            const result = RuleConverter.groupConvertedRules(converted, createRuleTemplate, combineRulePair);

            // Should have 1 combined rule
            expect(result.declarativeRules).toHaveLength(1);
            expect(result.declarativeRules[0].id).toBe(999);
            expect(result.sourceMapValues).toHaveLength(2);
            expect(result.sourceMapValues[0].declarativeRuleId).toBe(100);
            expect(result.sourceMapValues[1].declarativeRuleId).toBe(999);

            // Other source mapping properties should be preserved
            expect(result.sourceMapValues[0].sourceRuleIndex).toBe(0);
            expect(result.sourceMapValues[0].filterId).toBe(1);
            expect(result.sourceMapValues[1].sourceRuleIndex).toBe(1);
            expect(result.sourceMapValues[1].filterId).toBe(2);
        });

        it('should handle empty declarative rules array', () => {
            const converted: ConvertedRules = {
                declarativeRules: [],
                sourceMapValues: [],
                errors: [],
            };

            const createRuleTemplate = vi.fn();
            const combineRulePair = vi.fn();

            // @ts-expect-error Accessing protected static method for testing purposes
            const result = RuleConverter.groupConvertedRules(converted, createRuleTemplate, combineRulePair);

            expect(result.declarativeRules).toHaveLength(0);
            expect(result.sourceMapValues).toHaveLength(0);
            expect(result.errors).toHaveLength(0);
            expect(createRuleTemplate).not.toHaveBeenCalled();
            expect(combineRulePair).not.toHaveBeenCalled();
        });

        it('should not modify original rules (deep copy behavior)', () => {
            const originalRule1: DeclarativeRule = {
                id: 1,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            const originalRule2: DeclarativeRule = {
                id: 2,
                priority: 1,
                action: { type: RuleActionType.Block },
                condition: { urlFilter: 'example.com' },
            };

            const sourceMapValues = [
                { declarativeRuleId: 1, sourceRuleIndex: 0, filterId: 1 },
                { declarativeRuleId: 2, sourceRuleIndex: 1, filterId: 1 },
            ];

            const converted: ConvertedRules = {
                declarativeRules: [originalRule1, originalRule2],
                sourceMapValues,
                errors: [],
            };

            // Store original values for comparison
            const originalRule1Copy = { ...originalRule1 };
            const originalRule2Copy = { ...originalRule2 };

            const createRuleTemplate = vi.fn((rule: DeclarativeRule) => rule.condition?.urlFilter || '');

            // Mock combine function that modifies the returned rule
            const combineRulePair = vi.fn((sourceRule: DeclarativeRule) => ({
                ...sourceRule,
                id: 999,
                priority: 999,
            }));

            // @ts-expect-error Accessing protected static method for testing purposes
            RuleConverter.groupConvertedRules(converted, createRuleTemplate, combineRulePair);

            // Original rules should remain unchanged
            expect(originalRule1).toEqual(originalRule1Copy);
            expect(originalRule2).toEqual(originalRule2Copy);
        });
    });
});
