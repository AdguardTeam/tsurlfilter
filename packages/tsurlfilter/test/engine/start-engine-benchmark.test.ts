import console from 'console';
import fs from 'fs';
import {
    Engine,
    RuleStorage,
    setLogger,
    BufferRuleList,
    FilterListPreprocessor,
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

        const rawFilterList = await fs.promises.readFile(rulesFilePath, 'utf8');
        const processed = FilterListPreprocessor.preprocess(rawFilterList);

        console.log('Starting engine..');
        const startParse = Date.now();

        // Start Engine Benchmark 20 times
        // ✓ starts network-engine (7100ms)

        let count = 0;
        while (count < 20) {
            count += 1;

            const list = new BufferRuleList(1, processed.filterList, false, false, false, processed.sourceMap);
            const ruleStorage = new RuleStorage([list]);

            const engine = new Engine(ruleStorage, false);
            expect(engine).toBeTruthy();
            expect(engine.getRulesCount()).toEqual(91691);
        }

        console.log(`Elapsed on parsing rules: ${Date.now() - startParse}`);
    });
});
