import { type IndexedStorageRule } from '../rules/rule';
import { type ByteBuffer } from '../utils/byte-buffer';

export interface Builder<T> {
    addRule(rule: IndexedStorageRule): void;

    build(buffer: ByteBuffer): T;
}
