import { strict as assert } from 'node:assert';

import { type CommandResult, type FixtureCommand } from './fixture-server';

/**
 * Browsers with the selected extension registration paths.
 */
export type CanvasTestBrowser = 'chromium' | 'firefox';

/**
 * Public runner suites; engine suites become available with the bundled engine.
 */
export type CanvasTestSuite = 'delivery' | 'engine' | 'lifecycle' | 'benchmark';

/**
 * The first page script reports the method reference it captured synchronously.
 */
export interface FirstReadResult {
    readonly kind: 'first-read';
    readonly id: string;
    readonly url: string;
    readonly origin: string;
    readonly referrer: string;
    readonly topAccessible: boolean;
    readonly pixel: readonly number[];
    readonly at?: number;
    readonly documentTimeOrigin?: number;
    readonly private: boolean | null;
    readonly engine?: {
        readonly outcome: string | null;
        readonly hash: string;
        readonly nativeHash: string;
        readonly pixels: readonly number[];
        readonly changed: number;
        readonly eligible: number;
        readonly fixtures: number;
        readonly reads: number;
        readonly failures: readonly string[];
        readonly observations: readonly unknown[];
    };
    readonly benchmark?: {
        readonly width: number;
        readonly height: number;
        readonly outcome: string | null;
        readonly samples: Readonly<Record<string, readonly number[]>>;
        readonly callbacks: number;
        readonly failures: readonly string[];
    };
    readonly beforeDetachPixel?: readonly number[];
    readonly delivery?: {
        readonly outcome: 'enabled' | 'disabled' | 'excluded' | 'unsupported';
        readonly mode: 'top-derived' | 'frame-local' | null;
        readonly key: string | null;
        readonly requestType: 'document' | 'subdocument';
        readonly unavailableConditions: readonly string[];
        readonly policyRevision?: string;
        readonly capturedGeneration?: string;
    } | null;
}

/**
 * Correlates a reported first read with the native document selected by the runner.
 *
 * @param observation Actual fixture report.
 * @param selected Native selected document identity.
 * @param selected.url Actual URL of the selected document.
 * @param selected.timeOrigin Native performance time origin of the selected document.
 */
export const assertSelectedDocument = (
    observation: FirstReadResult,
    selected: { readonly url: string; readonly timeOrigin: number },
): void => {
    const evidence = JSON.stringify({
        selected,
        observation: {
            id: observation.id,
            url: observation.url,
            at: observation.at,
            documentTimeOrigin: observation.documentTimeOrigin,
        },
    });
    assert.ok(Number.isFinite(selected.timeOrigin) && selected.timeOrigin > 0, evidence);
    assert.equal(observation.url, selected.url, evidence);
    assert.equal(observation.documentTimeOrigin, selected.timeOrigin, evidence);
};

/**
 * A named browser assertion and the concrete evidence or limitation it produced.
 */
export interface SuiteCase {
    readonly name: string;
    readonly status: 'passed' | 'failed' | 'unverified';
    readonly reason: string;
    readonly evidence?: unknown;
}

/**
 * Real process, executable, permission and delivery evidence.
 */
export interface SuiteReport {
    readonly browser: CanvasTestBrowser;
    readonly suite: CanvasTestSuite;
    readonly version: string;
    readonly executable: string;
    readonly protocol: 'HTTP';
    readonly profile: string;
    readonly launch: {
        readonly headless: true;
        readonly arguments: readonly string[];
    };
    readonly permission: unknown;
    readonly lifetime?: unknown;
    readonly hardware?: unknown;
    readonly process?: unknown;
    readonly artifacts?: readonly { readonly path: string; readonly sha256: string }[];
    readonly capabilities?: readonly unknown[];
    readonly processOutcome?: {
        readonly exitCode: number | null;
        readonly signal: string | null;
        readonly error?: string;
    };
    readonly cases: readonly SuiteCase[];
    readonly exitCode: number;
}

/**
 * Browser transport shared by the built consumer's observable suites.
 */
export interface BuiltSuiteContext {
    readonly browser: CanvasTestBrowser;
    readonly origin: string;
    readonly processId: number;
    readonly cases: SuiteCase[];
    readonly events: readonly CommandResult[];
    inspectRequests(): Promise<
        readonly { readonly url: string; readonly method: string; readonly type: string }[]
    >;
    command(input: FixtureCommand): Promise<CommandResult>;
    read(
        id: string,
        options?: {
            readonly route?: string;
            readonly host?: string;
            readonly corpus?: number;
            readonly reads?: number;
            readonly mode?: string;
        },
    ): Promise<FirstReadResult>;
    evaluate<T>(script: string): Promise<T>;
    openWindow(
        id: string,
        privateWindow: boolean,
    ): Promise<{ readonly command: CommandResult; readonly observation: FirstReadResult }>;
    stopWorker(): Promise<unknown>;
    restartBrowser(startUrl?: string): Promise<unknown>;
    setUserScriptAccess(enabled: boolean): Promise<unknown>;
    replaceExtension(version: string): Promise<unknown>;
    unloadBackground(): Promise<unknown>;
    reloadPage(): Promise<FirstReadResult>;
}

/**
 * Cases that cannot silently disappear when a prerequisite is unavailable.
 */
export const deliveryCaseNames = [
    'first inline script captures protected page methods',
    'keeps delivery after worker stop',
    'same-origin frame captures local protection',
    'cross-origin frame captures local protection',
    'sandboxed HTTP frame captures local protection',
    'about:blank records unsupported host',
    'srcdoc records unsupported host',
    'data records unsupported host',
    'blob records unsupported host',
    'restricted URL records absent injection',
    'no-referrer frame captures local protection',
    'detached frame retains its captured methods',
    'missing host permission records absent injection',
    'unmatched selector records absent injection',
    'normal and private windows receive protection',
    'records stale reactivation and enforces acknowledged disablement',
    'records stale reactivation and enforces acknowledged exclusion',
    'Chromium version update records registration loss and acknowledged reinstall',
    'Chromium unchanged-version reload records registration loss and acknowledged reinstall',
    'Firefox cold startup restores early delivery',
    'Firefox new startup page receives early delivery',
    'Firefox reload restores early delivery',
    'Firefox update restores early delivery',
    'proves Firefox registering-page lifetime',
] as const;

/**
 * Selects mandatory cases for the browser's actual registration architecture.
 *
 * @param browser Selected registration path.
 *
 * @returns Applicable cases without substituting passes for other architectures.
 */
export const getDeliveryCaseNames = (browser: CanvasTestBrowser): readonly string[] => {
    return deliveryCaseNames.filter((name) => (browser === 'chromium'
        ? !name.startsWith('Firefox') && name !== 'proves Firefox registering-page lifetime'
        : name !== 'keeps delivery after worker stop'
              && !name.startsWith('records stale reactivation')
              && !name.startsWith('Chromium ')));
};

/**
 * Asserts observable MAIN-world delivery from the page's first captured method.
 *
 * @param result The fixture's first synchronous read.
 * @param protectedRead Whether this document must receive the delivery probe.
 *
 * @throws When first page code captured an unexpected readout.
 */
export const assertFirstRead = (result: FirstReadResult, protectedRead: boolean): void => {
    assert.deepEqual(result.pixel, [protectedRead ? 17 : 16, 32, 48, 255]);
};
