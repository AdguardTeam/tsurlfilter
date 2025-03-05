declare namespace chrome.userScripts {
    export function execute(
        injection: chrome.userScripts.UserScriptInjection,
        callback?: function,
    );

    export interface UserScriptInjection {
        injectImmediately?: boolean;
        js: chrome.userScripts.ScriptSource[];
        target: chrome.userScripts.InjectionTarget;
        world?: chrome.userScripts.ExecutionWorld;
        worldId?: string;
    }

    export interface WorldProperties {
        csp?: string;
        messaging?: boolean;
        worldId?: string;
    }
}
