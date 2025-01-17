import { type LocalScriptRules } from '../../../../../src/lib/mv2/background/services/local-script-rules-service';

export const getLocalScriptRulesFixture = (): LocalScriptRules => ({
    comment: 'Test list of pre-built JS rules',
    rules: {
        'window.open = undefined;': [
            {
                permittedDomains: ['example.com'],
                restrictedDomains: [],
            },
        ],
    },
});
