import { describe, expect, it } from 'vitest';

import {
    EmptyOrNegativeNumberOfRulesError,
    NegativeNumberOfRulesError,
    ResourcesPathError,
} from '../../../src/errors/converter-options-errors';
import { UnavailableFilterSourceError } from '../../../src/errors/unavailable-sources-errors';
import { Filter } from '../../../src/filter/filter';
import { type IFilter } from '../../../src/filter/types';
import { FilterConverter } from '../../../src/filter-converter/filter-converter';

/**
 * Creates a test IFilter from an array of rule strings.
 *
 * @param rules Array of rule text strings.
 * @param filterId Filter list ID.
 *
 * @returns IFilter mock.
 */
const createFilter = (rules: string[], filterId = 0): IFilter => {
    const content = rules.join('\n');

    return {
        getId: () => filterId,
        getContent: async () => content,
        getRuleByIndex: async () => '',
        unloadContent: () => {},
    };
};

describe('FilterConverter', () => {
    const converter = new FilterConverter();

    describe('convert (single filter)', () => {
        it('converts network rules to declarative rules', async () => {
            const filter = createFilter(['||example.org^']);
            const [{ ruleSet, errors, limitations }] = await converter.convert([filter]);

            const declarativeRules = ruleSet.getDeclarativeRules();
            expect(declarativeRules.length).toBeGreaterThanOrEqual(1);
            expect(declarativeRules[0].condition.urlFilter).toBe('||example.org^');
            expect(errors).toBeDefined();
            expect(limitations).toBeDefined();
        });

        it('assigns a rule set id based on filter id', async () => {
            const filterId = 42;
            const filter = createFilter(['||example.org^'], filterId);
            const [{ ruleSet }] = await converter.convert([filter]);

            expect(ruleSet.getId()).toBe(FilterConverter.getRuleSetId(filterId));
        });

        it('handles empty lines in filter list', async () => {
            const filter = createFilter([
                '||example.org^',
                '',
                '||example.com^',
                '',
                '',
                '||example.net^',
            ]);
            const [{ ruleSet }] = await converter.convert([filter]);
            const declarativeRules = ruleSet.getDeclarativeRules();

            // Three valid network rules should produce 3 declarative rules
            expect(declarativeRules).toHaveLength(3);
        });

        it('returns counters', async () => {
            const filter = createFilter([
                '||example.com^',
                '@@||example.io^',
            ]);
            const [{ ruleSet }] = await converter.convert([filter]);

            expect(ruleSet.getSafeRulesCount()).toStrictEqual(2);
        });

        it('does not throw on conversion errors', async () => {
            const filter = createFilter([
                '||example.com^',
                // Unsupported modifier will produce a conversion error
                '||example.org^$ping',
            ]);
            const [{ ruleSet }] = await converter.convert([filter]);

            // At least the valid rule should be converted
            expect(ruleSet.getSafeRulesCount()).toBeGreaterThanOrEqual(1);
        });
    });

    describe('convert (combined)', () => {
        it('converts multiple filters into one combined ruleset', async () => {
            const filter1 = createFilter(['||example.com^'], 1);
            const filter2 = createFilter(['||example.net^'], 2);

            const [{ ruleSet }] = await converter.convert(
                [filter1, filter2],
                { combine: true },
            );

            const declarativeRules = ruleSet.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(2);
            expect(ruleSet.getId()).toBe(FilterConverter.COMBINED_RULESET_ID);
        });
    });

    describe('empty filters (fresh install)', () => {
        // Reproduces AG-55141: on a fresh install the user rules (0), allowlist
        // (100) and blocking-page trusted domains (-10) dynamic filters are all
        // empty. They must convert to zero rules without producing errors.
        it('converts empty filters to zero rules without errors', async () => {
            const userRules = createFilter([], 0);
            const allowlist = createFilter([], 100);
            const trustedDomains = createFilter([], -10);

            const [{ ruleSet, errors }] = await converter.convert(
                [allowlist, trustedDomains, userRules],
                { combine: true },
            );
            const declarativeRules = ruleSet.getDeclarativeRules();

            expect(errors).toHaveLength(0);
            expect(ruleSet.getSafeRulesCount()).toBe(0);
            expect(declarativeRules).toHaveLength(0);
        });

        it('converts non-empty filters while ignoring empty ones, without errors', async () => {
            const emptyUserRules = createFilter([], 0);
            const allowlist = createFilter(['||example.org^'], 100);

            const [{ ruleSet, errors }] = await converter.convert(
                [allowlist, emptyUserRules],
                { combine: true },
            );
            const declarativeRules = ruleSet.getDeclarativeRules();

            expect(errors).toHaveLength(0);
            expect(declarativeRules.length).toBeGreaterThan(0);
        });

        it('rejects with UnavailableFilterSourceError when a filter source is genuinely unavailable', async () => {
            const failingFilter = new Filter(
                100,
                async () => {
                    throw new Error('source failure');
                },
            );

            await expect(converter.convert([failingFilter], { combine: true }))
                .rejects.toThrow(UnavailableFilterSourceError);
        });
    });

    describe('respects limitations', () => {
        it('limits max number of rules', async () => {
            const filter = createFilter([
                '||example1.com^',
                '||example2.com^',
                '||example3.com^',
            ]);
            const [{ ruleSet, limitations }] = await converter.convert(
                [filter],
                { maxNumberOfRules: 2 },
            );

            const declarativeRules = ruleSet.getDeclarativeRules();
            expect(declarativeRules).toHaveLength(2);
            expect(limitations.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('checks converter options', () => {
        it('throws error when empty resources path provided', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = '';
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `start with a leading slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the resources path does not start with a slash', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = 'path';
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `start with a leading slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if the resources path ended with a slash', async () => {
            const filter = createFilter(['||example.org^']);
            const resourcesPath = '/path/';
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { resourcesPath });
            };

            const msg = 'Path to web accessible resources should '
                + `not end with a slash: ${resourcesPath}`;
            await expect(convert).rejects.toThrow(new ResourcesPathError(msg));
        });

        it('throws error if max number of rules is equal to or less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfRules = 0;
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { maxNumberOfRules });
            };

            const msg = 'Maximum number of rules cannot be equal or less than 0';
            await expect(convert).rejects.toThrow(new EmptyOrNegativeNumberOfRulesError(msg));
        });

        it('throws error if max number of regexp rules is less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfRegexpRules = -1;
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { maxNumberOfRegexpRules });
            };

            const msg = 'Maximum number of regexp rules cannot be less than 0';
            await expect(convert).rejects.toThrow(new NegativeNumberOfRulesError(msg));
        });

        it('throws error if max number of unsafe rules is less than 0', async () => {
            const filter = createFilter(['||example.org^']);
            const maxNumberOfUnsafeRules = -1;
            const convert = async (): Promise<void> => {
                await converter.convert([filter], { maxNumberOfUnsafeRules });
            };

            const msg = 'Maximum number of unsafe rules cannot be less than 0';
            await expect(convert).rejects.toThrow(new NegativeNumberOfRulesError(msg));
        });
    });
});
