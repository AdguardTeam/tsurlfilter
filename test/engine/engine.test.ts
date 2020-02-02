import { Engine } from '../../src/engine/engine';
import { Request, RequestType } from '../../src';
import { StringRuleList } from '../../src/filterlist/rule-list';
import { RuleStorage } from '../../src/filterlist/rule-storage';

describe('TestEngineMatchRequest', () => {
    it('works if request matches rule', () => {
        const rules = ['||example.org^$third-party'];
        const list = new StringRuleList(1, rules.join('\n'), false);
        const engine = new Engine(new RuleStorage([list]));

        const request = new Request('https://example.org', '', RequestType.Document);
        const result = engine.matchRequest(request);

        expect(result.basicRule).toBeNull();
        expect(result.documentRule).toBeNull();
        expect(result.replaceRules).toBeNull();
        expect(result.cspRules).toBeNull();
        expect(result.cookieRules).toBeNull();
        expect(result.stealthRule).toBeNull();
    });
});
