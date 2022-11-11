declare namespace chrome.scripting {
    export function executeScript<Args extends unknown[], Result>(
        // Extend ScriptInjection by { injectImmediately: boolean }
        injection: ScriptInjection<Args, Result> & { injectImmediately: boolean }
    ): Promise<InjectionResult<Awaited<Result>>[]>;
}
