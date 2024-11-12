import { defaultParserOptions, type ParserOptions, RuleParser } from '@adguard/agtree/parser';

import { extendConfig, type RecursivePartial } from '../../../helpers/config-extend';
import { getConfigurationMv2Fixture } from './fixtures/configuration';
import { type ConfigurationMV2 } from '../../../../src/lib';
import { EngineApi } from '../../../../src/lib/mv2/background/engine-api';
import { Allowlist } from '../../../../src/lib/mv2/background/allowlist';
import { appContext } from '../../../../src/lib/mv2/background/context';
import { stealthApi } from '../../../../src/lib/mv2/background/stealth-api';
import { ALLOWLIST_FILTER_ID } from '../../../../src/lib/common/constants';

jest.mock('@lib/mv2/background/context');

/**
 * AGTree parser options to use in tests.
 */
const AGTREE_OPTIONS: ParserOptions = {
    ...defaultParserOptions,
    includeRaws: false,
    isLocIncluded: false,
};

describe('EngineApi.retrieveDynamicRuleNode', () => {
    /**
     * Create and start engine API.
     *
     * @param additionalConfig Additional configuration.
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

    it('should return allowlist rules if allowlist is enabled and has rules', async () => {
        const api = await createAndStartEngineApi({
            allowlist: ['example.com'],
            settings: {
                allowlistEnabled: true,
            },
        });

        // should return allowlist rule for domain correctly
        // position 4 is the first valid position within byte buffer, because 0-3 are reserved for schema version
        let node = api.retrieveDynamicRuleNode(ALLOWLIST_FILTER_ID, 4);
        expect(node).not.toBeNull();
        expect(node).toEqual(
            RuleParser.parse('@@///(www\\.)?example\\.com/$document,important', AGTREE_OPTIONS),
        );

        // should return null for non-existing node and non-existing filter
        // position 5 is definitely an invalid position, because first rule starts from position 4
        node = api.retrieveDynamicRuleNode(ALLOWLIST_FILTER_ID, 5);
        expect(node).toBeNull();

        node = api.retrieveDynamicRuleNode(-123, 4);
        expect(node).toBeNull();
    });

    it('should return null if allowlist is disabled', async () => {
        const api = await createAndStartEngineApi({
            allowlist: ['example.com'],
            settings: {
                allowlistEnabled: false,
            },
        });

        // should return null because allowlist is disabled
        const node = api.retrieveDynamicRuleNode(ALLOWLIST_FILTER_ID, 4);
        expect(node).toBeNull();
    });
});
