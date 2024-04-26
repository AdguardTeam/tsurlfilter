import { DnsEngine } from '../../src/engine/dns-engine';
import { BufferRuleList } from '../../src/filterlist/buffer-rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';
import { ByteBuffer } from '../../src/utils/byte-buffer';

describe('General DNS engine tests', () => {
    /**
     * Helper function creates rule storage
     *
     * @param listId
     * @param rules
     */
    const createTestRuleStorage = (listId: number, rules: string[]): RuleStorage => {
        const list = new BufferRuleList(listId, rules.join('\n'), false);
        return new RuleStorage([list]);
    };

    it('works if empty engine is ok', () => {
        const engine = DnsEngine.create(createTestRuleStorage(1, []), new ByteBuffer());

        const result = engine.match('example.org');

        expect(result).not.toBeNull();
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks engine match', () => {
        const engine = DnsEngine.create(createTestRuleStorage(1, [
            '||example.org^',
            '||example2.org/*',
            '@@||example3.org^',
            '0.0.0.0 v4.com',
            '127.0.0.1 v4.com',
            ':: v6.com',
            '127.0.0.1 v4and6.com',
            '127.0.0.2 v4and6.com',
            '::1 v4and6.com',
            '::2 v4and6.com',
        ]), new ByteBuffer());

        let result;

        result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getText()).toBe('||example.org^');
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('example2.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getText()).toBe('||example2.org/*');
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('example3.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getText()).toBe('@@||example3.org^');
        expect(result.hostRules).toHaveLength(0);

        result = engine.match('v4.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(2);
        expect(result.hostRules[0].getText()).toBe('127.0.0.1 v4.com');
        expect(result.hostRules[1].getText()).toBe('0.0.0.0 v4.com');

        result = engine.match('v6.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(1);
        expect(result.hostRules[0].getText()).toBe(':: v6.com');

        result = engine.match('v4and6.com');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(4);
        expect(result.hostRules[0].getText()).toBe('::2 v4and6.com');
        expect(result.hostRules[1].getText()).toBe('::1 v4and6.com');
        expect(result.hostRules[2].getText()).toBe('127.0.0.2 v4and6.com');
        expect(result.hostRules[3].getText()).toBe('127.0.0.1 v4and6.com');

        result = engine.match('example.net');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - protocol', () => {
        const engine = DnsEngine.create(createTestRuleStorage(1, [
            '://example.org',
        ]), new ByteBuffer());

        const result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - regex', () => {
        const engine = DnsEngine.create(createTestRuleStorage(1, [
            '/^stats?\\./',
        ]), new ByteBuffer());

        const result = engine.match('stats.test.com');
        expect(result.basicRule).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for host level network rule - regex allowlist', () => {
        const engine = DnsEngine.create(createTestRuleStorage(1, [
            '||stats.test.com^',
            '@@/stats?\\./',
        ]), new ByteBuffer());

        const result = engine.match('stats.test.com');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.isAllowlist()).toBeTruthy();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for badfilter rules', () => {
        const engine = DnsEngine.create(createTestRuleStorage(1, [
            '||example.org^',
            '||example.org^$badfilter',
        ]), new ByteBuffer());

        const result = engine.match('example.org');
        expect(result.basicRule).toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('checks match for dnsrewrite rules', () => {
        const engine = DnsEngine.create(createTestRuleStorage(1, [
            '||example.org^',
            '||example.org^$dnsrewrite=1.2.3.4',
        ]), new ByteBuffer());

        const result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getAdvancedModifier()).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);
    });

    it('should deserialized correctly', () => {
        const buffer = new ByteBuffer();
        const ruleStorage = createTestRuleStorage(1, [
            '||example.org^',
            '||example.org^$dnsrewrite=1.2.3.4',
        ]);

        const engine = DnsEngine.create(ruleStorage, buffer);

        const result = engine.match('example.org');
        expect(result.basicRule).not.toBeNull();
        expect(result.basicRule!.getAdvancedModifier()).not.toBeNull();
        expect(result.hostRules).toHaveLength(0);

        const restoredBuffer = new ByteBuffer(buffer.chunks);

        const restoredEngine = DnsEngine.from(ruleStorage, restoredBuffer);

        const restoredEngineResult = restoredEngine.match('example.org');
        expect(restoredEngineResult.basicRule).not.toBeNull();
        expect(restoredEngineResult.basicRule!.getAdvancedModifier()).not.toBeNull();
        expect(restoredEngineResult.hostRules).toHaveLength(0);
    });
});
