import { expectAssignable, expectType } from 'tsd';

import {
    NodeType,
    RuleParserPipeline,
    type AnyRule,
    type RawRule,
} from '@adguard/agtree';

const parser = new RuleParserPipeline();

// parse() returns the public AnyRule union — no cast needed.
expectType<AnyRule>(parser.parse('||example.com^'));

// RawRule (returned under ignore options) is a member of AnyRule.
expectAssignable<AnyRule>({} as RawRule);

// NodeType discriminant is importable from the root as a value.
expectType<'RawRule'>(NodeType.RawRule);
