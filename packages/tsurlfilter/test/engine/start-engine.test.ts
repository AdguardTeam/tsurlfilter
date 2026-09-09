import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

import { CosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';
import { CosmeticOption } from '../../src/engine/cosmetic-option';
import { DnsEngine } from '../../src/engine/dns-engine';
import { Engine, type EngineFactoryOptions } from '../../src/engine/engine';
import { type IRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { ScannerType } from '../../src/filterlist/scanner/scanner-type';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import type { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';
import { type IndexedStorageCosmeticRuleParts } from '../../src/rules/rule';

import { parseRequests } from './requests';
import { collectRuleParts } from './rule-parts';

/**
 * Expected loaded rules and match counts for the correctness suites below.
 * Kept as named constants next to the corpus paths so a fixture change reports
 * which count failed.
 */
const expectedLoadedRules = 38978;
const expectedNetworkMatchesCount = 4667;
const expectedDnsMatchesCount = 8776;
const expectedCosmeticMatchesCount = 1754;

/**
 * Creates a cosmetic engine from the given rule lists.
 *
 * @param lists Rule lists to build the cosmetic engine from.
 *
 * @returns A cosmetic engine built from the given rule lists.
 */
const createCosmeticEngine = (lists: IRuleList[]): CosmeticEngine => {
    const storage = new RuleStorage(lists);
    const rulesParts = collectRuleParts<IndexedStorageCosmeticRuleParts>(storage, ScannerType.CosmeticRules);

    return CosmeticEngine.createSync(rulesParts, storage);
};

/**
 * Counts requests matched by the given matcher (no timing).
 *
 * @param requests Parsed requests.
 * @param matchFunc Predicate deciding a match.
 *
 * @returns Number of matches.
 */
function countMatches(requests: Request[], matchFunc: (r: Request) => boolean): number {
    let total = 0;
    for (const req of requests) {
        if (matchFunc(req)) {
            total += 1;
        }
    }
    return total;
}

describe('engine startup correctness', () => {
    const easyList = fs.readFileSync('./test/resources/easylist.txt', 'utf8');
    const adguardSdnFilter = fs.readFileSync('./test/resources/adguard_sdn_filter.txt', 'utf8');
    const hostsFile = fs.readFileSync('./test/resources/hosts', 'utf8');
    const adguardBaseFilter = fs.readFileSync('./test/resources/adguard_base_filter.txt', 'utf8');

    it.each([{ loadAsync: false }, { loadAsync: true }])(
        'network engine loads and matches (with loadAsync=$loadAsync)',
        async ({ loadAsync }) => {
            const requests = await parseRequests();
            const options: EngineFactoryOptions = { filters: [{ id: 1, content: easyList }] };
            const engine = loadAsync ? await Engine.createAsync(options) : Engine.createSync(options);

            expect(engine).toBeTruthy();
            expect(engine.getRulesCount()).toBe(expectedLoadedRules);

            const totalMatches = countMatches(requests, (request) => {
                const r = engine.matchRequest(request);
                return !!(r && r.basicRule && !r.basicRule.isAllowlist());
            });
            expect(totalMatches).toBe(expectedNetworkMatchesCount);
        },
    );

    it('dns engine loads and matches', async () => {
        const requests = await parseRequests();
        const ruleList = new StringRuleList(1, adguardSdnFilter, true, false, false);
        const hostsList = new StringRuleList(2, hostsFile, true, false, false);
        const engine = new DnsEngine(new RuleStorage([ruleList, hostsList]));

        expect(engine).toBeTruthy();
        const totalMatches = countMatches(requests, (request) => {
            const dnsResult = engine.match(request.hostname);
            if (dnsResult.basicRule) {
                return !dnsResult.basicRule.isAllowlist();
            }
            return dnsResult.hostRules.length > 0;
        });
        expect(totalMatches).toBe(expectedDnsMatchesCount);
    });

    it('cosmetic engine loads and matches', async () => {
        const requests = await parseRequests();
        const lists: IRuleList[] = [new StringRuleList(1, adguardBaseFilter, false, false, false)];
        const engine = createCosmeticEngine(lists);

        expect(engine).toBeTruthy();
        const totalMatches = countMatches(requests, (request) => {
            if (request.requestType !== RequestType.SubDocument) {
                return false;
            }
            const result = engine.match(request, CosmeticOption.CosmeticOptionAll);
            return result.elementHiding.specific.length + result.elementHiding.generic.length > 0;
        });
        expect(totalMatches).toBe(expectedCosmeticMatchesCount);
    });
});
