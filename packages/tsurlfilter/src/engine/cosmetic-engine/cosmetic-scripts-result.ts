import Scriptlets from '@adguard/scriptlets';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { ScriptletParser } from './scriptlet-parser';
import { config } from '../../configuration';
import { CosmeticContentResult } from './cosmetic-content-result';
import { ADG_SCRIPTLET_MASK } from '../../rules/cosmetic-rule-marker';
import { Request } from '../../request';

/**
 * This class stores found script rules content in the appropriate collections
 * It is primarily used by the {@see CosmeticResult}
 */
export class CosmeticScriptsResult implements CosmeticContentResult {
    /**
     * Collection of generic (domain insensitive) rules
     */
    public generic: CosmeticRule[];

    /**
     * Collection of domain specific rules
     */
    public specific: CosmeticRule[];

    /**
     * Constructor
     */
    constructor() {
        this.generic = [];
        this.specific = [];
    }

    /**
     * Appends rule to appropriate collection
     * @param rule
     * @param request
     */
    append(rule: CosmeticRule, request?: Request): void {
        CosmeticScriptsResult.setScriptCode(rule, request);

        if (rule.isGeneric()) {
            this.generic.push(rule);
        } else {
            this.specific.push(rule);
        }
    }

    /**
     * Returns rules collected
     */
    getRules(): CosmeticRule[] {
        return [...this.generic, ...this.specific];
    }

    /**
     * Updates rule.script with js ready to execute
     *
     * @param rule
     * @param request
     */
    private static setScriptCode(rule: CosmeticRule, request?: Request): void {
        let requestDomainName;
        if (request) {
            requestDomainName = request.domain;
        }

        if (rule.script && rule.scriptVerbose) {
            if (!rule.isScriptlet) {
                // Already done for this none-scriptlet rule
                return;
            }
            // do not reinvoke scriptVerbose for same domain for scriptlet rule
            if (rule.isScriptlet
                && requestDomainName
                && rule.verboseInvokedForDomain === requestDomainName) {
                return;
            }
        }

        const ruleContent = rule.getContent();
        if (!ruleContent.startsWith(ADG_SCRIPTLET_MASK)) {
            // eslint-disable-next-line no-param-reassign
            rule.script = ruleContent;
            // eslint-disable-next-line no-param-reassign
            rule.scriptVerbose = ruleContent;
            return;
        }

        const scriptletContent = ruleContent.substr(ADG_SCRIPTLET_MASK.length);
        const scriptletParams = ScriptletParser.parseRule(scriptletContent);

        const params: Scriptlets.IConfiguration = {
            args: scriptletParams.args,
            engine: config.engine ? config.engine : '',
            name: scriptletParams.name,
            ruleText: rule.getText(),
            verbose: false,
            version: config.version ? config.version : '',
        };

        let scriptText;

        if (!rule.script) {
            scriptText = Scriptlets.invoke(params);
            // eslint-disable-next-line no-param-reassign
            rule.script = scriptText !== null ? scriptText : undefined;
        }

        params.verbose = true;
        // add domainName to reduce log output in the rules with multiple domains
        if (requestDomainName) {
            params.domainName = requestDomainName;
            rule.verboseInvokedForDomain = requestDomainName;
        }

        scriptText = Scriptlets.invoke(params);
        // eslint-disable-next-line no-param-reassign
        rule.scriptVerbose = scriptText !== null ? scriptText : undefined;
    }
}
