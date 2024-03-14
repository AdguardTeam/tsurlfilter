import type { HostRule } from '../rules/host-rule';
import type { NetworkRule } from '../rules/network-rule';
import type { IRule } from '../rules/rule';
import type { RuleNodeList } from './rule-node-list';

export abstract class RuleNodeStorage {
    constructor(private readonly lists: RuleNodeList[]) {}

    abstract retrieveRule(storageIdx: number, ignoreHost?: boolean): IRule | null;

    abstract retrieveNetworkRule(storageIdx: number): NetworkRule | null;

    abstract retrieveHostRule(storageIdx: number): HostRule | null;

    abstract getCacheSize(): number;
}
