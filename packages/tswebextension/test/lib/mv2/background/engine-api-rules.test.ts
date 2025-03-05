import {
    beforeAll,
    describe,
    expect,
    it,
    vi,
} from 'vitest';
import { FilterListPreprocessor, type PreprocessedFilterList } from '@adguard/tsurlfilter';
import { type AnyRule, RuleGenerator } from '@adguard/agtree';

import { extendConfig, type RecursivePartial } from '../../../helpers/config-extend';
import { type ConfigurationMV2, extSessionStorage } from '../../../../src/lib';
import { EngineApi } from '../../../../src/lib/mv2/background/engine-api';
import { Allowlist } from '../../../../src/lib/mv2/background/allowlist';
import { appContext } from '../../../../src/lib/mv2/background/app-context';
import { stealthApi } from '../../../../src/lib/mv2/background/stealth-api';
import { ALLOWLIST_FILTER_ID } from '../../../../src/lib/common/constants';

import { getConfigurationMv2Fixture } from './fixtures/configuration';

vi.mock('../../../../src/lib/mv2/background/app-context');

describe('EngineApi.retrieveRuleNode', () => {
    /**
     * Create and start engine API.
     *
     * @param additionalConfig Additional configuration.
     *
     * @returns Engine API instance.
     */
    const createAndStartEngineApi = async (
        additionalConfig?: RecursivePartial<ConfigurationMV2>,
    ): Promise<EngineApi> => {
        const allowlist = new Allowlist();
        const api = new EngineApi(allowlist, appContext, stealthApi);
        const config = extendConfig(getConfigurationMv2Fixture(), additionalConfig);

        await api.startEngine(config);

        return api;
    };

    beforeAll(() => {
        extSessionStorage.init();
        appContext.startTimeMs = Date.now();
    });

    it('should return allowlist rules if allowlist is enabled and has rules', async () => {
        const list1 = FilterListPreprocessor.preprocess([
            '||example.org^$third-party',
            '##banner',
        ].join('\n'));

        const list2 = FilterListPreprocessor.preprocess([
            "#%#//scriptlet('set-constant', 'foo', 'bar')",
            '#@#.yay',
        ].join('\n'));

        const api = await createAndStartEngineApi({
            allowlist: ['example.com'],
            filters: [
                {
                    content: list1.filterList,
                    sourceMap: list1.sourceMap,
                    filterId: 1,
                    trusted: true,
                },
                {
                    content: list2.filterList,
                    sourceMap: list2.sourceMap,
                    filterId: 2,
                    trusted: true,
                },
            ],
            settings: {
                allowlistEnabled: true,
            },
        });

        /**
         * Helper function to get the rule index from the source map by the rule number.
         *
         * @param rule Rule number, starting from 1.
         * @param sourceMap Source map.
         *
         * @returns Rule index.
         *
         * @throws Error if the rule is not found.
         */
        const getRuleIndex = (rule: number, sourceMap: PreprocessedFilterList['sourceMap']): number => {
            const ruleIndex = Object.keys(sourceMap)[rule - 1];

            if (ruleIndex === undefined) {
                throw new Error(`Rule with number ${rule} not found in source map`);
            }

            return parseInt(ruleIndex, 10);
        };

        let node: AnyRule | null;

        // should return allowlist rule for domain correctly
        // position 4 is the first valid position within byte buffer, because 0-3 are reserved for schema version
        node = api.retrieveRuleNode(ALLOWLIST_FILTER_ID, 4);
        expect(node).not.toBeNull();
        expect(RuleGenerator.generate(node!)).toStrictEqual('@@///(www\\.)?example\\.com/$document,important');

        // should return null for non-existing node and non-existing filter
        // position 5 is definitely an invalid position, because first rule starts from position 4
        node = api.retrieveRuleNode(ALLOWLIST_FILTER_ID, 5);
        expect(node).toBeNull();

        node = api.retrieveRuleNode(-123, 4);
        expect(node).toBeNull();

        // List 1
        node = api.retrieveRuleNode(1, getRuleIndex(1, list1.sourceMap));
        expect(node).not.toBeNull();
        expect(RuleGenerator.generate(node!)).toStrictEqual('||example.org^$third-party');

        node = api.retrieveRuleNode(1, getRuleIndex(2, list1.sourceMap));
        expect(node).not.toBeNull();
        expect(RuleGenerator.generate(node!)).toStrictEqual('##banner');

        // List 2
        node = api.retrieveRuleNode(2, getRuleIndex(1, list2.sourceMap));
        expect(node).not.toBeNull();
        expect(RuleGenerator.generate(node!)).toStrictEqual("#%#//scriptlet('set-constant', 'foo', 'bar')");

        node = api.retrieveRuleNode(2, getRuleIndex(2, list2.sourceMap));
        expect(node).not.toBeNull();
        expect(RuleGenerator.generate(node!)).toStrictEqual('#@#.yay');
    });

    it('should return null if allowlist is disabled', async () => {
        const api = await createAndStartEngineApi({
            allowlist: ['example.com'],
            settings: {
                allowlistEnabled: false,
            },
        });

        // should return null because allowlist is disabled
        const node = api.retrieveRuleNode(ALLOWLIST_FILTER_ID, 4);
        expect(node).toBeNull();
    });
});
