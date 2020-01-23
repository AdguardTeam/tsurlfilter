import { NetworkEngine } from '../../src/engine/network-engine';
import { Request, RequestType } from '../../src/request';

describe('TestEmptyNetworkEngine', () => {
    it('works if empty engine is ok', () => {
        const engine = new NetworkEngine([]);
        const request = new Request('http://example.org/', '', RequestType.Other);
        const result = engine.match(request);

        expect(result).toBeNull();
    });
});

describe('TestMatchWhitelistRule', () => {
    it('works if it finds simple whitelist rule', () => {
        const rule = '||example.org^$script';
        const exceptionRule = '@@http://example.org^';

        const engine = new NetworkEngine([rule, exceptionRule]);
        const request = new Request('http://example.org/', '', RequestType.Script);
        const result = engine.match(request);

        expect(result).toEqual(exceptionRule);
    });
});

// TODO: Add more tests
