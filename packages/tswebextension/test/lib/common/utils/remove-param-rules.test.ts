import {
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type RemoveParamDescriptor } from '../../../../src/lib/common/message';
import { getRemoveParamDescriptors } from '../../../../src/lib/common/utils/remove-param-rules';

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
        expect(result).toHaveLength(1);
        expect(result![0]).toMatchObject({
            value: 'utm_source',
            isAllowlist: false,
            isImportant: false,
            filterId: 1,
            ruleIndex: 42,
            ruleText: '||example.com^$removeparam=utm_source',
            advancedModifier: 'utm_source',
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
        expect(result![0]).toMatchObject({
            value: '',
            advancedModifier: null,
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

        expect(result).toHaveLength(2);
        expect(result![0]).toMatchObject({
            value: 'utm_source',
            isImportant: false,
            filterId: 1,
            ruleIndex: 0,
        });
        expect(result![1]).toMatchObject({
            value: 'utm_medium',
            isImportant: true,
            filterId: 2,
            ruleIndex: 5,
        });
    });
});
