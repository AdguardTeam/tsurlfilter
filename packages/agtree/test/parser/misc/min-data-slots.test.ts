import { describe, expect, test } from 'vitest';

import {
    DomainListParser,
    LogicalExpressionParser,
    ModifierListParser,
    ModifierParser,
    ParameterListParser,
} from '../../../src/parser';

describe('MIN_DATA_SLOTS', () => {
    test.each([
        ['ModifierParser', ModifierParser],
        ['ModifierListParser', ModifierListParser],
        ['DomainListParser', DomainListParser],
        ['ParameterListParser', ParameterListParser],
        ['LogicalExpressionParser', LogicalExpressionParser],
    ])('%s has MIN_DATA_SLOTS > 0', (_, Parser) => {
        expect(Parser.MIN_DATA_SLOTS).toBeGreaterThan(0);
    });
});
