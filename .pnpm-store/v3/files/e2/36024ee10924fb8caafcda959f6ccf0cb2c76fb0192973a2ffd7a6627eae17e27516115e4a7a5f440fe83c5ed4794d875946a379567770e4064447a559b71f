import { UnprefixedRuleOptions as UnprefixedRuleOptions$1 } from '@stylistic/eslint-plugin-js';
import { UnprefixedRuleOptions as UnprefixedRuleOptions$2 } from '@stylistic/eslint-plugin-jsx';
import { UnprefixedRuleOptions as UnprefixedRuleOptions$3 } from '@stylistic/eslint-plugin-ts';
import { UnprefixedRuleOptions as UnprefixedRuleOptions$4 } from '@stylistic/eslint-plugin-plus';

type UnprefixedRuleOptions = UnprefixedRuleOptions$1 & UnprefixedRuleOptions$2 & UnprefixedRuleOptions$3 & UnprefixedRuleOptions$4

type RuleOptions = {
  [K in keyof UnprefixedRuleOptions as `@stylistic/${K}`]: UnprefixedRuleOptions[K]
}

export type { RuleOptions, UnprefixedRuleOptions };
