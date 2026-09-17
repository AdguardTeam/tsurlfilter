import { CosmeticOption, type CosmeticRule, RequestType } from '@adguard/tsurlfilter';

import { DocumentApi } from '../document-api';
import { engineApi } from '../engine-api';

/**
 * Queries the engine for JS/scriptlet rules applicable to `hostname`,
 * ignoring the `$path` modifier so path-qualified rules aren't missed.
 *
 * Only rules from local (built-in) filters are returned. Custom filter
 * and user rules were never scanned at build time, so no matching
 * `{hash}.js` exists for them — they stay on the dynamic
 * (non-preregistered) injection path in `CosmeticApi`.
 *
 * `$url`-scoped rules are excluded even when their hash is present in the
 * manifest: the engine is queried per-hostname root, so a rule whose URL
 * pattern matches the root URL would end up in a `*://hostname/*`
 * registration whose generated file carries no URL guard. They stay on the
 * dynamic injection path, matching the build-time collector.
 *
 * @param hostname Hostname string.
 *
 * @returns Applicable local script rules.
 */
export const getHostnameScriptRules = (hostname: string): CosmeticRule[] => {
    const url = `https://${hostname}/`;

    const frameRule = DocumentApi.matchFrame(url);

    const cosmeticResult = engineApi.matchCosmetic(
        {
            requestUrl: url,
            frameUrl: url,
            requestType: RequestType.Document,
            frameRule,
        },
        {
            ignorePath: true,
            optionMask: CosmeticOption.CosmeticOptionJS,
        },
    );

    const allRules = cosmeticResult.getScriptRules();
    return allRules.filter(
        (rule) => engineApi.isLocalFilter(rule.getFilterListId()) && !rule.urlModifier,
    );
};
