import { expectAssignable } from 'tsd';

import {
    AT_MIN_DATA_SLOTS,
    CSS_INJ_MIN_DATA_SLOTS,
    RuleClassifier,
    SL_MIN_DATA_SLOTS,
    StructuralRuleParser,
    createParserContext,
} from '@adguard/agtree/parser';
import type { RuleKind } from '@adguard/agtree/parser';

// Raw buffer-layout constants MUST NOT be exported from the parser subpath.
// @ts-expect-error
import { NR_FLAGS_OFFSET } from '@adguard/agtree/parser';
// @ts-expect-error
import { CHILD_FIELD_7 } from '@adguard/agtree/parser';
// @ts-expect-error
import { LE_KIND_VAR } from '@adguard/agtree/parser';

expectAssignable<number>(SL_MIN_DATA_SLOTS);
expectAssignable<number>(CSS_INJ_MIN_DATA_SLOTS);
expectAssignable<number>(AT_MIN_DATA_SLOTS);

void createParserContext;
void RuleClassifier;
void StructuralRuleParser;

const kinds: RuleKind[] = [];
void kinds;
