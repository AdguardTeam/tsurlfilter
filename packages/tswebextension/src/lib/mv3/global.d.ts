declare namespace chrome.scripting {
    export function executeScript<Args extends any[], Result>(
        // Extend ScriptInjection by { injectImmediately: boolean }
        injection: ScriptInjection<Args, Result> & { injectImmediately: boolean }
    ): Promise<InjectionResult<Awaited<Result>>[]>;
}
