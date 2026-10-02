/* eslint-disable no-console -- This CLI reports actual browser lifecycle observations. */
/* eslint-disable no-await-in-loop -- Browser lifecycle transitions must execute in order. */
import { strict as assert } from 'node:assert';
import { type ChildProcess, execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';
import { rollup } from 'rollup';

import { createDeliveryCode } from './build-extension';
import { assertFirstRead, type FirstReadResult, type SuiteCase } from './delivery.suite';

const packageDirectory = fileURLToPath(new URL('../../', import.meta.url));
const output = path.join(packageDirectory, 'output-canvas-protection/firefox-lifetime');
const executable = process.env.CANVAS_FIREFOX_LIFETIME_BINARY
    ?? path.join(output, 'Firefox Nightly.app/Contents/MacOS/firefox');
const extensionId = 'canvas-lifetime@tests.invalid';
const initialRevision = 'delivery-fixture';
const initialGeneration = '22222222222222222222222222222222';
const updatedRevision = 'delivery-update';
const updatedGeneration = '33333333333333333333333333333333';

/**
 * Required proofs for the permanent-addon registration architecture.
 */
const requiredCaseNames = [
    'consumer-session permanent install MAIN delivery',
    'Firefox cold startup restores early delivery',
    'Firefox new startup page receives early delivery',
    'Firefox reload restores early delivery',
    'Firefox update restores early delivery',
    'proves Firefox registering-page lifetime',
] as const;

/**
 * A background event records its own clock and registration context.
 */
interface Observation {
    readonly kind: string;
    readonly event?: string;
    readonly context?: string;
    readonly at?: number;
    readonly detail?: unknown;
    readonly phase: string;
    readonly receivedAt: number;
    readonly pixel?: readonly number[];
    readonly id?: string;
}

/**
 * The collector keeps startup page reads separate from extension startup events.
 */
interface Collector {
    readonly origin: string;
    readonly observations: Observation[];
    setPhase(value: string): void;
    command(operation: 'reload' | 'unload'): Promise<Observation>;
    wait(predicate: (value: Observation) => boolean): Promise<Observation>;
    close(): Promise<void>;
}

/**
 * An outstanding collector read resolves from the next matching fixture result.
 */
interface PendingObservation {
    readonly predicate: (value: Observation) => boolean;
    readonly resolve: (value: Observation) => void;
}

/**
 * Listens on an ephemeral loopback port.
 *
 * @param server Server to bind.
 *
 * @returns The assigned port.
 */
const listen = async (server: Server): Promise<number> => {
    await new Promise<void>((done, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', done);
    });
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    return address.port;
};

/**
 * Collects first inline reads and events across full browser restarts.
 *
 * @returns The collector and its bounded observation wait.
 */
const startCollector = async (): Promise<Collector> => {
    const firstPage = await readFile(
        new URL('./fixtures/first-read.html', import.meta.url),
        'utf8',
    );
    const observations: Observation[] = [];
    const commands: { readonly operation: 'reload' | 'unload' }[] = [];
    const pending = new Set<PendingObservation>();
    let phase = 'setup';
    let origin = '';
    const server = createServer(async (request, response) => {
        response.setHeader('Cache-Control', 'no-store');
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        if (request.method === 'OPTIONS') {
            response.writeHead(204).end();
            return;
        }
        if (request.method === 'POST') {
            let body = '';
            for await (const chunk of request) {
                body += chunk;
            }
            // All producers are fixture-owned; malformed fixture data fails loudly.
            const value = JSON.parse(body) as Omit<Observation, 'phase' | 'receivedAt'>;
            const observation = { ...value, phase, receivedAt: Date.now() };
            observations.push(observation);
            for (const consumer of pending) {
                if (consumer.predicate(observation)) {
                    pending.delete(consumer);
                    consumer.resolve(observation);
                }
            }
            response.writeHead(204).end();
            return;
        }
        const url = new URL(request.url ?? '/', origin);
        if (url.pathname === '/commands') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(commands.shift() ?? null));
            return;
        }
        response.setHeader('Content-Type', 'text/html');
        response.end(
            firstPage
                .replace(
                    '__CASE_ID__',
                    JSON.stringify(`${phase}:${url.searchParams.get('id') ?? 'page'}`),
                )
                .replace('__COLLECTOR__', JSON.stringify(`${origin}/results`)),
        );
    });
    origin = `http://127.0.0.1:${await listen(server)}`;
    /**
     * Resolves as soon as a fixture observation arrives without delaying browser operations.
     *
     * @param predicate Selects the required observation.
     *
     * @returns The existing or next matching result.
     */
    const wait = (predicate: (value: Observation) => boolean): Promise<Observation> => {
        const match = observations.find(predicate);
        if (match) {
            return Promise.resolve(match);
        }
        return new Promise((done, reject) => {
            let timeout: ReturnType<typeof setTimeout>;
            const consumer = {
                predicate,
                resolve: (value: Observation): void => {
                    clearTimeout(timeout);
                    done(value);
                },
            };
            timeout = setTimeout(() => {
                pending.delete(consumer);
                reject(new Error(`No matching lifecycle observation in ${phase}`));
            }, 15000);
            pending.add(consumer);
        });
    };
    return {
        origin,
        observations,
        setPhase: (value): void => {
            phase = value;
        },
        command: (operation): Promise<Observation> => {
            commands.push({ operation });
            return wait((value) => value.phase === phase && value.event === `command-${operation}`);
        },
        wait,
        close: (): Promise<void> => new Promise((done, reject) => {
            server.closeAllConnections();
            server.close((error) => {
                if (error) {
                    reject(error);
                } else {
                    done();
                }
            });
        }),
    };
};

/**
 * Builds a permanent extension using the selected production registration adapter.
 *
 * @param origin The local collector.
 * @param consumerEvents Whether to initialize the existing MV2 request event service.
 * @param version Extension version for an actual update.
 * @param sessionAwait Whether to read actual extension session storage before registration.
 *
 * @returns A packaged, unsigned developer extension.
 */
const buildExtension = async (
    origin: string,
    consumerEvents: boolean,
    version = '1.0.0',
    sessionAwait = false,
): Promise<string> => {
    const consumerMode = sessionAwait ? 'consumer-session' : 'consumer';
    const mode = consumerEvents ? consumerMode : 'minimal';
    const directory = path.join(output, `${mode}-${version}-extension`);
    await mkdir(directory, { recursive: true });
    const { code, snapshot } = await createDeliveryCode('firefox', {
        revision: version === '1.0.0' ? initialRevision : updatedRevision,
        generation: version === '1.0.0' ? initialGeneration : updatedGeneration,
    });
    const entry = path.join(output, `${mode}-${version}-background.ts`);
    await writeFile(
        entry,
        `
import browser from 'webextension-polyfill';
import { FirefoxCanvasRegistration } from ${JSON.stringify(
        path.join(packageDirectory, 'src/lib/mv2/background/canvas-registration'),
    )};
${
    consumerEvents
        ? `import { RequestEvents } from ${JSON.stringify(
            path.join(packageDirectory, 'src/lib/mv2/background/request/events/request-events'),
        )};`
        : ''
}
const context = crypto.randomUUID();
const report = (event, detail = null) => fetch(${JSON.stringify(`${origin}/events`)}, {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({kind: 'background', event, context, at: Date.now(), detail}),
});
report('background-started', {version: ${JSON.stringify(version)}, consumerEvents: ${consumerEvents},
    sessionAwait: ${sessionAwait}});
browser.runtime.onInstalled.addListener((detail) => report('installed', detail));
browser.runtime.onStartup.addListener(() => report('runtime-startup'));
addEventListener('unload', () => navigator.sendBeacon(${JSON.stringify(`${origin}/events`)},
    JSON.stringify({kind: 'background', event: 'unloaded', context, at: Date.now()})));
${consumerEvents ? 'RequestEvents.init();' : ''}
const registration = new FirefoxCanvasRegistration();
const install = async () => {
    ${
    sessionAwait
        ? `report('session-read-started');
    await browser.storage.session.get('canvasLifetimeFixture');
    report('session-read-acknowledged');`
        : ''
}
    report('register-started');
    await registration.install(${JSON.stringify(code)}, ${JSON.stringify(snapshot.policy)});
    await report('register-acknowledged', ${JSON.stringify({
        version,
        policyRevision: snapshot.policy.revision,
        capturedGeneration: snapshot.session.generation,
        requested: { gates: snapshot.gates, policyRevision: snapshot.policy.revision },
    })});
};
install().catch((error) => report('register-failed', String(error)));
const poll = async () => {
    const response = await fetch(${JSON.stringify(`${origin}/commands`)});
    const command = await response.json();
    if (command) {
        await report('command-' + command.operation);
        if (command.operation === 'unload') {
            location.replace('about:blank');
            return;
        }
        browser.runtime.reload();
        return;
    }
    setTimeout(poll, 100);
};
poll();
`,
    );
    const build = await rollup({
        input: entry,
        treeshake: { moduleSideEffects: false },
        plugins: [
            swc(),
            resolve({ browser: true, extensions: ['.js', '.json', '.ts'] }),
            commonjs(),
        ],
    });
    try {
        await build.write({ file: path.join(directory, 'background.js'), format: 'iife' });
    } finally {
        await build.close();
    }
    await writeFile(
        path.join(directory, 'manifest.json'),
        JSON.stringify({
            manifest_version: 2,
            name: 'Canvas persistent lifetime probe',
            version,
            permissions: [
                'storage',
                'tabs',
                'http://127.0.0.1/*',
                'http://localhost/*',
                ...(consumerEvents ? ['webRequest', 'webRequestBlocking', 'webNavigation'] : []),
            ],
            background: { scripts: ['background.js'], persistent: true },
            browser_specific_settings: { gecko: { id: extensionId, strict_min_version: '128.0' } },
        }),
    );
    const archive = path.join(output, `${mode}-${version}.xpi`);
    execFileSync('/usr/bin/zip', ['-q', '-j', archive, 'manifest.json', 'background.js'], {
        cwd: directory,
    });
    return archive;
};

/**
 * Owns one headless Firefox process and its WebDriver connection.
 */
export interface FirefoxProcess {
    readonly browser: ChildProcess;
    readonly session: string;
    readonly capabilities: unknown;
    readonly launch: {
        readonly arguments: readonly string[];
        readonly MOZ_HEADLESS: '1';
    };
    command(method: string, route: string, body?: unknown): Promise<unknown>;
    chromeScript(script: string, args?: readonly unknown[]): Promise<unknown>;
    close(): Promise<void>;
}

/**
 * Starts Firefox directly so WebDriver cannot rewrite startup preferences.
 *
 * @param profile Dedicated persistent developer profile.
 * @param url Optional page opened by the browser command line during startup.
 * @param options Owned launch overrides.
 * @param options.executable Optional existing Firefox executable.
 *
 * @returns Browser process and a connection established after ordinary startup.
 */
export const launchFirefox = async (
    profile: string,
    url?: string,
    options: { readonly executable?: string } = {},
): Promise<FirefoxProcess> => {
    const marionetteServer = createServer();
    const marionettePort = await listen(marionetteServer);
    await new Promise<void>((done) => {
        marionetteServer.close(() => done());
    });
    await writeFile(
        path.join(profile, 'user.js'),
        [
            ['marionette.port', marionettePort],
            ['remote.prefs.recommended', false],
            ['app.update.disabledForTesting', true],
            ['xpinstall.signatures.required', false],
            ['browser.startup.page', 3],
            ['browser.shell.checkDefaultBrowser', false],
            ['browser.startup.homepage_override.mstone', 'ignore'],
            ['startup.homepage_welcome_url', 'about:blank'],
            ['startup.homepage_welcome_url.additional', ''],
            ['browser.warnOnQuit', false],
        ]
            .map(([key, value]) => `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
            .join('\n'),
    );
    const args = [
        '-headless',
        '-no-remote',
        '-profile',
        profile,
        '-marionette',
        '-remote-allow-system-access',
        ...(url ? ['-url', url] : []),
    ];
    const browser = spawn(options.executable ?? executable, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, MOZ_HEADLESS: '1', MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' },
    });
    const browserFinished = new Promise<void>((done) => {
        browser.once('exit', () => done());
        browser.once('error', () => done());
    });
    browser.stdout.on('data', (value: Buffer) => console.error(value.toString().trimEnd()));
    browser.stderr.on('data', (value: Buffer) => console.error(value.toString().trimEnd()));
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
    const driverFinished = new Promise<void>((done) => {
        driver.once('exit', () => done());
        driver.once('error', () => done());
    });
    let driverOrigin = '';
    const driverReady = new Promise<void>((done, reject) => {
        const timer = setTimeout(() => reject(new Error('Geckodriver startup timed out')), 15000);
        driver.once('error', reject);
        browser.once('error', reject);
        driver.stdout.on('data', (value: Buffer) => {
            const line = value.toString();
            console.error(line.trimEnd());
            const port = /Listening on 127\.0\.0\.1:(\d+)/.exec(line)?.[1];
            if (port) {
                driverOrigin = `http://127.0.0.1:${port}`;
                clearTimeout(timer);
                done();
            }
        });
        driver.stderr.on('data', (value: Buffer) => console.error(value.toString().trimEnd()));
    });
    try {
        await driverReady;
        /**
         * Calls the local WebDriver server with a bounded transport timeout.
         *
         * @param method HTTP verb.
         * @param route WebDriver endpoint.
         * @param body Command parameters.
         *
         * @returns The WebDriver command result.
         *
         * @throws When the driver rejects the command or the transport times out.
         */
        const request = async (method: string, route: string, body?: unknown): Promise<unknown> => {
            const response = await fetch(`${driverOrigin}${route}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                ...(body === undefined ? {} : { body: JSON.stringify(body) }),
                signal: AbortSignal.timeout(30000),
            });
            const result = (await response.json()) as { value: unknown };
            if (!response.ok) {
                throw new Error(`WebDriver ${route}: ${JSON.stringify(result.value)}`);
            }
            return result.value;
        };
        const sessionResult = (await request('POST', '/session', {
            capabilities: { alwaysMatch: { browserName: 'firefox' } },
        })) as { sessionId: string; capabilities: unknown };
        assert.equal(
            (sessionResult.capabilities as { 'moz:headless': boolean })['moz:headless'],
            true,
        );
        const command = (method: string, route: string, body?: unknown): Promise<unknown> => {
            return request(method, `/session/${sessionResult.sessionId}${route}`, body);
        };
        /**
         * Runs extension-management diagnostics in Firefox's privileged application context.
         *
         * @param script Diagnostic script using the WebDriver completion callback.
         * @param scriptArgs Diagnostic arguments.
         *
         * @returns The diagnostic result.
         */
        const chromeScript = async (
            script: string,
            scriptArgs: readonly unknown[] = [],
        ): Promise<unknown> => {
            await command('POST', '/moz/context', { context: 'chrome' });
            try {
                return await command('POST', '/execute/async', { script, args: scriptArgs });
            } finally {
                await command('POST', '/moz/context', { context: 'content' });
            }
        };
        return {
            browser,
            session: sessionResult.sessionId,
            capabilities: sessionResult.capabilities,
            launch: { arguments: args, MOZ_HEADLESS: '1' },
            command,
            chromeScript,
            close: async (): Promise<void> => {
                try {
                    await command('POST', '/moz/context', { context: 'chrome' });
                    await command('POST', '/execute/sync', {
                        script: [
                            'setTimeout(() => Services.startup.quit(Ci.nsIAppStartup.eAttemptQuit), 0);',
                            'return true;',
                        ].join('\n'),
                        args: [],
                    });
                    await browserFinished;
                    assert.equal(
                        browser.exitCode,
                        0,
                        'Cold restart requires a clean browser shutdown',
                    );
                } finally {
                    if (browser.exitCode === null && browser.signalCode === null) {
                        browser.kill('SIGTERM');
                    }
                    driver.kill('SIGTERM');
                    await Promise.all([browserFinished, driverFinished]);
                }
            },
        };
    } catch (error) {
        if (browser.exitCode === null && browser.signalCode === null) {
            browser.kill('SIGTERM');
        }
        if (driver.exitCode === null && driver.signalCode === null) {
            driver.kill('SIGTERM');
        }
        await Promise.all([browserFinished, driverFinished]);
        throw error;
    }
};

/**
 * Checks that acknowledged delivery carries the intended fixture snapshot.
 *
 * @param result The page's first captured method and delivery metadata.
 * @param revision Expected policy revision.
 * @param generation Expected delivery-only generation identifier.
 */
const assertCurrentDelivery = (result: Observation, revision: string, generation: string): void => {
    const read = result as unknown as FirstReadResult;
    assertFirstRead(read, true);
    assert.equal(read.delivery?.policyRevision, revision);
    assert.equal(read.delivery?.capturedGeneration, generation);
    assert.equal(read.delivery?.outcome, 'enabled');
};

/**
 * Checks actual delivery without assigning a snapshot to an uninjected document.
 *
 * @param result The first inline read.
 * @param retainedRead The same document's captured method after acknowledgment.
 */
const assertRetainedCapture = (result: Observation, retainedRead: unknown): void => {
    const read = result as unknown as FirstReadResult;
    const native = read.pixel[0] === 16;
    assertFirstRead(read, !native);
    if (native) {
        assert.equal(read.delivery, null);
    } else {
        assert.equal(read.delivery?.outcome, 'enabled');
        assert.ok(read.delivery?.policyRevision);
        assert.ok(read.delivery?.capturedGeneration);
    }
    assert.deepEqual(retainedRead, read.pixel);
};

/**
 * Reads public addon-management state without replacing extension APIs.
 *
 * @param active The actual headless Firefox connection.
 * @param addonId Exact owned extension identifier.
 *
 * @returns Permanent-addon identity, activity and manifest version.
 */
export const readAddon = async (
    active: FirefoxProcess,
    addonId = extensionId,
): Promise<{
    readonly id: string;
    readonly version: string;
    readonly isActive: boolean;
    readonly temporarilyInstalled: boolean;
}> => active.chromeScript(
    `
    const done = arguments[arguments.length - 1];
    const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
    AddonManager.getAddonByID(arguments[0]).then((value) => done({
        id: value.id, version: value.version, isActive: value.isActive,
        temporarilyInstalled: value.temporarilyInstalled,
    }));
`,
    [addonId],
) as ReturnType<typeof readAddon>;

/**
 * Reads a replacement interval and verifies that earlier native captures remain native.
 *
 * @param active The running headless browser.
 * @param collector The fixture result collector.
 * @param phase Lifecycle operation being measured.
 * @param oldContext Context that owned the previous registration.
 * @param revision Replacement policy revision.
 * @param generation Replacement fixture generation identifier.
 *
 * @returns Real transition clocks and retained/reloaded/fresh document observations.
 */
const captureReplacement = async (
    active: FirefoxProcess,
    collector: Collector,
    phase: string,
    oldContext: string,
    revision: string,
    generation: string,
): Promise<{
    readonly during: Observation;
    readonly unloaded: Observation;
    readonly ack: Observation;
    readonly retainedRead: unknown;
    readonly reloaded: Observation;
    readonly fresh: Observation;
    readonly intervalExercised: boolean;
}> => {
    await active.command('POST', '/url', { url: `${collector.origin}/first-read?id=during` });
    const during = await collector.wait((item) => item.id === `${phase}:during`);
    const ack = await collector.wait(
        (item) => item.phase === phase && item.event === 'register-acknowledged',
    );
    const unloaded = await collector.wait(
        (item) => item.phase === phase && item.event === 'unloaded' && item.context === oldContext,
    );
    const retainedRead = await active.command('POST', '/execute/sync', {
        script: 'return window.canvasFixtureRead();',
        args: [],
    });
    await active.command('POST', '/refresh', {});
    const reloaded = await collector.wait(
        (item) => item.id === `${phase}:during` && item.receivedAt > during.receivedAt,
    );
    await active.command('POST', '/url', { url: `${collector.origin}/first-read?id=after-ack` });
    const fresh = await collector.wait((item) => item.id === `${phase}:after-ack`);
    assertCurrentDelivery(reloaded, revision, generation);
    assertCurrentDelivery(fresh, revision, generation);
    return {
        during,
        unloaded,
        ack,
        retainedRead,
        reloaded,
        fresh,
        intervalExercised: unloaded.at! <= during.at! && during.at! < ack.at!,
    };
};

/**
 * Mandatory permanent-addon results remain separate from deliberate minimal controls.
 */
export interface FirefoxLifetimeReport {
    readonly executable: string;
    readonly version: string;
    readonly buildID: string;
    readonly protocol: 'HTTP';
    readonly cases: readonly SuiteCase[];
    readonly diagnostics: readonly SuiteCase[];
    readonly observations: readonly Observation[];
    readonly launches: readonly unknown[];
    readonly reportPath: string;
    readonly runReportPath: string;
    readonly exitCode: number;
}

/**
 * Tests real permanent installation, cold startup, reload, update and background lifetime.
 *
 * @returns Structured observations; failed or unverified required cases produce a nonzero result.
 */
export const runFirefoxLifetimeProbe = async (): Promise<FirefoxLifetimeReport> => {
    await mkdir(output, { recursive: true });
    const collector = await startCollector();
    const cases: SuiteCase[] = [];
    const diagnostics: SuiteCase[] = [];
    const launches: {
        readonly phase: string;
        readonly launch: FirefoxProcess['launch'];
        readonly capabilities: unknown;
    }[] = [];
    const runDirectory = path.join(output, `run-${Date.now()}`);
    let active: FirefoxProcess | undefined;
    /**
     * Records observable assertions while keeping diagnostic controls out of completion gates.
     *
     * @param name Named behavior.
     * @param evidence Actual clocks, readouts and browser identity.
     * @param verify Assertions against observed behavior.
     * @param mandatory Whether the case is a required supported-consumer proof.
     * @param intervalExercised Whether the required interval and native-capture control were exercised.
     * @param unverifiedReason Explains which required observation is missing.
     */
    const record = (
        name: string,
        evidence: unknown,
        verify: () => void,
        mandatory = true,
        intervalExercised = true,
        unverifiedReason = 'First read missed the context unload to replacement acknowledgment interval',
    ): void => {
        let result: SuiteCase;
        try {
            verify();
            result = {
                name,
                status: intervalExercised ? 'passed' : 'unverified',
                reason: intervalExercised
                    ? 'Actual browser observations satisfy the applicable delivery contract'
                    : unverifiedReason,
                evidence,
            };
        } catch (error) {
            result = {
                name,
                status: 'failed',
                reason: String(error),
                evidence,
            };
        }
        (mandatory ? cases : diagnostics).push(result);
    };
    try {
        for (const mode of ['minimal', 'consumer', 'consumer-session']) {
            const consumerEvents = mode !== 'minimal';
            const mandatory = mode === 'consumer-session';
            const profile = path.join(runDirectory, `${mode}-profile`);
            await mkdir(profile, { recursive: true });
            const sessionAwait = mode === 'consumer-session';
            const archive = await buildExtension(
                collector.origin,
                consumerEvents,
                '1.0.0',
                sessionAwait,
            );
            collector.setPhase(`${mode}-install`);
            active = await launchFirefox(profile);
            launches.push({
                phase: `${mode}-install`,
                launch: active.launch,
                capabilities: active.capabilities,
            });
            const installed = await active.command('POST', '/moz/addon/install', {
                path: archive,
                temporary: false,
            });
            assert.equal(installed, extensionId);
            const installation = await collector.wait(
                (item) => item.phase === `${mode}-install` && item.event === 'installed',
            );
            await collector.wait(
                (item) => item.phase === `${mode}-install` && item.event === 'register-acknowledged',
            );
            await active.command('POST', '/url', {
                url: `${collector.origin}/first-read?id=installed`,
            });
            const installedRead = await collector.wait(
                (item) => item.id === `${mode}-install:installed`,
            );
            const installedAddon = await readAddon(active);
            record(
                `${mode} permanent install MAIN delivery`,
                {
                    executable,
                    installation,
                    installedRead,
                    addon: installedAddon,
                    capabilities: active.capabilities,
                    launch: active.launch,
                    profile,
                },
                () => {
                    assert.equal((installation.detail as { temporary: boolean }).temporary, false);
                    assert.equal(installedAddon.temporarilyInstalled, false);
                    assert.equal(installedAddon.version, '1.0.0');
                    assertCurrentDelivery(installedRead, initialRevision, initialGeneration);
                },
                mandatory,
            );
            await active.close();
            active = undefined;
            collector.setPhase(`${mode}-cold-startup`);
            active = await launchFirefox(profile);
            launches.push({
                phase: `${mode}-cold-startup`,
                launch: active.launch,
                capabilities: active.capabilities,
            });
            const startup = await collector.wait(
                (item) => item.phase === `${mode}-cold-startup` && item.event === 'runtime-startup',
            );
            const restoredRead = await collector.wait(
                (item) => item.id === `${mode}-cold-startup:installed`,
            );
            const ack = await collector.wait(
                (item) => item.phase === `${mode}-cold-startup` && item.event === 'register-acknowledged',
            );
            await active.command('POST', '/url', {
                url: `${collector.origin}/first-read?id=after-ack`,
            });
            const afterAck = await collector.wait(
                (item) => item.id === `${mode}-cold-startup:after-ack`,
            );
            record(
                mandatory
                    ? 'Firefox cold startup restores early delivery'
                    : `${mode} Firefox cold startup restores early delivery`,
                {
                    executable,
                    startup,
                    ack,
                    restoredRead,
                    afterAck,
                    capabilities: active.capabilities,
                    launch: active.launch,
                    profile,
                },
                () => {
                    assertCurrentDelivery(restoredRead, initialRevision, initialGeneration);
                    assertCurrentDelivery(afterAck, initialRevision, initialGeneration);
                    assert.equal(startup.context, ack.context);
                },
                mandatory,
            );
            await active.close();
            active = undefined;
            if (mandatory) {
                collector.setPhase(`${mode}-command-line-startup`);
                active = await launchFirefox(
                    profile,
                    `${collector.origin}/first-read?id=command-line`,
                );
                launches.push({
                    phase: `${mode}-command-line-startup`,
                    launch: active.launch,
                    capabilities: active.capabilities,
                });
                const commandLineRead = await collector.wait(
                    (item) => item.id === `${mode}-command-line-startup:command-line`,
                );
                const commandLineAck = await collector.wait(
                    (item) => item.phase === `${mode}-command-line-startup`
                        && item.event === 'register-acknowledged',
                );
                const commandLineStartup = await collector.wait(
                    (item) => item.phase === `${mode}-command-line-startup`
                        && item.event === 'runtime-startup',
                );
                record(
                    'Firefox new startup page receives early delivery',
                    {
                        executable,
                        commandLineRead,
                        commandLineAck,
                        commandLineStartup,
                        capabilities: active.capabilities,
                        launch: active.launch,
                        profile,
                    },
                    () => {
                        assertCurrentDelivery(commandLineRead, initialRevision, initialGeneration);
                    },
                );

                collector.setPhase('consumer-reload');
                const reloadRequested = await collector.command('reload');
                const reload = await captureReplacement(
                    active,
                    collector,
                    'consumer-reload',
                    reloadRequested.context!,
                    initialRevision,
                    initialGeneration,
                );
                record(
                    'Firefox reload restores early delivery',
                    {
                        executable,
                        reloadRequested,
                        ...reload,
                        capabilities: active.capabilities,
                        launch: active.launch,
                        profile,
                    },
                    () => {
                        assertRetainedCapture(reload.during, reload.retainedRead);
                        assert.equal(reload.ack.context === reloadRequested.context, false);
                    },
                    true,
                    reload.intervalExercised && reload.during.pixel?.[0] === 16,
                    reload.intervalExercised
                        ? 'A native first-read capture was not observed inside the replacement interval'
                        : 'First read missed the context unload to replacement acknowledgment interval',
                );

                const updateArchive = await buildExtension(collector.origin, true, '1.0.1', true);
                collector.setPhase('consumer-update');
                const updateRequested = await active.chromeScript(
                    `
                    const done = arguments[arguments.length - 1];
                    const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
                    const { FileUtils } = ChromeUtils.importESModule('resource://gre/modules/FileUtils.sys.mjs');
                    AddonManager.getInstallForFile(new FileUtils.File(arguments[0]), null,
                        {source: 'internal'}).then((install) => {
                        install.install().catch((error) => fetch(arguments[1], {
                            method: 'POST', headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({kind: 'management', event: 'update-failed',
                                at: Date.now(), detail: String(error)}),
                        }));
                        done({requestedAt: Date.now(), path: arguments[0]});
                    }, (error) => done({error: String(error)}));
                `,
                    [updateArchive, `${collector.origin}/events`],
                );
                await collector.wait(
                    (item) => item.phase === 'consumer-update'
                        && item.event === 'unloaded'
                        && item.context === reload.ack.context,
                );
                const update = await captureReplacement(
                    active,
                    collector,
                    'consumer-update',
                    reload.ack.context!,
                    updatedRevision,
                    updatedGeneration,
                );
                const updateInstalled = await collector.wait(
                    (item) => item.phase === 'consumer-update' && item.event === 'installed',
                );
                const updateAddon = await readAddon(active);
                record(
                    'Firefox update restores early delivery',
                    {
                        executable,
                        updateRequested,
                        updateInstalled,
                        addon: updateAddon,
                        archive: updateArchive,
                        ...update,
                        capabilities: active.capabilities,
                        launch: active.launch,
                        profile,
                    },
                    () => {
                        const detail = updateInstalled.detail as {
                            reason: string;
                            previousVersion: string;
                        };
                        assert.equal(detail.reason, 'update');
                        assert.equal(detail.previousVersion, '1.0.0');
                        assert.equal(updateAddon.id, extensionId);
                        assert.equal(updateAddon.version, '1.0.1');
                        assert.equal(updateAddon.isActive, true);
                        assert.equal(updateAddon.temporarilyInstalled, false);
                        assertRetainedCapture(update.during, update.retainedRead);
                        const acknowledged = update.ack.detail as {
                            version: string;
                            policyRevision: string;
                            capturedGeneration: string;
                        };
                        assert.equal(acknowledged.version, '1.0.1');
                        assert.equal(acknowledged.policyRevision, updatedRevision);
                        assert.equal(acknowledged.capturedGeneration, updatedGeneration);
                    },
                    true,
                    update.intervalExercised && update.during.pixel?.[0] === 16,
                    update.intervalExercised
                        ? 'A native first-read capture was not observed inside the replacement interval'
                        : 'First read missed the context unload to replacement acknowledgment interval',
                );

                collector.setPhase('consumer-unload');
                const unloadRequested = await collector.command('unload');
                const unloaded = await collector.wait(
                    (item) => item.phase === 'consumer-unload'
                        && item.event === 'unloaded'
                        && item.context === unloadRequested.context,
                );
                await active.command('POST', '/url', {
                    url: `${collector.origin}/first-read?id=after-unload`,
                });
                const afterUnload = await collector.wait(
                    (item) => item.id === 'consumer-unload:after-unload',
                );
                const addon = await readAddon(active);
                const recovery = (await active.chromeScript(
                    `
                    const done = arguments[arguments.length - 1];
                    const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
                    AddonManager.getAddonByID(arguments[0]).then(async (value) => {
                        const operation = {operation: 'AddonManager.addon.reload', id: value.id,
                            version: value.version, requestedAt: Date.now()};
                        try {
                            await value.reload();
                            done({...operation, completedAt: Date.now()});
                        } catch (error) {
                            done({...operation, error: String(error)});
                        }
                    });
                `,
                    [extensionId],
                )) as {
                    readonly operation: string;
                    readonly id: string;
                    readonly version: string;
                    readonly requestedAt: number;
                    readonly completedAt?: number;
                    readonly error?: string;
                };
                assert.equal(recovery.error, undefined);
                const recoveryStarted = await collector.wait(
                    (item) => item.phase === 'consumer-unload'
                        && item.event === 'background-started'
                        && item.context !== unloaded.context,
                );
                const recoveryAck = await collector.wait(
                    (item) => item.phase === 'consumer-unload'
                        && item.event === 'register-acknowledged'
                        && item.context === recoveryStarted.context,
                );
                const recoverySessionStarted = await collector.wait(
                    (item) => item.phase === 'consumer-unload'
                        && item.event === 'session-read-started'
                        && item.context === recoveryStarted.context,
                );
                const recoverySessionAcknowledged = await collector.wait(
                    (item) => item.phase === 'consumer-unload'
                        && item.event === 'session-read-acknowledged'
                        && item.context === recoveryStarted.context,
                );
                const retainedAfterRecovery = await active.command('POST', '/execute/sync', {
                    script: 'return window.canvasFixtureRead();',
                    args: [],
                });
                await active.command('POST', '/refresh', {});
                const reloadedAfterRecovery = await collector.wait(
                    (item) => item.id === 'consumer-unload:after-unload'
                        && item.receivedAt > afterUnload.receivedAt,
                );
                await active.command('POST', '/url', {
                    url: `${collector.origin}/first-read?id=after-recovery-ack`,
                });
                const freshAfterRecovery = await collector.wait(
                    (item) => item.id === 'consumer-unload:after-recovery-ack',
                );
                const recoveredAddon = await readAddon(active);
                record(
                    'proves Firefox registering-page lifetime',
                    {
                        executable,
                        unloadRequested,
                        unloaded,
                        afterUnload,
                        addon,
                        recovery,
                        recoveryStarted,
                        recoverySessionStarted,
                        recoverySessionAcknowledged,
                        recoveryAck,
                        retainedAfterRecovery,
                        reloadedAfterRecovery,
                        freshAfterRecovery,
                        recoveredAddon,
                        closedInterval: {
                            removedAt: unloaded.at,
                            firstReadAt: afterUnload.at,
                            replacementAcknowledgedAt: recoveryAck.at,
                            previousOwner: unloaded.context,
                            replacementOwner: recoveryAck.context,
                        },
                        capabilities: active.capabilities,
                        launch: active.launch,
                        profile,
                    },
                    () => {
                        assertFirstRead(afterUnload as unknown as FirstReadResult, false);
                        assert.equal((afterUnload as unknown as FirstReadResult).delivery, null);
                        assert.equal(addon.isActive, true);
                        assert.equal(addon.temporarilyInstalled, false);
                        assert.equal(unloaded.context, update.ack.context);
                        assert.equal(recovery.operation, 'AddonManager.addon.reload');
                        assert.equal(recovery.id, extensionId);
                        assert.equal(recovery.version, '1.0.1');
                        assert.ok(recovery.completedAt);
                        assert.equal(recoveryStarted.context === unloaded.context, false);
                        const started = recoveryStarted.detail as {
                            consumerEvents: boolean;
                            sessionAwait: boolean;
                        };
                        assert.equal(started.consumerEvents, true);
                        assert.equal(started.sessionAwait, true);
                        assert.ok(
                            unloaded.at! <= afterUnload.at! && afterUnload.at! < recoveryAck.at!,
                        );
                        assert.ok(afterUnload.at! <= recovery.requestedAt);
                        assert.ok(
                            recoverySessionStarted.at! <= recoverySessionAcknowledged.at!
                                && recoverySessionAcknowledged.at! <= recoveryAck.at!,
                        );
                        const acknowledged = recoveryAck.detail as {
                            policyRevision: string;
                            capturedGeneration: string;
                        };
                        assert.equal(acknowledged.policyRevision, updatedRevision);
                        assert.equal(acknowledged.capturedGeneration, updatedGeneration);
                        assertRetainedCapture(afterUnload, retainedAfterRecovery);
                        assertCurrentDelivery(
                            reloadedAfterRecovery,
                            updatedRevision,
                            updatedGeneration,
                        );
                        assertCurrentDelivery(
                            freshAfterRecovery,
                            updatedRevision,
                            updatedGeneration,
                        );
                        assert.equal(recoveredAddon.isActive, true);
                        assert.equal(recoveredAddon.temporarilyInstalled, false);
                        assert.equal(recoveredAddon.version, '1.0.1');
                    },
                );
                await active.close();
                active = undefined;
            }
        }
    } catch (error) {
        console.error(error);
        cases.push({ name: 'Firefox lifetime runner', status: 'failed', reason: String(error) });
    } finally {
        try {
            await active?.close();
        } catch (error) {
            cases.push({
                name: 'Firefox process cleanup',
                status: 'failed',
                reason: String(error),
            });
        }
        await collector.close();
    }
    for (const name of requiredCaseNames) {
        if (!cases.some((item) => item.name === name)) {
            cases.push({
                name,
                status: 'unverified',
                reason: 'Required permanent-addon behavior was not exercised',
            });
        }
    }
    const capabilities = launches[0]?.capabilities as
        | { browserVersion?: string; 'moz:buildID'?: string }
        | undefined;
    const report: FirefoxLifetimeReport = {
        executable,
        version: capabilities?.browserVersion ?? 'unavailable',
        buildID: capabilities?.['moz:buildID'] ?? 'unavailable',
        protocol: 'HTTP',
        cases,
        diagnostics,
        observations: collector.observations,
        launches,
        reportPath: path.join(output, 'amended-report.json'),
        runReportPath: path.join(runDirectory, 'report.json'),
        exitCode: cases.every((item) => item.status === 'passed') ? 0 : 1,
    };
    await writeFile(report.reportPath, `${JSON.stringify(report, null, 2)}\n`);
    await writeFile(report.runReportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const report = await runFirefoxLifetimeProbe();
    console.info(JSON.stringify(report, null, 2));
    process.exitCode = report.exitCode;
}
