import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { type DeclarativeRule, RuleActionType } from '../../../src/declarative-rule';
import { type ConversionError, InvalidDeclarativeRuleError } from '../../../src/errors/conversion-errors';
import {
    TooManyRegexpRulesError,
    TooManyRulesError,
    TooManyUnsafeRulesError,
} from '../../../src/errors/limitation-errors';
import { RulesConverter } from '../../../src/filter-converter/rules-converter';
import { type GroupedRules, RulesGroup } from '../../../src/filter-converter/rules-grouper';
import { type ScannedFilter } from '../../../src/filter-converter/rules-scanner';
import { type NetworkRule, NetworkRuleOption } from '../../../src/network-rule';
import {
    BadFilterConverter,
    CspConverter,
    RegularConverter,
    RemoveHeaderConverter,
    RemoveParamConverter,
} from '../../../src/rule-converters';
import { type ConvertedRules } from '../../../src/rule-converters/converted-rules';
import { type Source } from '../../../src/source-map';
import { isSafeRule } from '../../../src/utils/is-safe-rule';
import { createNetworkRuleMock } from '../../mocks/network-rule';

vi.mock('../../../src/rule-converters', () => ({
    BadFilterConverter: vi.fn(),
    CspConverter: vi.fn(),
    RegularConverter: vi.fn(),
    RemoveHeaderConverter: vi.fn(),
    RemoveParamConverter: vi.fn(),
}));

vi.mock('../../../src/utils/is-safe-rule', () => ({
    isSafeRule: vi.fn(),
}));

// Import the mocked function
const MockedBadFilterConverter = vi.mocked(BadFilterConverter);
const MockedCspConverter = vi.mocked(CspConverter);
const MockedRegularConverter = vi.mocked(RegularConverter);
const MockedRemoveHeaderConverter = vi.mocked(RemoveHeaderConverter);
const MockedRemoveParamConverter = vi.mocked(RemoveParamConverter);
const isSafeRuleMocked = vi.mocked(isSafeRule);

// @ts-expect-error Accessing private constants for testing
const { MIN_DECLARATIVE_RULE_ID, MAX_DECLARATIVE_RULE_ID } = RulesConverter;

const createScannedFilter = (
    id: number,
    rules: NetworkRule[] = [],
    badFilterRules: NetworkRule[] = [],
): ScannedFilter => ({
    id,
    rules,
    badFilterRules,
});

const createDeclarativeRule = (
    id: number,
    pattern = 'example.com',
    isRegex = false,
): DeclarativeRule => ({
    id,
    priority: 1,
    action: { type: RuleActionType.Block },
    condition: isRegex ? { regexFilter: pattern } : { urlFilter: pattern },
});

const createSource = (
    declarativeRuleId: number,
    sourceRuleIndex: number,
    filterId: number,
): Source => ({
    declarativeRuleId,
    sourceRuleIndex,
    filterId,
});

const createConversionError = (declarativeRuleId: number): ConversionError => {
    const declarativeRule = createDeclarativeRule(declarativeRuleId);
    const networkRule = createNetworkRuleMock();

    /**
     * Just for testing purposes.
     */
    class TestInvalidDeclarativeRuleError extends InvalidDeclarativeRuleError {}

    return new TestInvalidDeclarativeRuleError(
        'Test conversion error',
        networkRule,
        declarativeRule,
    );
};

const createConvertedRules = (
    declarativeRules: DeclarativeRule[] = [],
    sourceMapValues: Source[] = [],
    errors: (ConversionError | Error)[] = [],
): ConvertedRules => ({
    declarativeRules,
    sourceMapValues,
    errors,
});

describe('RulesConverter', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('convert', () => {
        it('should successfully convert single filter with basic rules', async () => {
            const networkRule1 = createNetworkRuleMock({ pattern: 'example.com' });
            const networkRule2 = createNetworkRuleMock({ pattern: 'test.com' });

            const scannedFilters = [
                createScannedFilter(1, [networkRule1, networkRule2], []),
            ];

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const convertRulesSpy = vi.spyOn(RulesConverter as any, 'convertRules');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');
            const checkRulesHaveCorrectIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveCorrectIds');

            // Mock return values
            const groupedRules = {
                [RulesGroup.Regular]: [networkRule1, networkRule2],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            applyBadFilterSpy.mockReturnValue([[1, groupedRules]]);

            const convertedRules = createConvertedRules(
                [createDeclarativeRule(1, 'example.com'), createDeclarativeRule(2, 'test.com')],
                [createSource(1, 0, 1), createSource(2, 1, 1)],
            );
            convertRulesSpy.mockResolvedValue(convertedRules);
            checkLimitationsSpy.mockReturnValue(convertedRules);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(true);
            checkRulesHaveCorrectIdsSpy.mockReturnValue(true);

            const result = await RulesConverter.convert(scannedFilters);

            expect(applyBadFilterSpy).toHaveBeenCalledWith(scannedFilters);
            expect(convertRulesSpy).toHaveBeenCalledWith(1, groupedRules, expect.any(Set), undefined);
            expect(checkLimitationsSpy).toHaveBeenCalledWith(convertedRules, undefined, undefined, undefined);
            expect(checkRulesHaveUniqueIdsSpy).toHaveBeenCalledWith(convertedRules.declarativeRules);
            expect(checkRulesHaveCorrectIdsSpy).toHaveBeenCalledWith(convertedRules.declarativeRules);

            expect(result.declarativeRules).toHaveLength(2);
            expect(result.sourceMapValues).toHaveLength(2);
            expect(result.errors).toEqual([]);
        });

        it('should handle empty scanned filters array', async () => {
            const scannedFilters: ScannedFilter[] = [];

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');
            const checkRulesHaveCorrectIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveCorrectIds');

            applyBadFilterSpy.mockReturnValue([]);
            const emptyResult = createConvertedRules([], []);
            checkLimitationsSpy.mockReturnValue(emptyResult);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(true);
            checkRulesHaveCorrectIdsSpy.mockReturnValue(true);

            const result = await RulesConverter.convert(scannedFilters);

            expect(applyBadFilterSpy).toHaveBeenCalledWith(scannedFilters);
            expect(checkLimitationsSpy).toHaveBeenCalledWith(emptyResult, undefined, undefined, undefined);
            expect(result.declarativeRules).toEqual([]);
            expect(result.sourceMapValues).toEqual([]);
            expect(result.errors).toEqual([]);
        });

        it('should convert multiple filters and aggregate results', async () => {
            const networkRule1 = createNetworkRuleMock({ pattern: 'example.com' });
            const networkRule2 = createNetworkRuleMock({ pattern: 'test.com' });
            const networkRule3 = createNetworkRuleMock({ pattern: 'another.com' });

            const scannedFilters = [
                createScannedFilter(1, [networkRule1], []),
                createScannedFilter(2, [networkRule2, networkRule3], []),
            ];

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const convertRulesSpy = vi.spyOn(RulesConverter as any, 'convertRules');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');
            const checkRulesHaveCorrectIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveCorrectIds');

            const groupedRules1 = {
                [RulesGroup.Regular]: [networkRule1],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            const groupedRules2 = {
                [RulesGroup.Regular]: [networkRule2, networkRule3],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            applyBadFilterSpy.mockReturnValue([[1, groupedRules1], [2, groupedRules2]]);

            const convertedRules1 = createConvertedRules(
                [createDeclarativeRule(1, 'example.com')],
                [createSource(1, 0, 1)],
            );
            const convertedRules2 = createConvertedRules(
                [createDeclarativeRule(2, 'test.com'), createDeclarativeRule(3, 'another.com')],
                [createSource(2, 0, 2), createSource(3, 1, 2)],
            );

            convertRulesSpy
                .mockResolvedValueOnce(convertedRules1)
                .mockResolvedValueOnce(convertedRules2);

            const aggregatedResult = createConvertedRules(
                [
                    createDeclarativeRule(1, 'example.com'),
                    createDeclarativeRule(2, 'test.com'),
                    createDeclarativeRule(3, 'another.com'),
                ],
                [
                    createSource(1, 0, 1),
                    createSource(2, 0, 2),
                    createSource(3, 1, 2),
                ],
            );
            checkLimitationsSpy.mockReturnValue(aggregatedResult);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(true);
            checkRulesHaveCorrectIdsSpy.mockReturnValue(true);

            const result = await RulesConverter.convert(scannedFilters);

            expect(convertRulesSpy).toHaveBeenCalledTimes(2);
            expect(convertRulesSpy).toHaveBeenNthCalledWith(1, 1, groupedRules1, expect.any(Set), undefined);
            expect(convertRulesSpy).toHaveBeenNthCalledWith(2, 2, groupedRules2, expect.any(Set), undefined);

            expect(result.declarativeRules).toHaveLength(3);
            expect(result.sourceMapValues).toHaveLength(3);
        });

        it('should pass converter options to convertRules and checkLimitations', async () => {
            const networkRule = createNetworkRuleMock({ pattern: 'example.com' });
            const scannedFilters = [createScannedFilter(1, [networkRule], [])];
            const options = {
                resourcesPath: '/path/to/resources',
                maxNumberOfRules: 100,
                maxNumberOfUnsafeRules: 50,
                maxNumberOfRegexpRules: 25,
            };

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const convertRulesSpy = vi.spyOn(RulesConverter as any, 'convertRules');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');
            const checkRulesHaveCorrectIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveCorrectIds');

            const groupedRules = {
                [RulesGroup.Regular]: [networkRule],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            applyBadFilterSpy.mockReturnValue([[1, groupedRules]]);

            const convertedRules = createConvertedRules(
                [createDeclarativeRule(1, 'example.com')],
                [createSource(1, 0, 1)],
            );
            convertRulesSpy.mockResolvedValue(convertedRules);
            checkLimitationsSpy.mockReturnValue(convertedRules);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(true);
            checkRulesHaveCorrectIdsSpy.mockReturnValue(true);

            await RulesConverter.convert(scannedFilters, options);

            expect(convertRulesSpy).toHaveBeenCalledWith(1, groupedRules, expect.any(Set), options);
            expect(checkLimitationsSpy).toHaveBeenCalledWith(
                convertedRules,
                options.maxNumberOfRules,
                options.maxNumberOfUnsafeRules,
                options.maxNumberOfRegexpRules,
            );
        });

        it('should throw error when rules have non-unique identifiers', async () => {
            const networkRule = createNetworkRuleMock({ pattern: 'example.com' });
            const scannedFilters = [createScannedFilter(1, [networkRule], [])];

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const convertRulesSpy = vi.spyOn(RulesConverter as any, 'convertRules');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');

            const groupedRules = {
                [RulesGroup.Regular]: [networkRule],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            applyBadFilterSpy.mockReturnValue([[1, groupedRules]]);

            const convertedRules = createConvertedRules(
                [createDeclarativeRule(1, 'example.com')],
                [createSource(1, 0, 1)],
            );
            convertRulesSpy.mockResolvedValue(convertedRules);
            checkLimitationsSpy.mockReturnValue(convertedRules);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(false); // Non-unique IDs

            await expect(RulesConverter.convert(scannedFilters))
                .rejects
                .toThrow('Declarative rules have non-unique identifiers.');
        });

        it('should throw error when rules have incorrect identifiers', async () => {
            const networkRule = createNetworkRuleMock({ pattern: 'example.com' });
            const scannedFilters = [createScannedFilter(1, [networkRule], [])];

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const convertRulesSpy = vi.spyOn(RulesConverter as any, 'convertRules');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');
            const checkRulesHaveCorrectIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveCorrectIds');

            const groupedRules = {
                [RulesGroup.Regular]: [networkRule],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            applyBadFilterSpy.mockReturnValue([[1, groupedRules]]);

            const convertedRules = createConvertedRules(
                [createDeclarativeRule(1, 'example.com')],
                [createSource(1, 0, 1)],
            );
            convertRulesSpy.mockResolvedValue(convertedRules);
            checkLimitationsSpy.mockReturnValue(convertedRules);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(true);
            checkRulesHaveCorrectIdsSpy.mockReturnValue(false); // Incorrect IDs

            await expect(RulesConverter.convert(scannedFilters))
                .rejects
                .toThrow('Declarative rules have incorrect identifiers.');
        });

        it('should apply badfilter rules correctly', async () => {
            const regularRule = createNetworkRuleMock({ pattern: 'example.com' });
            const badFilterRule = createNetworkRuleMock({
                pattern: 'example.com',
                enabledOptions: [NetworkRuleOption.Badfilter],
            });

            const scannedFilters = [
                createScannedFilter(1, [regularRule, badFilterRule], [badFilterRule]),
            ];

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const convertRulesSpy = vi.spyOn(RulesConverter as any, 'convertRules');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');
            const checkRulesHaveCorrectIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveCorrectIds');

            // Simulate badfilter application - regular rule is filtered out
            const groupedRules = {
                [RulesGroup.Regular]: [], // badfilter removed the regular rule
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [], // badfilter rules are cleared
            };
            applyBadFilterSpy.mockReturnValue([[1, groupedRules]]);

            const convertedRules = createConvertedRules([], []); // No rules after badfilter
            convertRulesSpy.mockResolvedValue(convertedRules);
            checkLimitationsSpy.mockReturnValue(convertedRules);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(true);
            checkRulesHaveCorrectIdsSpy.mockReturnValue(true);

            const result = await RulesConverter.convert(scannedFilters);

            expect(applyBadFilterSpy).toHaveBeenCalledWith(scannedFilters);
            expect(result.declarativeRules).toEqual([]);
            expect(result.sourceMapValues).toEqual([]);
        });

        it('should enforce limitations and return limitation errors', async () => {
            const networkRule = createNetworkRuleMock({ pattern: 'example.com' });
            const scannedFilters = [createScannedFilter(1, [networkRule], [])];
            const options = { maxNumberOfRules: 1 };

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const convertRulesSpy = vi.spyOn(RulesConverter as any, 'convertRules');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');
            const checkRulesHaveCorrectIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveCorrectIds');

            const groupedRules = {
                [RulesGroup.Regular]: [networkRule],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            applyBadFilterSpy.mockReturnValue([[1, groupedRules]]);

            const convertedRules = createConvertedRules(
                [createDeclarativeRule(1, 'example.com')],
                [createSource(1, 0, 1)],
            );
            convertRulesSpy.mockResolvedValue(convertedRules);

            const limitationError = new TooManyRulesError(
                'Too many rules',
                [],
                1,
                0,
            );
            const limitedResult = {
                ...convertedRules,
                limitations: [limitationError],
            };
            checkLimitationsSpy.mockReturnValue(limitedResult);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(true);
            checkRulesHaveCorrectIdsSpy.mockReturnValue(true);

            const result = await RulesConverter.convert(scannedFilters, options);

            expect(checkLimitationsSpy).toHaveBeenCalledWith(
                convertedRules,
                options.maxNumberOfRules,
                undefined,
                undefined,
            );
            expect(result.limitations).toEqual([limitationError]);
        });

        it('should aggregate errors from multiple filters', async () => {
            const networkRule1 = createNetworkRuleMock({ pattern: 'example.com' });
            const networkRule2 = createNetworkRuleMock({ pattern: 'test.com' });

            const scannedFilters = [
                createScannedFilter(1, [networkRule1], []),
                createScannedFilter(2, [networkRule2], []),
            ];

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const convertRulesSpy = vi.spyOn(RulesConverter as any, 'convertRules');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');
            const checkRulesHaveCorrectIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveCorrectIds');

            const groupedRules1 = {
                [RulesGroup.Regular]: [networkRule1],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            const groupedRules2 = {
                [RulesGroup.Regular]: [networkRule2],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            applyBadFilterSpy.mockReturnValue([[1, groupedRules1], [2, groupedRules2]]);

            const error1 = createConversionError(1);
            const error2 = createConversionError(2);
            const convertedRules1 = createConvertedRules(
                [createDeclarativeRule(1, 'example.com')],
                [createSource(1, 0, 1)],
                [error1],
            );
            const convertedRules2 = createConvertedRules(
                [createDeclarativeRule(2, 'test.com')],
                [createSource(2, 0, 2)],
                [error2],
            );

            convertRulesSpy
                .mockResolvedValueOnce(convertedRules1)
                .mockResolvedValueOnce(convertedRules2);

            const aggregatedResult = createConvertedRules(
                [createDeclarativeRule(1, 'example.com'), createDeclarativeRule(2, 'test.com')],
                [createSource(1, 0, 1), createSource(2, 0, 2)],
                [error1, error2],
            );
            checkLimitationsSpy.mockReturnValue(aggregatedResult);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(true);
            checkRulesHaveCorrectIdsSpy.mockReturnValue(true);

            const result = await RulesConverter.convert(scannedFilters);

            expect(result.errors).toHaveLength(2);
            expect(result.errors).toContain(error1);
            expect(result.errors).toContain(error2);
        });

        it('should maintain unique IDs set across multiple filter conversions', async () => {
            const networkRule1 = createNetworkRuleMock({ pattern: 'example.com' });
            const networkRule2 = createNetworkRuleMock({ pattern: 'test.com' });

            const scannedFilters = [
                createScannedFilter(1, [networkRule1], []),
                createScannedFilter(2, [networkRule2], []),
            ];

            // Mock the private methods
            const applyBadFilterSpy = vi.spyOn(RulesConverter as any, 'applyBadFilter');
            const convertRulesSpy = vi.spyOn(RulesConverter as any, 'convertRules');
            const checkLimitationsSpy = vi.spyOn(RulesConverter as any, 'checkLimitations');
            const checkRulesHaveUniqueIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveUniqueIds');
            const checkRulesHaveCorrectIdsSpy = vi.spyOn(RulesConverter as any, 'checkRulesHaveCorrectIds');

            const groupedRules1 = {
                [RulesGroup.Regular]: [networkRule1],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            const groupedRules2 = {
                [RulesGroup.Regular]: [networkRule2],
                [RulesGroup.Csp]: [],
                [RulesGroup.RemoveParam]: [],
                [RulesGroup.RemoveHeader]: [],
                [RulesGroup.BadFilter]: [],
            };
            applyBadFilterSpy.mockReturnValue([[1, groupedRules1], [2, groupedRules2]]);

            const convertedRules1 = createConvertedRules(
                [createDeclarativeRule(1, 'example.com')],
                [createSource(1, 0, 1)],
            );
            const convertedRules2 = createConvertedRules(
                [createDeclarativeRule(2, 'test.com')],
                [createSource(2, 0, 2)],
            );

            convertRulesSpy
                .mockResolvedValueOnce(convertedRules1)
                .mockResolvedValueOnce(convertedRules2);

            const aggregatedResult = createConvertedRules(
                [createDeclarativeRule(1, 'example.com'), createDeclarativeRule(2, 'test.com')],
                [createSource(1, 0, 1), createSource(2, 0, 2)],
            );
            checkLimitationsSpy.mockReturnValue(aggregatedResult);
            checkRulesHaveUniqueIdsSpy.mockReturnValue(true);
            checkRulesHaveCorrectIdsSpy.mockReturnValue(true);

            await RulesConverter.convert(scannedFilters);

            // Verify that the same uniqueIds set is passed to both convertRules calls
            const firstCallUniqueIds = convertRulesSpy.mock.calls[0][2];
            const secondCallUniqueIds = convertRulesSpy.mock.calls[1][2];
            expect(firstCallUniqueIds).toBe(secondCallUniqueIds);
        });
    });

    describe('convertRules', () => {
        const createGroupedRules = (
            groups: Partial<GroupedRules> = {},
        ): GroupedRules => ({
            [RulesGroup.Regular]: groups[RulesGroup.Regular] || [],
            [RulesGroup.Csp]: groups[RulesGroup.Csp] || [],
            [RulesGroup.RemoveParam]: groups[RulesGroup.RemoveParam] || [],
            [RulesGroup.RemoveHeader]: groups[RulesGroup.RemoveHeader] || [],
            [RulesGroup.BadFilter]: groups[RulesGroup.BadFilter] || [],
        });

        it('should convert rules from all groups and aggregate results', async () => {
            const filterId = 1;
            const usedIds = new Set<number>();

            const regularRule = createNetworkRuleMock({ pattern: 'example.com' });
            const cspRule = createNetworkRuleMock({ pattern: 'test.com' });

            const groupedRules = createGroupedRules({
                [RulesGroup.Regular]: [regularRule],
                [RulesGroup.Csp]: [cspRule],
            });

            // Mock converter responses
            const regularConverted = createConvertedRules(
                [createDeclarativeRule(1, 'example.com')],
                [createSource(1, 10, filterId)],
            );
            const cspConverted = createConvertedRules(
                [createDeclarativeRule(2, 'test.com')],
                [createSource(2, 20, filterId)],
            );

            const regularConvertMock = vi.fn(async () => regularConverted);
            MockedRegularConverter.mockImplementationOnce(() => ({
                convert: regularConvertMock,
            } as any));
            const cspConvertMock = vi.fn(async () => cspConverted);
            MockedCspConverter.mockImplementationOnce(() => ({
                convert: cspConvertMock,
            } as any));
            const removeParamConvertMock = vi.fn(async () => createConvertedRules());
            MockedRemoveParamConverter.mockImplementationOnce(() => ({
                convert: removeParamConvertMock,
            } as any));
            const removeHeaderConvertMock = vi.fn(async () => createConvertedRules());
            MockedRemoveHeaderConverter.mockImplementationOnce(() => ({
                convert: removeHeaderConvertMock,
            } as any));
            const badFilterConvertMock = vi.fn(async () => createConvertedRules());
            MockedBadFilterConverter.mockImplementationOnce(() => ({
                convert: badFilterConvertMock,
            } as any));

            // @ts-expect-error Accessing private method for testing
            const result = await RulesConverter.convertRules(filterId, groupedRules, usedIds);

            // Verify converters were called with correct parameters
            expect(regularConvertMock).toHaveBeenCalledWith(filterId, [regularRule], usedIds);
            expect(cspConvertMock).toHaveBeenCalledWith(filterId, [cspRule], usedIds);
            expect(removeParamConvertMock).toHaveBeenCalledWith(filterId, [], usedIds);
            expect(removeHeaderConvertMock).toHaveBeenCalledWith(filterId, [], usedIds);
            expect(badFilterConvertMock).toHaveBeenCalledWith(filterId, [], usedIds);
            // Verify results are aggregated correctly
            expect(result.declarativeRules).toHaveLength(2);
            expect(result.declarativeRules).toEqual([
                createDeclarativeRule(1, 'example.com'),
                createDeclarativeRule(2, 'test.com'),
            ]);
            expect(result.sourceMapValues).toHaveLength(2);
            expect(result.sourceMapValues).toEqual([
                createSource(1, 10, filterId),
                createSource(2, 20, filterId),
            ]);
            expect(result.errors).toEqual([]);
        });

        it('should handle empty grouped rules', async () => {
            const filterId = 2;
            const usedIds = new Set<number>();
            const groupedRules = createGroupedRules();

            // Mock all converters to return empty results
            const emptyResult = createConvertedRules();
            const regularConvertMock = vi.fn(async () => emptyResult);
            MockedRegularConverter.mockImplementationOnce(() => ({
                convert: regularConvertMock,
            } as any));
            const cspConvertMock = vi.fn(async () => emptyResult);
            MockedCspConverter.mockImplementationOnce(() => ({
                convert: cspConvertMock,
            } as any));
            const removeParamConvertMock = vi.fn(async () => emptyResult);
            MockedRemoveParamConverter.mockImplementationOnce(() => ({
                convert: removeParamConvertMock,
            } as any));
            const removeHeaderConvertMock = vi.fn(async () => emptyResult);
            MockedRemoveHeaderConverter.mockImplementationOnce(() => ({
                convert: removeHeaderConvertMock,
            } as any));
            const badFilterConvertMock = vi.fn(async () => emptyResult);
            MockedBadFilterConverter.mockImplementationOnce(() => ({
                convert: badFilterConvertMock,
            } as any));

            // @ts-expect-error Accessing private method for testing
            const result = await RulesConverter.convertRules(filterId, groupedRules, usedIds);

            // Verify all converters were called with empty arrays
            expect(regularConvertMock).toHaveBeenCalledWith(filterId, [], usedIds);
            expect(cspConvertMock).toHaveBeenCalledWith(filterId, [], usedIds);
            expect(removeParamConvertMock).toHaveBeenCalledWith(filterId, [], usedIds);
            expect(removeHeaderConvertMock).toHaveBeenCalledWith(filterId, [], usedIds);
            expect(badFilterConvertMock).toHaveBeenCalledWith(filterId, [], usedIds);

            // Verify empty result
            expect(result.declarativeRules).toEqual([]);
            expect(result.sourceMapValues).toEqual([]);
            expect(result.errors).toEqual([]);
        });

        it('should pass converter options to converters', async () => {
            const filterId = 3;
            const usedIds = new Set<number>();
            const options = { resourcesPath: '/path/to/resources' };
            const groupedRules = createGroupedRules({
                [RulesGroup.Regular]: [createNetworkRuleMock()],
            });

            MockedRegularConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedCspConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedRemoveParamConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedRemoveHeaderConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedBadFilterConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));

            // @ts-expect-error Accessing private method for testing
            await RulesConverter.convertRules(filterId, groupedRules, usedIds, options);

            // Verify converters were instantiated with resourcesPath
            expect(RegularConverter).toHaveBeenCalledWith(options.resourcesPath);
            expect(CspConverter).toHaveBeenCalledWith(options.resourcesPath);
            expect(RemoveParamConverter).toHaveBeenCalledWith(options.resourcesPath);
            expect(RemoveHeaderConverter).toHaveBeenCalledWith(options.resourcesPath);
            expect(BadFilterConverter).toHaveBeenCalledWith(options.resourcesPath);
        });

        it('should aggregate errors from all converters', async () => {
            const filterId = 4;
            const usedIds = new Set<number>();
            const groupedRules = createGroupedRules({
                [RulesGroup.Regular]: [createNetworkRuleMock()],
                [RulesGroup.Csp]: [createNetworkRuleMock()],
            });

            const regularError = createConversionError(1);
            const cspError = createConversionError(2);
            const generalError = new Error('General error');

            MockedRegularConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules([], [], [regularError]),
            } as any));
            MockedCspConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules([], [], [cspError, generalError]),
            } as any));
            MockedRemoveParamConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedRemoveHeaderConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedBadFilterConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));

            // @ts-expect-error Accessing private method for testing
            const result = await RulesConverter.convertRules(filterId, groupedRules, usedIds);

            expect(result.errors).toHaveLength(3);
            expect(result.errors).toContain(regularError);
            expect(result.errors).toContain(cspError);
            expect(result.errors).toContain(generalError);
        });

        it('should handle single rule group conversion', async () => {
            const filterId = 5;
            const usedIds = new Set<number>();
            const removeParamRule = createNetworkRuleMock({ pattern: 'param.com' });

            const groupedRules = createGroupedRules({
                [RulesGroup.RemoveParam]: [removeParamRule],
            });

            const removeParamConverted = createConvertedRules(
                [createDeclarativeRule(10, 'param.com')],
                [createSource(10, 30, filterId)],
            );

            MockedRegularConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedCspConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            const removeParamConvertMock = vi.fn(async () => createConvertedRules());
            MockedRemoveParamConverter.mockImplementationOnce(() => ({
                convert: removeParamConvertMock,
            } as any));
            MockedRemoveHeaderConverter.mockImplementationOnce(() => ({
                convert: async () => removeParamConverted,
            } as any));
            MockedBadFilterConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));

            // @ts-expect-error Accessing private method for testing
            const result = await RulesConverter.convertRules(filterId, groupedRules, usedIds);

            expect(removeParamConvertMock).toHaveBeenCalledWith(filterId, [removeParamRule], usedIds);
            expect(result.declarativeRules).toEqual([createDeclarativeRule(10, 'param.com')]);
            expect(result.sourceMapValues).toEqual([createSource(10, 30, filterId)]);
        });

        it('should maintain usedIds set across converter calls', async () => {
            const filterId = 6;
            const usedIds = new Set([1, 2, 3]);
            const groupedRules = createGroupedRules({
                [RulesGroup.Regular]: [createNetworkRuleMock()],
                [RulesGroup.Csp]: [createNetworkRuleMock()],
            });

            const regularConvertMock = vi.fn(async () => createConvertedRules());
            MockedRegularConverter.mockImplementationOnce(() => ({
                convert: regularConvertMock,
            } as any));
            const cspConvertMock = vi.fn(async () => createConvertedRules());
            MockedCspConverter.mockImplementationOnce(() => ({
                convert: cspConvertMock,
            } as any));
            const removeParamConvertMock = vi.fn(async () => createConvertedRules());
            MockedRemoveParamConverter.mockImplementationOnce(() => ({
                convert: removeParamConvertMock,
            } as any));
            const removeHeaderConvertMock = vi.fn(async () => createConvertedRules());
            MockedRemoveHeaderConverter.mockImplementationOnce(() => ({
                convert: removeHeaderConvertMock,
            } as any));
            const badFilterConvertMock = vi.fn(async () => createConvertedRules());
            MockedBadFilterConverter.mockImplementationOnce(() => ({
                convert: badFilterConvertMock,
            } as any));

            // @ts-expect-error Accessing private method for testing
            await RulesConverter.convertRules(filterId, groupedRules, usedIds);

            // Verify the same usedIds set was passed to all converters
            expect(regularConvertMock).toHaveBeenCalledWith(filterId, expect.any(Array), usedIds);
            expect(cspConvertMock).toHaveBeenCalledWith(filterId, expect.any(Array), usedIds);
            expect(removeParamConvertMock).toHaveBeenCalledWith(filterId, expect.any(Array), usedIds);
            expect(removeHeaderConvertMock).toHaveBeenCalledWith(filterId, expect.any(Array), usedIds);
            expect(badFilterConvertMock).toHaveBeenCalledWith(filterId, expect.any(Array), usedIds);
        });

        it('should handle mixed successful and error conversions', async () => {
            const filterId = 7;
            const usedIds = new Set<number>();
            const groupedRules = createGroupedRules({
                [RulesGroup.Regular]: [createNetworkRuleMock()],
                [RulesGroup.RemoveHeader]: [createNetworkRuleMock()],
            });

            const successfulResult = createConvertedRules(
                [createDeclarativeRule(100, 'success.com')],
                [createSource(100, 50, filterId)],
            );
            const error = createConversionError(101);
            const errorResult = createConvertedRules([], [], [error]);

            MockedRegularConverter.mockImplementationOnce(() => ({
                convert: async () => successfulResult,
            } as any));
            MockedCspConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedRemoveParamConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedRemoveHeaderConverter.mockImplementationOnce(() => ({
                convert: async () => errorResult,
            } as any));
            MockedBadFilterConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));

            // @ts-expect-error Accessing private method for testing
            const result = await RulesConverter.convertRules(filterId, groupedRules, usedIds);

            expect(result.declarativeRules).toEqual([createDeclarativeRule(100, 'success.com')]);
            expect(result.sourceMapValues).toEqual([createSource(100, 50, filterId)]);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0]).toEqual(error);
        });

        it('should process all rule groups in parallel', async () => {
            const filterId = 8;
            const usedIds = new Set<number>();
            const groupedRules = createGroupedRules({
                [RulesGroup.Regular]: [createNetworkRuleMock()],
                [RulesGroup.Csp]: [createNetworkRuleMock()],
                [RulesGroup.RemoveParam]: [createNetworkRuleMock()],
                [RulesGroup.RemoveHeader]: [createNetworkRuleMock()],
                [RulesGroup.BadFilter]: [createNetworkRuleMock()],
            });

            // Create promises that we can control
            let regularResolve: (value: ConvertedRules) => void;
            let cspResolve: (value: ConvertedRules) => void;
            let removeParamResolve: (value: ConvertedRules) => void;
            let removeHeaderResolve: (value: ConvertedRules) => void;
            let badFilterResolve: (value: ConvertedRules) => void;

            const regularPromise = new Promise<ConvertedRules>((resolve) => { regularResolve = resolve; });
            const cspPromise = new Promise<ConvertedRules>((resolve) => { cspResolve = resolve; });
            const removeParamPromise = new Promise<ConvertedRules>((resolve) => { removeParamResolve = resolve; });
            const removeHeaderPromise = new Promise<ConvertedRules>((resolve) => { removeHeaderResolve = resolve; });
            const badFilterPromise = new Promise<ConvertedRules>((resolve) => { badFilterResolve = resolve; });

            const regularConvertMock = vi.fn(async () => regularPromise);
            MockedRegularConverter.mockImplementationOnce(() => ({
                convert: regularConvertMock,
            } as any));
            const cspConvertMock = vi.fn(async () => cspPromise);
            MockedCspConverter.mockImplementationOnce(() => ({
                convert: cspConvertMock,
            } as any));
            const removeParamConvertMock = vi.fn(async () => removeParamPromise);
            MockedRemoveParamConverter.mockImplementationOnce(() => ({
                convert: removeParamConvertMock,
            } as any));
            const removeHeaderConvertMock = vi.fn(async () => removeHeaderPromise);
            MockedRemoveHeaderConverter.mockImplementationOnce(() => ({
                convert: removeHeaderConvertMock,
            } as any));
            const badFilterConvertMock = vi.fn(async () => badFilterPromise);
            MockedBadFilterConverter.mockImplementationOnce(() => ({
                convert: badFilterConvertMock,
            } as any));

            // @ts-expect-error Accessing private method for testing
            const resultPromise = RulesConverter.convertRules(filterId, groupedRules, usedIds);

            // Verify all converters were called immediately (parallel execution)
            expect(regularConvertMock).toHaveBeenCalled();
            expect(cspConvertMock).toHaveBeenCalled();
            expect(removeParamConvertMock).toHaveBeenCalled();
            expect(removeHeaderConvertMock).toHaveBeenCalled();
            expect(badFilterConvertMock).toHaveBeenCalled();

            // Resolve promises in different order to test parallel execution
            cspResolve!(createConvertedRules([createDeclarativeRule(2)], [createSource(2, 2, filterId)]));
            removeParamResolve!(createConvertedRules([createDeclarativeRule(3)], [createSource(3, 3, filterId)]));
            regularResolve!(createConvertedRules([createDeclarativeRule(1)], [createSource(1, 1, filterId)]));
            badFilterResolve!(createConvertedRules([createDeclarativeRule(5)], [createSource(5, 5, filterId)]));
            removeHeaderResolve!(createConvertedRules([createDeclarativeRule(4)], [createSource(4, 4, filterId)]));

            const result = await resultPromise;

            // Results should be aggregated regardless of resolution order
            expect(result.declarativeRules).toHaveLength(5);
            expect(result.sourceMapValues).toHaveLength(5);
            expect(result.errors).toEqual([]);
        });

        it('should handle converter instantiation with undefined resourcesPath', async () => {
            const filterId = 9;
            const usedIds = new Set<number>();
            const groupedRules = createGroupedRules({
                [RulesGroup.Regular]: [createNetworkRuleMock()],
            });

            MockedRegularConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedCspConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedRemoveParamConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedRemoveHeaderConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));
            MockedBadFilterConverter.mockImplementationOnce(() => ({
                convert: async () => createConvertedRules(),
            } as any));

            // @ts-expect-error Accessing private method for testing
            await RulesConverter.convertRules(filterId, groupedRules, usedIds);

            // Verify converters were instantiated with undefined resourcesPath
            expect(RegularConverter).toHaveBeenCalledWith(undefined);
            expect(CspConverter).toHaveBeenCalledWith(undefined);
            expect(RemoveParamConverter).toHaveBeenCalledWith(undefined);
            expect(RemoveHeaderConverter).toHaveBeenCalledWith(undefined);
            expect(BadFilterConverter).toHaveBeenCalledWith(undefined);
        });
    });

    describe('applyBadFilter', () => {
        it('should filter out rules negated by badfilter rules', () => {
            const regularRule1 = createNetworkRuleMock({ pattern: 'example.com' });
            const regularRule2 = createNetworkRuleMock({ pattern: 'test.com' });
            const badFilterRule = createNetworkRuleMock({
                pattern: 'example.com',
                enabledOptions: [NetworkRuleOption.Badfilter],
                negatesBadfilter: (rule) => rule === regularRule1,
            });

            const scannedFilters = [
                createScannedFilter(1, [regularRule1, regularRule2, badFilterRule], [badFilterRule]),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.applyBadFilter(scannedFilters);

            expect(result).toHaveLength(1);
            expect(result[0][0]).toBe(1); // filter id

            const groupedRules = result[0][1];
            // regularRule1 should be filtered out, regularRule2 should remain
            expect(groupedRules[RulesGroup.Regular]).toEqual([regularRule2]);
            // badfilter rules should be cleared
            expect(groupedRules[RulesGroup.BadFilter]).toEqual([]);
        });

        it('should keep rules not negated by badfilter rules', () => {
            const regularRule1 = createNetworkRuleMock({ pattern: 'example.com' });
            const regularRule2 = createNetworkRuleMock({ pattern: 'test.com' });
            const badFilterRule = createNetworkRuleMock({
                pattern: 'different.com',
                enabledOptions: [NetworkRuleOption.Badfilter],
            });

            const scannedFilters = [
                createScannedFilter(1, [regularRule1, regularRule2], [badFilterRule]),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.applyBadFilter(scannedFilters);

            expect(result).toHaveLength(1);
            expect(result[0][0]).toBe(1); // filter id

            const groupedRules = result[0][1];
            // Both rules should remain
            expect(groupedRules[RulesGroup.Regular]).toEqual([regularRule1, regularRule2]);
            // badfilter rules should be cleared
            expect(groupedRules[RulesGroup.BadFilter]).toEqual([]);
        });

        it('should handle empty scanned filters array', () => {
            const scannedFilters: ScannedFilter[] = [];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.applyBadFilter(scannedFilters);

            expect(result).toEqual([]);
        });

        it('should handle filters with no rules', () => {
            const scannedFilters = [
                createScannedFilter(1, [], []),
                createScannedFilter(2, [], []),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.applyBadFilter(scannedFilters);

            expect(result).toHaveLength(2);
            expect(result[0][0]).toBe(1);
            expect(result[1][0]).toBe(2);

            // All rule groups should be empty
            const groupedRules1 = result[0][1];
            const groupedRules2 = result[1][1];

            Object.values(RulesGroup).forEach((group) => {
                if (typeof group === 'number') {
                    expect(groupedRules1[group]).toEqual([]);
                    expect(groupedRules2[group]).toEqual([]);
                }
            });
        });

        it('should handle filters with no badfilter rules', () => {
            const regularRule1 = createNetworkRuleMock({ pattern: 'example.com' });
            const regularRule2 = createNetworkRuleMock({ pattern: 'test.com' });

            const scannedFilters = [
                createScannedFilter(1, [regularRule1, regularRule2], []),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.applyBadFilter(scannedFilters);

            expect(result).toHaveLength(1);
            expect(result[0][0]).toBe(1); // filter id

            const groupedRules = result[0][1];
            // All rules should remain since there are no badfilter rules
            expect(groupedRules[RulesGroup.Regular]).toEqual([regularRule1, regularRule2]);
            expect(groupedRules[RulesGroup.BadFilter]).toEqual([]);
        });

        it('should apply badfilter rules across multiple filters', () => {
            const regularRule1 = createNetworkRuleMock({ pattern: 'example.com' });
            const regularRule2 = createNetworkRuleMock({ pattern: 'test.com' });
            const regularRule3 = createNetworkRuleMock({ pattern: 'another.com' });

            const badFilterRule1 = createNetworkRuleMock({
                pattern: 'example.com',
                enabledOptions: [NetworkRuleOption.Badfilter],
                negatesBadfilter: (rule) => rule === regularRule1,
            });
            const badFilterRule2 = createNetworkRuleMock({
                pattern: 'another.com',
                enabledOptions: [NetworkRuleOption.Badfilter],
                negatesBadfilter: (rule) => rule === regularRule3,
            });

            const scannedFilters = [
                createScannedFilter(1, [regularRule1, regularRule2, badFilterRule1], [badFilterRule1]),
                createScannedFilter(2, [regularRule3, badFilterRule2], [badFilterRule2]),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.applyBadFilter(scannedFilters);

            expect(result).toHaveLength(2);

            // Filter 1: regularRule1 should be filtered out, regularRule2 should remain
            const groupedRules1 = result[0][1];
            expect(groupedRules1[RulesGroup.Regular]).toEqual([regularRule2]);
            expect(groupedRules1[RulesGroup.BadFilter]).toEqual([]);

            // Filter 2: regularRule3 should be filtered out
            const groupedRules2 = result[1][1];
            expect(groupedRules2[RulesGroup.Regular]).toEqual([]);
            expect(groupedRules2[RulesGroup.BadFilter]).toEqual([]);
        });

        it('should handle different rule types correctly', () => {
            const regularRule = createNetworkRuleMock({ pattern: 'example.com' });
            const cspRule = createNetworkRuleMock({
                pattern: 'test.com',
                enabledOptions: [NetworkRuleOption.Csp],
            });
            const removeParamRule = createNetworkRuleMock({
                pattern: 'param.com',
                enabledOptions: [NetworkRuleOption.RemoveParam],
            });
            const badFilterRule = createNetworkRuleMock({
                pattern: 'example.com',
                enabledOptions: [NetworkRuleOption.Badfilter],
                negatesBadfilter: (rule) => rule === regularRule,
            });

            const scannedFilters = [
                createScannedFilter(1, [regularRule, cspRule, removeParamRule, badFilterRule], [badFilterRule]),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.applyBadFilter(scannedFilters);

            expect(result).toHaveLength(1);

            const groupedRules = result[0][1];
            // Regular rule should be filtered out
            expect(groupedRules[RulesGroup.Regular]).toEqual([]);
            // Other rule types should remain
            expect(groupedRules[RulesGroup.Csp]).toEqual([cspRule]);
            expect(groupedRules[RulesGroup.RemoveParam]).toEqual([removeParamRule]);
            // badfilter rules should be cleared
            expect(groupedRules[RulesGroup.BadFilter]).toEqual([]);
        });

        it('should handle multiple badfilter rules affecting the same regular rule', () => {
            const regularRule = createNetworkRuleMock({ pattern: 'example.com' });
            const badFilterRule1 = createNetworkRuleMock({
                pattern: 'example.com',
                enabledOptions: [NetworkRuleOption.Badfilter],
                negatesBadfilter: (rule) => rule === regularRule,
            });
            const badFilterRule2 = createNetworkRuleMock({
                pattern: 'example.com',
                enabledOptions: [NetworkRuleOption.Badfilter],
                negatesBadfilter: (rule) => rule === regularRule,
            });

            const scannedFilters = [
                createScannedFilter(1, [regularRule, badFilterRule1, badFilterRule2], [badFilterRule1, badFilterRule2]),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.applyBadFilter(scannedFilters);

            expect(result).toHaveLength(1);

            const groupedRules = result[0][1];
            // Regular rule should be filtered out (even though multiple badfilter rules affect it)
            expect(groupedRules[RulesGroup.Regular]).toEqual([]);
            expect(groupedRules[RulesGroup.BadFilter]).toEqual([]);
        });

        it('should preserve filter IDs correctly', () => {
            const regularRule1 = createNetworkRuleMock({ pattern: 'example.com' });
            const regularRule2 = createNetworkRuleMock({ pattern: 'test.com' });
            const regularRule3 = createNetworkRuleMock({ pattern: 'another.com' });

            const scannedFilters = [
                createScannedFilter(100, [regularRule1], []),
                createScannedFilter(200, [regularRule2], []),
                createScannedFilter(300, [regularRule3], []),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.applyBadFilter(scannedFilters);

            expect(result).toHaveLength(3);
            expect(result[0][0]).toBe(100);
            expect(result[1][0]).toBe(200);
            expect(result[2][0]).toBe(300);

            // Verify rules are preserved with correct filter IDs
            expect(result[0][1][RulesGroup.Regular]).toEqual([regularRule1]);
            expect(result[1][1][RulesGroup.Regular]).toEqual([regularRule2]);
            expect(result[2][1][RulesGroup.Regular]).toEqual([regularRule3]);
        });
    });

    describe('checkLimitations', () => {
        it('should return unchanged rules when no limits are specified', () => {
            const declarativeRules = [
                createDeclarativeRule(1, 'example.com'),
                createDeclarativeRule(2, 'test.com'),
                createDeclarativeRule(3, '^https?:\\/\\/regex\\.com\\/.*$', true),
            ];
            const sourceMapValues = [
                createSource(1, 10, 100),
                createSource(2, 20, 200),
                createSource(3, 30, 300),
            ];
            const errors = [createConversionError(1)];
            const converted = createConvertedRules(declarativeRules, sourceMapValues, errors);

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(converted);

            expect(result.declarativeRules).toEqual(declarativeRules);
            expect(result.sourceMapValues).toEqual(sourceMapValues);
            expect(result.errors).toEqual(errors);
            expect(result.limitations).toEqual([]);
        });

        it('should return unchanged rules when limits are not exceeded', () => {
            const declarativeRules = [
                createDeclarativeRule(1, 'example.com'),
                createDeclarativeRule(2, 'test.com'),
            ];
            const sourceMapValues = [
                createSource(1, 10, 100),
                createSource(2, 20, 200),
            ];
            const converted = createConvertedRules(declarativeRules, sourceMapValues);

            // Mock isSafeRule to return true for all rules
            isSafeRuleMocked.mockReturnValue(true);

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(
                converted,
                5, // maxNumberOfRules
                3, // maxNumberOfUnsafeRules
                2, // maxNumberOfRegexpRules
            );

            expect(result.declarativeRules).toEqual(declarativeRules);
            expect(result.sourceMapValues).toEqual(sourceMapValues);
            expect(result.limitations).toEqual([]);
        });

        it('should enforce maximum number of rules limit', () => {
            const declarativeRules = [
                createDeclarativeRule(1, 'example.com'),
                createDeclarativeRule(2, 'test.com'),
                createDeclarativeRule(3, 'another.com'),
            ];
            const sourceMapValues = [
                createSource(1, 10, 100),
                createSource(2, 20, 200),
                createSource(3, 30, 300),
            ];
            const converted = createConvertedRules(declarativeRules, sourceMapValues);

            // Mock isSafeRule to return true for all rules
            isSafeRuleMocked.mockReturnValue(true);

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(
                converted,
                2, // maxNumberOfRules - limit to 2 rules
            );

            expect(result.declarativeRules).toHaveLength(2);
            expect(result.declarativeRules).toEqual([
                createDeclarativeRule(1, 'example.com'),
                createDeclarativeRule(2, 'test.com'),
            ]);
            expect(result.sourceMapValues).toHaveLength(2);
            expect(result.limitations).toHaveLength(1);
            expect(result.limitations![0]).toBeInstanceOf(TooManyRulesError);
            expect(result.limitations![0].message).toContain(
                'too many declarative rules remain: 3 exceeds the limit provided - 2',
            );
        });

        it('should enforce maximum number of unsafe rules limit', () => {
            const declarativeRules = [
                createDeclarativeRule(1, 'safe1.com'),
                createDeclarativeRule(2, 'unsafe1.com'),
                createDeclarativeRule(3, 'unsafe2.com'),
                createDeclarativeRule(4, 'safe2.com'),
            ];
            const sourceMapValues = [
                createSource(1, 10, 100),
                createSource(2, 20, 200),
                createSource(3, 30, 300),
                createSource(4, 40, 400),
            ];
            const converted = createConvertedRules(declarativeRules, sourceMapValues);

            // Mock isSafeRule: rules 1 and 4 are safe, rules 2 and 3 are unsafe
            isSafeRuleMocked.mockImplementation((rule) => {
                return rule.id === 1 || rule.id === 4;
            });

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(
                converted,
                10, // maxNumberOfRules - high enough to not trigger
                1, // maxNumberOfUnsafeRules - limit to 1 unsafe rule
            );

            // Should keep safe rules and only 1 unsafe rule
            expect(result.declarativeRules).toHaveLength(3);
            expect(result.declarativeRules.map((r) => r.id)).toEqual([1, 2, 4]);
            expect(result.sourceMapValues).toHaveLength(3);
            expect(result.limitations).toHaveLength(1);
            expect(result.limitations![0]).toBeInstanceOf(TooManyUnsafeRulesError);
            expect(result.limitations![0].message).toContain(
                'too many unsafe rules remain: 2 exceeds the limit provided - 1',
            );
        });

        it('should enforce maximum number of regex rules limit', () => {
            const declarativeRules = [
                createDeclarativeRule(1, 'example.com'), // non-regex
                createDeclarativeRule(2, '^https?:\\/\\/regex1\\.com\\/.*$', true), // regex
                createDeclarativeRule(3, '^https?:\\/\\/regex2\\.com\\/.*$', true), // regex
                createDeclarativeRule(4, 'test.com'), // non-regex
            ];
            const sourceMapValues = [
                createSource(1, 10, 100),
                createSource(2, 20, 200),
                createSource(3, 30, 300),
                createSource(4, 40, 400),
            ];
            const converted = createConvertedRules(declarativeRules, sourceMapValues);

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(
                converted,
                undefined, // maxNumberOfRules
                undefined, // maxNumberOfUnsafeRules
                1, // maxNumberOfRegexpRules - limit to 1 regex rule
            );

            // Should keep non-regex rules and only 1 regex rule
            expect(result.declarativeRules).toHaveLength(3);
            expect(result.declarativeRules.map((r) => r.id)).toEqual([1, 2, 4]);
            expect(result.sourceMapValues).toHaveLength(3);
            expect(result.limitations).toHaveLength(1);
            expect(result.limitations![0]).toBeInstanceOf(TooManyRegexpRulesError);
            expect(result.limitations![0].message).toContain(
                'too many regexp rules remain: 2 exceeds the limit provided - 1',
            );
        });

        it('should handle empty declarative rules array', () => {
            const converted = createConvertedRules([], []);

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(
                converted,
                5, // maxNumberOfRules
                3, // maxNumberOfUnsafeRules
                2, // maxNumberOfRegexpRules
            );

            expect(result.declarativeRules).toEqual([]);
            expect(result.sourceMapValues).toEqual([]);
            expect(result.limitations).toEqual([]);
        });

        it('should handle combination of all limits', () => {
            const declarativeRules = [
                createDeclarativeRule(1, 'safe.com'), // safe, non-regex
                createDeclarativeRule(2, 'unsafe.com'), // unsafe, non-regex
                createDeclarativeRule(3, '^https?:\\/\\/unsafe-regex\\.com\\/.*$', true), // unsafe, regex
                createDeclarativeRule(4, '^https?:\\/\\/safe-regex\\.com\\/.*$', true), // safe, regex
                createDeclarativeRule(5, 'another-unsafe.com'), // unsafe, non-regex
            ];
            const sourceMapValues = declarativeRules.map((rule, index) => (
                createSource(rule.id, (index + 1) * 10, (index + 1) * 100)
            ));
            const converted = createConvertedRules(declarativeRules, sourceMapValues);

            // Mock isSafeRule: rules 1 and 4 are safe, others are unsafe
            isSafeRuleMocked.mockImplementation((rule) => {
                return rule.id === 1 || rule.id === 4;
            });

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(
                converted,
                3, // maxNumberOfRules - limit to 3 rules total
                1, // maxNumberOfUnsafeRules - limit to 1 unsafe rule
                1, // maxNumberOfRegexpRules - limit to 1 regex rule
            );

            // Should apply all limits: max 3 rules, max 1 unsafe, max 1 regex
            // Expected: rule 1 (safe, non-regex), rule 2 (unsafe, non-regex), rule 4 (safe, regex)
            // Rule 3 should be excluded due to regex limit, rule 5 should be excluded due to total limit
            expect(result.declarativeRules).toHaveLength(2);
            expect(result.declarativeRules.map((r) => r.id)).toEqual([1, 2]);
            expect(result.limitations).toHaveLength(2);

            // Check for all three types of limitation errors
            const limitationTypes = result.limitations!.map((l) => l.constructor.name);
            expect(limitationTypes).toContain('TooManyUnsafeRulesError');
            expect(limitationTypes).toContain('TooManyRulesError');
        });

        it('should properly handle conversion errors and filter them correctly', () => {
            const declarativeRules = [
                createDeclarativeRule(1, 'example.com'),
                createDeclarativeRule(2, 'test.com'),
                createDeclarativeRule(3, 'another.com'),
            ];
            const sourceMapValues = [
                createSource(1, 10, 100),
                createSource(2, 20, 200),
                createSource(3, 30, 300),
            ];
            const conversionErrors = [
                createConversionError(1),
                createConversionError(3),
            ];
            const otherErrors = [new Error('Some other error')];
            const allErrors = [...conversionErrors, ...otherErrors];

            const converted = createConvertedRules(declarativeRules, sourceMapValues, allErrors);

            // Mock isSafeRule to return true for all rules
            isSafeRuleMocked.mockReturnValue(true);

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(
                converted,
                2, // maxNumberOfRules - will remove rule 3
            );

            expect(result.declarativeRules).toHaveLength(2);
            expect(result.declarativeRules.map((r) => r.id)).toEqual([1, 2]);

            // Should keep conversion errors for remaining rules and all other errors
            expect(result.errors).toHaveLength(2); // 1 conversion error for rule 1 + 1 other error
            expect(result.errors).toContain(conversionErrors[0]); // Error for rule 1
            expect(result.errors).toContain(otherErrors[0]); // Other error
            expect(result.errors).not.toContain(conversionErrors[1]); // Error for rule 3 should be removed
        });

        it('should properly manage multiple errors on same declarative rule', () => {
            const declarativeRules = [createDeclarativeRule(1, 'example.com')];
            const sourceMapValues = [createSource(1, 10, 100)];
            const allErrors = [
                createConversionError(1),
                createConversionError(1),
            ];
            const converted = createConvertedRules(declarativeRules, sourceMapValues, allErrors);

            isSafeRuleMocked.mockReturnValue(true);

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(converted);

            expect(result.errors).toEqual(allErrors);
        });

        it('should properly manage multiple sources on same declarative rule', () => {
            const declarativeRules = [createDeclarativeRule(1, 'example.com')];
            const allErrors = [createConversionError(1)];
            const sourceMapValues = [
                createSource(1, 10, 100),
                createSource(1, 20, 200),
            ];
            const converted = createConvertedRules(declarativeRules, sourceMapValues, allErrors);

            isSafeRuleMocked.mockReturnValue(true);

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkLimitations(converted);

            expect(result.sourceMapValues).toEqual(sourceMapValues);
        });
    });

    describe('removeTruncatedRuleSourcesAndErrors', () => {
        it('should clear sources and errors for the specified rule ID', () => {
            const ruleId = 1;
            const sourcesIndex = new Map<number, Source[]>();
            const errorsIndex = new Map<number, ConversionError[]>();
            const excludedRulesIds: number[] = [];

            // Setup initial data
            const sources = [
                createSource(ruleId, 10, 100),
                createSource(ruleId, 20, 200),
            ];
            const errors = [createConversionError(ruleId)];

            sourcesIndex.set(ruleId, sources);
            errorsIndex.set(ruleId, errors);

            // @ts-expect-error Accessing private method for testing
            RulesConverter.removeTruncatedRuleSourcesAndErrors(
                ruleId,
                sourcesIndex,
                errorsIndex,
                excludedRulesIds,
            );

            // Verify sources are cleared
            expect(sourcesIndex.get(ruleId)).toEqual([]);

            // Verify errors are cleared
            expect(errorsIndex.get(ruleId)).toEqual([]);

            // Verify excluded rule IDs are populated with source rule indices
            expect(excludedRulesIds).toEqual([10, 20]);
        });

        it('should handle empty sources array', () => {
            const ruleId = 2;
            const sourcesIndex = new Map<number, Source[]>();
            const errorsIndex = new Map<number, ConversionError[]>();
            const excludedRulesIds: number[] = [];

            // Setup with empty sources but with errors
            sourcesIndex.set(ruleId, []);
            errorsIndex.set(ruleId, [createConversionError(ruleId)]);

            // @ts-expect-error Accessing private method for testing
            RulesConverter.removeTruncatedRuleSourcesAndErrors(
                ruleId,
                sourcesIndex,
                errorsIndex,
                excludedRulesIds,
            );

            // Verify sources remain empty
            expect(sourcesIndex.get(ruleId)).toEqual([]);

            // Verify errors are cleared
            expect(errorsIndex.get(ruleId)).toEqual([]);

            // Verify no rule IDs are added to excluded list
            expect(excludedRulesIds).toEqual([]);
        });

        it('should handle missing rule ID in sources index', () => {
            const ruleId = 3;
            const sourcesIndex = new Map<number, Source[]>();
            const errorsIndex = new Map<number, ConversionError[]>();
            const excludedRulesIds: number[] = [];

            // Setup with errors but no sources entry
            errorsIndex.set(ruleId, [createConversionError(ruleId)]);

            // @ts-expect-error Accessing private method for testing
            RulesConverter.removeTruncatedRuleSourcesAndErrors(
                ruleId,
                sourcesIndex,
                errorsIndex,
                excludedRulesIds,
            );

            // Verify sources are set to empty array
            expect(sourcesIndex.get(ruleId)).toEqual([]);

            // Verify errors are cleared
            expect(errorsIndex.get(ruleId)).toEqual([]);

            // Verify no rule IDs are added to excluded list
            expect(excludedRulesIds).toEqual([]);
        });

        it('should handle multiple sources with different filter IDs', () => {
            const ruleId = 4;
            const sourcesIndex = new Map<number, Source[]>();
            const errorsIndex = new Map<number, ConversionError[]>();
            const excludedRulesIds: number[] = [];

            // Setup with multiple sources from different filters
            const sources = [
                createSource(ruleId, 5, 100),
                createSource(ruleId, 15, 200),
                createSource(ruleId, 25, 300),
            ];

            sourcesIndex.set(ruleId, sources);
            errorsIndex.set(ruleId, [createConversionError(ruleId)]);

            // @ts-expect-error Accessing private method for testing
            RulesConverter.removeTruncatedRuleSourcesAndErrors(
                ruleId,
                sourcesIndex,
                errorsIndex,
                excludedRulesIds,
            );

            // Verify sources are cleared
            expect(sourcesIndex.get(ruleId)).toEqual([]);

            // Verify errors are cleared
            expect(errorsIndex.get(ruleId)).toEqual([]);

            // Verify all source rule indices are added to excluded list
            expect(excludedRulesIds).toEqual([5, 15, 25]);
        });

        it('should append to existing excludedRulesIds array', () => {
            const ruleId = 5;
            const sourcesIndex = new Map<number, Source[]>();
            const errorsIndex = new Map<number, ConversionError[]>();
            const excludedRulesIds: number[] = [1, 2, 3]; // Pre-existing IDs

            // Setup with sources
            const sources = [
                createSource(ruleId, 10, 100),
                createSource(ruleId, 20, 200),
            ];

            sourcesIndex.set(ruleId, sources);
            errorsIndex.set(ruleId, [createConversionError(ruleId)]);

            // @ts-expect-error Accessing private method for testing
            RulesConverter.removeTruncatedRuleSourcesAndErrors(
                ruleId,
                sourcesIndex,
                errorsIndex,
                excludedRulesIds,
            );

            // Verify sources are cleared
            expect(sourcesIndex.get(ruleId)).toEqual([]);

            // Verify errors are cleared
            expect(errorsIndex.get(ruleId)).toEqual([]);

            // Verify new rule IDs are appended to existing excluded list
            expect(excludedRulesIds).toEqual([1, 2, 3, 10, 20]);
        });

        it('should handle empty errors array', () => {
            const ruleId = 6;
            const sourcesIndex = new Map<number, Source[]>();
            const errorsIndex = new Map<number, ConversionError[]>();
            const excludedRulesIds: number[] = [];

            // Setup with sources but empty errors
            const sources = [createSource(ruleId, 30, 300)];
            sourcesIndex.set(ruleId, sources);
            errorsIndex.set(ruleId, []);

            // @ts-expect-error Accessing private method for testing
            RulesConverter.removeTruncatedRuleSourcesAndErrors(
                ruleId,
                sourcesIndex,
                errorsIndex,
                excludedRulesIds,
            );

            // Verify sources are cleared
            expect(sourcesIndex.get(ruleId)).toEqual([]);

            // Verify errors remain empty
            expect(errorsIndex.get(ruleId)).toEqual([]);

            // Verify source rule index is added to excluded list
            expect(excludedRulesIds).toEqual([30]);
        });
    });

    describe('isRegexRule', () => {
        it('should return true for regex rules', () => {
            const rule = createDeclarativeRule(1, '^https?:\\/\\/example\\.com\\/.*$', true);
            expect(RulesConverter.isRegexRule(rule)).toBe(true);
        });

        it('should return false for non-regex rules', () => {
            const rule = createDeclarativeRule(2, 'example.com');
            expect(RulesConverter.isRegexRule(rule)).toBe(false);
        });
    });

    describe('checkRulesHaveUniqueIds', () => {
        it('returns true for unique IDs', () => {
            const rules = [
                createDeclarativeRule(1),
                createDeclarativeRule(2),
                createDeclarativeRule(3),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkRulesHaveUniqueIds(rules);
            expect(result).toBe(true);
        });

        it('returns false for duplicate IDs', () => {
            const rules = [
                createDeclarativeRule(1),
                createDeclarativeRule(2),
                createDeclarativeRule(1),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkRulesHaveUniqueIds(rules);
            expect(result).toBe(false);
        });
    });

    describe('checkRulesHaveCorrectIds', () => {
        it('returns true for correct IDs', () => {
            const rules = [
                createDeclarativeRule(MIN_DECLARATIVE_RULE_ID),
                createDeclarativeRule(MIN_DECLARATIVE_RULE_ID + 1),
                createDeclarativeRule(MAX_DECLARATIVE_RULE_ID - 1),
                createDeclarativeRule(MAX_DECLARATIVE_RULE_ID),
            ];

            // @ts-expect-error Accessing private method for testing
            const result = RulesConverter.checkRulesHaveCorrectIds(rules);
            expect(result).toBe(true);
        });

        it('returns false for incorrect IDs', () => {
            // @ts-expect-error Accessing private method for testing
            const result1 = RulesConverter.checkRulesHaveCorrectIds([
                createDeclarativeRule(MIN_DECLARATIVE_RULE_ID - 1),
            ]);
            expect(result1).toBe(false);

            // @ts-expect-error Accessing private method for testing
            const result2 = RulesConverter.checkRulesHaveCorrectIds([
                createDeclarativeRule(MAX_DECLARATIVE_RULE_ID + 1),
            ]);
            expect(result2).toBe(false);
        });
    });
});
