import { NetworkRule, StringRuleList } from '@adguard/tsurlfilter';
import { Configuration, getDomain } from '../../common';
import { engineApi } from './engine-api';

/**
 * Allowlist service.
 */
export class AllowlistApi {
    static allowlistFilterId = 100;

    domains: string[] = [];

    inverted = false;

    enabled = false;

    /**
     * Configures allowlist state based on app configuration.
     *
     * @param configuration App configuration.
     */
    public configure(configuration: Configuration): void {
        const {
            allowlist,
            settings,
        } = configuration;

        const {
            allowlistEnabled,
            allowlistInverted,
        } = settings;

        this.domains = allowlist;
        this.enabled = allowlistEnabled;
        this.inverted = allowlistInverted;
    }

    /**
     * Returns a list of rules to be loaded into the engine based on allowlist state.
     *
     * @returns List of allowlist rules or null.
     */
    public getAllowlistRules(): StringRuleList | null {
        if (this.enabled && !this.inverted) {
            return new StringRuleList(
                AllowlistApi.allowlistFilterId,
                this.domains.map((domain) => {
                    return `@@//${domain}$document`;
                }).join('\n'),
            );
        }

        return null;
    }

    /**
     * Match frame rule based on allowlist state.
     *
     * @param frameUrl Frame url.
     * @returns Matched rule or null.
     */
    public matchFrame(frameUrl: string): NetworkRule | null {
        /**
         * If inverted allowlist enabled, use specific matching strategy.
         */
        if (this.enabled && this.inverted) {
            return this.matchFrameInverted(frameUrl);
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
    private matchFrameInverted(frameUrl: string): NetworkRule | null {
        const domain = getDomain(frameUrl);

        if (!domain) {
            return null;
        }

        if (!this.domains.includes(domain)) {
            return AllowlistApi.createAllowlistRule(domain);
        }

        return engineApi.matchFrame(frameUrl);
    }

    /**
     * Creates allowlist rule for domain.
     *
     * @param domain Domain name.
     * @returns Allowlist rule or null.
     */
    private static createAllowlistRule(domain: string): null | NetworkRule {
        if (!domain) {
            return null;
        }

        return new NetworkRule(`@@//${domain}$document`, AllowlistApi.allowlistFilterId);
    }
}

export const allowlistApi = new AllowlistApi();
