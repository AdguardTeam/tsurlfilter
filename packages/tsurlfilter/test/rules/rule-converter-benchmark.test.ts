import * as fs from 'fs/promises';
import * as path from 'path';
import { RuleConverter, setLogger } from '../../src';

const logger = global.console;

beforeAll(() => {
    global.console = {
        ...console,
        // ignore all except error
        log: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    };

    setLogger(global.console);
});

afterAll(() => {
    global.console = console;
    setLogger(console);
});

describe('rule converter performance benchmark', () => {
    it('converts easylist', async () => {
        // this test with flag --runInBand takes on macbook pro 2021, Apple M1 Pro, 16gb ram ~ 500ms
        const rules = (await fs.readFile(path.resolve(__dirname, '../resources/easylist-base.txt'))).toString();
        const start = performance.now();
        RuleConverter.convertRules(rules);
        const end = performance.now();
        const time = end - start;
        const lines = rules.split(/\r?\n/);
        logger.log('rules length:', lines.length);
        logger.log('conversion took', time, 'ms');
        logger.log('for one rule', time / lines.length, 'ms per rule');

        // this was put to 3sec to make sure that the test will not fail on CI
        expect(time).toBeLessThanOrEqual(3000);
    });

    it('converts ublock', async () => {
        // this test with flag --runInBand takes on macbook pro 2021, Apple M1 Pro, 16gb ram - 450ms
        const rules = (await fs.readFile(path.resolve(__dirname, '../resources/ublock-base.txt'))).toString();
        const start = performance.now();
        RuleConverter.convertRules(rules);
        const end = performance.now();
        const time = end - start;
        const lines = rules.split(/\r?\n/);
        logger.log('rules length:', lines.length);
        logger.log('conversion took', time, 'ms');
        logger.log('for one rule', time / lines.length, 'ms per rule');

        // this was put to 3sec to make sure that the test will not fail on CI
        expect(time).toBeLessThanOrEqual(3000);
    });
});
