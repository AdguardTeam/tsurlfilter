import { expectAssignable } from 'tsd';

import { RuleParser, defaultParserOptions } from '@adguard/agtree/compat';

// The v4 shim is importable from its own subpath.
expectAssignable<typeof RuleParser>(RuleParser);
expectAssignable<object>(defaultParserOptions);

// ... and deliberately absent from the light structural subpath (F-015).
// @ts-expect-error
import { RuleParser as ParserFromParserSubpath } from '@adguard/agtree/parser';
// @ts-expect-error
import { defaultParserOptions as DefaultsFromParserSubpath } from '@adguard/agtree/parser';

void ParserFromParserSubpath;
void DefaultsFromParserSubpath;
