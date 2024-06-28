import { promises as fs } from 'fs';

import { DeclarativeFilterConverter } from '../../../src/rules/declarative-converter/filter-converter';
import { Filter } from '../../../src/rules/declarative-converter/filter';
import { TooManyRulesError } from '../../../src/rules/declarative-converter/errors/limitation-errors';
import {
    EmptyOrNegativeNumberOfRulesError,
    ResourcesPathError,
} from '../../../src/rules/declarative-converter/errors/converter-options-errors';
import { UnsupportedModifierError } from '../../../src/rules/declarative-converter/errors/conversion-errors';
import { NetworkRule } from '../../../src/rules/network-rule';
import { RuleActionType } from '../../../src/rules/declarative-converter/declarative-rule';
import {
    EmptyDomainsError,
} from '../../../src/rules/declarative-converter/errors/conversion-errors/empty-domains-error';
import { re2Validator } from '../../../src/rules/declarative-converter/re2-regexp/re2-validator';
import { regexValidatorNode } from '../../../src/rules/declarative-converter/re2-regexp/regex-validator-node';
import path from 'path';

const createFilter = (
    rules: string[],
    filterId: number = 0,
) => {
    return new Filter(
        filterId,
        { getContent: async () => rules },
        true,
    );
};

describe('DeclarativeConverter', () => {
    const converter = new DeclarativeFilterConverter();
    re2Validator.setValidator(regexValidatorNode);

    it('applies badfilter to multiple filters', async () => {
        const filterContent = await fs.readFile(path.resolve(__dirname, './filter.txt'), 'utf-8');
        const filter = createFilter(filterContent.split('\r?\n'), 0);

        const { ruleSet } = await converter.convertDynamicRuleSets([
            filter,
        ], []);

        const start = performance.now();
        const declarativeRules = await ruleSet.getDeclarativeRules();
        const end = performance.now();
        console.log('getDeclarativeRules', end - start);

        expect(declarativeRules).toHaveLength(1);
    });
});
