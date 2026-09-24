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

/**
 * Iteration budget for the request-matching benches. Each iteration is a full
 * pass over the committed 27,969-request corpus (network/dns) or over the
 * sub-document subset (cosmetic), so a lower cap than the engine-startup
 * benches keeps the run quick without losing the average-per-request signal.
 */
export const MATCH_BENCH_OPTIONS = {
    iterations: 5,
    warmupIterations: 1,
};
