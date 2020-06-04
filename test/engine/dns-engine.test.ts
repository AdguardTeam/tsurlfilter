import { DnsEngine } from '../../src/engine/dns-engine';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';

describe('General', () => {
    /**
     * Helper function creates rule storage
     *
     * @param listId
     * @param rules
     */
    const createTestRuleStorage = (listId: number, rules: string[]): RuleStorage => {
        const list = new StringRuleList(listId, rules.join('\n'), false);
        return new RuleStorage([list]);
    };

    it('works if empty engine is ok', () => {
        const engine = new DnsEngine(createTestRuleStorage(1, []));
        const result = engine.match('example.org');

        expect(result).not.toBeNull();
        expect(result).toHaveLength(0);
    });

    it('checks engine match', () => {
        const engine = new DnsEngine(createTestRuleStorage(1, [
            // '||example.org^',
            // '||example2.org/*',
            '0.0.0.0 v4.com',
            '127.0.0.1 v4.com',
            ':: v6.com',
            '127.0.0.1 v4and6.com',
            '127.0.0.2 v4and6.com',
            '::1 v4and6.com',
            '::2 v4and6.com',
        ]));

        let result;

        // result = engine.match('example.org');
        // expect(result).toHaveLength(1);
        //
        // result = engine.match('example.org');
        // expect(result).toHaveLength(1);

        result = engine.match('v4.com');
        expect(result).toHaveLength(2);
        expect(result[0].getText()).toBe('0.0.0.0 v4.com');
        expect(result[1].getText()).toBe('127.0.0.1 v4.com');

        result = engine.match('v6.com');
        expect(result).toHaveLength(1);
        expect(result[0].getText()).toBe(':: v6.com');

        result = engine.match('v4and6.com');
        expect(result).toHaveLength(4);
        expect(result[0].getText()).toBe('127.0.0.1 v4and6.com');
        expect(result[1].getText()).toBe('127.0.0.2 v4and6.com');
        expect(result[2].getText()).toBe('::1 v4and6.com');
        expect(result[3].getText()).toBe('::2 v4and6.com');

        result = engine.match('example.net');
        expect(result).toHaveLength(0);
    });
});

describe('Benchmark DnsEngine', () => {
    // TODO: Implement TestBenchDnsEngine
});
