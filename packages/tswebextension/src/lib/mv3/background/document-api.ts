import type { NetworkRule } from '@adguard/tsurlfilter';

import { getDomain, getUpperLevelDomain } from '../../common/utils/url';

import { allowlistApi, AllowlistApi } from './allowlist-api';
import { engineApi } from './engine-api';

/**
 * Matches rules from {@link EngineApi} based on current {@link Allowlist} state.
 */
export class DocumentApi {
    /**
     * Match frame rule based on allowlist state.
     *
     * @param frameUrl Frame url.
     * @returns Matched rule or null.
     */
    public static matchFrame(frameUrl: string): NetworkRule | null {
        const { enabled, inverted } = allowlistApi;
        /**
         * If inverted allowlist enabled, use specific matching strategy.
         */
        if (enabled && inverted) {
            return DocumentApi.matchFrameInverted(frameUrl);
        }

        /**
         * If allowlist mode is default, request rule from engine.
         * If allowlist is enabled, rules have already loaded.
         */
        return engineApi.matchFrame(frameUrl);
    }

    /**
     * Creates allowlist rule for domains that are not in the inverted list.
     * In other cases returns engine matched rule.
     *
     * @param frameUrl Frame url.
     * @returns Matched rule or null.
     */
    private static matchFrameInverted(frameUrl: string): NetworkRule | null {
        const domain = getDomain(frameUrl);

        if (!domain) {
            return null;
        }

        const upperDomain = getUpperLevelDomain(domain);

        if (!allowlistApi.domains.includes(domain) && !allowlistApi.domains.includes(`*.${upperDomain}`)) {
            return AllowlistApi.createAllowlistRule(domain);
        }

        return engineApi.matchFrame(frameUrl);
    }
}
