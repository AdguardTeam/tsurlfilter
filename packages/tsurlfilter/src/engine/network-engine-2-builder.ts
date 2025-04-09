import { type RuleStorage } from '../filterlist/rule-storage';
import { ByteBuffer } from '../utils/byte-buffer';
import { type Builder } from './builder';
import { NetworkEngine } from './network-engine-2';
import { DomainsLookupTableBuilder } from './lookup-tables-2/domains-lookup-table-builder';
import { TrieLookupTableBuilder } from './lookup-tables-2/trie-lookup-table-builder';
import { HostnameLookupTableBuilder } from './lookup-tables-2/hostname-lookup-table-builder';
import { SeqScanLookupTableBuilder } from './lookup-tables-2/seq-scan-lookup-table-builder';
import { type IndexedStorageRule } from '../rules/rule';
import { NetworkEngineByteOffsets } from './byte-offsets';

/**
 * NetworkEngine is the engine that supports quick search over network rules.
 */
export class NetworkEngineBuilder implements Builder<NetworkEngine> {
    private built = false;

    private readonly storage: RuleStorage;

    private readonly buffer: ByteBuffer;

    private readonly domainsLookupTableBuilder: DomainsLookupTableBuilder;

    private readonly shortcutsLookupTableBuilder: TrieLookupTableBuilder;

    private readonly hostnameLookupTableBuilder: HostnameLookupTableBuilder;

    private readonly seqScanLookupTableBuilder: SeqScanLookupTableBuilder;

    constructor(storage: RuleStorage) {
        this.storage = storage;
        this.buffer = new ByteBuffer();
        this.built = false;

        this.domainsLookupTableBuilder = new DomainsLookupTableBuilder(storage);
        this.shortcutsLookupTableBuilder = new TrieLookupTableBuilder(storage);
        this.hostnameLookupTableBuilder = new HostnameLookupTableBuilder(storage);
        this.seqScanLookupTableBuilder = new SeqScanLookupTableBuilder(storage);
    }

    public addRule(rule: IndexedStorageRule): void {
        if (!this.hostnameLookupTableBuilder.addRule(rule)) {
            if (!this.shortcutsLookupTableBuilder.addRule(rule)) {
                if (!this.domainsLookupTableBuilder.addRule(rule)) {
                    this.seqScanLookupTableBuilder.addRule(rule);
                }
            }
        }
    }

    public build(buffer: ByteBuffer): NetworkEngine {
        if (this.built) {
            throw new Error('Cannot build the network engine after it has been built');
        }

        const offset = buffer.byteOffset;

        // allocate space for the offsets
        this.buffer.addUint32(offset, NetworkEngineByteOffsets.DomainsLookupTable);
        // eslint-disable-next-line max-len
        this.buffer.addUint32(offset + NetworkEngineByteOffsets.HostnameLookupTable, NetworkEngineByteOffsets.HostnameLookupTable);
        // eslint-disable-next-line max-len
        this.buffer.addUint32(offset + NetworkEngineByteOffsets.ShortcutsLookupTable, NetworkEngineByteOffsets.ShortcutsLookupTable);
        // eslint-disable-next-line max-len
        this.buffer.addUint32(offset + NetworkEngineByteOffsets.SeqScanLookupTable, NetworkEngineByteOffsets.SeqScanLookupTable);

        // domains lookup table
        this.buffer.setUint32(offset + NetworkEngineByteOffsets.DomainsLookupTable, this.buffer.byteOffset);
        this.domainsLookupTableBuilder.build(this.buffer);

        // hostname lookup table
        this.buffer.setUint32(offset + NetworkEngineByteOffsets.HostnameLookupTable, this.buffer.byteOffset);
        this.hostnameLookupTableBuilder.build(this.buffer);

        // shortcuts lookup table
        this.buffer.setUint32(offset + NetworkEngineByteOffsets.ShortcutsLookupTable, this.buffer.byteOffset);
        this.shortcutsLookupTableBuilder.build(this.buffer);

        // seq scan lookup table
        this.buffer.setUint32(offset + NetworkEngineByteOffsets.SeqScanLookupTable, this.buffer.byteOffset);
        this.seqScanLookupTableBuilder.build(this.buffer);

        buffer.addByteBuffer(this.buffer);

        this.built = true;

        return new NetworkEngine(this.storage, buffer, offset);
    }
}
