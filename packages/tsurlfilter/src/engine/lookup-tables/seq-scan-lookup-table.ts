import { ILookupTable } from './lookup-table';
import { Request } from '../../request';
import { NetworkRule } from '../../rules/network-rule';
import type { RuleStorage } from '../../filterlist/rule-storage';
import type { ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
/**
 * Sequence scan lookup table of rules for which we could not find a shortcut
 * and could not place it to the shortcuts lookup table.
 * In common case of rule there is always a way to just check a rule.match().
 */
export class SeqScanLookupTable implements ILookupTable {
    /**
     * Count of rules added to this lookup table.
     */
    private rulesCount = 0;

    declare private readonly ruleStorage: RuleStorage;

    declare private readonly byteBuffer: ByteBuffer;

    declare private readonly storageIndexesPosition: number;

    /**
     * Creates a new instance
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     */
    constructor(storage: RuleStorage, buffer: ByteBuffer) {
        this.ruleStorage = storage;
        this.byteBuffer = buffer;
        this.storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
    }

    /**
     * addRule implements the ILookupTable interface for SeqScanLookupTable.
     * @param rule
     */
    addRule(_rule: NetworkRule, storageIdx: number): boolean {
        const position = U32LinkedList.find(
            (idx) => idx === storageIdx,
            this.byteBuffer,
            this.storageIndexesPosition,
        );
        if (position === -1) {
            U32LinkedList.add(storageIdx, this.byteBuffer, this.storageIndexesPosition);
            this.rulesCount += 1;
            return true;
        }

        return false;
    }

    /**
     * Implements the ILookupTable interface method.
     */
    getRulesCount(): number {
        return this.rulesCount;
    }

    /**
     * Implements the ILookupTable interface method.
     * @param request
     */
    matchAll(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];

        U32LinkedList.forEach((storageIndexPosition) => {
            const ruleId = this.byteBuffer.getUint32(storageIndexPosition);
            const listId = this.byteBuffer.getUint32(storageIndexPosition + 4);

            const rule = this.ruleStorage.retrieveNetworkRule(listId, ruleId);

            if (rule && rule.match(request)) {
                result.push(rule);
            }
        }, this.byteBuffer, this.storageIndexesPosition);

        return result;
    }
}
