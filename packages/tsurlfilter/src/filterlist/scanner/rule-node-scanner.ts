import type { AnyRule } from '@adguard/agtree';

export abstract class RuleNodeScanner {
    abstract scan(): boolean;

    abstract getRuleNode(): AnyRule | null;
}
