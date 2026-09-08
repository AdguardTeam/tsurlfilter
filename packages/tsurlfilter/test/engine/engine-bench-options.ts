/**
 * Iteration budget shared by the tsurlfilter engine-startup benches. Each
 * engine build takes ~200-400 ms on the base filter, so tinybench's defaults
 * (64 iterations + 16 warmup per registration) would blow past the 60s
 * bench-mode test timeout. This cap keeps each A/B run quick while still
 * representative.
 */
export const ENGINE_BENCH_OPTIONS = {
    iterations: 10,
    warmupIterations: 3,
};
