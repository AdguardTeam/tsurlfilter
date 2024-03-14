import type { AnyRule } from '@adguard/agtree';
import type { RuleNodeScanner } from './scanner/rule-node-scanner';
import type { ScannerType } from './scanner/scanner-type';

export abstract class RuleNodeList {
    constructor(
        private readonly id: number,
        private readonly ruleNodes: ArrayBufferLike,
        private readonly ignoreCosmetic: boolean,
        private readonly ignoreJS: boolean,
        private readonly ignoreUnsafe: boolean,
    ) {}

    abstract getId(): number;

    abstract newScanner(scannerType: ScannerType): RuleNodeScanner;

    abstract close(): void;

    abstract retrieveRule(ruleIdx: number): AnyRule | null;
}
