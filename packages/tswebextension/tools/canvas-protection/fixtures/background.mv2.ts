/* eslint-disable no-console -- Built fixture diagnostics remain local to the runner. */
import browser from 'webextension-polyfill';

import {
    type ConfigurationMV2,
    createTsWebExtension,
    type ProtectionPolicyArtifact,
    RequestEvents,
} from '@adguard/tswebextension';

import { FirefoxCanvasRegistration } from '../../../src/lib/mv2/background/canvas-registration';
import { createProtectAllPolicy } from '../../../test/lib/common/canvas-protection/fixtures/prepared-policies';
import { createPrivilegedReference } from '../engine.suite';
import { type CommandResult, type FixtureCommand } from '../fixture-server';

declare const canvasFixtureConfig: {
    readonly collector: string;
    readonly baseline: boolean;
    readonly mode: 'delivery' | 'engine';
};
const registration = new FirefoxCanvasRegistration();

const contextId = crypto.randomUUID();
const nativeEvents: unknown[] = [];
const nativeFlushes: Promise<void>[] = [];
const nativeRequests: { url: string; method: string; type: string }[] = [];
let nativeDelay = 0;
if (canvasFixtureConfig.mode === 'engine') {
    browser.webRequest.onBeforeRequest.addListener(
        (details) => {
            nativeRequests.push({ url: details.url, method: details.method, type: details.type });
            return undefined;
        },
        { urls: ['http://127.0.0.1/*', 'http://localhost/*', 'http://*.localhost/*'] },
    );
}

/**
 * Records actual extension registration API timing through the existing collector.
 *
 * @param event Native boundary name.
 * @param detail Seed-free operation metadata.
 */
const reportNativeEvent = (event: string, detail: unknown = null): void => {
    const value = {
        event,
        contextId,
        at: Date.now(),
        version: browser.runtime.getManifest().version,
        detail,
    };
    nativeEvents.push(value);
    nativeFlushes.push(
        fetch(canvasFixtureConfig.collector, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kind: 'command',
                id: `native-event:${contextId}:${nativeEvents.length}`,
                status: 'succeeded',
                value,
            }),
        }).then(() => undefined),
    );
};

/**
 * Observes real registration calls and optionally delays before their native invocation.
 *
 */
const observeNativeRegistration = (): void => {
    if (canvasFixtureConfig.mode !== 'engine') {
        return;
    }
    const namespace = browser.contentScripts;
    if (!namespace) {
        return;
    }
    (['register'] as const).forEach((method) => {
        const original = namespace[method].bind(namespace);
        namespace[method] = (async (...parameters: Parameters<typeof original>) => {
            reportNativeEvent(`${method}-requested`);
            if (nativeDelay) {
                await new Promise<void>((resolve) => {
                    setTimeout(resolve, nativeDelay);
                });
            }
            reportNativeEvent(`${method}-native-called`);
            const value = await original(...parameters);
            reportNativeEvent(`${method}-native-fulfilled`);
            return value;
        }) as (typeof namespace)[typeof method];
    });
};
observeNativeRegistration();
reportNativeEvent('background-started');
browser.runtime.onInstalled.addListener((details) => reportNativeEvent('native-runtime-installed', details));
browser.runtime.onStartup.addListener(() => reportNativeEvent('native-runtime-startup'));
window.addEventListener('unload', () => navigator.sendBeacon(
    canvasFixtureConfig.collector,
    JSON.stringify({
        kind: 'command',
        id: `native-event:${contextId}:unload`,
        status: 'succeeded',
        value: {
            event: 'background-unloaded',
            contextId,
            at: Date.now(),
            version: browser.runtime.getManifest().version,
        },
    }),
));

const consumer = canvasFixtureConfig.mode === 'engine' ? createTsWebExtension('resources') : undefined;
if (consumer) {
    RequestEvents.init();
    reportNativeEvent('built-request-events-initialized');
}
const consumerReady = (async (): Promise<void> => {
    if (consumer) {
        const fixtureStored = await browser.storage.local.get([
            'canvasBuiltConfiguration',
            'canvasFixtureAckDelay',
        ]);
        const stored = fixtureStored.canvasBuiltConfiguration as ConfigurationMV2 | undefined;
        nativeDelay = (fixtureStored.canvasFixtureAckDelay as number | undefined) ?? 0;
        reportNativeEvent('fixture-delay-hydrated', { delay: nativeDelay });
        await consumer.initStorage();
        if (stored) {
            await consumer.start(stored);
        }
    }
})();
consumerReady.catch((error) => console.error('Built consumer startup failed', error));

/**
 * Exercises the public built application from the privileged extension context.
 *
 * @param command Owned runner command.
 *
 * @returns Seed-free application and real session evidence.
 */
const executeConsumerCommand = async (command: FixtureCommand): Promise<CommandResult> => {
    await consumerReady;
    if (!consumer) {
        throw new Error('Built consumer command requires engine mode');
    }
    let value: unknown;
    if (command.operation === 'consumer-start' || command.operation === 'consumer-configure') {
        const configuration = command.configuration as unknown as ConfigurationMV2;
        await browser.storage.local.set({ canvasBuiltConfiguration: configuration });
        value = command.operation === 'consumer-start'
            ? await consumer.start(configuration)
            : await consumer.configure(configuration);
    } else if (command.operation === 'consumer-delay') {
        nativeDelay = command.delay!;
        await browser.storage.local.set({ canvasFixtureAckDelay: nativeDelay });
        value = { delay: command.delay, contextId };
    } else if (command.operation === 'consumer-diagnostics') {
        await Promise.all(nativeFlushes);
        value = { contextId, nativeEvents, nativeRequests };
    } else if (command.operation === 'consumer-stop') {
        await consumer.stop();
        value = consumer.getCanvasProtectionState();
    } else if (command.operation === 'consumer-enable') {
        value = await consumer.setCanvasProtectionEnabled(command.enabled!);
        const stored = await browser.storage.local.get('canvasBuiltConfiguration');
        const configuration = stored.canvasBuiltConfiguration as ConfigurationMV2;
        await browser.storage.local.set({
            canvasBuiltConfiguration: {
                ...configuration,
                settings: {
                    ...configuration.settings,
                    stealth: { ...configuration.settings.stealth, protectCanvas: command.enabled! },
                },
            },
        });
    } else if (command.operation === 'consumer-policy') {
        value = await consumer.setCanvasProtectionPolicy(
            command.policy as ProtectionPolicyArtifact,
        );
    } else if (command.operation === 'consumer-reconcile') {
        value = await consumer.reconcileCanvasProtection();
    } else if (command.operation === 'consumer-state') {
        value = consumer.getCanvasProtectionState();
    } else if (command.operation === 'consumer-oracle') {
        const data = await browser.storage.session.get(
            'tswebextension.canvasProtectionRequestedSnapshot',
        );
        const snapshot = data['tswebextension.canvasProtectionRequestedSnapshot'] as {
            session: { root: string; generation: string };
            policy: { revision: string };
        };
        value = {
            generation: snapshot.session.generation,
            revision: snapshot.policy.revision,
            pixels: createPrivilegedReference(
                snapshot.session,
                command.host!,
                command.pixels!,
                command.width!,
                command.height!,
            ),
        };
    } else if (command.operation === 'consumer-session') {
        const data = await browser.storage.session.get([
            'tswebextension.canvasProtectionSession',
            'tswebextension.canvasProtectionRequestedSnapshot',
            'tswebextension.canvasProtectionRegistration',
        ]);
        const current = data['tswebextension.canvasProtectionSession'] as
            | { generation: string }
            | undefined;
        const snapshot = data['tswebextension.canvasProtectionRequestedSnapshot'] as
            | {
                session: { generation: string };
                policy: { revision: string };
            }
            | undefined;
        value = {
            generation: current?.generation ?? null,
            snapshotGeneration: snapshot?.session.generation ?? null,
            snapshotRevision: snapshot?.policy.revision ?? null,
            state: consumer.getCanvasProtectionState(),
            acknowledged: data['tswebextension.canvasProtectionRegistration'],
            fixtureProbeRegistration: await registration.checkAvailability(),
            requested: (
                await browser.storage.local.get('tswebextension.canvasProtectionRequested')
            )['tswebextension.canvasProtectionRequested'],
        };
    } else {
        throw new Error(`Unknown built consumer operation: ${command.operation}`);
    }
    return {
        kind: 'command',
        id: command.id,
        status: 'succeeded',
        value: {
            result: value,
            acknowledgedAt: Date.now(),
            owner: {
                contextId,
                extensionId: browser.runtime.id,
                collector: canvasFixtureConfig.collector,
                version: browser.runtime.getManifest().version,
                mode: canvasFixtureConfig.mode,
            },
        },
    };
};

/**
 * Runs navigation and registration commands in the persistent extension page.
 *
 * @param command Command collected from the local fixture server.
 *
 * @returns Browser API evidence without page-world privilege exposure.
 */
const executeFixtureCommand = async (command: FixtureCommand): Promise<CommandResult> => {
    try {
        if (command.operation.startsWith('consumer-')) {
            return await executeConsumerCommand(command);
        }
        if (command.operation === 'availability') {
            return {
                kind: 'command',
                id: command.id,
                status: 'succeeded',
                value: {
                    extensionId: browser.runtime.id,
                    privateAllowed: await browser.extension.isAllowedIncognitoAccess(),
                    browserInfo: await browser.runtime.getBrowserInfo(),
                },
            };
        }
        if (command.operation === 'install' || command.operation === 'remove') {
            if (canvasFixtureConfig.baseline) {
                return { kind: 'command', id: command.id, status: 'baseline' };
            }
            if (command.operation === 'remove') {
                await registration.remove();
            } else {
                const policy = createProtectAllPolicy('firefox-mv2', command.id);
                await registration.install(command.code!, {
                    ...policy,
                    selectors: { matches: command.matches!, excludeMatches: [] },
                });
            }
            return { kind: 'command', id: command.id, status: 'succeeded' };
        }
        if (command.operation === 'navigate') {
            return {
                kind: 'command',
                id: command.id,
                status: 'succeeded',
                value: await browser.tabs.create({ url: command.url }),
            };
        }
        if (command.operation === 'private' || command.operation === 'window') {
            return {
                kind: 'command',
                id: command.id,
                status: 'succeeded',
                value: await browser.windows.create({
                    url: command.url,
                    incognito: command.operation === 'private',
                }),
            };
        }
        if (command.operation === 'close') {
            await browser.windows.remove(command.windowId!);
            return { kind: 'command', id: command.id, status: 'succeeded' };
        }
        if (command.operation === 'reload') {
            browser.runtime.reload();
            return { kind: 'command', id: command.id, status: 'succeeded' };
        }
        throw new Error(`Unsupported fixture operation: ${command.operation}`);
    } catch (error) {
        return {
            kind: 'command',
            id: command.id,
            status: 'failed',
            reason:
                error instanceof Error
                    ? `${error.name}: ${error.message}\n${error.stack}\nCause: ${String(error.cause)}`
                    : String(error),
        };
    }
};

/**
 * Collects one command at a time to keep registration operations ordered.
 *
 * @returns After the current command has been acknowledged.
 */
const poll = async (): Promise<void> => {
    try {
        const response = await fetch(
            canvasFixtureConfig.collector.replace('/results', '/commands'),
        );
        const command = (await response.json()) as FixtureCommand | null;
        if (command) {
            const result = await executeFixtureCommand(command);
            await fetch(canvasFixtureConfig.collector, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(result),
            });
        }
    } finally {
        setTimeout(poll, 100);
    }
};

poll();
