import { type Configuration, type ProtectionPolicyArtifact, TsWebExtension } from '@adguard/tswebextension/mv3';

/* eslint-disable no-console -- Fixture startup diagnostics belong to the runner output. */
import { ChromiumCanvasRegistration } from '../../../src/lib/mv3/background/canvas-registration';
import { RequestEvents } from '../../../src/lib/mv3/background/request/events/request-events';
import { createProtectAllPolicy } from '../../../test/lib/common/canvas-protection/fixtures/prepared-policies';
import { createPrivilegedReference } from '../engine.suite';
import { type CommandResult, type FixtureCommand } from '../fixture-server';

declare const canvasFixtureConfig: {
    readonly collector: string;
    readonly baseline: boolean;
    readonly mode: 'delivery' | 'engine';
    readonly restore?: {
        readonly code: string;
        readonly matches: readonly string[];
        readonly requested?: 'enable';
    };
};
const startedAt = Date.now();
const registration = new ChromiumCanvasRegistration();

const contextId = crypto.randomUUID();
const nativeEvents: unknown[] = [];
const nativeFlushes: Promise<void>[] = [];
let nativeDelay = 0;

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
        version: chrome.runtime.getManifest().version,
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
    const namespace = chrome.userScripts;
    if (!namespace) {
        return;
    }
    (['register', 'update', 'unregister'] as const).forEach((method) => {
        const original = namespace[method].bind(namespace);
        Object.defineProperty(namespace, method, {
            value: async (...parameters: unknown[]) => {
                reportNativeEvent(`${method}-requested`);
                if (nativeDelay) {
                    await new Promise<void>((resolve) => {
                        setTimeout(resolve, nativeDelay);
                    });
                }
                reportNativeEvent(`${method}-native-called`);
                const value = await Reflect.apply(original, namespace, parameters);
                reportNativeEvent(`${method}-native-fulfilled`);
                return value;
            },
        });
    });
};
observeNativeRegistration();
reportNativeEvent('background-started');
chrome.runtime.onInstalled.addListener((details) => reportNativeEvent('native-runtime-installed', details));
chrome.runtime.onStartup.addListener(() => reportNativeEvent('native-runtime-startup'));

const consumer = canvasFixtureConfig.mode === 'engine' ? new TsWebExtension('/resources') : undefined;
const consumerReady = (async (): Promise<void> => {
    if (consumer) {
        const fixtureStored = await chrome.storage.local.get([
            'canvasBuiltConfiguration',
            'canvasFixtureAckDelay',
        ]);
        const stored = fixtureStored.canvasBuiltConfiguration as Configuration | undefined;
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
        const configuration = command.configuration as unknown as Configuration;
        await chrome.storage.local.set({ canvasBuiltConfiguration: configuration });
        value = command.operation === 'consumer-start'
            ? await consumer.start(configuration)
            : await consumer.configure(configuration);
    } else if (command.operation === 'consumer-delay') {
        nativeDelay = command.delay!;
        await chrome.storage.local.set({ canvasFixtureAckDelay: nativeDelay });
        value = { delay: command.delay, contextId };
    } else if (command.operation === 'consumer-diagnostics') {
        await Promise.all(nativeFlushes);
        value = { contextId, nativeEvents };
    } else if (command.operation === 'consumer-stop') {
        await consumer.stop();
        value = consumer.getCanvasProtectionState();
    } else if (command.operation === 'consumer-enable') {
        value = await consumer.setCanvasProtectionEnabled(command.enabled!);
        const stored = await chrome.storage.local.get('canvasBuiltConfiguration');
        const configuration = stored.canvasBuiltConfiguration as Configuration;
        await chrome.storage.local.set({
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
        const data = await chrome.storage.session.get(
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
        const data = await chrome.storage.session.get([
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
            requested: (await chrome.storage.local.get('tswebextension.canvasProtectionRequested'))[
                'tswebextension.canvasProtectionRequested'
            ],
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
                extensionId: chrome.runtime.id,
                collector: canvasFixtureConfig.collector,
                version: chrome.runtime.getManifest().version,
                mode: canvasFixtureConfig.mode,
            },
        },
    };
};

/**
 * Executes privileged fixture commands without installing code from a page script.
 *
 * @param command Command from the local test runner.
 *
 * @returns The actual browser API outcome.
 */
export const executeFixtureCommand = async (command: FixtureCommand): Promise<CommandResult> => {
    try {
        if (command.operation.startsWith('consumer-')) {
            return await executeConsumerCommand(command);
        }
        if (command.operation === 'availability') {
            let availability: unknown;
            try {
                availability = {
                    status: 'available',
                    registrations: (await chrome.userScripts.getScripts()).map((script) => ({
                        id: script.id,
                        world: script.world,
                        runAt: script.runAt,
                        matches: script.matches,
                        allFrames: script.allFrames,
                    })),
                };
            } catch (error) {
                availability = {
                    status: 'unavailable',
                    reason:
                        error instanceof Error
                            ? `${error.name}: ${error.message}\n${error.stack}\nCause: ${String(error.cause)}`
                            : String(error),
                };
            }
            return {
                kind: 'command',
                id: command.id,
                status: 'succeeded',
                value: {
                    availability,
                    extensionId: chrome.runtime.id,
                    privateAllowed: await chrome.extension.isAllowedIncognitoAccess(),
                    userAgent: navigator.userAgent,
                    requested: (await chrome.storage.local.get('canvasFixtureRequested'))
                        .canvasFixtureRequested,
                },
            };
        }
        if (command.operation === 'install' || command.operation === 'remove') {
            if (canvasFixtureConfig.baseline) {
                return { kind: 'command', id: command.id, status: 'baseline' };
            }
            if (command.requested) {
                // Only seed-free user intent survives unavailable API access.
                await chrome.storage.local.set({
                    canvasFixtureRequested: {
                        gates: {
                            filteringEnabled: true,
                            stealthModeEnabled: true,
                            protectCanvas: command.requested !== 'disable',
                        },
                        exclusion: command.requested === 'exclude' ? '/excluded(?:\\?|$)' : null,
                    },
                });
            }
            if (command.operation === 'remove') {
                await registration.remove();
            } else {
                const policy = createProtectAllPolicy('chromium-mv3', command.id);
                await registration.install(command.code!, {
                    ...policy,
                    selectors: { matches: command.matches!, excludeMatches: [] },
                });
            }
            const acknowledgedAt = Date.now();
            const scripts = await chrome.userScripts.getScripts();
            return {
                kind: 'command',
                id: command.id,
                status: 'succeeded',
                value: {
                    acknowledgedAt,
                    currentCodeInstalled: scripts.some(
                        (script) => script.id === 'adguard-canvas-protection'
                            && script.js?.[0].code === command.code,
                    ),
                    requested: (await chrome.storage.local.get('canvasFixtureRequested'))
                        .canvasFixtureRequested,
                    registrations: scripts.map((script) => ({
                        id: script.id,
                        world: script.world,
                        runAt: script.runAt,
                        matches: script.matches,
                        allFrames: script.allFrames,
                    })),
                },
            };
        }
        if (command.operation === 'navigate') {
            return {
                kind: 'command',
                id: command.id,
                status: 'succeeded',
                value: await chrome.tabs.create({ url: command.url }),
            };
        }
        if (command.operation === 'private' || command.operation === 'window') {
            return {
                kind: 'command',
                id: command.id,
                status: 'succeeded',
                value: await chrome.windows.create({
                    url: command.url,
                    incognito: command.operation === 'private',
                }),
            };
        }
        if (command.operation === 'close') {
            await chrome.windows.remove(command.windowId!);
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
            value: {
                requested: (await chrome.storage.local.get('canvasFixtureRequested'))
                    .canvasFixtureRequested,
            },
        };
    }
};

// A fixture-only privileged entry point lets Playwright control the loaded worker.
Object.assign(globalThis, { executeFixtureCommand });
chrome.runtime.onMessage.addListener((command: FixtureCommand, _sender, respond): boolean => {
    executeFixtureCommand(command).then(respond);
    return true;
});
chrome.runtime.onStartup.addListener(() => console.info('Canvas fixture browser startup'));
chrome.runtime.onInstalled.addListener((details) => {
    console.info('Canvas fixture extension installed', details);
    if (canvasFixtureConfig.restore) {
        fetch(canvasFixtureConfig.collector, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                kind: 'command',
                id: 'update-installed',
                status: 'succeeded',
                value: {
                    details,
                    manifestVersion: chrome.runtime.getManifest().version,
                    at: Date.now(),
                },
            }),
        });
    }
});
/**
 * Initializes consumer request listeners and actual session access before registration.
 *
 * @returns After the autonomous fixture registration result has been collected.
 */
const restoreFixture = async (): Promise<void> => {
    RequestEvents.init();
    const sessionReadStartedAt = Date.now();
    await chrome.storage.session.get('canvasFixtureSession');
    const sessionReadAcknowledgedAt = Date.now();
    const result = await executeFixtureCommand({
        id: 'update-bootstrap',
        operation: 'install',
        ...canvasFixtureConfig.restore!,
    });
    await fetch(canvasFixtureConfig.collector, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...result,
            value: {
                result: result.value,
                startedAt,
                sessionReadStartedAt,
                sessionReadAcknowledgedAt,
                consumerEvents: true,
                sessionAwait: true,
                at: Date.now(),
            },
        }),
    });
};
if (canvasFixtureConfig.restore) {
    restoreFixture().catch((error) => fetch(canvasFixtureConfig.collector, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            kind: 'command',
            id: 'update-bootstrap',
            status: 'failed',
            reason:
                    error instanceof Error
                        ? `${error.name}: ${error.message}\n${error.stack}\nCause: ${String(error.cause)}`
                        : String(error),
            value: { startedAt, at: Date.now() },
        }),
    }));
}
console.info('Canvas fixture worker ready', canvasFixtureConfig.collector);
