import {
    describe,
    it,
    expect,
    beforeAll,
    afterAll,
    vi,
    bench,
} from 'vitest';
import console from 'node:console';
import { join } from 'node:path';
import { readFile } from 'node:fs/promises';

import { CosmeticEngine } from '../../src/engine/cosmetic-engine/cosmetic-engine';
import { DnsEngine } from '../../src/engine/dns-engine';
import { Engine } from '../../src/engine/engine';
import { NetworkEngine } from '../../src/engine/network-engine';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { StringRuleList } from '../../src/filterlist/string-rule-list';
import { setLogger } from '../../src/utils/logger';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = new URL('.', import.meta.url).pathname;

const adguardBaseFilter = await readFile(join(__dirname, '../resources/adguard_base_filter.txt'), 'utf8');
const adguardSdnFilter = await readFile(join(__dirname, '../resources/adguard_sdn_filter.txt'), 'utf8');
const hostsFile = await readFile(join(__dirname, '../resources/hosts'), 'utf8');

// FIXME: double check after fixing DNS engine
// FIXME: show system info with https://www.npmjs.com/package/systeminformation
describe('Start Engine Benchmark', () => {
    const startEngine = () => {
        const engine = new Engine({
            filters: [{
                id: 1,
                text: adguardBaseFilter,
            }],
        });

        return engine;
    };

    const startNetworkEngine = () => {
        const engine = new NetworkEngine(
            new RuleStorage([
                new StringRuleList(1, adguardBaseFilter, false, false, false),
            ]),
            false,
        );

        return engine;
    };

    const startDnsEngine = () => {
        const engine = new DnsEngine(
            new RuleStorage([
                new StringRuleList(1, adguardSdnFilter, false, false, false),
                new StringRuleList(2, hostsFile, false, false, false),
            ]),
        );

        return engine;
    };

    const startCosmeticEngine = () => {
        const engine = new CosmeticEngine(
            new RuleStorage([
                new StringRuleList(1, adguardBaseFilter, false, false, false),
            ]),
        );

        return engine;
    };

    beforeAll(() => {
        setLogger({
            error: vi.fn(),
            info: vi.fn(),
            debug: vi.fn(),
            warn: vi.fn(),
        });

        const engine = startEngine();
        expect(engine).toBeTruthy();
        expect(engine.getRulesCount()).toEqual(91691);

        const networkEngine = startNetworkEngine();
        expect(networkEngine.rulesCount).toEqual(44614);

        const dnsEngine = startDnsEngine();
        expect(dnsEngine.rulesCount).toEqual(55997);

        const cosmeticEngine = startCosmeticEngine();
        expect(cosmeticEngine.rulesCount).toEqual(91691);
    });

    afterAll(() => {
        setLogger(console);
    });

    bench('Engine starting time', async () => {
        startEngine();
    });

    it('NetworkEngine starting time', async () => {
        startNetworkEngine();
    });

    it('DnsEngine starting time', async () => {
        startDnsEngine();
    });

    it('CosmeticEngine starting time', async () => {
        startCosmeticEngine();
    });
});
