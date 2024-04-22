import { ILookupTable } from './lookup-table';
import { Request } from '../../request';
import { NetworkRule } from '../../rules/network-rule';
import { RuleStorage } from '../../filterlist/rule-storage';
import type { ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
/**
 * Sequence scan lookup table of rules for which we could not find a shortcut
 * and could not place it to the shortcuts lookup table.
 * In common case of rule there is always a way to just check a rule.match().
 */
export class SeqScanLookupTable implements ILookupTable {
    declare private readonly ruleStorage: RuleStorage;

    declare private readonly byteBuffer: ByteBuffer;

    declare private readonly storageIndexesPosition: number;

    declare private ruleCountPosition: number;

    private get rulesCount(): number {
        return this.byteBuffer.getUint32(this.ruleCountPosition);
    }

    private set rulesCount(value: number) {
        this.byteBuffer.setUint32(this.ruleCountPosition, value);
    }

    /**
     * Creates a new instance
     *
     * @param storage rules storage. We store "rule indexes" in the lookup table which
     * can be used to retrieve the full rules from the storage.
     * @param buffer
     */
    constructor(storage: RuleStorage, buffer: ByteBuffer) {
        this.ruleStorage = storage;
        this.byteBuffer = buffer;
        this.pushRulesCountToBuffer();
        this.storageIndexesPosition = U32LinkedList.create(this.byteBuffer);
    }

    /**
     * addRule implements the ILookupTable interface for SeqScanLookupTable.
     * @param _rule
     * @param storageIdx
     */
    addRule(_rule: NetworkRule, storageIdx: number): boolean {
        // Check if storageIdx has already indexed
        const position = U32LinkedList.find((storageIndex) => {
            return storageIndex === storageIdx;
        }, this.byteBuffer, this.storageIndexesPosition);

        if (position !== -1) {
            return false;
        }

        U32LinkedList.add(storageIdx, this.byteBuffer, this.storageIndexesPosition);
        this.rulesCount += 1;
        return true;
    }

    /** @inheritdoc */
    getRulesCount(): number {
        return this.rulesCount;
    }

    /**
     * Implements the ILookupTable interface method.
     * @param request
     */
    matchAll(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];

        U32LinkedList.forEach((storageIdx) => {
            const rule = this.ruleStorage.retrieveNetworkRule(storageIdx);

            if (rule && rule.match(request)) {
                result.push(rule);
            }
        }, this.byteBuffer, this.storageIndexesPosition);

        return result;
    }

    private pushRulesCountToBuffer() {
        this.ruleCountPosition = this.byteBuffer.byteOffset;
        this.byteBuffer.addUint32(this.ruleCountPosition, 0);
    }
}
