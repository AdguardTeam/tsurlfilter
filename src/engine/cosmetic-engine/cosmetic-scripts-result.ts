import Scriptlets from 'scriptlets';
import { CosmeticRule } from '../../rules/cosmetic-rule';
import { ScriptletParser } from './scriptlet-parser';

/**
 * This class stores found script rules content in the appropriate collections
 * It is primarily used by the {@see CosmeticResult}
 */
export class CosmeticScriptsResult {
    /**
     * AdGuard scriptlet rule mask
     */
    private static ADG_SCRIPTLET_MASK = '//scriptlet';

    /**
     * Collection of generic (domain insensitive) rules
     */
    public generic: string[];

    /**
     * Collection of domain specific rules
     */
    public specific: string[];

    constructor() {
        this.generic = [] as string[];
        this.specific = [] as string[];
    }

    /**
     * Appends rule to appropriate collection
     * @param rule
     */
    append(rule: CosmeticRule): void {
        let ruleContent = rule.getContent();
        if (ruleContent.startsWith(CosmeticScriptsResult.ADG_SCRIPTLET_MASK)) {
            const scriptCode = CosmeticScriptsResult.getScriptCode(rule);
            ruleContent = scriptCode ? scriptCode! : '';
        }

        if (rule.isGeneric()) {
            this.generic.push(ruleContent);
        } else {
            this.specific.push(ruleContent);
        }
    }

    /**
     * Returns script ready to execute
     *
     * @param ruleContent
     */
    public static getScriptCode(rule: CosmeticRule): string | null {
        const scriptletContent = rule.getContent().substr(CosmeticScriptsResult.ADG_SCRIPTLET_MASK.length);
        const scriptletParams = ScriptletParser.parseRule(scriptletContent);

        // TODO: Add cache
        // rule.script = ..

        // TODO: Use proper params
        const params: Scriptlets.IConfiguration = {
            args: scriptletParams.args,
            engine: 'extension',
            name: scriptletParams.name,
            ruleText: rule.getText(),
            verbose: false,
            version: '1.0.0',
        };

        return Scriptlets.invoke(params);
    }
}
