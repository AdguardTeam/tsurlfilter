import { NetworkEngine } from '../../src/engine/network-engine';
import { Request, RequestType } from '../../src/request';

describe('TestEmptyNetworkEngine', () => {
    it('works if it finds simple rules', () => {
        const engine = new NetworkEngine([]);
        const request = new Request('http://example.org/', '', RequestType.Other);
        const result = engine.match(request);

        expect(result).toBeNull();
    });
});

describe('TestMatchWhitelistRule', () => {
    it('works if it finds simple rules', () => {
        const rule = '||example.org^$script';
        const exceptionRule = '@@http://example.org^';

        const engine = new NetworkEngine([rule, exceptionRule]);
        const request = new Request('http://example.org/', '', RequestType.Script);
        const result = engine.match(request);

        expect(result).toBeDefined();
        expect(result).toEqual(exceptionRule);
    });
});

// TODO: Add more tests
