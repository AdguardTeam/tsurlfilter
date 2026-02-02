/**
 * Chunk size for async rules loading.
 * It means that we load 5000 rules at a time, then take a small pause to give UI thread some time.
 */
export const CHUNK_SIZE = 5000;
