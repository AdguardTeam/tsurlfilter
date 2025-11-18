import { RuleCategory } from '@adguard/agtree';
import { FilterListParser } from '@adguard/agtree/parser';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { MaxScannedRulesError } from '../../../src/errors/limitation-errors/max-scanned-rules-error';
import { RulesScanner } from '../../../src/filter-converter/rules-scanner';
import { type Filter } from '../../../src/filter-converter/types';
import { NetworkRule, NetworkRuleOption } from '../../../src/network-rule';
import { createNetworkRuleMock } from '../../mocks/network-rule';

vi.mock('@adguard/agtree/parser', () => ({
    FilterListParser: { parse: vi.fn() },
}));

vi.mock('../../../src/network-rule', async () => ({
    ...(await vi.importActual('../../../src/network-rule')),
    NetworkRule: { parseFromNode: vi.fn() },
}));

const createFilter = (rules: string[] = [], id = 1): Filter => ({
    id,
    content: rules.join('\n'),
});

const parserMock = vi.mocked(FilterListParser.parse);
const parseFromNodeMock = vi.mocked(NetworkRule.parseFromNode);

describe('RulesScanner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    describe('scanFilters', () => {
        it('should scan multiple filters and return scanned results', () => {
            const filter1Rule1 = '||example.com^';
            const filter1 = createFilter([filter1Rule1], 1);
            const mockAst1 = {
                children: [{
                    category: RuleCategory.Network,
                    start: 0,
                    raws: { text: filter1Rule1 },
                }],
            };
            parserMock.mockReturnValueOnce(mockAst1 as any);
            const mockRule1 = createNetworkRuleMock({
                filterListId: 1,
                pattern: filter1Rule1,
                index: 0,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule1]);

            const filter2Rule1 = '@@||allowed.com^';
            const filter2 = createFilter([filter2Rule1], 2);
            const mockAst2 = {
                children: [{
                    category: RuleCategory.Network,
                    start: 0,
                    raws: { text: filter2Rule1 },
                }],
            };
            parserMock.mockReturnValueOnce(mockAst2 as any);
            const mockRule2 = createNetworkRuleMock({
                filterListId: 2,
                pattern: filter2Rule1,
                index: 0,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule2]);

            const result = RulesScanner.scanFilters([filter1, filter2]);
            expect(result).toEqual({
                errors: [],
                filters: [
                    {
                        id: 1,
                        rules: [mockRule1],
                        badFilterRules: [],
                    },
                    {
                        id: 2,
                        rules: [mockRule2],
                        badFilterRules: [],
                    },
                ],
            });
        });

        it('should apply filter function to rules', () => {
            const filterRule1 = '||example.com^';
            const filterRule2 = '||blocked.com^';
            const filter = createFilter([filterRule1, filterRule2]);
            const mockAst = {
                children: [
                    {
                        category: RuleCategory.Network,
                        start: 0,
                        raws: { text: filterRule1 },
                    },
                    {
                        category: RuleCategory.Network,
                        start: 14,
                        raws: { text: filterRule2 },
                    },
                ],
            };
            parserMock.mockReturnValue(mockAst as any);
            const mockRule1 = createNetworkRuleMock({
                filterListId: 1,
                pattern: filterRule1,
                index: 0,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule1]);
            const mockRule2 = createNetworkRuleMock({
                filterListId: 1,
                pattern: filterRule2,
                index: 14,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule2]);

            const filterFn = vi.fn((rule: any) => rule.pattern === '||example.com^');
            const result = RulesScanner.scanFilters([filter], filterFn);

            expect(filterFn).toHaveBeenCalledTimes(2);
            expect(result).toEqual({
                errors: [],
                filters: [{
                    id: 1,
                    rules: [mockRule1],
                    badFilterRules: [],
                }],
            });
        });

        it('should separate badfilter rules', () => {
            const filterRule1 = '||example.com^';
            const filterRule2 = '||example.com^$badfilter';
            const filter = createFilter([filterRule1, filterRule2]);
            const mockAst = {
                children: [
                    {
                        category: RuleCategory.Network,
                        start: 0,
                        raws: { text: filterRule1 },
                    },
                    {
                        category: RuleCategory.Network,
                        start: 14,
                        raws: { text: filterRule2 },
                    },
                ],
            };
            parserMock.mockReturnValue(mockAst as any);
            const mockRule1 = createNetworkRuleMock({
                filterListId: 1,
                pattern: filterRule1,
                enabledOptions: [],
                index: 0,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule1]);
            const mockRule2 = createNetworkRuleMock({
                filterListId: 1,
                pattern: filterRule2,
                enabledOptions: [NetworkRuleOption.Badfilter],
                index: 14,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule2]);

            const result = RulesScanner.scanFilters([filter]);
            expect(result).toEqual({
                errors: [],
                filters: [{
                    id: 1,
                    rules: [mockRule1, mockRule2],
                    badFilterRules: [mockRule2],
                }],
            });
        });

        it('should handle parsing errors', () => {
            const filterRule = 'invalid rule';
            const filter = createFilter([filterRule]);
            const mockAst = {
                children: [{
                    category: RuleCategory.Invalid,
                    start: 0,
                    raws: { text: filterRule },
                    error: {
                        name: 'ParseError',
                        message: 'Invalid rule syntax',
                    },
                }],
            };
            parserMock.mockReturnValue(mockAst as any);

            const result = RulesScanner.scanFilters([filter]);

            expect(result).toEqual({
                errors: [new Error(
                    `[ParseError] Invalid rule syntax: filter id - 1, line index - 0, line - ${filterRule}`,
                )],
                filters: [{
                    id: 1,
                    rules: [],
                    badFilterRules: [],
                }],
            });
        });

        it('should handle NetworkRule creation errors', () => {
            const filterRule = '||example.com^';
            const filter = createFilter([filterRule]);
            const mockAst = {
                children: [{
                    category: RuleCategory.Network,
                    start: 0,
                    raws: { text: filterRule },
                }],
            };
            parserMock.mockReturnValue(mockAst as any);
            parseFromNodeMock.mockImplementation(() => {
                throw new Error('NetworkRule creation failed');
            });

            const result = RulesScanner.scanFilters([filter]);
            expect(result).toEqual({
                errors: [new Error('NetworkRule creation failed')],
                filters: [{
                    id: 1,
                    rules: [],
                    badFilterRules: [],
                }],
            });
        });

        it('should handle unknown errors during NetworkRule creation', () => {
            const filterRule = '||example.com^';
            const filter = createFilter([filterRule]);
            const mockAst = {
                children: [{
                    category: RuleCategory.Network,
                    start: 0,
                    raws: { text: filterRule },
                }],
            };
            parserMock.mockReturnValue(mockAst as any);
            parseFromNodeMock.mockImplementation(() => {
                // eslint-disable-next-line @typescript-eslint/no-throw-literal
                throw 'Unknown error';
            });

            const result = RulesScanner.scanFilters([filter]);

            expect(result).toEqual({
                errors: [new Error(
                    // eslint-disable-next-line max-len
                    `Unknown error during creating network rule from raw string: filter id - 1, line index - 0, line - ${filterRule}`,
                )],
                filters: [{
                    id: 1,
                    rules: [],
                    badFilterRules: [],
                }],
            });
        });

        it('should respect maximum number of scanned rules limit', () => {
            const filterRule1 = '||example1.com^';
            const filterRule2 = '||example2.com^';
            const filterRule3 = '||example3.com^';
            const filter = createFilter([filterRule1, filterRule2, filterRule3]);
            const mockAst = {
                children: [
                    {
                        category: RuleCategory.Network,
                        start: 0,
                        raws: { text: filterRule1 },
                    },
                    {
                        category: RuleCategory.Network,
                        start: 15,
                        raws: { text: filterRule2 },
                    },
                    {
                        category: RuleCategory.Network,
                        start: 30,
                        raws: { text: filterRule3 },
                    },
                ],
            };
            parserMock.mockReturnValue(mockAst as any);
            const mockRule1 = createNetworkRuleMock({
                filterListId: 1,
                pattern: filterRule1,
                index: 0,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule1]);
            const mockRule2 = createNetworkRuleMock({
                filterListId: 1,
                pattern: filterRule2,
                index: 15,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule2]);
            const mockRule3 = createNetworkRuleMock({
                filterListId: 1,
                pattern: filterRule3,
                index: 30,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule3]);

            const result = RulesScanner.scanFilters([filter], undefined, 2);
            expect(result).toEqual({
                errors: [new MaxScannedRulesError(
                    'Maximum number of scanned network rules reached at line index 15.',
                    15,
                )],
                filters: [{
                    id: 1,
                    rules: [mockRule1, mockRule2],
                    badFilterRules: [],
                }],
            });
        });

        it('should handle empty filters array', () => {
            const result = RulesScanner.scanFilters([]);

            expect(result).toEqual({
                errors: [],
                filters: [],
            });
        });

        it('should handle filters with empty content', () => {
            const filter = createFilter();
            const mockAst = { children: [] };
            parserMock.mockReturnValue(mockAst as any);

            const result = RulesScanner.scanFilters([filter]);
            expect(result).toEqual({
                errors: [],
                filters: [{
                    id: 1,
                    rules: [],
                    badFilterRules: [],
                }],
            });
        });
    });
});
