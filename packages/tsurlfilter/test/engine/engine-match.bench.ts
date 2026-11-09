/* eslint-disable max-len */
import { readFileSync } from 'node:fs';

import { test } from 'vitest';

import {
    type CosmeticEngine as CosmeticEngineType,
    type IndexedStorageCosmeticRuleParts,
    type IRuleList,
} from '@adguard/tsurlfilter';
import { ScannerType } from '@adguard/tsurlfilter/es/scanner-type';

import { MATCH_BENCH_OPTIONS } from './engine-bench-options';
import { parseRequests } from './requests';

// `current` is imported from the BUILT `@adguard/tsurlfilter` package (its
// `exports` map resolves to `dist/`), NOT from `src/`. Vite serves `src/`
// module-by-module and deoptimizes cross-module calls, which inflates the
// current leg 1.7–11×; the published baselines are optimized bundles, so the
// current code must be measured as its bundle too. Build the package before
// running this benchmark (see `packages/benchmarks/DEVELOPMENT.md`). The
// dynamic import turns a missing/stale build into a clear error instead of a
// cryptic module-resolution failure.
const TSURLFILTER = await import('@adguard/tsurlfilter').catch((error: unknown) => {
    throw new Error(
        'Failed to resolve the built `@adguard/tsurlfilter` bundle. '
        + 'Build it first (inject a temporary version, then `pnpm build`) — '
        + 'see packages/benchmarks/DEVELOPMENT.md.',
        { cause: error },
    );
});

const {
    CosmeticEngine,
    CosmeticOption,
    DnsEngine,
    Engine,
    RequestType,
    RuleStorage,
    StringRuleList,
} = TSURLFILTER;

const easyList = readFileSync('test/resources/easylist.txt', 'utf-8');
const adguardSdnFilter = readFileSync('test/resources/adguard_sdn_filter.txt', 'utf-8');
const hostsFile = readFileSync('test/resources/hosts', 'utf-8');
const adguardBaseFilter = readFileSync('test/resources/adguard_base_filter.txt', 'utf-8');

// Keep the timed work observable: each bench accumulates a cheap checksum here
// so the engine can't eliminate the closure, and we guard it after the run.
let resultSink = 0;

/**
 * Creates a cosmetic engine from the given rule lists.
 *
 * @param lists Rule lists to build the cosmetic engine from.
 *
 * @returns A cosmetic engine built from the given rule lists.
 */
const createCosmeticEngine = (lists: IRuleList[]): CosmeticEngineType => {
    const storage = new RuleStorage(lists);
    const scanner = storage.createRuleStorageScanner(ScannerType.CosmeticRules);
    const rulesParts: IndexedStorageCosmeticRuleParts[] = [];
    while (scanner.scan()) {
        rulesParts.push(scanner.getRuleParts()! as IndexedStorageCosmeticRuleParts);
    }

    return CosmeticEngine.createSync(rulesParts, storage);
};

test('request matching over committed corpus', async ({ bench }) => {
    // Corpus loading and engine construction happen outside the timed region:
    // only the match calls below are measured.
    const requests = await parseRequests();

    const networkEngine = Engine.createSync({ filters: [{ id: 1, content: easyList }] });

    const dnsRuleList = new StringRuleList(1, adguardSdnFilter, true, false, false);
    const dnsHostsList = new StringRuleList(2, hostsFile, true, false, false);
    const dnsEngine = new DnsEngine(new RuleStorage([dnsRuleList, dnsHostsList]));

    const cosmeticEngine = createCosmeticEngine([new StringRuleList(1, adguardBaseFilter, false, false, false)]);
    const subdocumentRequests = requests.filter((request) => request.requestType === RequestType.SubDocument);

    await bench('network engine matchRequest', () => {
        for (const request of requests) {
            const result = networkEngine.matchRequest(request);
            resultSink += (result && result.basicRule && !result.basicRule.isAllowlist()) ? 1 : 0;
        }
    }).run(MATCH_BENCH_OPTIONS);

    await bench('dns engine match', () => {
        for (const request of requests) {
            const dnsResult = dnsEngine.match(request.hostname);
            if (dnsResult.basicRule) {
                resultSink += dnsResult.basicRule.isAllowlist() ? 0 : 1;
            } else {
                resultSink += dnsResult.hostRules.length;
            }
        }
    }).run(MATCH_BENCH_OPTIONS);

    await bench('cosmetic engine match', () => {
        for (const request of subdocumentRequests) {
            const result = cosmeticEngine.match(request, CosmeticOption.CosmeticOptionAll);
            resultSink += result.elementHiding.specific.length + result.elementHiding.generic.length;
        }
    }).run(MATCH_BENCH_OPTIONS);

    if (resultSink === 0) {
        throw new Error('benchmark produced no observable results');
    }
});
