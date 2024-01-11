import console from 'console';
import fs from 'fs';
import {
    Engine,
    RuleStorage,
    setLogger,
    StringRuleList,
} from '../../src';

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

    it('starts network-engine', async () => {
        const rulesFilePath = './test/resources/adguard_base_filter.txt';

        const ruleText = await fs.promises.readFile(rulesFilePath, 'utf8');

        console.log('Starting engine..');
        const startParse = Date.now();

        // Start Engine Benchmark 20 times
        // ✓ starts network-engine (7100ms)

        let count = 0;
        while (count < 20) {
            count += 1;

            const list = new StringRuleList(1, ruleText, false);
            const ruleStorage = new RuleStorage([list]);

            const engine = new Engine(ruleStorage, false);
            expect(engine).toBeTruthy();
            expect(engine.getRulesCount()).toEqual(91688);
        }

        console.log(`Elapsed on parsing rules: ${Date.now() - startParse}`);
    });
});
