import console from 'console';
import fs from 'fs';
import {
    BufferRuleList,
    DnsEngine,
    Engine,
    NetworkEngine,
    RuleStorage,
    setLogger,
} from '../../src';
import { ByteBuffer } from '../../src/utils/byte-buffer';

const toFixed = (num: number): string => {
    return num.toFixed(2);
};

describe('Start Engine Benchmark', () => {
    beforeAll(() => {
        setLogger({
            error(): void {
            },
            info(): void {
            },
            debug(): void {
            },
            warn(): void {
            },
        });
    });

    afterAll(() => {
        setLogger(console);
    });

    it('starts engine', async () => {
        const rulesFilePath = './test/resources/adguard_base_filter.txt';

        const ruleText = await fs.promises.readFile(rulesFilePath, 'utf8');

        console.log('Starting engine..');
        const startParse = performance.now();

        // Starting engine..
        // ┌─────────┬─────────────┐
        // │ (index) │   Values    │
        // ├─────────┼─────────────┤
        // │  cold   │ '377.50 ms' │
        // │   hot   │ '187.66 ms' │
        // │  diff   │ '-50.29 %'  │
        // └─────────┴─────────────┘
        // Elapsed on parsing rules: 5660.67 ms

        let count = 0;
        let buffer;
        const loopsCount = 10;
        const coldMeasurements = [];
        const hotMeasurements = [];
        while (count < loopsCount) {
            count += 1;

            const list = new BufferRuleList(1, ruleText, false);
            const ruleStorage = new RuleStorage([list]);

            buffer = new ByteBuffer();
            const coldStart = performance.now();
            const engine = Engine.create(ruleStorage, buffer, false);
            coldMeasurements.push(performance.now() - coldStart);

            expect(engine).toBeTruthy();
            expect(engine.getRulesCount()).toEqual(91694);

            const newBuffer = new ByteBuffer(buffer.data); // copy buffer

            const hotStart = performance.now();
            const engineFromBuffer = Engine.from(ruleStorage, newBuffer);
            hotMeasurements.push(performance.now() - hotStart);

            expect(engineFromBuffer).toBeTruthy();
            expect(engineFromBuffer.getRulesCount()).toEqual(91694);
        }

        const coldAverage = coldMeasurements.reduce((a, b) => a + b, 0) / loopsCount;
        const hotAverage = hotMeasurements.reduce((a, b) => a + b, 0) / loopsCount;
        const differenceInPercent = ((hotAverage - coldAverage) / coldAverage) * 100;
        console.table({
            cold: `${toFixed(coldAverage)} ms`,
            hot: `${toFixed(hotAverage)} ms`,
            diff: `${toFixed(differenceInPercent)} %`,
        });

        console.log(`Elapsed on parsing rules: ${toFixed(performance.now() - startParse)} ms`);
    });

    it('starts network engine', async () => {
        const rulesFilePath = './test/resources/adguard_base_filter.txt';

        const ruleText = await fs.promises.readFile(rulesFilePath, 'utf8');

        console.log('Starting network engine...');
        const startParse = performance.now();

        // Starting network engine...
        // ┌─────────┬─────────────┐
        // │ (index) │   Values    │
        // ├─────────┼─────────────┤
        // │  cold   │ '133.58 ms' │
        // │   hot   │  '0.03 ms'  │
        // │  diff   │ '-99.98 %'  │
        // └─────────┴─────────────┘
        // Elapsed on parsing rules: 1342.14 ms

        let count = 0;
        let buffer;
        const loopsCount = 10;
        const coldMeasurements = [];
        const hotMeasurements = [];
        while (count < loopsCount) {
            count += 1;

            const list = new BufferRuleList(1, ruleText, false);
            const ruleStorage = new RuleStorage([list]);

            buffer = new ByteBuffer();
            const coldStart = performance.now();
            const networkEngine = NetworkEngine.create(ruleStorage, buffer, false);
            coldMeasurements.push(performance.now() - coldStart);

            expect(networkEngine).toBeTruthy();
            expect(networkEngine.rulesCount).toEqual(44613);

            const newBuffer = new ByteBuffer(buffer.data); // copy buffer

            const hotStart = performance.now();
            const networkEngineFromBuffer = new NetworkEngine(ruleStorage, newBuffer, 0);
            hotMeasurements.push(performance.now() - hotStart);

            expect(networkEngineFromBuffer).toBeTruthy();
            expect(networkEngineFromBuffer.rulesCount).toEqual(44613);
        }

        const coldAverage = coldMeasurements.reduce((a, b) => a + b, 0) / loopsCount;
        const hotAverage = hotMeasurements.reduce((a, b) => a + b, 0) / loopsCount;
        const differenceInPercent = ((hotAverage - coldAverage) / coldAverage) * 100;
        console.table({
            cold: `${toFixed(coldAverage)} ms`,
            hot: `${toFixed(hotAverage)} ms`,
            diff: `${toFixed(differenceInPercent)} %`,
        });

        console.log(`Elapsed on parsing rules: ${toFixed(performance.now() - startParse)} ms`);
    });

    it('starts dns engine', async () => {
        const rulesFilePath = './test/resources/adguard_sdn_filter.txt';
        const hostsFilePath = './test/resources/hosts';

        const rulesText = await fs.promises.readFile(rulesFilePath, 'utf8');
        const hostsText = await fs.promises.readFile(hostsFilePath, 'utf8');

        console.log('Starting dns engine...');
        const startParse = performance.now();

        // Starting dns engine...
        // ┌─────────┬─────────────┐
        // │ (index) │   Values    │
        // ├─────────┼─────────────┤
        // │  cold   │ '191.61 ms' │
        // │   hot   │  '0.76 ms'  │
        // │  diff   │ '-99.61 %'  │
        // └─────────┴─────────────┘
        // Elapsed on parsing rules: 1979.51 ms

        let count = 0;
        let buffer;
        const loopsCount = 10;
        const coldMeasurements = [];
        const hotMeasurements = [];
        while (count < loopsCount) {
            count += 1;

            const ruleList = new BufferRuleList(1, rulesText, false);
            const hostList = new BufferRuleList(2, hostsText, false);
            const ruleStorage = new RuleStorage([ruleList, hostList]);

            buffer = new ByteBuffer();
            const coldStart = performance.now();
            const dnsEngine = DnsEngine.create(ruleStorage, buffer, false);
            coldMeasurements.push(performance.now() - coldStart);

            expect(dnsEngine).toBeTruthy();
            expect(dnsEngine.rulesCount).toEqual(55999);

            const newBuffer = new ByteBuffer(buffer.data); // copy buffer

            const hotStart = performance.now();
            const dnsEngineFromBuffer = DnsEngine.from(ruleStorage, newBuffer);
            hotMeasurements.push(performance.now() - hotStart);

            expect(dnsEngineFromBuffer).toBeTruthy();
            expect(dnsEngineFromBuffer.rulesCount).toEqual(55999);
        }

        const coldAverage = coldMeasurements.reduce((a, b) => a + b, 0) / loopsCount;
        const hotAverage = hotMeasurements.reduce((a, b) => a + b, 0) / loopsCount;
        const differenceInPercent = ((hotAverage - coldAverage) / coldAverage) * 100;
        console.table({
            cold: `${toFixed(coldAverage)} ms`,
            hot: `${toFixed(hotAverage)} ms`,
            diff: `${toFixed(differenceInPercent)} %`,
        });

        console.log(`Elapsed on parsing rules: ${toFixed(performance.now() - startParse)} ms`);
    });
});
