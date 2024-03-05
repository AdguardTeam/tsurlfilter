import { RuleStorageScanner } from '../filterlist/scanner/rule-storage-scanner';
import { ByteBuffer } from './byte-buffer';

export class StorageIndex {
    public static get(buffer: ByteBuffer, position: number) {
        return RuleStorageScanner.ruleListIdxToStorageIdx(
            buffer.getUint32(position),
            buffer.getUint32(position + Uint32Array.BYTES_PER_ELEMENT),
        );
    }

    public static add(buffer: ByteBuffer, storageIdx: number): number {
        const { byteOffset } = buffer;
        const [listId, ruleId] = RuleStorageScanner.storageIdxToRuleListIdx(storageIdx);

        buffer.addUint32(byteOffset, listId);
        buffer.addUint32(byteOffset + Uint32Array.BYTES_PER_ELEMENT, ruleId);

        return byteOffset;
    }
}
