import { CosmeticEngine } from './cosmetic-engine/cosmetic-engine';
import { NetworkEngine } from './network-engine';
import { Request, RequestType } from '../request';
import { CosmeticOption, MatchingResult } from './matching-result';
import { NetworkRule } from '../rules/network-rule';
import { RuleStorage } from '../filterlist/rule-storage';
import { CosmeticResult } from './cosmetic-engine/cosmetic-result';
import { config, IConfiguration } from '../configuration';
import { Journal } from '../journal';
import { CosmeticRule } from '../rules/cosmetic-rule';

/**
 * Engine represents the filtering engine with all the loaded rules
 */
export class Engine {
    /**
     * Basic filtering rules engine
     */
    private readonly networkEngine: NetworkEngine;

    /**
     * Cosmetic rules engine
     */
    private readonly cosmeticEngine: CosmeticEngine;

    /**
     * Rule journal
     */
    private readonly journal: Journal;

    /**
     * Creates an instance of an Engine
     * Parses the filtering rules and creates a filtering engine of them
     *
     * @param ruleStorage storage
     * @param configuration optional configuration
     *
     * @throws
     */
    constructor(ruleStorage: RuleStorage, configuration?: IConfiguration | undefined) {
        this.networkEngine = new NetworkEngine(ruleStorage);
        this.cosmeticEngine = new CosmeticEngine(ruleStorage);
        this.journal = new Journal();

        if (configuration) {
            config.engine = configuration.engine;
            config.version = configuration.version;
            config.verbose = configuration.verbose;
        }
    }

    /**
     * Matches the specified request against the filtering engine and returns the matching result.
     *
     * @param request - request to check
     * @return matching result
     */
    matchRequest(request: Request): MatchingResult {
        const networkRules = this.networkEngine.matchAll(request);
        let sourceRules: NetworkRule[] = [];

        if (request.sourceUrl) {
            const sourceRequest = new Request(request.sourceUrl, '', RequestType.Document);
            sourceRules = this.networkEngine.matchAll(sourceRequest);
        }

        return new MatchingResult(networkRules, sourceRules);
    }

    /**
     * Matches the specified request against the filtering engine and returns the matching result.
     * Adds rule journal records
     *
     * @param tabId
     * @param request
     * @return matching result
     */
    matchRequestWithTabId(tabId: number, request: Request): MatchingResult {
        const result = this.matchRequest(request);

        // TODO: add other rules to journal
        if (result) {
            const rule = result.getBasicResult();
            if (rule) {
                this.journal.recordNetworkRuleEvent(tabId, request, rule.getText());
            }
        }

        return result;
    }

    /**
     * Gets cosmetic result for the specified hostname and cosmetic options
     *
     * @param hostname
     * @param option
     * @return matching result
     */
    getCosmeticResult(hostname: string, option: CosmeticOption): CosmeticResult {
        const includeCss = (option & CosmeticOption.CosmeticOptionCSS) === CosmeticOption.CosmeticOptionCSS;
        const includeGenericCss = (option
            & CosmeticOption.CosmeticOptionGenericCSS) === CosmeticOption.CosmeticOptionGenericCSS;
        const includeJs = (option & CosmeticOption.CosmeticOptionJS) === CosmeticOption.CosmeticOptionJS;

        return this.cosmeticEngine.match(hostname, includeCss, includeJs, includeGenericCss);
    }

    /**
     * Gets cosmetic result for the specified hostname and cosmetic options
     * Adds rule journal records
     *
     * @param tabId
     * @param hostname
     * @param option
     * @return matching result
     */
    getCosmeticResultWithTabId(tabId: number, hostname: string, option: CosmeticOption): CosmeticResult {
        const result = this.getCosmeticResult(hostname, option);

        if (result) {
            const rules = result.getRules();
            rules.forEach((r: CosmeticRule) => {
                this.journal.recordCosmeticRuleEvent(tabId, hostname, r.getText());
            });
        }

        return result;
    }

    /**
     * Returns rule journal object
     * Usage:
     * journal.on('rule', (event) => { .. });
     */
    getJournal(): Journal {
        return this.journal;
    }
}
