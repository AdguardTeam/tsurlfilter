import console from 'node:console';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
    afterAll,
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { DnsEngine } from '../../src/engine/dns-engine';
import { Engine } from '../../src/engine/engine';
import { NetworkEngine } from '../../src/engine/network-engine';
import { BufferRuleList } from '../../src/filterlist/buffer-rule-list';
import { FilterListPreprocessor } from '../../src/filterlist/preprocessor';
import { RuleStorage } from '../../src/filterlist/rule-storage';

// eslint-disable-next-line @typescript-eslint/naming-convention, no-underscore-dangle
const __dirname = new URL('.', import.meta.url).pathname;

// TODO: Consider using Vitest benchmark feature: https://vitest.dev/guide/features#benchmarking
// Time: Tue May 14 2024
// Env:
// ┌──────────────┬────────────────────────────────────────────┐
// │   (index)    │                   Values                   │
// ├──────────────┼────────────────────────────────────────────┤
// │   Platform   │                'darwin x64'                │
// │     CPU      │ 'Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz' │
// │     RAM      │                  '16 GB'                   │
// │ Node version │                 '18.19.0'                  │
// │  V8 version  │           '10.2.154.26-node.28'            │
// └──────────────┴────────────────────────────────────────────┘
// Result (10 rounds):
// ┌────────────────┬─────────────┐
// │    (index)     │   Values    │
// ├────────────────┼─────────────┤
// │     engine     │ '570.33 ms' │
// │ network engine │ '248.39 ms' │
// │   dns engine   │ '180.94 ms' │
// └────────────────┴─────────────┘
describe('Start Engine Benchmark', () => {
    const ROUNDS = 10;

    let result: Record<string, string>;

    /**
     * Runs benchmark.
     *
     * @param title Title.
     * @param cb Callback.
     */
    function runBenchmark(title: string, cb: () => number): void {
        const measurements = [];
        let i = ROUNDS;

        while (i > 0) {
            measurements.push(cb());
            i -= 1;
        }

        const average = measurements.reduce((a, b) => a + b, 0) / ROUNDS;

        result[title] = `${average.toFixed(2)} ms`;
    }

    beforeAll(() => {
        result = {};
    });

    afterAll(() => {
        vi.restoreAllMocks();
        console.log('Time:', new Date(Date.now()).toDateString());
        console.log('Env:');
        console.table({
            Platform: `${os.platform()} ${os.arch()}`,
            CPU: os.cpus()[0].model,
            RAM: `${os.totalmem() / (1024 ** 3)} GB`,
            'Node version': `${process.versions.node}`,
            'V8 version': `${process.versions.v8}`,
        });
        console.log(`Result (${ROUNDS} rounds):`);
        console.table(result);
    });

    it('starts engine', async () => {
        // If we run the tests from the Vitest workspace, we need to set the correct path
        // See https://github.com/vitest-dev/vitest/issues/5277
        const rulesFilePath = path.join(__dirname, '../resources/adguard_base_filter.txt');

        const rawFilterList = await fs.promises.readFile(rulesFilePath, 'utf8');
        const processed = FilterListPreprocessor.preprocess(rawFilterList);

        runBenchmark('engine', () => {
            const list = new BufferRuleList(1, processed.filterList, false, false, false, processed.sourceMap);
            const ruleStorage = new RuleStorage([list]);

            const start = performance.now();
            const engine = new Engine(ruleStorage, false);
            const end = performance.now() - start;

            expect(engine).toBeTruthy();
            expect(engine.getRulesCount()).toEqual(91691);

            return end;
        });
    });

    it('starts network engine', async () => {
        // If we run the tests from the Vitest workspace, we need to set the correct path
        // See https://github.com/vitest-dev/vitest/issues/5277
        const rulesFilePath = path.join(__dirname, '../resources/adguard_base_filter.txt');

        const rawFilterList = await fs.promises.readFile(rulesFilePath, 'utf8');
        const processed = FilterListPreprocessor.preprocess(rawFilterList);

        runBenchmark('network engine', () => {
            const list = new BufferRuleList(1, processed.filterList, false, false, false, processed.sourceMap);
            const ruleStorage = new RuleStorage([list]);

            const start = performance.now();
            const networkEngine = new NetworkEngine(ruleStorage, false);
            const end = performance.now() - start;

            expect(networkEngine).toBeTruthy();
            expect(networkEngine.rulesCount).toEqual(44614);

            return end;
        });
    });

    it('starts dns engine', async () => {
        // If we run the tests from the Vitest workspace, we need to set the correct path
        // See https://github.com/vitest-dev/vitest/issues/5277
        const rulesFilePath = path.join(__dirname, '../resources/adguard_sdn_filter.txt');
        const hostsFilePath = path.join(__dirname, '../resources/hosts');

        const rulesText = await fs.promises.readFile(rulesFilePath, 'utf8');
        const rulesProcessed = FilterListPreprocessor.preprocess(rulesText);
        const hostsText = await fs.promises.readFile(hostsFilePath, 'utf8');
        const hostsProcessed = FilterListPreprocessor.preprocess(hostsText, true);

        runBenchmark('dns engine', () => {
            const ruleList = new BufferRuleList(
                1,
                rulesProcessed.filterList,
                false,
                false,
                false,
                rulesProcessed.sourceMap,
            );
            const hostList = new BufferRuleList(
                2,
                hostsProcessed.filterList,
                false,
                false,
                false,
                hostsProcessed.sourceMap,
            );
            const ruleStorage = new RuleStorage([ruleList, hostList]);

            const start = performance.now();
            const dnsEngine = new DnsEngine(ruleStorage);
            const end = performance.now() - start;

            expect(dnsEngine).toBeTruthy();
            expect(dnsEngine.rulesCount).toEqual(55997);

            return end;
        });
    });
});
