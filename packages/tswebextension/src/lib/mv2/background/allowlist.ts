import { NetworkRule, StringRuleList } from '@adguard/tsurlfilter';
import { Configuration, getDomain } from '../../common';
import { engineApi } from './engine-api';

export class AllowlistApi {
    static allowlistFilterId = 100;

    domains: string[] = [];

    inverted = false;

    enabled = false;

    /**
     * Configure allowlist state based on app configuration
     */
    public configure(configuration: Configuration) {
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
     * Returns a list of rules to be loaded into the engine
     * based on allowlist state
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
     * Match frame rule match based on allowlist state
     */
    public matchFrame(frameUrl: string): NetworkRule | null {
        /**
         * If inverted allowlist enabled, use specific matching strategy
         */
        if (this.enabled && this.inverted) {
            return this.matchFrameInverted(frameUrl);
        }

        /**
         * If allowlist mode is default, request rule from engine
         * If allowlist is enabled, rules have already loaded
         */
        return engineApi.matchFrame(frameUrl);
    }

    /**
     * Creates allowlist rule for domains that are not in the inverted list
     * In other cases returns engine matched rule
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
     * Create allowlist rule for domain
     */
    private static createAllowlistRule(domain: string) {
        if (!domain) {
            return null;
        }

        return new NetworkRule(`@@//${domain}$document`, AllowlistApi.allowlistFilterId);
    }
}

export const allowlistApi = new AllowlistApi();
