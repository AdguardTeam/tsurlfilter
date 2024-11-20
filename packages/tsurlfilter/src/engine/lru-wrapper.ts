import { createRequire } from 'module';
import type { LRUMap as LRUMapType } from 'lru_map';

const require = createRequire(import.meta.url);
const { LRUMap } = require('lru_map');

// Export the value and type simultaneously
export { LRUMap };
export type LRUMap<K, V> = LRUMapType<K, V>;