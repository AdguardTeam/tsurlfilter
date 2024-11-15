import { createRequire } from 'module';

const require = createRequire(import.meta.url);
export const { LRUMap } = require('lru_map');
