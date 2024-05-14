import console from 'console';
import fs from 'fs';
import os from 'os';
import {
    BufferRuleList,
    DnsEngine,
    Engine,
    NetworkEngine,
    RuleStorage,
    setLogger,
} from '../../src';
import { ByteBuffer } from '../../src/utils/byte-buffer';

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
// ┌────────────────┬─────────────┬─────────────┬────────────┐
// │    (index)     │    cold     │     hot     │    diff    │
// ├────────────────┼─────────────┼─────────────┼────────────┤
// │     engine     │ '554.46 ms' │ '321.80 ms' │ '-41.96 %' │
// │ network engine │ '241.32 ms' │  '0.01 ms'  │ '-99.99 %' │
// │   dns engine   │ '190.96 ms' │  '1.05 ms'  │ '-99.45 %' │
// └────────────────┴─────────────┴─────────────┴────────────┘
describe('Start Engine Benchmark', () => {
    const ROUNDS = 10;

    let result: Record<string, {
        cold: string,
        hot: string,
        diff: string,
    }>;

    function runBenchmark(title: string, cb: () => { cold: number, hot: number }): void {
        const coldMeasurements = [];
        const hotMeasurements = [];
        let i = ROUNDS;

        while (i > 0) {
            const { cold, hot } = cb();
            coldMeasurements.push(cold);
            hotMeasurements.push(hot);
            i -= 1;
        }

        const coldAverage = coldMeasurements.reduce((a, b) => a + b, 0) / ROUNDS;
        const hotAverage = hotMeasurements.reduce((a, b) => a + b, 0) / ROUNDS;
        const differenceInPercent = ((hotAverage - coldAverage) / coldAverage) * 100;

        result[title] = {
            cold: `${coldAverage.toFixed(2)} ms`,
            hot: `${hotAverage.toFixed(2)} ms`,
            diff: `${differenceInPercent.toFixed(2)} %`,
        };
    }

    beforeAll(() => {
        setLogger({
            error: jest.fn(),
            info: jest.fn(),
            debug: jest.fn(),
            warn: jest.fn(),
        });

        result = {};
    });

    afterAll(() => {
        setLogger(console);
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
        const rulesFilePath = './test/resources/adguard_base_filter.txt';

        const ruleText = await fs.promises.readFile(rulesFilePath, 'utf8');

        runBenchmark('engine', () => {
            const list = new BufferRuleList(1, ruleText, false);
            const ruleStorage = new RuleStorage([list]);

            const buffer = new ByteBuffer();
            const coldStart = performance.now();
            const engine = Engine.create(ruleStorage, buffer, false);
            const coldEnd = performance.now() - coldStart;

            expect(engine).toBeTruthy();
            expect(engine.getRulesCount()).toEqual(91694);

            const newBuffer = new ByteBuffer(buffer.data); // copy buffer

            const hotStart = performance.now();
            const engineFromBuffer = Engine.from(ruleStorage, newBuffer);
            const hotEnd = performance.now() - hotStart;

            expect(engineFromBuffer).toBeTruthy();
            expect(engineFromBuffer.getRulesCount()).toEqual(91694);

            return {
                cold: coldEnd,
                hot: hotEnd,
            };
        });
    });

    it('starts network engine', async () => {
        const rulesFilePath = './test/resources/adguard_base_filter.txt';

        const ruleText = await fs.promises.readFile(rulesFilePath, 'utf8');
        runBenchmark('network engine', () => {
            const list = new BufferRuleList(1, ruleText, false);
            const ruleStorage = new RuleStorage([list]);

            const buffer = new ByteBuffer();
            const coldStart = performance.now();
            const engine = NetworkEngine.create(ruleStorage, buffer, false);
            const coldEnd = performance.now() - coldStart;

            expect(engine).toBeTruthy();
            expect(engine.rulesCount).toEqual(44613);

            const newBuffer = new ByteBuffer(buffer.data); // copy buffer

            const hotStart = performance.now();
            const engineFromBuffer = new NetworkEngine(ruleStorage, newBuffer, 0);
            const hotEnd = performance.now() - hotStart;

            expect(engineFromBuffer).toBeTruthy();
            expect(engine.rulesCount).toEqual(44613);

            return {
                cold: coldEnd,
                hot: hotEnd,
            };
        });
    });

    it('starts dns engine', async () => {
        const rulesFilePath = './test/resources/adguard_sdn_filter.txt';
        const hostsFilePath = './test/resources/hosts';

        const rulesText = await fs.promises.readFile(rulesFilePath, 'utf8');
        const hostsText = await fs.promises.readFile(hostsFilePath, 'utf8');

        runBenchmark('dns engine', () => {
            const ruleList = new BufferRuleList(1, rulesText, false);
            const hostList = new BufferRuleList(2, hostsText, false);
            const ruleStorage = new RuleStorage([ruleList, hostList]);

            const buffer = new ByteBuffer();
            const coldStart = performance.now();
            const engine = DnsEngine.create(ruleStorage, buffer, false);
            const coldEnd = performance.now() - coldStart;

            expect(engine).toBeTruthy();
            expect(engine.rulesCount).toEqual(55999);

            const newBuffer = new ByteBuffer(buffer.data); // copy buffer

            const hotStart = performance.now();
            const engineFromBuffer = DnsEngine.from(ruleStorage, newBuffer);
            const hotEnd = performance.now() - hotStart;

            expect(engineFromBuffer).toBeTruthy();
            expect(engine.rulesCount).toEqual(55999);

            return {
                cold: coldEnd,
                hot: hotEnd,
            };
        });
    });
});
