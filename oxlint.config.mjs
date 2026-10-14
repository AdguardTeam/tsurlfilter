import { createRequire } from 'node:module';

import { createConfig } from '@agcodeguidelines/oxlint-config';
import { resolveRule } from '@agcodeguidelines/rule-catalog';

const require = createRequire(import.meta.url);

/**
 * Optionless syntax rules whose default diagnostics have verified parity.
 */
export const ownedRules = ['no-debugger', 'no-duplicate-case', 'no-sparse-arrays'];

/**
 * Builds a syntax-only configuration from the effective ESLint file settings.
 *
 * @param config The original effective ESLint configuration for a file group.
 * @returns An Oxlint configuration containing only verified, previously enabled rules.
 */
export function createSyntaxConfig(config = {}) {
    const preset = createConfig({
        language: 'typescript',
        environment: 'both',
        policy: 'compatibility',
        profile: 'adguard-projects',
        typeAware: false,
    });
    const targets = ownedRules.map((source) => {
        const resolved = resolveRule(source, { language: 'typescript', profile: 'adguard-projects' });
        if (resolved.status !== 'resolved' || resolved.requiresTypeInfo) {
            throw new Error(`Unverified syntax mapping: ${source}`);
        }
        return resolved.target;
    });
    const rules = Object.fromEntries(Object.keys(preset.rules).map((rule) => [rule, 'off']));
    ownedRules.forEach((source, index) => {
        const setting = config.rules?.[source] ?? 'off';
        const values = Array.isArray(setting) ? setting : [setting];
        const severity = values[0];
        if (severity === 0 || severity === 'off') {
            return;
        }
        if (values.length !== 1) {
            throw new Error(`Unverified options for ${source}; retain ESLint ownership`);
        }
        rules[targets[index]] = severity;
    });
    return {
        ...preset,
        jsPlugins: preset.jsPlugins.map((plugin) => ({
            ...plugin,
            specifier: require.resolve(plugin.specifier),
        })),
        rules,
        overrides: [],
    };
}

export default createSyntaxConfig();