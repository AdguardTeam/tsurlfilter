import { Request } from '../request';
import { NetworkRule } from '../network-rule';
import { MatchingResult } from './matching-result';

/**
 * NetworkEngine is the engine that supports quick search over network rules
 */
export class NetworkEngine {
    /**
     * Count of rules added to the engine
     */
    private rulesCount: number;

    // ruleStorage *filterlist.RuleStorage // Storage for the network filtering rules

    // Domain lookup table. Key is the domain name hash.
    // domainsLookupTable map[uint32][]int64

    // shortcutsLookupTable map[uint32][]int64 // Shortcuts lookup table. Key is the shortcut hash.
    // shortcutsHistogram   map[uint32]int     // Shortcuts histogram helps us choose the best shortcut
    // for the shortcuts lookup table.

    /**
     * Rules for which we could not find a shortcut and could not place it to the shortcuts lookup table.
     */
    private otherRules: NetworkRule[];

    /**
     * Constructor
     *
     * @param rules
     */
    constructor(rules: string[]) {
        // engine := NetworkEngine{
        //     ruleStorage:          s,
        //         domainsLookupTable:   map[uint32][]int64{},
        //     shortcutsLookupTable: map[uint32][]int64{},
        //     shortcutsHistogram:   map[uint32]int{},
        // }
        //
        // scanner := s.NewRuleStorageScanner()
        //
        // for scanner.Scan() {
        //     f, idx := scanner.Rule()
        //     rule, ok := f.(*rules.NetworkRule)
        //     if ok {
        //         engine.addRule(rule, idx)
        //     }
        // }
        //
        // return &engine
    }

    /**
     * Match searches over all filtering rules loaded to the engine
     * It returns true if a match was found alongside the matching rule
     *
     * @param request
     */
    match(request: Request): NetworkRule {
        const networkRules = this.matchAll(request);

        if (networkRules.length === 0) {
            return null;
        }

        const result = new MatchingResult(networkRules, null);
        return result.GetBasicResult();
    }

    /**
     * Finds all rules matching the specified request regardless of the rule types
     * It will find both whitelist and blacklist rules
     *
     * @param request
     */
    matchAll(request: Request): NetworkRule[] {
        // First check by shortcuts
        const result = this.matchShortcutsLookupTable(request);
        result.push(...this.matchDomainsLookupTable(request));

        // Now check other rules
        this.otherRules.forEach(r => {
            if (r.match(request)) {
                result.push(r);
            }
        });

        return result;
    }

    /**
     * Finds all matching rules from the shortcuts lookup table
     *
     * @param request
     */
    private matchShortcutsLookupTable(request: Request): NetworkRule[] {
        // var result []*rules.NetworkRule
        // urlLen := len(r.URLLowerCase)
        // if urlLen > maxURLLength {
        //     urlLen = maxURLLength
        // }
        //
        // for i := 0; i <= urlLen-shortcutLength; i++ {
        //     hash := fastHashBetween(r.URLLowerCase, i, i+shortcutLength)
        //     if matchingRules, ok := n.shortcutsLookupTable[hash]; ok {
        //         for i := range matchingRules {
        //             ruleIdx := matchingRules[i]
        //             rule := n.ruleStorage.RetrieveNetworkRule(ruleIdx)
        //             if rule != nil && rule.Match(r) {
        //                 result = append(result, rule)
        //             }
        //         }
        //     }
        // }
        //
        // return result
    }

    /**
     * Finds all matching rules from the domains lookup table
     *
     * @param request
     */
    private matchDomainsLookupTable(request: Request): NetworkRule[] {
        // var result []*rules.NetworkRule
        //
        // if r.SourceHostname == "" {
        //     return result
        // }
        //
        // domains := getSubdomains(r.SourceHostname)
        // for _, domain := range domains {
        //     hash := fastHash(domain)
        //     if matchingRules, ok := n.domainsLookupTable[hash]; ok {
        //         for i := range matchingRules {
        //             ruleIdx := matchingRules[i]
        //             rule := n.ruleStorage.RetrieveNetworkRule(ruleIdx)
        //             if rule != nil && rule.Match(r) {
        //                 result = append(result, rule)
        //             }
        //         }
        //     }
        // }
        // return result
    }
}
