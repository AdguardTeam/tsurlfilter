import { RuleStorageScanner } from '../filterlist/scanner/rule-storage-scanner';
import { ByteBuffer } from './byte-buffer';

export class StorageIndex {
    public readonly buffer: ByteBuffer;

    public readonly offset: number;

    public get value(): number {
        return RuleStorageScanner.ruleListIdxToStorageIdx(
            this.buffer.getUint32(this.offset),
            this.buffer.getUint32(this.offset + Uint32Array.BYTES_PER_ELEMENT),
        );
    }

    constructor(buffer: ByteBuffer, offset: number) {
        this.buffer = buffer;
        this.offset = offset;
    }

    public static create(buffer: ByteBuffer, storageIdx: number): StorageIndex {
        const { byteOffset } = buffer;
        const [listId, ruleId] = RuleStorageScanner.storageIdxToRuleListIdx(storageIdx);

        buffer.addUint32(byteOffset, listId);
        buffer.addUint32(byteOffset + Uint32Array.BYTES_PER_ELEMENT, ruleId);

        return new StorageIndex(buffer, byteOffset);
    }
}
