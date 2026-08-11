import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    type MockInstance,
    vi,
} from 'vitest';

import { RuleCategory } from '@adguard/agtree';
import { FilterListParser } from '@adguard/agtree/parser';

import { MaxScannedRulesError } from '../../../src/errors/limitation-errors/max-scanned-rules-error';
import { type IFilter } from '../../../src/filter/types';
import { OPTION_NAMES } from '../../../src/rule/option-names';
import { Rule } from '../../../src/rule/rule';
import { RulesScanner } from '../../../src/rules-scanner';
import { createRuleMock } from '../../mocks/rule';

vi.mock('@adguard/agtree/parser', async () => {
    const actual = await vi.importActual('@adguard/agtree/parser');
    return {
        ...actual,
        FilterListParser: { parse: vi.fn() },
    };
});

const createFilter = (rules: string[] = [], id = 1): IFilter => ({
    getId: () => id,
    getRuleByIndex: async () => '',
    getContent: async () => rules.join('\n'),
    unloadContent: () => {},
});

const parserMock = vi.mocked(FilterListParser.parse);
let parseFromNodeMock: MockInstance<typeof Rule.parseFromNode>;

describe('RulesScanner', () => {
    beforeEach(() => {
        parseFromNodeMock = vi.spyOn(Rule, 'parseFromNode');
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe('scanFilters', () => {
        it('should scan multiple filters and return scanned results', async () => {
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
            const mockRule1 = createRuleMock({
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
            const mockRule2 = createRuleMock({
                filterListId: 2,
                pattern: filter2Rule1,
                index: 0,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule2]);

            const result = await RulesScanner.scanFilters([filter1, filter2]);
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

        it('should apply filter function to rules', async () => {
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
            const mockRule1 = createRuleMock({
                filterListId: 1,
                pattern: filterRule1,
                index: 0,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule1]);
            const mockRule2 = createRuleMock({
                filterListId: 1,
                pattern: filterRule2,
                index: 14,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule2]);

            const filterFn = vi.fn((rule: any) => rule.pattern === '||example.com^');
            const result = await RulesScanner.scanFilters([filter], filterFn);

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

        it('should separate badfilter rules', async () => {
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
            const mockRule1 = createRuleMock({
                filterListId: 1,
                pattern: filterRule1,
                enabledOptions: [],
                index: 0,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule1]);
            const mockRule2 = createRuleMock({
                filterListId: 1,
                pattern: filterRule2,
                enabledOptions: [OPTION_NAMES.BADFILTER],
                index: 14,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule2]);

            const result = await RulesScanner.scanFilters([filter]);
            expect(result).toEqual({
                errors: [],
                filters: [{
                    id: 1,
                    rules: [mockRule1, mockRule2],
                    badFilterRules: [mockRule2],
                }],
            });
        });

        it('should handle parsing errors', async () => {
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

            const result = await RulesScanner.scanFilters([filter]);

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

        it('should handle Rule creation errors', async () => {
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
                throw new Error('Rule creation failed');
            });

            const result = await RulesScanner.scanFilters([filter]);
            expect(result).toEqual({
                errors: [new Error('Rule creation failed')],
                filters: [{
                    id: 1,
                    rules: [],
                    badFilterRules: [],
                }],
            });
        });

        it('should handle unknown errors during Rule creation', async () => {
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

            const result = await RulesScanner.scanFilters([filter]);

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

        it('should respect maximum number of scanned rules limit', async () => {
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
            const mockRule1 = createRuleMock({
                filterListId: 1,
                pattern: filterRule1,
                index: 0,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule1]);
            const mockRule2 = createRuleMock({
                filterListId: 1,
                pattern: filterRule2,
                index: 15,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule2]);
            const mockRule3 = createRuleMock({
                filterListId: 1,
                pattern: filterRule3,
                index: 30,
            });
            parseFromNodeMock.mockReturnValueOnce([mockRule3]);

            const result = await RulesScanner.scanFilters([filter], undefined, 2);
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

        it('should handle empty filters array', async () => {
            const result = await RulesScanner.scanFilters([]);

            expect(result).toEqual({
                errors: [],
                filters: [],
            });
        });

        it('should handle filters with empty content', async () => {
            const filter = createFilter();
            const mockAst = { children: [] };
            parserMock.mockReturnValue(mockAst as any);

            const result = await RulesScanner.scanFilters([filter]);
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
