import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { RemoveParamModifier } from '@adguard/tsurlfilter';

import { type RemoveParamDescriptor } from '../../../../src/lib/common/utils/remove-param-rules';
import {
    filterEffectiveRemoveParamRules,
    getRemoveParamDescriptors,
} from '../../../../src/lib/common/utils/remove-param-rules';

describe('getRemoveParamDescriptors', () => {
    it('returns null when matchingResult is null', () => {
        const mockEngineApi = {
            matchRequest: vi.fn().mockReturnValue(null),
            retrieveRuleText: vi.fn(),
            retrieveOriginalRuleText: vi.fn(),
        };

        const result = getRemoveParamDescriptors({
            requestUrl: 'https://example.com/?utm_source=test',
            frameUrl: 'https://example.com/',
            frameRule: null,
            engineApi: mockEngineApi,
        });

        expect(result).toBeNull();
    });

    it('returns null when no removeparam rules match', () => {
        const mockMatchingResult = {
            getRemoveParamRules: vi.fn().mockReturnValue([]),
        };
        const mockEngineApi = {
            matchRequest: vi.fn().mockReturnValue(mockMatchingResult),
            retrieveRuleText: vi.fn(),
            retrieveOriginalRuleText: vi.fn(),
        };

        const result = getRemoveParamDescriptors({
            requestUrl: 'https://example.com/?page=1',
            frameUrl: 'https://example.com/',
            frameRule: null,
            engineApi: mockEngineApi,
        });

        expect(result).toBeNull();
    });

    it('returns descriptors when removeparam rules match', () => {
        const mockRule = {
            getAdvancedModifierValue: vi.fn().mockReturnValue('utm_source'),
            isAllowlist: vi.fn().mockReturnValue(false),
            isOptionEnabled: vi.fn().mockReturnValue(false),
            getFilterListId: vi.fn().mockReturnValue(1),
            getIndex: vi.fn().mockReturnValue(42),
            getText: vi.fn().mockReturnValue('||example.com^$removeparam=utm_source'),
        };
        const mockMatchingResult = {
            getRemoveParamRules: vi.fn().mockReturnValue([mockRule]),
        };
        const mockEngineApi = {
            matchRequest: vi.fn().mockReturnValue(mockMatchingResult),
            retrieveRuleText: vi.fn().mockReturnValue('||example.com^$removeparam=utm_source'),
            retrieveOriginalRuleText: vi.fn().mockReturnValue(null),
        };

        const result = getRemoveParamDescriptors({
            requestUrl: 'https://example.com/?utm_source=test',
            frameUrl: 'https://example.com/',
            frameRule: null,
            engineApi: mockEngineApi,
        });

        expect(result).not.toBeNull();
        expect(result!.descriptors).toHaveLength(1);
        expect(result!.rules).toHaveLength(1);
        expect(result!.descriptors[0]).toMatchObject({
            value: 'utm_source',
            isAllowlist: false,
            isImportant: false,
            filterId: 1,
            ruleIndex: 42,
            ruleText: '||example.com^$removeparam=utm_source',
        } satisfies Partial<RemoveParamDescriptor>);
    });

    it('handles rules with empty modifier value (bare removeparam)', () => {
        const mockRule = {
            getAdvancedModifierValue: vi.fn().mockReturnValue(null),
            isAllowlist: vi.fn().mockReturnValue(false),
            isOptionEnabled: vi.fn().mockReturnValue(false),
            getFilterListId: vi.fn().mockReturnValue(1),
            getIndex: vi.fn().mockReturnValue(10),
            getText: vi.fn().mockReturnValue('||example.com^$removeparam'),
        };
        const mockMatchingResult = {
            getRemoveParamRules: vi.fn().mockReturnValue([mockRule]),
        };
        const mockEngineApi = {
            matchRequest: vi.fn().mockReturnValue(mockMatchingResult),
            retrieveRuleText: vi.fn().mockReturnValue('||example.com^$removeparam'),
            retrieveOriginalRuleText: vi.fn().mockReturnValue(null),
        };

        const result = getRemoveParamDescriptors({
            requestUrl: 'https://example.com/?a=1&b=2',
            frameUrl: 'https://example.com/',
            frameRule: null,
            engineApi: mockEngineApi,
        });

        expect(result).not.toBeNull();
        expect(result!.descriptors[0]).toMatchObject({
            value: '',
        });
    });

    it('returns multiple descriptors when multiple rules match', () => {
        const mockRules = [
            {
                getAdvancedModifierValue: vi.fn().mockReturnValue('utm_source'),
                isAllowlist: vi.fn().mockReturnValue(false),
                isOptionEnabled: vi.fn().mockReturnValue(false),
                getFilterListId: vi.fn().mockReturnValue(1),
                getIndex: vi.fn().mockReturnValue(0),
                getText: vi.fn().mockReturnValue('||example.com^$removeparam=utm_source'),
            },
            {
                getAdvancedModifierValue: vi.fn().mockReturnValue('utm_medium'),
                isAllowlist: vi.fn().mockReturnValue(false),
                isOptionEnabled: vi.fn().mockReturnValue(true),
                getFilterListId: vi.fn().mockReturnValue(2),
                getIndex: vi.fn().mockReturnValue(5),
                getText: vi.fn().mockReturnValue('||example.com^$removeparam=utm_medium,important'),
            },
        ];
        const mockMatchingResult = {
            getRemoveParamRules: vi.fn().mockReturnValue(mockRules),
        };
        const mockEngineApi = {
            matchRequest: vi.fn().mockReturnValue(mockMatchingResult),
            retrieveRuleText: vi.fn((_, idx) => mockRules[idx === 0 ? 0 : 1]!.getText()),
            retrieveOriginalRuleText: vi.fn().mockReturnValue(null),
        };

        const result = getRemoveParamDescriptors({
            requestUrl: 'https://example.com/?utm_source=g&utm_medium=c',
            frameUrl: 'https://example.com/',
            frameRule: null,
            engineApi: mockEngineApi,
        });

        expect(result!.descriptors).toHaveLength(2);
        expect(result!.rules).toHaveLength(2);
        expect(result!.descriptors[0]).toMatchObject({
            value: 'utm_source',
            isImportant: false,
            filterId: 1,
            ruleIndex: 0,
        });
        expect(result!.descriptors[1]).toMatchObject({
            value: 'utm_medium',
            isImportant: true,
            filterId: 2,
            ruleIndex: 5,
        });
    });
});

describe('filterEffectiveRemoveParamRules', () => {
    /**
     * Creates a mock NetworkRule with a real RemoveParamModifier.
     *
     * @param modifierValue The removeparam modifier value.
     * @param isAllowlist Whether the rule is an allowlist rule.
     *
     * @returns Mock rule object.
     */
    function mockRule(modifierValue: string, isAllowlist = false): any {
        const modifier = new RemoveParamModifier(modifierValue);
        return {
            getAdvancedModifier: (): any => modifier,
            getAdvancedModifierValue: (): string | null => modifierValue || null,
            isAllowlist: (): boolean => isAllowlist,
        };
    }

    it('returns empty array when URL has no query string', () => {
        const rules = [mockRule('utm_source')];
        expect(filterEffectiveRemoveParamRules('https://example.com/page', rules)).toEqual([]);
    });

    it('returns rules whose targeted param is present', () => {
        const rule = mockRule('utm_source');
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?utm_source=test&legit=1',
            [rule],
        );
        expect(result).toEqual([rule]);
    });

    it('excludes rules whose targeted param is NOT present', () => {
        const rule = mockRule('utm_source');
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?legit=1',
            [rule],
        );
        expect(result).toEqual([]);
    });

    it('handles bare $removeparam (empty value) — effective when params exist', () => {
        const rule = mockRule('');
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?foo=1',
            [rule],
        );
        expect(result).toEqual([rule]);
    });

    it('handles bare $removeparam (empty value) — not effective when no params', () => {
        expect(filterEffectiveRemoveParamRules('https://example.com/page', [mockRule('')])).toEqual([]);
    });

    it('handles regex modifier values', () => {
        const rule = mockRule('/^utm_/');
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?utm_campaign=spring',
            [rule],
        );
        expect(result).toEqual([rule]);
    });

    it('excludes regex rules that do not match any param', () => {
        const rule = mockRule('/^utm_/');
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?legit=1',
            [rule],
        );
        expect(result).toEqual([]);
    });

    it('handles negated modifier — effective when non-matching params exist', () => {
        const rule = mockRule('~legit');
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?utm_source=test&legit=1',
            [rule],
        );
        expect(result).toEqual([rule]);
    });

    it('handles negated modifier — not effective when only matching params exist', () => {
        const rule = mockRule('~legit');
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?legit=1',
            [rule],
        );
        expect(result).toEqual([]);
    });

    it('excludes allowlist rules', () => {
        const rule = mockRule('utm_source', true);
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?utm_source=test',
            [rule],
        );
        expect(result).toEqual([]);
    });

    it('handles URL with hash — ignores hash portion', () => {
        const rule = mockRule('utm_source');
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?utm_source=test#section',
            [rule],
        );
        expect(result).toEqual([rule]);
    });

    it('returns multiple effective rules from a mixed set', () => {
        const effective = mockRule('utm_source');
        const ineffective = mockRule('fbclid');
        const allowlist = mockRule('utm_source', true);
        const result = filterEffectiveRemoveParamRules(
            'https://example.com/page?utm_source=test',
            [effective, ineffective, allowlist],
        );
        expect(result).toEqual([effective]);
    });
});
