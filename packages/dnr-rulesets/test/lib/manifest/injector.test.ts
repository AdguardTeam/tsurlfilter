import {
    afterEach,
    describe,
    expect,
    it,
    vi,
} from 'vitest';

import { RulesetsInjector } from '../../../src/lib/manifest/injector';

describe('RulesetsInjector', () => {
    const filterNames = ['filter_1', 'filter_2'];

    const mockGenerateRulesetPath = vi.fn().mockReturnValue('test');

    afterEach(() => {
        mockGenerateRulesetPath.mockClear();
    });

    it('should apply rulesets to manifest', () => {
        const injector = new RulesetsInjector();

        const patched = injector.applyRulesets(mockGenerateRulesetPath, {}, filterNames);

        expect(patched).toEqual({
            declarative_net_request: {
                rule_resources: [{
                    id: 'ruleset_1',
                    enabled: false,
                    path: 'test',
                }, {
                    id: 'ruleset_2',
                    enabled: false,
                    path: 'test',
                }],
            },
        });
        expect(mockGenerateRulesetPath).toHaveBeenCalledTimes(2);
    });

    it('should apply only selected rulesets to manifest', () => {
        const injector = new RulesetsInjector();

        const patched = injector.applyRulesets(mockGenerateRulesetPath, {}, filterNames, { ids: ['1'] });

        expect(patched).toEqual({
            declarative_net_request: {
                rule_resources: [{
                    id: 'ruleset_1',
                    enabled: false,
                    path: 'test',
                }],
            },
        });
        expect(mockGenerateRulesetPath).toHaveBeenCalledTimes(1);
    });

    it('should enable selected rulesets', () => {
        const injector = new RulesetsInjector();

        const patched = injector.applyRulesets(mockGenerateRulesetPath, {}, filterNames, { enable: ['1'] });

        expect(patched).toEqual({
            declarative_net_request: {
                rule_resources: [{
                    id: 'ruleset_1',
                    enabled: true,
                    path: 'test',
                }, {
                    id: 'ruleset_2',
                    enabled: false,
                    path: 'test',
                }],
            },
        });
        expect(mockGenerateRulesetPath).toHaveBeenCalledTimes(2);
    });

    it('should throw an error if ruleset ID is duplicated', () => {
        const manifest = {
            declarative_net_request: {
                rule_resources: [{
                    id: 'ruleset_1',
                    enabled: false,
                    path: 'whatever',
                }],
            },
        };

        const injector = new RulesetsInjector();

        expect(() => injector.applyRulesets(mockGenerateRulesetPath, manifest, filterNames)).toThrow();
        expect(mockGenerateRulesetPath).toHaveBeenCalledTimes(1);
    });

    it('should force update existed ruleset', () => {
        const manifest = {
            declarative_net_request: {
                rule_resources: [{
                    id: 'ruleset_1',
                    enabled: false,
                    path: 'whatever',
                }],
            },
        };

        const injector = new RulesetsInjector();
        const patched = injector.applyRulesets(mockGenerateRulesetPath, manifest, filterNames, {
            forceUpdate: true,
            enable: ['1'],
        });

        expect(patched).toEqual({
            declarative_net_request: {
                rule_resources: [{
                    id: 'ruleset_1',
                    enabled: true,
                    path: 'test',
                }, {
                    id: 'ruleset_2',
                    enabled: false,
                    path: 'test',
                }],
            },
        });
        expect(mockGenerateRulesetPath).toHaveBeenCalledTimes(2);
    });

    it('should ignore files without index', () => {
        const injector = new RulesetsInjector();

        const patched = injector.applyRulesets(mockGenerateRulesetPath, {}, ['test.txt', 'filter_1.txt']);

        expect(patched).toEqual({
            declarative_net_request: {
                rule_resources: [{
                    id: 'ruleset_1',
                    enabled: false,
                    path: 'test',
                }],
            },
        });
        expect(mockGenerateRulesetPath).toHaveBeenCalledTimes(1);
    });
});
