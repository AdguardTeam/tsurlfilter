import type { NetworkRule } from '@adguard/tsurlfilter';

import { getDomain } from '../../common/utils/url';
import { Allowlist } from './allowlist';
import type { EngineApi } from './engine-api';

/**
 * Matches rules from {@link EngineApi} based on current {@link Allowlist} state.
 */
export class DocumentApi {
    /**
     * Creates new DocumentApi instance.
     *
     * @param allowlist Allowlist API.
     * @param engineApi Engine API.
     */
    constructor(
        private readonly allowlist: Allowlist,
        private readonly engineApi: EngineApi,
    ) { }

    /**
     * Match frame rule based on allowlist state.
     *
     * @param frameUrl Frame url.
     * @returns Matched rule or null.
     */
    public matchFrame(frameUrl: string): NetworkRule | null {
        const { enabled, inverted } = this.allowlist;
        /**
         * If inverted allowlist enabled, use specific matching strategy.
         */
        if (enabled && inverted) {
            return this.matchFrameInverted(frameUrl);
        }

        /**
         * If allowlist mode is default, request rule from engine.
         * If allowlist is enabled, rules have already loaded.
         */
        return this.engineApi.matchFrame(frameUrl);
    }

    /**
     * Creates allowlist rule for domains that are not in the inverted list.
     * In other cases returns engine matched rule.
     *
     * @param frameUrl Frame url.
     * @returns Matched rule or null.
     */
    private matchFrameInverted(frameUrl: string): NetworkRule | null {
        const domain = getDomain(frameUrl);

        if (!domain) {
            return null;
        }

        if (!this.allowlist.domains.includes(domain)) {
            return Allowlist.createAllowlistRule(domain);
        }

        return this.engineApi.matchFrame(frameUrl);
    }
}
