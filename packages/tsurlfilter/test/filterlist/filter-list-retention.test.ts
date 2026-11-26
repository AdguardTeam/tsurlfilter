import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

import { describe, expect, it } from 'vitest';

import { CompatibilityTypes, setConfiguration } from '../../src/configuration';
import { CosmeticOption } from '../../src/engine/cosmetic-option';
import { Engine } from '../../src/engine/engine';
import { FilterList } from '../../src/filterlist/filter-list';
import { Request } from '../../src/request';
import { RequestType } from '../../src/request-type';

const MB = 1024 * 1024;
const MAX_RETAINED_MB = 5;
const GC_CALLS = 5;
const RULE_PAIRS_COUNT = 90_000;
const PAGE_RULE_PAIRS_COUNT = 20;
const BEACON_RULE = '||beacon.example.com/beacon/error^';
const BEACON_URL = 'https://beacon.example.com/beacon/error?x=1';
const PAGE_URL = 'https://page.example.org/';
const CONVERTED_RULE = 'example.com##+js(set-constant, someLongPropertyName.value, true)';
const BROKEN_RULE = 'example.org##^:min-text-length(abc)';
const ANALYTICS_PATH = '/analytics/collect/v1/pixel.gif^$third-party';
const BANNER_CLASS = 'advertisement-banner-container-with-a-long-class-name';

setFlagsFromString('--expose-gc');

const collectGarbage = runInNewContext('gc') as () => void;

setConfiguration({
    engine: 'extension',
    version: '1.0.0',
    verbose: false,
    compatibility: CompatibilityTypes.Extension,
});

/**
 * Builds a flat filter list string of about 20 MB, the way it comes from storage.
 *
 * @param firstRule Rule to place at the start of the list.
 *
 * @returns Flat filter list content.
 */
function buildContent(firstRule?: string): string {
    const lines: string[] = [];

    if (firstRule !== undefined) {
        lines.push(firstRule);
    }

    for (let i = 0; i < RULE_PAIRS_COUNT; i += 1) {
        lines.push(`||tracker-${i}.example.com${ANALYTICS_PATH},domain=site-${i}.example.org|other-${i}.example.net`);
        lines.push(`site-${i}.example.org##.${BANNER_CLASS}-${i} > div[data-ad-slot="${i}"]`);
    }

    for (let i = 0; i < PAGE_RULE_PAIRS_COUNT; i += 1) {
        lines.push(`page.example.org##.${BANNER_CLASS}-x${i}`);
        lines.push(`page.example.org#%#//scriptlet('set-constant', 'someLongPropertyName${i}.value', 'true')`);
    }

    lines.push(BEACON_RULE);

    return JSON.parse(JSON.stringify(lines.join('\n'))) as string;
}

/**
 * Measures the used heap after a few garbage collection passes.
 *
 * @returns Used heap in MB.
 */
function heapUsedMb(): number {
    for (let i = 0; i < GC_CALLS; i += 1) {
        collectGarbage();
    }

    return process.memoryUsage().heapUsed / MB;
}

/**
 * Creates an engine with a list of the given size.
 *
 * @param content Filter list content.
 *
 * @returns Engine instance.
 */
function createEngine(content: string): Engine {
    const list = new FilterList(content, 1, FilterList.createEmptyConversionData());

    return Engine.createSync({ filters: [{ id: 1, content: list }] });
}

describe('FilterList retention', () => {
    it('does not retain the filter text through a retrieved rule text', () => {
        const before = heapUsedMb();

        const ruleText = (() => {
            const engine = createEngine(buildContent());
            const request = new Request(BEACON_URL, PAGE_URL, RequestType.XmlHttpRequest);
            const basicRule = engine.matchRequest(request).getBasicResult()!;

            return engine.retrieveRuleText(basicRule.getFilterListId(), basicRule.getIndex());
        })();

        const after = heapUsedMb();

        expect(after - before).toBeLessThan(MAX_RETAINED_MB);
        expect(ruleText).toBe(BEACON_RULE);
    });

    it('does not retain the filter text through a MatchingResult', () => {
        const before = heapUsedMb();

        const matchingResult = (() => {
            const engine = createEngine(buildContent());
            const request = new Request(BEACON_URL, PAGE_URL, RequestType.XmlHttpRequest);

            return engine.matchRequest(request);
        })();

        const after = heapUsedMb();

        expect(after - before).toBeLessThan(MAX_RETAINED_MB);
        expect(matchingResult.getBasicResult()).not.toBeNull();
    });

    it('does not retain the filter text through a CosmeticResult', () => {
        const before = heapUsedMb();

        const cosmeticResult = (() => {
            const engine = createEngine(buildContent());
            const request = new Request(PAGE_URL, PAGE_URL, RequestType.Document);

            return engine.getCosmeticResult(request, CosmeticOption.CosmeticOptionAll);
        })();

        const after = heapUsedMb();

        expect(after - before).toBeLessThan(MAX_RETAINED_MB);
        expect(cosmeticResult.elementHiding.specific.length).toBeGreaterThan(0);
        expect(cosmeticResult.JS.specific.length).toBeGreaterThan(0);
    });

    it('does not retain the raw text through a converted rule original', () => {
        const before = heapUsedMb();

        const convertedOriginal = (() => {
            const list = new FilterList(buildContent(CONVERTED_RULE), 1);

            return list.getConvertedRuleOriginal(0);
        })();

        const after = heapUsedMb();

        expect(after - before).toBeLessThan(MAX_RETAINED_MB);
        expect(convertedOriginal).toBe(CONVERTED_RULE);
    });

    it('does not retain the raw text through a conversion error', () => {
        const before = heapUsedMb();

        const conversionError = (() => {
            const list = new FilterList(buildContent(BROKEN_RULE), 1);

            return list.getConversionErrors()[0];
        })();

        const after = heapUsedMb();

        expect(after - before).toBeLessThan(MAX_RETAINED_MB);
        expect(conversionError.rule).toBe(BROKEN_RULE);
        expect(conversionError.message).toContain('min-text-length');
    });
});
