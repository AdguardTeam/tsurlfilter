import { type RuleStorage } from '../../filterlist/rule-storage';
import { DomainModifier } from '../../modifiers/domain-modifier';
import { fastHash } from '../../utils/string-utils';
import { NetworkRule } from '../../rules/network-rule';
import { ByteBuffer } from '../../utils/byte-buffer';
import { U32LinkedList } from '../../utils/u32-linked-list';
import { BinaryUint32ToUint32Map } from '../../utils/binary-uint32-to-uint32-map';
import { type Builder } from '../builder';
import { DomainsLookupTable } from './domains-lookup-table';
import { type IndexedStorageRule } from '../../rules/rule';

export class DomainsLookupTableBuilder implements Builder<DomainsLookupTable> {
    private built: boolean;

    private readonly buffer: ByteBuffer;

    private readonly storage: RuleStorage;

    private readonly domainsLookupTable: Map<number, number>;

    constructor(storage: RuleStorage) {
        this.built = false;
        this.storage = storage;
        this.buffer = new ByteBuffer();
        this.domainsLookupTable = new Map<number, number>();
    }

    public addRule(rule: IndexedStorageRule): boolean {
        if (this.built) {
            throw new Error('Cannot add rules after the lookup table has been built');
        }

        if (!(rule.rule instanceof NetworkRule)) {
            return false;
        }

        const permittedDomains = rule.rule.getPermittedDomains();
        if (!permittedDomains || permittedDomains.length === 0) {
            return false;
        }

        if (permittedDomains.some(DomainModifier.isWildcardOrRegexDomain)) {
            return false;
        }

        permittedDomains.forEach((domain) => {
            const hash = fastHash(domain);

            // Get the position of the storage indexes for the hash
            let storageIndexesPosition = this.domainsLookupTable.get(hash);

            /**
             * If the hash is not in the lookup table, create a new {@link U32LinkedList}.
             */
            if (storageIndexesPosition === undefined) {
                storageIndexesPosition = U32LinkedList.create(this.buffer);
                this.domainsLookupTable.set(hash, storageIndexesPosition);
            }

            // Add the storage index to the related U32LinkedList
            U32LinkedList.add(rule.index, this.buffer, storageIndexesPosition);
        });

        return true;
    }

    public build(buffer: ByteBuffer): DomainsLookupTable {
        if (this.built) {
            throw new Error('Cannot build the lookup table after it has been built');
        }

        const relativeBinaryMapPosition = BinaryUint32ToUint32Map.create(this.domainsLookupTable, this.buffer);
        const offset = buffer.byteOffset;
        // write rule count
        buffer.addUint32(offset, this.domainsLookupTable.size);
        // FIXME
        buffer.addUint32(offset + Uint32Array.BYTES_PER_ELEMENT, 0);
        // write binary map
        buffer.addByteBuffer(this.buffer);
        this.built = true;
        return new DomainsLookupTable(this.storage, buffer, offset + relativeBinaryMapPosition);
    }
}
