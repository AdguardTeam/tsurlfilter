import { LocalScriptRules } from '@lib/mv2/background/services/local-script-rules-service';

export const getLocalScriptRulesFixture = (): LocalScriptRules => ({
    comment: 'Test list of pre-built JS rules',
    rules: [
        {
            domains: 'example.com',
            script: 'window.open = undefined;',
        },
    ],
});
