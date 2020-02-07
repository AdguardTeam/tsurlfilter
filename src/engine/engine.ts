import { CosmeticEngine } from './cosmetic-engine/cosmetic-engine';
import { NetworkEngine } from './network-engine';
import { Request, RequestType } from '../request';
import { CosmeticOption, MatchingResult } from './matching-result';
import { NetworkRule } from '../network-rule';
import { RuleStorage } from '../filterlist/rule-storage';
import { CosmeticResult } from './cosmetic-engine/cosmetic-result';

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
     * Creates an instance of an Engine
     * Parses the filtering rules and creates a filtering engine of them
     *
     * @param ruleStorage storage
     *
     * @throws
     */
    constructor(ruleStorage: RuleStorage) {
        this.networkEngine = new NetworkEngine(ruleStorage);
        this.cosmeticEngine = new CosmeticEngine(ruleStorage);
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
     * Gets cosmetic result for the specified hostname and cosmetic options
     */
    getCosmeticResult(hostname: string, option: CosmeticOption): CosmeticResult {
        const includeCss = (option & CosmeticOption.CosmeticOptionCSS) === CosmeticOption.CosmeticOptionCSS;
        const includeGenericCss = (option
            & CosmeticOption.CosmeticOptionGenericCSS) === CosmeticOption.CosmeticOptionGenericCSS;
        const includeJs = (option & CosmeticOption.CosmeticOptionJS) === CosmeticOption.CosmeticOptionJS;

        return this.cosmeticEngine.match(hostname, includeCss, includeJs, includeGenericCss);
    }
}
