import { NetworkRule } from '../../rules/network-rule';
import { type RuleStorage } from '../../filterlist/rule-storage';
import { ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { type Builder } from '../builder';
import { SeqScanLookupTable } from './seq-scan-lookup-table';
import { type IndexedStorageRule } from '../../rules/rule';

export class SeqScanLookupTableBuilder implements Builder<SeqScanLookupTable> {
    private built: boolean;

    private readonly buffer: ByteBuffer;

    private readonly storage: RuleStorage;

    private rulesCount: number;

    constructor(storage: RuleStorage) {
        this.built = false;
        this.storage = storage;
        this.buffer = new ByteBuffer();
        this.rulesCount = 0;
    }

    /** @inheritdoc */
    addRule(rule: IndexedStorageRule): boolean {
        if (this.built) {
            throw new Error('Cannot add rules after the lookup table has been built');
        }

        if (!(rule.rule instanceof NetworkRule)) {
            return false;
        }

        // Check if storageIdx has already indexed
        const position = U32LinkedList.find((storageIndex) => {
            return storageIndex === rule.index;
        }, this.buffer, 4);

        if (position !== -1) {
            return false;
        }

        U32LinkedList.add(rule.index, this.buffer, 4);
        this.rulesCount += 1;
        return true;
    }

    /**
     * Builds the lookup table.
     *
     * @param buffer Byte buffer to store the binary data.
     *
     * @returns Instance of {@link SeqScanLookupTable}.
     */
    public build(buffer: ByteBuffer): SeqScanLookupTable {
        if (this.built) {
            throw new Error('Cannot build the lookup table after it has been built');
        }

        const offset = buffer.byteOffset;
        buffer.addUint32(offset, this.rulesCount);
        U32LinkedList.create(buffer);
        this.built = true;
        return new SeqScanLookupTable(this.storage, buffer, offset);
    }
}
