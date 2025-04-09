import { type ILookupTable } from './lookup-table';
import { type Request } from '../../request';
import { type NetworkRule } from '../../rules/network-rule';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { type ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';

/**
 * Sequence scan lookup table of rules for which we could not find a shortcut
 * and could not place it to the shortcuts lookup table.
 * In common case of rule there is always a way to just check a rule.match().
 */
export class SeqScanLookupTable implements ILookupTable {
    /** @inheritdoc */
    declare public readonly offset: number;

    /**
     * Storage for the network filtering rules.
     */
    declare private readonly ruleStorage: RuleStorage;

    /**
     * ByteBuffer to store the binary data.
     */
    declare private readonly buffer: ByteBuffer;

    /**
     * Rules counter offset position in the {@link byteBuffer}.
     *
     * @returns Buffer offset.
     */
    private get rulesCountPosition(): number {
        return this.offset;
    }

    /**
     * Storage indexes linked list offset position in the {@link byteBuffer}.
     *
     * @returns Buffer offset.
     */
    private get storageIndexesPosition(): number {
        return this.offset + 4; // Uint32Array.BYTES_PER_ELEMENT
    }

    /**
     * Creates a new instance.
     *
     * @param storage Rules storage. We store "rule indexes" in the lookup table which can be used
     * to retrieve the full rules from the storage.
     * @param buffer Byte buffer to store the binary data.
     * @param offset Byte offset of the lookup table in the {@link buffer}.
     */
    constructor(
        storage: RuleStorage,
        buffer: ByteBuffer,
        offset: number,
    ) {
        this.ruleStorage = storage;
        this.buffer = buffer;
        this.offset = offset;
    }

    /** @inheritdoc */
    getRulesCount(): number {
        return this.buffer.getUint32(this.rulesCountPosition);
    }

    /** @inheritdoc */
    matchAll(request: Request): NetworkRule[] {
        const result: NetworkRule[] = [];

        U32LinkedList.forEach((storageIdx) => {
            const rule = this.ruleStorage.retrieveNetworkRule(storageIdx);

            if (rule && rule.match(request)) {
                result.push(rule);
            }
        }, this.buffer, this.storageIndexesPosition);

        return result;
    }
}
