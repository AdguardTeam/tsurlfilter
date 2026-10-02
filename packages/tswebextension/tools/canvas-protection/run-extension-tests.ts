/* eslint-disable no-console -- The CLI emits browser observations and its structured report. */
/* eslint-disable no-await-in-loop -- Actual UI changes and browser registration commands must remain ordered. */
import { strict as assert } from 'node:assert';
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { type BrowserContext, chromium, type Page } from 'playwright';

import { runBenchmarkSuite } from './benchmark.suite';
import { buildCanvasTestExtension, createDeliveryCode } from './build-extension';
import {
    assertFirstRead,
    assertSelectedDocument,
    type BuiltSuiteContext,
    type CanvasTestBrowser,
    type CanvasTestSuite,
    deliveryCaseNames,
    getDeliveryCaseNames,
    type SuiteCase,
    type SuiteReport,
} from './delivery.suite';
import { engineCaseNames, runEngineSuite } from './engine.suite';
import {
    type FirefoxLifetimeReport,
    type FirefoxProcess,
    launchFirefox,
    readAddon,
    runFirefoxLifetimeProbe,
} from './firefox-lifetime-probe';
import {
    type CommandResult,
    type FixtureCommand,
    type FixtureServer,
    startFixtureServer,
} from './fixture-server';
import { lifecycleCaseNames, runLifecycleSuite } from './lifecycle.suite';

/**
 * Dismisses only Firefox's first-run Spotlight overlay in the owned test profile.
 * Native tab selection refuses to switch while this modal is open.
 *
 * @param active Owned headless Firefox connection.
 *
 * @returns Actual modal identity and native dismissal clocks.
 */
const dismissFirefoxOnboarding = async (active: FirefoxProcess): Promise<unknown> => {
    const result = await active.chromeScript(`
        const done = arguments[arguments.length - 1];
        const win = Services.wm.getMostRecentWindow('navigator:browser');
        const before = {at: Date.now(), modal: win.document.documentElement.hasAttribute('window-modal-open'),
            uri: win.gDialogBox.dialog?._openedURL ?? null};
        if (!before.modal) return done({before, after: before, aborted: false});
        if (before.uri !== 'chrome://browser/content/spotlight.html') {
            return done({before, error: 'Unexpected native modal'});
        }
        win.gDialogBox.dialog.abort();
        const deadline = Date.now() + 5000;
        const observe = () => {
            const after = {at: Date.now(), modal: win.document.documentElement.hasAttribute('window-modal-open')};
            if (!after.modal || Date.now() >= deadline) return done({before, after, aborted: true});
            setTimeout(observe, 10);
        };
        observe();`);
    const observation = result as { error?: string; after: { modal: boolean } };
    assert.equal(observation.error, undefined, JSON.stringify(result));
    assert.equal(observation.after.modal, false, JSON.stringify(result));
    return result;
};

/**
 * Selects the actual new Firefox tab from native inventories.
 * Some browser/driver pairs report the prior handle in the creation response.
 *
 * @param active Owned headless Firefox connection.
 *
 * @returns Actual added handle alongside both native inventories and the unmodified response.
 */
const createFirefoxTab = async (active: FirefoxProcess): Promise<{
    handle: string;
    response: unknown;
    before: readonly string[];
    after: readonly string[];
    onboarding: unknown;
}> => {
    const onboarding = await dismissFirefoxOnboarding(active);
    const before = await active.command('GET', '/window/handles') as string[];
    const response = await active.command('POST', '/window/new', { type: 'tab' });
    const after = await active.command('GET', '/window/handles') as string[];
    const added = after.filter((handle) => !before.includes(handle));
    assert.equal(added.length, 1, JSON.stringify({ before, response, after }));
    return {
        handle: added[0], response, before, after, onboarding,
    };
};

/**
 * Reads native output from a restricted browser page after navigation.
 *
 * @returns Capability evidence; this observation does not claim first-inline timing.
 */
const readRestrictedPage = (): unknown => {
    const page = (window as typeof window & { wrappedJSObject?: typeof window }).wrappedJSObject ?? window;
    const canvas = page.document.createElement('canvas');
    canvas.width = 2;
    canvas.height = 2;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgb(16,32,48)';
    context.fillRect(0, 0, 2, 2);
    const pixel = Array.from(
        page.CanvasRenderingContext2D.prototype.getImageData.call(context, 0, 0, 1, 1).data,
    );
    return {
        url: page.location.href,
        pixel,
        delivery:
            (page as typeof window & { canvasFixtureDelivery?: unknown }).canvasFixtureDelivery
            ?? null,
    };
};

/**
 * Reserves an ephemeral loopback port for a Firefox automation transport.
 *
 * @returns A port released before Firefox starts listening.
 */
const allocatePort = async (): Promise<number> => {
    const listener = createServer();
    await new Promise<void>((resolve, reject) => {
        listener.once('error', reject);
        listener.listen(0, '127.0.0.1', resolve);
    });
    const address = listener.address();
    assert.ok(address && typeof address !== 'string');
    await new Promise<void>((resolve) => {
        listener.close(() => resolve());
    });
    return address.port;
};

/**
 * Native controls attach to a browser launched by the existing web-ext runner.
 */
interface FirefoxController {
    readonly capabilities: { readonly 'moz:headless': boolean; readonly browserVersion: string };
    command(method: string, route: string, body?: unknown): Promise<unknown>;
    close(): Promise<void>;
}

/**
 * Connects to the already-running web-ext browser without replacing its launch.
 *
 * @param marionettePort Actual Firefox transport port.
 * @param waitForLoad Whether navigation waits for the native load event.
 *
 * @returns Native browser UI commands, capabilities and cleanup.
 */
const connectFirefox = async (
    marionettePort: number,
    waitForLoad = true,
): Promise<FirefoxController> => {
    const driver = spawn(
        'geckodriver',
        [
            '--connect-existing',
            '--marionette-port',
            String(marionettePort),
            '--allow-system-access',
            '--port',
            '0',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] },
    );
    const finished = new Promise<void>((resolve) => {
        driver.once('exit', () => resolve());
        driver.once('error', () => resolve());
    });
    try {
        const origin = await new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Geckodriver did not start')), 15000);
            driver.once('error', reject);
            driver.stdout.on('data', (data: Buffer) => {
                const port = /Listening on 127\.0\.0\.1:(\d+)/.exec(data.toString())?.[1];
                if (port) {
                    clearTimeout(timeout);
                    resolve(`http://127.0.0.1:${port}`);
                }
            });
        });
        /**
         * Calls the actual local WebDriver endpoint.
         *
         * @param method HTTP method.
         * @param route Native command endpoint.
         * @param body Command parameters.
         *
         * @returns The browser's command result.
         */
        const request = async (method: string, route: string, body?: unknown): Promise<unknown> => {
            const response = await fetch(`${origin}${route}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                signal: AbortSignal.timeout(route.endsWith('/execute/sync') ? 900000 : 30000),
            });
            const result = (await response.json()) as { value: unknown };
            if (!response.ok) {
                throw new Error(`WebDriver ${route}: ${JSON.stringify(result.value)}`);
            }
            return result.value;
        };
        const session = (await request('POST', '/session', {
            capabilities: {
                alwaysMatch: {
                    browserName: 'firefox',
                    pageLoadStrategy: waitForLoad ? 'normal' : 'none',
                },
            },
        })) as {
            sessionId: string;
            capabilities: { 'moz:headless': boolean; browserVersion: string };
        };
        assert.equal(session.capabilities['moz:headless'], true);
        return {
            capabilities: session.capabilities,
            command: (method: string, route: string, body?: unknown): Promise<unknown> => {
                return request(method, `/session/${session.sessionId}${route}`, body);
            },
            close: async (): Promise<void> => {
                driver.kill('SIGTERM');
                await finished;
            },
        };
    } catch (error) {
        driver.kill('SIGTERM');
        await finished;
        throw error;
    }
};

/**
 * Reads only the owned extension's persisted native installation provenance.
 *
 * @param profile Dedicated Chromium profile.
 * @param extensionId Actual fixture extension identifier.
 *
 * @returns Location, path and native stored worker version.
 */
const readChromiumInstallation = async (
    profile: string,
    extensionId: string,
): Promise<{
    readonly path: string;
    readonly location: number;
    readonly version: string;
}> => {
    const preferences = JSON.parse(
        await readFile(path.join(profile, 'Default/Secure Preferences'), 'utf8'),
    ) as {
        extensions: {
            settings: Record<
                string,
                {
                    path: string;
                    location: number;
                    service_worker_registration_info: { version: string };
                }
            >;
        };
    };
    const entry = preferences.extensions.settings[extensionId];
    return {
        path: entry.path,
        location: entry.location,
        version: entry.service_worker_registration_info.version,
    };
};

/**
 * Reads through the page method captured by its first synchronous script.
 *
 * @returns The current readout from that captured method.
 */
const readCapturedFixture = (): readonly number[] => {
    const fixtureWindow = window as typeof window & { canvasFixtureRead: () => readonly number[] };
    return fixtureWindow.canvasFixtureRead();
};

/**
 * Runs the loaded extension suite, retaining all mandatory missing evidence.
 *
 * @param browser Actual browser path.
 * @param suite Selected test suite.
 *
 * @returns A report with a nonzero outcome for failures or missing mandatory cases.
 */
export const runCanvasExtensionSuite = async (
    browser: CanvasTestBrowser,
    suite: CanvasTestSuite,
): Promise<SuiteReport> => {
    const reportPath = fileURLToPath(
        new URL(`../../output-canvas-protection/${browser}-${suite}/report.json`, import.meta.url),
    );
    let extension = path.resolve(path.dirname(reportPath), 'extension');
    let server: FixtureServer | undefined;
    const profile = path.resolve(
        extension,
        suite === 'delivery' ? '../profile' : `../run-${Date.now()}/profile`,
    );
    const cases = new Map<string, SuiteCase>();
    let version = 'unverified';
    let executable = '';
    let permission: unknown;
    let firefoxBuildId: string | undefined;
    let lifetime: unknown;
    let artifacts: SuiteReport['artifacts'];
    let headlessArguments: readonly string[] = [];
    let processOutcome: SuiteReport['processOutcome'];
    let cleanup: (() => Promise<void>) | undefined;
    let chromiumContext: BrowserContext | undefined;
    let chromiumSettings: Page | undefined;
    let firefoxControl: Awaited<ReturnType<typeof connectFirefox>> | undefined;
    let permanentFirefox: FirefoxProcess | undefined;
    try {
        server = await startFixtureServer();
        const localDomains = Array.from({ length: 100 }, (_, index) => `site-${index}.localhost`).join(',');
        const fixtureServer = server;
        extension = await buildCanvasTestExtension(
            browser,
            suite === 'delivery' ? 'delivery' : 'engine',
            fixtureServer.collector,
            { suite },
        );
        if (suite !== 'delivery') {
            artifacts = JSON.parse(
                await readFile(path.join(extension, 'build-artifacts.json'), 'utf8'),
            ) as SuiteReport['artifacts'];
        }
        await mkdir(profile, { recursive: true });
        let command: (input: FixtureCommand) => Promise<CommandResult>;
        if (browser === 'chromium') {
            executable = chromium.executablePath();
            const context = await chromium.launchPersistentContext(profile, {
                channel: 'chromium',
                headless: true,
                args: [
                    '--enable-automation',
                    `--disable-extensions-except=${extension}`,
                    `--load-extension=${extension}`,
                    '--no-first-run',
                    '--host-resolver-rules=MAP *.localhost 127.0.0.1',
                ],
            });
            cleanup = (): Promise<void> => context.close();
            chromiumContext = context;
            version = context.browser()?.version() ?? 'unverified';
            const browserSession = await context.browser()!.newBrowserCDPSession();
            const actualCommand = await browserSession.send('Browser.getBrowserCommandLine');
            headlessArguments = actualCommand.arguments.filter((argument) => argument.startsWith('--headless'));
            assert.ok(
                headlessArguments.length > 0,
                'Actual Chromium command must include its headless flag',
            );
            await browserSession.detach();
            const settings = await context.newPage();
            chromiumSettings = settings;
            await settings.goto('chrome://extensions/');
            const extensionItem = settings
                .locator('extensions-item')
                .filter({ hasText: 'Canvas delivery test' });
            const extensionId = await extensionItem.getAttribute('id');
            const developerMode = settings.locator('extensions-toolbar #devMode');
            if ((await developerMode.getAttribute('aria-pressed')) === 'false') {
                await developerMode.click();
            }
            type OwnedWorkerVersion = {
                versionId: string; scriptURL: string; runningStatus: string; status: string; targetId?: string;
            };
            const serviceWorkerVersions: unknown[] = [];
            const latestWorkerVersions = new Map<string, OwnedWorkerVersion>();
            if (suite !== 'delivery') {
                const lifecycleSession = await context.newCDPSession(settings);
                lifecycleSession.on('ServiceWorker.workerVersionUpdated', ({ versions }) => {
                    versions.filter((entry) => entry.scriptURL === `chrome-extension://${extensionId}/background.js`)
                        .forEach((entry) => latestWorkerVersions.set(entry.versionId, entry));
                    serviceWorkerVersions.push({
                        observedAt: Date.now(),
                        versions: versions.filter((entry) => entry.scriptURL === `chrome-extension://${extensionId}/background.js`),
                    });
                });
                await lifecycleSession.send('ServiceWorker.enable');
            }
            // A fixture reload starts its worker and loads the current test build.
            if (suite === 'delivery') {
                const workerStarted = context.waitForEvent('serviceworker', { timeout: 15000 });
                await extensionItem.locator('#dev-reload-button').click();
                await workerStarted;
            } else {
                const session = await context.browser()!.newBrowserCDPSession();
                const before = (await session.send('Target.getTargets')).targetInfos.filter(
                    (target) => target.url === `chrome-extension://${extensionId}/background.js`,
                );
                await extensionItem.locator('#dev-reload-button').click();
                const deadline = Date.now() + 15000;
                let after = (await session.send('Target.getTargets')).targetInfos;
                while (
                    !after.some(
                        (target) => target.type === 'service_worker'
                            && target.url === `chrome-extension://${extensionId}/background.js`
                            && !before.some((previous) => previous.targetId === target.targetId),
                    )
                    && Date.now() < deadline
                ) {
                    after = (await session.send('Target.getTargets')).targetInfos;
                }
                assert.ok(
                    after.some(
                        (target) => target.type === 'service_worker'
                            && target.url === `chrome-extension://${extensionId}/background.js`
                            && !before.some((previous) => previous.targetId === target.targetId),
                    ),
                    JSON.stringify({ before, after }),
                );
                await session.detach();
            }
            await settings.goto(`chrome://extensions/?id=${extensionId}`);
            for (const selector of ['#allow-user-scripts', '#allow-incognito']) {
                const toggle = settings.locator(`extensions-detail-view ${selector} cr-toggle`);
                console.error(
                    'Dedicated-profile UI setting',
                    selector,
                    await toggle.getAttribute('aria-pressed'),
                );
                if ((await toggle.getAttribute('aria-pressed')) === 'false') {
                    await toggle.click();
                }
            }
            if (suite !== 'delivery') {
                const setupSession = await context.browser()!.newBrowserCDPSession();
                const setupStartedAt = Date.now();
                const setupDeadline = setupStartedAt + 15000;
                let setupTargets = (await setupSession.send('Target.getTargets')).targetInfos;
                let activeVersions: OwnedWorkerVersion[];
                do {
                    setupTargets = (await setupSession.send('Target.getTargets')).targetInfos;
                    const observedTargets = setupTargets;
                    activeVersions = [...latestWorkerVersions.values()].filter((entry) => entry.status === 'activated'
                        && entry.runningStatus === 'running'
                        && observedTargets.some((target) => target.targetId === entry.targetId
                            && target.type === 'service_worker' && target.url === entry.scriptURL));
                } while (activeVersions.length === 0 && Date.now() < setupDeadline);
                assert.equal(activeVersions.length, 1, JSON.stringify({ setupTargets, activeVersions }));
                const activeVersion = activeVersions[0];
                const retiredVersions = [...latestWorkerVersions.values()].filter(
                    (entry) => entry.status === 'redundant'
                        && entry.targetId !== activeVersion.targetId
                        && setupTargets.some((target) => target.targetId === entry.targetId
                            && target.type === 'service_worker' && target.url === entry.scriptURL),
                );
                const closed = [];
                for (const retired of retiredVersions) {
                    const requestedAt = Date.now();
                    const outcome = await setupSession.send('Target.closeTarget', { targetId: retired.targetId! });
                    assert.equal(outcome.success, true);
                    closed.push({ retired, requestedAt, outcome });
                }
                const retirementDeadline = Date.now() + 5000;
                let afterRetirement = (await setupSession.send('Target.getTargets')).targetInfos;
                const retiredTargetIds = new Set(retiredVersions.map((retired) => retired.targetId));
                while (afterRetirement.some((target) => retiredTargetIds.has(target.targetId))
                    && Date.now() < retirementDeadline) {
                    afterRetirement = (await setupSession.send('Target.getTargets')).targetInfos;
                }
                assert.ok(afterRetirement.every((target) => !retiredTargetIds.has(target.targetId)));
                assert.ok(afterRetirement.some((target) => target.targetId === activeVersion.targetId));
                assert.equal(latestWorkerVersions.get(activeVersion.versionId)!.status, 'activated');
                assert.equal(latestWorkerVersions.get(activeVersion.versionId)!.runningStatus, 'running');
                await setupSession.detach();
                const retirement = {
                    setupStartedAt,
                    setupTargets,
                    activeVersion,
                    retiredVersions,
                    closed,
                    afterRetirement,
                    verifiedAt: Date.now(),
                };
                const workerContexts = [];
                /**
                 * Reads the owned worker's fixture and native background identities.
                 *
                 * @returns Actual local context state without registered code or seed material.
                 */
                const inspectWorker = async (): Promise<{
                    diagnostic: CommandResult; nativeContexts: chrome.runtime.ExtensionContext[];
                }> => {
                    const fixture = globalThis as typeof globalThis & {
                        executeFixtureCommand(input: FixtureCommand): Promise<CommandResult>;
                    };
                    return {
                        diagnostic: await fixture.executeFixtureCommand({
                            id: 'owned-setup-worker-diagnostics', operation: 'consumer-diagnostics',
                        }),
                        nativeContexts: await chrome.runtime.getContexts({
                            contextTypes: [chrome.runtime.ContextType.BACKGROUND],
                        }),
                    };
                };
                const ownedWorkers = context.serviceWorkers().filter(
                    (value) => value.url() === `chrome-extension://${extensionId}/background.js`,
                );
                for (const worker of ownedWorkers) {
                    try {
                        const diagnostic = await worker.evaluate(inspectWorker);
                        workerContexts.push({ url: worker.url(), observedAt: Date.now(), diagnostic });
                    } catch (error) {
                        workerContexts.push({
                            url: worker.url(), observedAt: Date.now(), error: String(error),
                        });
                    }
                }
                const session = await context.browser()!.newBrowserCDPSession();
                const targets = (await session.send('Target.getTargets')).targetInfos.filter(
                    (target) => target.type === 'service_worker'
                        && target.url === `chrome-extension://${extensionId}/background.js`,
                );
                await session.detach();
                cases.set('owned Chromium setup worker identities', {
                    name: 'owned Chromium setup worker identities',
                    status: 'passed',
                    reason: 'Owned worker/target inventories after permission setup; no inferred pairing',
                    evidence: {
                        workers: workerContexts, targets, serviceWorkerVersions, retirement, observedAt: Date.now(),
                    },
                });
            }
            const control = await context.newPage();
            await control.goto(`chrome-extension://${extensionId}/control.html`);
            command = (input): Promise<CommandResult> => {
                return control.evaluate((value) => chrome.runtime.sendMessage(value), input);
            };
        } else {
            executable = process.env.CANVAS_FIREFOX_BINARY
                ?? path.resolve(
                    extension,
                    '../../firefox-lifetime/Firefox Nightly.app/Contents/MacOS/firefox',
                );
            if (suite === 'lifecycle') {
                permanentFirefox = await launchFirefox(profile, undefined, { executable });
                firefoxControl = permanentFirefox as typeof firefoxControl;
                const archive = path.resolve(extension, '../built-consumer.xpi');
                execFileSync('/usr/bin/zip', ['-q', '-r', archive, '.'], { cwd: extension });
                const installed = await permanentFirefox.command('POST', '/moz/addon/install', {
                    path: archive,
                    temporary: false,
                });
                assert.equal(installed, 'canvas-delivery@tests.invalid');
                assert.equal(
                    (await readAddon(permanentFirefox, 'canvas-delivery@tests.invalid'))
                        .temporarilyInstalled,
                    false,
                );
                cleanup = async (): Promise<void> => {
                    await permanentFirefox!.close();
                };
                command = (input): Promise<CommandResult> => fixtureServer.enqueue(input);
                headlessArguments = permanentFirefox.launch.arguments;
            } else {
                const marionettePort = await allocatePort();
                headlessArguments = ['-headless', '-marionette', '-remote-allow-system-access'];
                const launcher = spawn(
                    'npx',
                    [
                        '--yes',
                        'pnpm@10.33.4',
                        '--filter',
                        'tswebextension-mv2',
                        'exec',
                        'web-ext',
                        'run',
                        '--source-dir',
                        extension,
                        '--firefox',
                        executable,
                        '--firefox-profile',
                        profile,
                        '--keep-profile-changes',
                        '--no-reload',
                        '--no-input',
                        '--no-config-discovery',
                        '--pref',
                        `marionette.port=${marionettePort}`,
                        '--pref',
                        'app.update.disabledForTesting=true',
                        '--pref',
                        `network.dns.localDomains=${localDomains}`,
                        ...headlessArguments.map((argument) => `--args=${argument}`),
                    ],
                    {
                        cwd: path.resolve(extension, '../../../..'),
                        stdio: ['ignore', 'pipe', 'pipe'],
                        env: {
                            ...process.env,
                            MOZ_HEADLESS: '1',
                            MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1',
                        },
                    },
                );
                // Capture completion before a launch error or early exit can occur.
                const launcherFinished = new Promise<void>((resolve) => {
                    launcher.once('error', (error) => {
                        processOutcome = { exitCode: null, signal: null, error: String(error) };
                        resolve();
                    });
                    launcher.once('exit', (exitCode, signal) => {
                        processOutcome = { ...processOutcome, exitCode, signal };
                        resolve();
                    });
                });
                launcher.stdout.on('data', (data: Buffer) => console.error(data.toString().trimEnd()));
                launcher.stderr.on('data', (data: Buffer) => console.error(data.toString().trimEnd()));
                cleanup = async (): Promise<void> => {
                    try {
                        await firefoxControl?.close();
                    } finally {
                        if (launcher.exitCode === null && launcher.signalCode === null) {
                            launcher.kill('SIGTERM');
                        }
                        await launcherFinished;
                    }
                };
                firefoxControl = await connectFirefox(marionettePort, suite !== 'benchmark');
                command = (input): Promise<CommandResult> => fixtureServer.enqueue(input);
            }
        }
        let availability = await command({ id: 'availability', operation: 'availability' });
        let privateSetup: unknown;
        const onboarding = permanentFirefox ? await dismissFirefoxOnboarding(permanentFirefox) : undefined;
        if (browser === 'firefox') {
            const before = availability;
            await firefoxControl!.command('POST', '/url', { url: 'about:addons' });
            if (suite === 'benchmark') {
                const readyDeadline = Date.now() + 15000;
                let readiness: { url: string; readyState: string; initialized: string };
                do {
                    readiness = (await firefoxControl!.command('POST', '/execute/sync', {
                        script: `return {url: location.href, readyState: document.readyState,
                            initialized: typeof window.wrappedJSObject.promiseInitialized};`,
                        args: [],
                    })) as typeof readiness;
                } while (
                    (readiness.url !== 'about:addons'
                        || readiness.readyState !== 'complete'
                        || readiness.initialized !== 'object')
                    && Date.now() < readyDeadline
                );
                assert.equal(readiness.initialized, 'object', JSON.stringify(readiness));
            }
            const opened = await firefoxControl!.command('POST', '/execute/async', {
                script: `const page = window.wrappedJSObject; const done = arguments[arguments.length - 1];
                    page.promiseInitialized.then(() => page.loadView('detail/' + arguments[0]))
                        .then(() => done({url: location.href, view: page.gViewController.currentViewId}));`,
                args: ['canvas-delivery@tests.invalid'],
            });
            const cardSelector = 'addon-card[addon-id="canvas-delivery@tests.invalid"]';
            const find = async (selector: string): Promise<string> => {
                const element = (await firefoxControl!.command('POST', '/element', {
                    using: 'css selector',
                    value: selector,
                })) as Record<string, string>;
                return element['element-6066-11e4-a52e-4f735466cecf'];
            };
            await firefoxControl!.command('POST', '/timeouts', { implicit: 10000 });
            const allow = await find(`${cardSelector} input[name="private-browsing"][value="1"]`);
            const allowedBefore = await firefoxControl!.command(
                'GET',
                `/element/${allow}/property/checked`,
            );
            const controlBefore = await firefoxControl!.command('POST', '/execute/sync', {
                script: `const input = document.querySelector(arguments[0]);
                    window.wrappedJSObject.canvasPrivateControlEvents = [];
                    document.addEventListener('change', event => {
                        if (event.target.name === 'private-browsing') {
                            window.wrappedJSObject.canvasPrivateControlEvents.push({
                                at: Date.now(), trusted: event.isTrusted, value: event.target.value,
                                checked: event.target.checked});
                        }
                    }, true);
                    return {checked: input.checked, disabled: input.disabled,
                        labels: [...input.labels].map(value => value.textContent.trim()),
                        rectangle: input.getBoundingClientRect().toJSON()};`,
                args: [`${cardSelector} input[name="private-browsing"][value="1"]`],
            });
            assert.equal(
                allowedBefore,
                (availability.value as { privateAllowed: boolean }).privateAllowed,
            );
            if (!allowedBefore) {
                await firefoxControl!.command('POST', `/element/${allow}/value`, { text: ' ', value: [' '] });
            }
            const deadline = Date.now() + 10000;
            do {
                availability = await command({
                    id: `private-readback-${Date.now()}`,
                    operation: 'availability',
                });
            } while (
                !(availability.value as { privateAllowed: boolean }).privateAllowed
                && Date.now() < deadline
            );
            const checkedAfter = await firefoxControl!.command(
                'GET',
                `/element/${allow}/property/checked`,
            );
            const addonAfter = permanentFirefox
                ? await readAddon(permanentFirefox, 'canvas-delivery@tests.invalid')
                : undefined;
            const controlEvents = await firefoxControl!.command('POST', '/execute/sync', {
                script: 'return window.wrappedJSObject.canvasPrivateControlEvents;', args: [],
            });
            permission = {
                controlBefore,
                controlEvents,
                before,
                opened,
                allowedBefore,
                checkedAfter,
                addonAfter,
                after: availability,
            };
            const { privateAllowed } = availability.value as { privateAllowed: boolean };
            if (!privateAllowed && suite === 'lifecycle') {
                cases.set('actual Firefox permanent private permission setup', {
                    name: 'actual Firefox permanent private permission setup',
                    status: 'failed',
                    reason: 'Native about:addons selection and extension API readback did not grant private access',
                    evidence: permission,
                });
            } else {
                assert.equal(privateAllowed, true, JSON.stringify(permission));
            }
            privateSetup = {
                nativeControl: permission,
                onboarding,
                before,
                opened,
                selector: `${cardSelector} input[name="private-browsing"][value="1"]`,
                after: availability,
                allowedBefore,
                permissionSource: allowedBefore
                    ? 'Actual about:addons Allow selection and API readback'
                    : 'Actual about:addons Allow radio keyboard activation and API readback',
            };
        }
        permission = { ...availability, privateSetup, capabilities: firefoxControl?.capabilities };
        if (browser === 'firefox' && availability.value) {
            const value = availability.value as {
                browserInfo: { version: string; buildID: string };
            };
            version = value.browserInfo.version;
            firefoxBuildId = value.browserInfo.buildID;
        }
        if (suite !== 'delivery') {
            const engineCases: SuiteCase[] = [];
            const observedRequests: { url: string; method: string; type: string }[] = [];
            chromiumContext?.on('request', (request) => {
                observedRequests.push({
                    url: request.url(),
                    method: request.method(),
                    type: request.resourceType(),
                });
            });
            let enginePage: Page | undefined;
            let lastReadUrl = '';
            let lastReadId = '';
            let replacementSequence = 0;
            const processSession = browser === 'chromium'
                ? await chromiumContext!.browser()!.newBrowserCDPSession()
                : undefined;
            const processId = processSession
                ? Number(
                    (await processSession.send('SystemInfo.getProcessInfo')).processInfo.find(
                        (entry) => entry.type === 'browser',
                    )!.id,
                )
                : Number(
                    (firefoxControl!.capabilities as unknown as { 'moz:processID': number })[
                        'moz:processID'
                    ],
                );
            await processSession?.detach();
            const readBuilt: BuiltSuiteContext['read'] = async (id, options = {}) => {
                const target = new URL(options.route ?? '/engine', fixtureServer.origin);
                if (options.host) {
                    target.hostname = options.host;
                }
                target.searchParams.set('id', id);
                target.searchParams.set('corpus', String(options.corpus ?? 1));
                target.searchParams.set('reads', String(options.reads ?? 2));
                lastReadUrl = target.href;
                lastReadId = id;
                const navigationRequestedAt = Date.now();
                if (browser === 'chromium') {
                    await enginePage?.close();
                    enginePage = await chromiumContext!.newPage();
                    await enginePage.goto(target.href, { waitUntil: 'commit' });
                } else {
                    await firefoxControl!.command('POST', '/url', { url: target.href });
                }
                const observation = await fixtureServer.waitForRead(id);
                let selectedDocument: { url: string; timeOrigin: number };
                if (browser === 'chromium') {
                    const inspectedFrame = options.route === '/engine-frame'
                        ? enginePage!.frames().find((frame) => frame.parentFrame() === enginePage!.mainFrame())!
                        : enginePage!.mainFrame();
                    selectedDocument = await inspectedFrame.evaluate(() => ({
                        url: window.location.href, timeOrigin: window.performance.timeOrigin,
                    }));
                } else {
                    if (options.route === '/engine-frame') {
                        const frame = await firefoxControl!.command('POST', '/element', {
                            using: 'css selector', value: 'iframe',
                        });
                        await firefoxControl!.command('POST', '/frame', { id: frame });
                    }
                    try {
                        selectedDocument = await firefoxControl!.command('POST', '/execute/sync', {
                            script: 'return {url: location.href, timeOrigin: performance.timeOrigin};', args: [],
                        }) as { url: string; timeOrigin: number };
                    } finally {
                        if (options.route === '/engine-frame') {
                            await firefoxControl!.command('POST', '/frame', { id: null });
                        }
                    }
                }
                const selectedHandle = browser === 'firefox'
                    ? await firefoxControl!.command('GET', '/window') : undefined;
                const navigation = { requestedAt: navigationRequestedAt, selectedDocument, selectedHandle };
                if (observation.engine) {
                    assertSelectedDocument(observation, selectedDocument);
                }
                return { ...observation, navigation };
            };
            const runBuiltSuite = {
                benchmark: runBenchmarkSuite, lifecycle: runLifecycleSuite, engine: runEngineSuite,
            }[suite];
            try {
                await runBuiltSuite({
                    browser,
                    origin: fixtureServer.origin,
                    processId,
                    cases: engineCases,
                    events: fixtureServer.events,
                    inspectRequests: async () => {
                        if (browser === 'chromium') {
                            return [...observedRequests];
                        }
                        const result = await command({
                            id: `network-observation-${Date.now()}`,
                            operation: 'consumer-diagnostics',
                        });
                        assert.equal(result.status, 'succeeded', JSON.stringify(result));
                        return (
                            result.value as {
                                result: {
                                    nativeRequests: readonly {
                                        url: string;
                                        method: string;
                                        type: string;
                                    }[];
                                };
                            }
                        ).result.nativeRequests;
                    },
                    command: (input) => command(input),
                    read: readBuilt,
                    evaluate: async <T>(script: string): Promise<T> => {
                        if (browser === 'chromium') {
                            return enginePage!.evaluate(script) as Promise<T>;
                        }
                        return firefoxControl!.command('POST', '/execute/sync', {
                            script,
                            args: [],
                        }) as Promise<T>;
                    },
                    openWindow: async (id, privateWindow) => {
                        const result = await command({
                            id: `open-${id}`,
                            operation: privateWindow ? 'private' : 'window',
                            url: `${fixtureServer.origin}/engine?id=${id}`,
                        });
                        assert.equal(result.status, 'succeeded', JSON.stringify(result));
                        return {
                            command: result,
                            observation: await fixtureServer.waitForRead(id),
                        };
                    },
                    stopWorker: async () => {
                        const session = await chromiumContext!.browser()!.newBrowserCDPSession();
                        try {
                            const before = await session.send('Target.getTargets');
                            const fixtureId = (availability.value as { extensionId: string })
                                .extensionId;
                            const workers = before.targetInfos.filter(
                                (target) => target.type === 'service_worker'
                                    && target.url.startsWith(`chrome-extension://${fixtureId}/`),
                            );
                            assert.ok(workers.length > 0, JSON.stringify(workers));
                            const requestedAt = Date.now();
                            const closed = [];
                            for (const target of workers) {
                                const result = await session.send('Target.closeTarget', {
                                    targetId: target.targetId,
                                });
                                assert.equal(result.success, true);
                                closed.push({ target, result });
                            }
                            const ownedTargetIds = new Set(workers.map((worker) => worker.targetId));
                            let after = await session.send('Target.getTargets');
                            const deadline = Date.now() + 5000;
                            while (
                                after.targetInfos.some((target) => ownedTargetIds.has(target.targetId))
                                && Date.now() < deadline
                            ) {
                                after = await session.send('Target.getTargets');
                            }
                            assert.equal(
                                after.targetInfos.some((target) => ownedTargetIds.has(target.targetId)),
                                false,
                            );
                            return {
                                requestedAt,
                                stoppedAt: Date.now(),
                                before,
                                closed,
                                after,
                            };
                        } finally {
                            await session.detach();
                        }
                    },
                    restartBrowser: async (startUrl) => {
                        const requestedBeforeShutdown = await command({
                            id: `restart-requested-${Date.now()}`,
                            operation: 'consumer-session',
                        });
                        assert.equal(requestedBeforeShutdown.status, 'succeeded');
                        const requestedAt = Date.now();
                        if (startUrl) {
                            lastReadUrl = startUrl;
                            lastReadId = new URL(startUrl).searchParams.get('id')!;
                        }
                        if (browser === 'chromium') {
                            await chromiumContext!.close();
                            const closedAt = Date.now();
                            const beforeInstallation = await readChromiumInstallation(
                                profile,
                                (availability.value as { extensionId: string }).extensionId,
                            );
                            chromiumContext = await chromium.launchPersistentContext(profile, {
                                channel: 'chromium',
                                headless: true,
                                ignoreDefaultArgs: ['--disable-extensions'],
                                args: [
                                    '--enable-automation',
                                    '--no-first-run',
                                    '--restore-last-session',
                                    ...(startUrl ? [`--app=${startUrl}`] : []),
                                ],
                            });
                            cleanup = (): Promise<void> => chromiumContext!.close();
                            const session = await chromiumContext.browser()!.newBrowserCDPSession();
                            const launch = await session.send('Browser.getBrowserCommandLine');
                            await session.detach();
                            const { extensionId } = availability.value as { extensionId: string };
                            const persistedInstallation = await readChromiumInstallation(
                                profile,
                                extensionId,
                            );
                            const control = await chromiumContext.newPage();
                            await control.goto(`chrome-extension://${extensionId}/control.html`);
                            command = (input): Promise<CommandResult> => control.evaluate(
                                (value) => chrome.runtime.sendMessage(value),
                                input,
                            );
                            let startup;
                            if (startUrl) {
                                const matches = chromiumContext.pages().filter((page) => page.url() === startUrl);
                                assert.equal(matches.length, 1, 'Startup URL must identify one document');
                                [enginePage] = matches;
                                const selected = await enginePage.evaluate(() => ({
                                    url: window.location.href, timeOrigin: window.performance.timeOrigin,
                                }));
                                startup = await fixtureServer.waitForRead(new URL(startUrl).searchParams.get('id')!);
                                assertSelectedDocument(startup, selected);
                            }
                            return {
                                requestedAt,
                                requestedBeforeShutdown,
                                launch,
                                persistedInstallation,
                                beforeInstallation,
                                closedAt,
                                restartedAt: Date.now(),
                                profile,
                                version: chromiumContext.browser()!.version(),
                                startup,
                            };
                        }
                        await permanentFirefox!.close();
                        const closedAt = Date.now();
                        permanentFirefox = await launchFirefox(profile, startUrl, { executable });
                        firefoxControl = permanentFirefox as typeof firefoxControl;
                        const addon = await readAddon(
                            permanentFirefox,
                            'canvas-delivery@tests.invalid',
                        );
                        assert.equal(addon.isActive, true);
                        assert.equal(addon.temporarilyInstalled, false);
                        const startupOnboarding = await dismissFirefoxOnboarding(permanentFirefox);
                        let startup;
                        let startupDocument;
                        if (startUrl) {
                            const handles = await permanentFirefox.command('GET', '/window/handles') as string[];
                            const matches: string[] = [];
                            for (const handle of handles) {
                                await permanentFirefox.command('POST', '/window', { handle });
                                if (await permanentFirefox.command('GET', '/url') === startUrl) {
                                    matches.push(handle);
                                }
                            }
                            assert.equal(matches.length, 1, 'Startup URL must identify one document');
                            await permanentFirefox.command('POST', '/window', { handle: matches[0] });
                            const selected = await permanentFirefox.command('POST', '/execute/sync', {
                                script: 'return {url: location.href, timeOrigin: performance.timeOrigin};', args: [],
                            }) as { url: string; timeOrigin: number };
                            startupDocument = { handle: matches[0], ...selected };
                            startup = await fixtureServer.waitForRead(new URL(startUrl).searchParams.get('id')!);
                            assertSelectedDocument(startup, selected);
                        }
                        return {
                            requestedAt,
                            requestedBeforeShutdown,
                            closedAt,
                            restartedAt: Date.now(),
                            profile,
                            addon,
                            startupOnboarding,
                            capabilities: permanentFirefox.capabilities,
                            startup,
                            startupDocument,
                        };
                    },
                    setUserScriptAccess: async (enabled) => {
                        const { extensionId } = availability.value as { extensionId: string };
                        const settings = await chromiumContext!.newPage();
                        await settings.goto(`chrome://extensions/?id=${extensionId}`);
                        const toggle = settings.locator(
                            'extensions-detail-view #allow-user-scripts cr-toggle',
                        );
                        const before = await toggle.getAttribute('aria-pressed');
                        if ((before === 'true') !== enabled) {
                            await toggle.click();
                        }
                        const after = await toggle.getAttribute('aria-pressed');
                        assert.equal(after, String(enabled));
                        await settings.close();
                        return {
                            before,
                            after,
                            at: Date.now(),
                            extensionId,
                        };
                    },
                    replaceExtension: async (nextVersion) => {
                        replacementSequence += 1;
                        const replacementId = `replacement-${replacementSequence}-${nextVersion}`;
                        const requestedAt = Date.now();
                        const previousEvents = fixtureServer.events.length;
                        const manifestPath = path.join(extension, 'manifest.json');
                        const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
                            version: string;
                        };
                        const previousVersion = manifest.version;
                        manifest.version = nextVersion;
                        await writeFile(manifestPath, JSON.stringify(manifest));
                        if (browser === 'chromium') {
                            const { extensionId } = availability.value as { extensionId: string };
                            const settings = await chromiumContext!.newPage();
                            await settings.goto('chrome://extensions/');
                            await settings
                                .locator(`extensions-item#${extensionId} #dev-reload-button`)
                                .click();
                            await settings.close();
                            const control = await chromiumContext!.newPage();
                            await control.goto(`chrome-extension://${extensionId}/control.html`);
                            command = (input): Promise<CommandResult> => control.evaluate(
                                (value) => chrome.runtime.sendMessage(value),
                                input,
                            );
                        } else {
                            const archive = path.resolve(
                                extension,
                                `../built-consumer-${nextVersion}.xpi`,
                            );
                            execFileSync('/usr/bin/zip', ['-q', '-r', archive, '.'], {
                                cwd: extension,
                            });
                            assert.equal(
                                await permanentFirefox!.command('POST', '/moz/addon/install', {
                                    path: archive,
                                    temporary: false,
                                }),
                                'canvas-delivery@tests.invalid',
                            );
                        }
                        const first = await readBuilt(`${replacementId}-preack`);
                        const acknowledgment = await command({
                            id: `${replacementId}-ack`,
                            operation: 'consumer-diagnostics',
                        });
                        assert.equal(
                            acknowledgment.status,
                            'succeeded',
                            JSON.stringify(acknowledgment),
                        );
                        return {
                            requestedAt,
                            previousVersion,
                            nextVersion,
                            manifestPath,
                            first,
                            acknowledgment,
                            events: fixtureServer.events.slice(previousEvents),
                            completedAt: Date.now(),
                        };
                    },
                    unloadBackground: async () => {
                        assert.equal(browser, 'firefox');
                        const requestedAt = Date.now();
                        const eventOffset = fixtureServer.events.length;
                        await permanentFirefox!.command('POST', '/moz/context', {
                            context: 'chrome',
                        });
                        let nativeUnload: unknown;
                        try {
                            nativeUnload = await permanentFirefox!.command('POST', '/execute/async', {
                                script: `const done = arguments[arguments.length - 1];
                                const { ExtensionParent } = ChromeUtils.importESModule(
                                    'resource://gre/modules/ExtensionParent.sys.mjs');
                                const extension = [...ExtensionParent.GlobalManager.extensionMap.values()]
                                    .find(value => value.id === arguments[0]);
                                const views = [...extension.views].filter(value => value.viewType === 'background');
                                if (views.length !== 1) throw new Error('Expected exactly one owned background view');
                                const context = views[0];
                                const ownedBrowser = context.xulBrowser;
                                const identity = {id: extension.id, childId: context.childId,
                                    viewType: context.viewType, uri: context.uri.spec,
                                    browserURI: ownedBrowser.currentURI.spec,
                                    browsingContextId: context.browsingContext.id};
                                if (identity.uri !== identity.browserURI) throw new Error('Background URI mismatch');
                                const removedAt = Date.now();
                                ownedBrowser.remove();
                                const deadline = Date.now() + 5000;
                                const observe = () => {
                                    const remaining = [...extension.views]
                                        .filter(value => value.viewType === 'background');
                                    const disappeared = !extension.views.has(context);
                                    if (disappeared || Date.now() >= deadline) {
                                        done({identity, removedAt, disappeared, observedAt: Date.now(),
                                            contextUnloaded: context.unloaded,
                                            browserConnected: ownedBrowser.isConnected,
                                            remaining: remaining.map(value => ({childId: value.childId,
                                                uri: value.uri.spec}))});
                                    } else { setTimeout(observe, 10); }
                                };
                                observe();`,
                                args: ['canvas-delivery@tests.invalid'],
                            });
                        } finally {
                            await permanentFirefox!.command('POST', '/moz/context', {
                                context: 'content',
                            });
                        }
                        const observedUnload = nativeUnload as {
                            disappeared: boolean; contextUnloaded: boolean; browserConnected: boolean;
                            remaining: readonly unknown[];
                        };
                        assert.equal(observedUnload.disappeared, true, JSON.stringify(nativeUnload));
                        assert.equal(observedUnload.contextUnloaded, true, JSON.stringify(nativeUnload));
                        assert.equal(observedUnload.browserConnected, false, JSON.stringify(nativeUnload));
                        assert.deepEqual(observedUnload.remaining, []);
                        const first = await readBuilt('background-unloaded-native');
                        const addonBeforeControl = await readAddon(permanentFirefox!, 'canvas-delivery@tests.invalid');
                        const originalHandle = await permanentFirefox!.command('GET', '/window') as string;
                        const control = await createFirefoxTab(permanentFirefox!);
                        await permanentFirefox!.command('POST', '/window', { handle: control.handle });
                        let sessionGeneration: unknown;
                        try {
                            const { identity } = nativeUnload as { identity: { uri: string } };
                            await permanentFirefox!.command('POST', '/url', {
                                url: new URL('control.html', identity.uri).href,
                            });
                            sessionGeneration = await permanentFirefox!.command('POST', '/execute/async', {
                                script: `const done = arguments[arguments.length - 1];
                                    (window.wrappedJSObject ?? window).browser.storage.session
                                        .get('tswebextension.canvasProtectionSession')
                                        .then(value => {
                                            const session = value['tswebextension.canvasProtectionSession'];
                                            done({generation: session?.generation ?? null,
                                                present: session !== undefined, observedAt: Date.now()});
                                        }, error => done({error: String(error), observedAt: Date.now()}));`,
                                args: [],
                            });
                        } finally {
                            await permanentFirefox!.command('DELETE', '/window');
                            await permanentFirefox!.command('POST', '/window', { handle: originalHandle });
                        }
                        const addonAfterControl = await readAddon(permanentFirefox!, 'canvas-delivery@tests.invalid');
                        await permanentFirefox!.command('POST', '/moz/context', { context: 'chrome' });
                        let backgroundAfterControl: unknown;
                        try {
                            backgroundAfterControl = await permanentFirefox!.command('POST', '/execute/sync', {
                                script: `const { ExtensionParent } = ChromeUtils.importESModule(
                                    'resource://gre/modules/ExtensionParent.sys.mjs');
                                    const extension = [...ExtensionParent.GlobalManager.extensionMap.values()]
                                        .find(value => value.id === arguments[0]);
                                    return {id: extension.id, at: Date.now(), backgrounds: [...extension.views]
                                        .filter(value => value.viewType === 'background')
                                        .map(value => ({childId: value.childId, uri: value.uri.spec}))};`,
                                args: ['canvas-delivery@tests.invalid'],
                            });
                        } finally {
                            await permanentFirefox!.command('POST', '/moz/context', { context: 'content' });
                        }
                        assert.equal(addonBeforeControl.isActive, true);
                        assert.equal(addonAfterControl.isActive, true);
                        assert.deepEqual((backgroundAfterControl as { backgrounds: unknown[] }).backgrounds, []);
                        const recovery = await permanentFirefox!.chromeScript(`
                            const done = arguments[arguments.length - 1];
                            const { ExtensionParent } = ChromeUtils.importESModule(
                                'resource://gre/modules/ExtensionParent.sys.mjs');
                            const extension = [...ExtensionParent.GlobalManager.extensionMap.values()]
                                .find(value => value.id === arguments[0]);
                            const api = extension.apiManager.getAPI('backgroundPage', extension, 'addon_parent');
                            api.backgroundBuilder.backgroundContextOwner.setBgStateStopped(false);
                            const before = {id: extension.id, version: extension.version,
                                state: extension.backgroundState, at: Date.now()};
                            extension.wakeupBackground().then(() => done({before, at: Date.now(),
                                state: extension.backgroundState, views: [...extension.views]
                                    .filter(value => value.viewType === 'background')
                                    .map(value => ({childId: value.childId, uri: value.uri.spec}))}),
                                error => done({error: String(error)}));`, ['canvas-delivery@tests.invalid']);
                        const acknowledgment = await command({
                            id: 'background-recovery-ack', operation: 'consumer-diagnostics',
                        });
                        assert.equal(acknowledgment.status, 'succeeded', JSON.stringify(acknowledgment));
                        const afterSession = await command({
                            id: 'background-recovery-session', operation: 'consumer-session',
                        });
                        const retained = await permanentFirefox!.command('POST', '/execute/sync', {
                            script: 'return window.canvasFixtureRead();', args: [],
                        });
                        await permanentFirefox!.command('POST', '/refresh', {});
                        const reloaded = await fixtureServer.waitForRead('background-unloaded-native');
                        const reloadedDocument = await permanentFirefox!.command('POST', '/execute/sync', {
                            script: 'return {url: location.href, timeOrigin: performance.timeOrigin};', args: [],
                        }) as { url: string; timeOrigin: number };
                        assertSelectedDocument(reloaded, reloadedDocument);
                        return {
                            reloadedDocument,
                            recovery,
                            acknowledgment,
                            afterSession,
                            retained,
                            reloaded,
                            control,
                            sessionGeneration,
                            addonBeforeControl,
                            addonAfterControl,
                            backgroundAfterControl,
                            requestedAt,
                            nativeUnload,
                            first,
                            events: fixtureServer.events.slice(eventOffset),
                            observedAt: Date.now(),
                        };
                    },
                    reloadPage: async () => {
                        const requestedAt = Date.now();
                        if (browser === 'chromium') {
                            await enginePage!.reload({ waitUntil: 'commit' });
                        } else {
                            await firefoxControl!.command('POST', '/refresh', {});
                        }
                        const selectedDocument = browser === 'chromium'
                            ? await enginePage!.evaluate(() => ({
                                url: window.location.href, timeOrigin: window.performance.timeOrigin,
                            }))
                            : await firefoxControl!.command('POST', '/execute/sync', {
                                script: 'return {url: location.href, timeOrigin: performance.timeOrigin};', args: [],
                            }) as { url: string; timeOrigin: number };
                        const selectedHandle = browser === 'firefox'
                            ? await firefoxControl!.command('GET', '/window') : undefined;
                        const observation = await fixtureServer.waitForRead(
                            lastReadId || new URL(lastReadUrl).searchParams.get('id')!,
                        );
                        const navigation = { requestedAt, selectedDocument, selectedHandle };
                        assertSelectedDocument(observation, selectedDocument);
                        return { ...observation, navigation };
                    },
                });
            } finally {
                engineCases.forEach((entry) => cases.set(entry.name, entry));
            }
        } else {
            const { code, snapshot } = await createDeliveryCode(browser);
            const installed = await command({
                id: 'install',
                operation: 'install',
                code,
                matches: snapshot.policy.selectors.matches,
            });
            console.error(
                JSON.stringify({
                    browser,
                    version,
                    executable,
                    profile,
                    permission,
                    installed,
                }),
            );
            assert.equal(
                installed.status,
                process.env.CANVAS_DELIVERY_BASELINE === '1' ? 'baseline' : 'succeeded',
            );
            if (browser === 'chromium' && process.env.CANVAS_DELIVERY_BASELINE !== '1') {
                assert.equal(
                    (installed.value as { currentCodeInstalled: boolean }).currentCodeInstalled,
                    true,
                );
            }
            const id = 'first-inline';
            await command({
                id: 'navigate-first',
                operation: 'navigate',
                url: `${fixtureServer.origin}/first-read?id=${id}`,
            });
            const first = await fixtureServer.waitForRead(id);
            try {
                assertFirstRead(first, true);
                cases.set(deliveryCaseNames[0], {
                    name: deliveryCaseNames[0],
                    status: 'passed',
                    reason: 'MAIN first read',
                    evidence: { first, installed },
                });
            } catch (error) {
                cases.set(deliveryCaseNames[0], {
                    name: deliveryCaseNames[0],
                    status: 'failed',
                    reason: String(error),
                    evidence: { first, installed },
                });
            }
            if (browser === 'chromium' && process.env.CANVAS_DELIVERY_BASELINE !== '1') {
                for (const requested of ['disable', 'exclude'] as const) {
                    const name = requested === 'disable'
                        ? 'records stale reactivation and enforces acknowledged disablement'
                        : 'records stale reactivation and enforces acknowledged exclusion';
                    const toggle = chromiumSettings!.locator(
                        'extensions-detail-view #allow-user-scripts cr-toggle',
                    );
                    await toggle.click();
                    const revoked = await command({
                        id: `${requested}-revoked`,
                        operation: 'availability',
                    });
                    const revokedAvailability = revoked.value as {
                        availability: { status: string };
                    };
                    assert.equal(revokedAvailability.availability.status, 'unavailable');
                    const replacement = await createDeliveryCode(browser, {
                        disabled: requested === 'disable',
                        excluded: requested === 'exclude',
                    });
                    const attempted = await command({
                        id: `${requested}-requested`,
                        operation: requested === 'disable' ? 'remove' : 'install',
                        requested,
                        code: replacement.code,
                        matches: replacement.snapshot.policy.selectors.matches,
                    });
                    assert.equal(attempted.status, 'failed');
                    // Restore access through the browser UI and navigate before reconciliation.
                    await toggle.click();
                    const page = await chromiumContext!.newPage();
                    const restoredId = `${requested}-restored-first-inline`;
                    const fixturePath = requested === 'exclude' ? 'excluded' : 'first-read';
                    await page.goto(`${fixtureServer.origin}/${fixturePath}?id=${restoredId}`);
                    const restoredFirst = await fixtureServer.waitForRead(restoredId);
                    const restored = await command({
                        id: `${requested}-restored`,
                        operation: 'availability',
                    });
                    const reconciled = await command({
                        id: `${requested}-reconcile`,
                        operation: 'install',
                        code: replacement.code,
                        matches: replacement.snapshot.policy.selectors.matches,
                    });
                    assert.equal(reconciled.status, 'succeeded');
                    assert.equal(
                        (reconciled.value as { currentCodeInstalled: boolean })
                            .currentCodeInstalled,
                        true,
                    );
                    const retainedAfterAck = await page.evaluate(readCapturedFixture);
                    assert.deepEqual(retainedAfterAck, restoredFirst.pixel);
                    await page.reload();
                    const reloadedFirst = await fixtureServer.waitForRead(restoredId);
                    assertFirstRead(reloadedFirst, false);
                    const reconciledId = `${requested}-reconciled-first-inline`;
                    await page.goto(`${fixtureServer.origin}/${fixturePath}?id=${reconciledId}`);
                    const reconciledFirst = await fixtureServer.waitForRead(reconciledId);
                    assertFirstRead(reconciledFirst, false);
                    try {
                        assertFirstRead(restoredFirst, true);
                        cases.set(name, {
                            name,
                            status: 'passed',
                            reason: 'Prior snapshot before reconciliation; native new document after acknowledgment',
                            evidence: {
                                revoked,
                                attempted,
                                restoredFirst,
                                restored,
                                reconciled,
                                retainedAfterAck,
                                reloadedFirst,
                                reconciledFirst,
                            },
                        });
                    } catch (error) {
                        cases.set(name, {
                            name,
                            status: 'failed',
                            reason: String(error),
                            evidence: {
                                revoked,
                                attempted,
                                restoredFirst,
                                restored,
                                reconciled,
                                retainedAfterAck,
                                reloadedFirst,
                                reconciledFirst,
                            },
                        });
                    }
                    await command({
                        id: `${requested}-reset`,
                        operation: 'install',
                        requested: 'enable',
                        code,
                        matches: snapshot.policy.selectors.matches,
                    });
                }
            }
            for (const [kind, name, protectedRead] of [
                ['same', 'same-origin frame captures local protection', true],
                ['cross', 'cross-origin frame captures local protection', true],
                ['sandbox', 'sandboxed HTTP frame captures local protection', true],
                ['about:blank', 'about:blank records unsupported host', false],
                ['srcdoc', 'srcdoc records unsupported host', false],
                ['data', 'data records unsupported host', false],
                ['blob', 'blob records unsupported host', false],
                ['no-referrer', 'no-referrer frame captures local protection', true],
                ['detached', 'detached frame retains its captured methods', true],
            ] as const) {
                const caseId = `frame-${kind}`;
                let nativeDetached: unknown;
                if (kind === 'detached') {
                    const disabled = await createDeliveryCode(browser, { disabled: true });
                    const disabledInstalled = await command({
                        id: 'disable-detached-control',
                        operation: 'install',
                        code: disabled.code,
                        matches: disabled.snapshot.policy.selectors.matches,
                    });
                    assert.equal(disabledInstalled.status, 'succeeded');
                    await command({
                        id: 'navigate-native-detached',
                        operation: 'navigate',
                        url: `${fixtureServer.origin}/frames?kind=detached&id=native-detached`,
                    });
                    const native = await fixtureServer.waitForRead('native-detached-detached');
                    assertFirstRead({ ...native, pixel: native.beforeDetachPixel! }, false);
                    nativeDetached = native;
                    const restoredInstalled = await command({
                        id: 'restore-detached-probe',
                        operation: 'install',
                        code,
                        matches: snapshot.policy.selectors.matches,
                    });
                    assert.equal(restoredInstalled.status, 'succeeded');
                }
                await command({
                    id: `navigate-${kind}`,
                    operation: 'navigate',
                    url: `${fixtureServer.origin}/frames?kind=${kind}&id=${caseId}`,
                });
                const frameRead = await fixtureServer.waitForRead(
                    kind === 'detached' ? `${caseId}-detached` : caseId,
                );
                try {
                    assertFirstRead(
                        kind === 'detached'
                            ? { ...frameRead, pixel: frameRead.beforeDetachPixel! }
                            : frameRead,
                        protectedRead,
                    );
                    if (kind === 'detached') {
                        const nativePixel = (nativeDetached as { pixel: readonly number[] }).pixel;
                        if (nativePixel[0] === 16 && nativePixel[3] === 255) {
                            assertFirstRead(frameRead, true);
                        } else {
                            assert.deepEqual(frameRead.pixel, nativePixel);
                        }
                    }
                    if (protectedRead) {
                        assert.equal(frameRead.delivery?.outcome, 'enabled');
                        assert.equal(frameRead.delivery.mode, 'frame-local');
                        assert.equal(frameRead.delivery.requestType, 'subdocument');
                    }
                    if (kind === 'sandbox') {
                        assert.equal(frameRead.topAccessible, false);
                        assert.equal(frameRead.origin, 'null');
                    }
                    if (kind === 'no-referrer') {
                        assert.equal(frameRead.referrer, '');
                    }
                    if (kind === 'about:blank') {
                        assert.equal(frameRead.url, 'about:blank');
                    } else if (kind === 'srcdoc') {
                        assert.equal(frameRead.url, 'about:srcdoc');
                    } else if (kind === 'data') {
                        assert.ok(frameRead.url.startsWith('data:text/html,'));
                    } else if (kind === 'blob') {
                        assert.ok(frameRead.url.startsWith(`blob:${fixtureServer.origin}/`));
                    }
                    cases.set(name, {
                        name,
                        status: 'passed',
                        reason: protectedRead
                            ? 'Captured local frame decision'
                            : 'Special URL keeps native output; delivery status is recorded separately',
                        evidence:
                            kind === 'detached'
                                ? { protected: frameRead, native: nativeDetached }
                                : frameRead,
                    });
                } catch (error) {
                    cases.set(name, {
                        name,
                        status: 'failed',
                        reason: String(error),
                        evidence: frameRead,
                    });
                }
            }
            const restrictedUrl = browser === 'chromium' ? 'chrome://version/' : 'about:config';
            const restricted = await createDeliveryCode(browser, { matches: [restrictedUrl] });
            const restrictedAttempt = await command({
                id: 'install-restricted',
                operation: 'install',
                code: restricted.code,
                matches: restricted.snapshot.policy.selectors.matches,
            });
            assert.equal(restrictedAttempt.status, 'failed');
            assert.ok(
                restrictedAttempt.reason,
                'Native rejection must retain its actual browser reason',
            );
            let restrictedRead: unknown;
            if (browser === 'chromium') {
                const restrictedPage = await chromiumContext!.newPage();
                await restrictedPage.goto(restrictedUrl);
                restrictedRead = await restrictedPage.evaluate(readRestrictedPage);
                await restrictedPage.close();
            } else {
                await firefoxControl!.command('POST', '/url', { url: restrictedUrl });
                restrictedRead = await firefoxControl!.command('POST', '/execute/sync', {
                    script: `return (${readRestrictedPage.toString()})();`,
                    args: [],
                });
            }
            const restrictedValue = restrictedRead as {
                url: string;
                pixel: readonly number[];
                delivery: unknown;
            };
            assert.equal(restrictedValue.url, restrictedUrl);
            assert.deepEqual(restrictedValue.pixel, [16, 32, 48, 255]);
            assert.equal(restrictedValue.delivery, null);
            await command({
                id: 'navigate-restricted-control',
                operation: 'navigate',
                url: `${fixtureServer.origin}/first-read?id=restricted-control`,
            });
            const restrictedControl = await fixtureServer.waitForRead('restricted-control');
            assertFirstRead(restrictedControl, true);
            cases.set('restricted URL records absent injection', {
                name: 'restricted URL records absent injection',
                status: 'passed',
                reason: 'Internal URL selector rejection is native; HTTP registration remains active',
                evidence: {
                    attempted: restrictedAttempt,
                    read: restrictedRead,
                    protectedControl: restrictedControl,
                    requestedMatches: restricted.snapshot.policy.selectors.matches,
                    observation:
                        'Restricted capability observation after navigation; first-inline timing is not claimed',
                },
            });
            const broad = await createDeliveryCode(browser, {
                matches: browser === 'chromium' ? ['<all_urls>'] : ['http://[::1]/*'],
            });
            const broadInstalled = await command({
                id: 'install-missing-permission',
                operation: 'install',
                code: broad.code,
                matches: broad.snapshot.policy.selectors.matches,
            });
            assert.equal(broadInstalled.status, browser === 'chromium' ? 'succeeded' : 'failed');
            if (browser === 'firefox') {
                assert.match(
                    broadInstalled.reason!,
                    /Permission denied to register.*http:\/\/\[::1\]/,
                );
            }
            await command({
                id: 'navigate-missing-permission',
                operation: 'navigate',
                url: `${fixtureServer.missingPermissionOrigin}/first-read?id=missing-permission`,
            });
            const missingPermissionRead = await fixtureServer.waitForRead('missing-permission');
            assertFirstRead(missingPermissionRead, false);
            assert.equal(missingPermissionRead.delivery, null);
            cases.set('missing host permission records absent injection', {
                name: 'missing host permission records absent injection',
                status: 'passed',
                reason:
                    browser === 'chromium'
                        ? 'Acknowledged broad selector; manifest does not grant the IPv6 host'
                        : 'Native Firefox API rejects the explicit ungranted IPv6 selector; no false acknowledgment',
                evidence: {
                    installed: broadInstalled,
                    first: missingPermissionRead,
                    requestedMatches: broad.snapshot.policy.selectors.matches,
                    grantedHosts: ['http://127.0.0.1/*', 'http://localhost/*'],
                },
            });
            const narrow = await createDeliveryCode(browser, {
                matches: ['http://127.0.0.1/selected/*'],
            });
            const narrowInstalled = await command({
                id: 'install-unmatched-selector',
                operation: 'install',
                code: narrow.code,
                matches: narrow.snapshot.policy.selectors.matches,
            });
            assert.equal(narrowInstalled.status, 'succeeded');
            await command({
                id: 'navigate-unmatched-selector',
                operation: 'navigate',
                url: `${fixtureServer.origin}/first-read?id=unmatched-selector`,
            });
            const unmatchedRead = await fixtureServer.waitForRead('unmatched-selector');
            assertFirstRead(unmatchedRead, false);
            assert.equal(unmatchedRead.delivery, null);
            cases.set('unmatched selector records absent injection', {
                name: 'unmatched selector records absent injection',
                status: 'passed',
                reason: 'Granted host with an unmatched native path selector',
                evidence: { installed: narrowInstalled, first: unmatchedRead },
            });
            const baseRestored = await command({
                id: 'restore-matrix-policy',
                operation: 'install',
                requested: 'enable',
                code,
                matches: snapshot.policy.selectors.matches,
            });
            assert.equal(baseRestored.status, 'succeeded');
            const normalWindow = await command({
                id: 'navigate-normal-window',
                operation: 'navigate',
                url: `${fixtureServer.origin}/first-read?id=normal-window`,
            });
            assert.equal(normalWindow.status, 'succeeded');
            assert.equal((normalWindow.value as { incognito: boolean }).incognito, false);
            const normalRead = await fixtureServer.waitForRead('normal-window');
            assertFirstRead(normalRead, true);
            const privateWindow = await command({
                id: 'navigate-private-window',
                operation: 'private',
                url: `${fixtureServer.origin}/first-read?id=private-window`,
            });
            assert.equal(privateWindow.status, 'succeeded');
            const privateValue = privateWindow.value as { id: number; incognito: boolean };
            assert.equal(privateValue.incognito, true);
            const privateRead = await fixtureServer.waitForRead('private-window');
            assertFirstRead(privateRead, true);
            cases.set('normal and private windows receive protection', {
                name: 'normal and private windows receive protection',
                status: 'passed',
                reason: 'Native extension tab/window metadata verifies normal and allowed private delivery',
                evidence: {
                    normalWindow,
                    normalRead,
                    privateWindow,
                    privateRead,
                },
            });
            await command({
                id: 'close-private-window',
                operation: 'close',
                windowId: privateValue.id,
            });
            if (browser === 'chromium') {
                const session = await chromiumContext!.browser()!.newBrowserCDPSession();
                const before = await session.send('Target.getTargets');
                const workers = before.targetInfos.filter(
                    (target) => target.type === 'service_worker'
                        && target.url.startsWith('chrome-extension://'),
                );
                assert.equal(workers.length, 1);
                const closed = await session.send('Target.closeTarget', {
                    targetId: workers[0].targetId,
                });
                assert.equal(closed.success, true);
                let stopped = await session.send('Target.getTargets');
                const stopDeadline = Date.now() + 5000;
                while (
                    stopped.targetInfos.some((target) => target.targetId === workers[0].targetId)
                    && Date.now() < stopDeadline
                ) {
                    await new Promise<void>((resolve) => {
                        setTimeout(resolve, 50);
                    });
                    stopped = await session.send('Target.getTargets');
                }
                assert.equal(
                    stopped.targetInfos.some((target) => target.targetId === workers[0].targetId),
                    false,
                );
                const page = await chromiumContext!.newPage();
                await page.goto(`${fixtureServer.origin}/first-read?id=stopped-worker`);
                const stoppedRead = await fixtureServer.waitForRead('stopped-worker');
                assertFirstRead(stoppedRead, true);
                const after = await session.send('Target.getTargets');
                assert.equal(
                    after.targetInfos.some(
                        (target) => target.type === 'service_worker'
                            && target.url.startsWith('chrome-extension://'),
                    ),
                    false,
                );
                cases.set('keeps delivery after worker stop', {
                    name: 'keeps delivery after worker stop',
                    status: 'passed',
                    reason: 'First inline read sees the registered probe while the worker target remains stopped',
                    evidence: {
                        worker: workers[0],
                        stoppedTargets: stopped.targetInfos,
                        afterReadTargets: after.targetInfos,
                        first: stoppedRead,
                    },
                });
                await session.detach();
                for (const kind of ['update', 'reload'] as const) {
                    const lifecycleId = `extension-${kind}`;
                    const caseName = kind === 'update'
                        ? 'Chromium version update records registration loss and acknowledged reinstall'
                        : 'Chromium unchanged-version reload records registration loss and acknowledged reinstall';
                    const updated = await createDeliveryCode(browser, {
                        revision: `delivery-${kind}`,
                        generation:
                            kind === 'update'
                                ? '33333333333333333333333333333333'
                                : '44444444444444444444444444444444',
                    });
                    await buildCanvasTestExtension(browser, 'delivery', fixtureServer.collector, {
                        version: '1.0.1',
                        restore: {
                            code: updated.code,
                            matches: updated.snapshot.policy.selectors.matches,
                            requested: 'enable',
                        },
                    });
                    await chromiumSettings!.goto('chrome://extensions/');
                    const updatedItem = chromiumSettings!
                        .locator('extensions-item')
                        .filter({ hasText: 'Canvas delivery test' });
                    const requestedAt = Date.now();
                    await updatedItem.locator('#dev-reload-button').click();
                    const updatePage = await chromiumContext!.newPage();
                    await updatePage.goto(`${fixtureServer.origin}/first-read?id=${lifecycleId}`);
                    const updatedFirst = await fixtureServer.waitForRead(lifecycleId);
                    const updateAcknowledgment = await fixtureServer.waitForCommand('update-bootstrap');
                    const updateInstalled = await fixtureServer.waitForCommand('update-installed');
                    const retainedUpdateRead = await updatePage.evaluate(readCapturedFixture);
                    await updatePage.reload();
                    const reloadedUpdateRead = await fixtureServer.waitForRead(lifecycleId);
                    assertFirstRead(reloadedUpdateRead, true);
                    assert.equal(
                        reloadedUpdateRead.delivery?.policyRevision,
                        updated.snapshot.policy.revision,
                    );
                    assert.equal(
                        reloadedUpdateRead.delivery?.capturedGeneration,
                        updated.snapshot.session.generation,
                    );
                    await updatePage.goto(
                        `${fixtureServer.origin}/first-read?id=${lifecycleId}-acknowledged`,
                    );
                    const acknowledgedUpdateRead = await fixtureServer.waitForRead(
                        `${lifecycleId}-acknowledged`,
                    );
                    assertFirstRead(acknowledgedUpdateRead, true);
                    assert.equal(
                        acknowledgedUpdateRead.delivery?.policyRevision,
                        updated.snapshot.policy.revision,
                    );
                    assert.equal(
                        acknowledgedUpdateRead.delivery?.capturedGeneration,
                        updated.snapshot.session.generation,
                    );
                    try {
                        assert.equal(updateAcknowledgment.status, 'succeeded');
                        const updateValue = updateAcknowledgment.value as {
                            result: { currentCodeInstalled: boolean };
                        };
                        const installedValue = updateInstalled.value as {
                            details: { reason: string; previousVersion: string };
                            manifestVersion: string;
                        };
                        assert.equal(updateValue.result.currentCodeInstalled, true);
                        assert.equal(installedValue.details.reason, 'update');
                        assert.equal(
                            installedValue.details.previousVersion,
                            kind === 'update' ? '1.0.0' : '1.0.1',
                        );
                        assert.equal(installedValue.manifestVersion, '1.0.1');
                        const ackAt = (
                            updateAcknowledgment.value as {
                                result: { acknowledgedAt: number };
                            }
                        ).result.acknowledgedAt;
                        assert.ok(
                            updatedFirst.at! < ackAt,
                            'First read must sample the registration-loss interval',
                        );
                        assert.deepEqual(retainedUpdateRead, updatedFirst.pixel);
                        if (updatedFirst.delivery === null) {
                            assertFirstRead(updatedFirst, false);
                        } else {
                            assertFirstRead(updatedFirst, true);
                        }
                        cases.set(caseName, {
                            name: caseName,
                            status: 'passed',
                            reason: 'Observed prereinstall capture; current snapshot after acknowledgment',
                            evidence: {
                                operation: {
                                    kind,
                                    requestedAt,
                                    control: 'chrome://extensions dev-reload-button',
                                    version: '1.0.1',
                                },
                                first: updatedFirst,
                                acknowledgment: updateAcknowledgment,
                                updateInstalled,
                                retainedUpdateRead,
                                reloadedUpdateRead,
                                acknowledgedUpdateRead,
                            },
                        });
                    } catch (error) {
                        cases.set(caseName, {
                            name: caseName,
                            status: 'failed',
                            reason: String(error),
                            evidence: {
                                operation: {
                                    kind,
                                    requestedAt,
                                    control: 'chrome://extensions dev-reload-button',
                                    version: '1.0.1',
                                },
                                first: updatedFirst,
                                acknowledgment: updateAcknowledgment,
                                updateInstalled,
                                retainedUpdateRead,
                                reloadedUpdateRead,
                                acknowledgedUpdateRead,
                            },
                        });
                    }
                }
            }
        }
    } catch (error) {
        cases.set('runner', {
            name: 'runner',
            status: 'failed',
            reason:
                error instanceof Error
                    ? `${error.name}: ${error.message}\n${error.stack}`
                    : String(error),
        });
    } finally {
        try {
            await cleanup?.();
        } catch (error) {
            cases.set('browser cleanup', {
                name: 'browser cleanup',
                status: 'failed',
                reason: String(error),
            });
        } finally {
            try {
                await server?.close();
            } catch (error) {
                cases.set('fixture cleanup', {
                    name: 'fixture cleanup',
                    status: 'failed',
                    reason: String(error),
                });
            }
        }
    }
    if (suite === 'delivery' && browser === 'firefox' && !cases.has('runner')) {
        try {
            const reusePath = process.env.CANVAS_FIREFOX_LIFETIME_REPORT;
            const content = reusePath ? await readFile(reusePath, 'utf8') : undefined;
            const permanent = content !== undefined
                ? (JSON.parse(content) as FirefoxLifetimeReport)
                : await runFirefoxLifetimeProbe();
            assert.equal(
                permanent.version,
                version,
                'Permanent and ordinary browser versions must agree',
            );
            assert.equal(
                permanent.buildID,
                firefoxBuildId,
                'Permanent and ordinary builds must agree',
            );
            assert.equal(
                permanent.executable,
                executable,
                'Permanent and ordinary executables must agree',
            );
            assert.equal(permanent.protocol, 'HTTP');
            assert.equal(permanent.exitCode, 0, 'Permanent mandatory cases must all pass');
            lifetime = {
                ...permanent,
                evidenceMode: reusePath ? 'explicit-report-reuse' : 'actual-probe-run',
                inputReport: reusePath ?? permanent.runReportPath,
                inputSha256: content
                    ? createHash('sha256').update(content).digest('hex')
                    : undefined,
            };
            for (const entry of permanent.cases) {
                cases.set(entry.name, entry);
            }
        } catch (error) {
            cases.set('Firefox permanent runner', {
                name: 'Firefox permanent runner',
                status: 'failed',
                reason: String(error),
            });
        }
    }
    const required = {
        delivery: getDeliveryCaseNames(browser),
        engine: engineCaseNames,
        lifecycle: lifecycleCaseNames,
        benchmark: ['256x128', '1024x1024', '4096x4096'].map(
            (size) => `measures native and protected readout cost ${size}`,
        ),
    }[suite];
    for (const name of required) {
        if (!cases.has(name)) {
            cases.set(name, {
                name,
                status: 'unverified',
                reason: 'Loaded-extension case has not completed',
            });
        }
    }
    const report: SuiteReport = {
        browser,
        suite,
        version,
        executable,
        profile,
        launch: { headless: true, arguments: headlessArguments },
        protocol: 'HTTP',
        permission,
        lifetime,
        hardware: {
            hostname: os.hostname(),
            platform: os.platform(),
            release: os.release(),
            arch: os.arch(),
            cpus: os.cpus().map((cpu) => cpu.model),
            totalMemoryBytes: os.totalmem(),
        },
        artifacts,
        processOutcome,
        cases: [...cases.values()],
        exitCode: [...cases.values()].every((entry) => entry.status === 'passed') ? 0 : 1,
    };
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report)}\n`);
    return report;
};

const { values } = parseArgs({
    options: { browser: { type: 'string' }, suite: { type: 'string' } },
});
if (
    (values.browser !== 'chromium' && values.browser !== 'firefox')
    || !['delivery', 'engine', 'lifecycle', 'benchmark'].includes(values.suite ?? '')
) {
    throw new Error(
        'Usage: --browser chromium|firefox --suite delivery|engine|lifecycle|benchmark',
    );
}
const report = await runCanvasExtensionSuite(values.browser, values.suite as CanvasTestSuite);
console.info(JSON.stringify(report));
process.exitCode = report.exitCode;
