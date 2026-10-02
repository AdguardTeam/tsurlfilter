/* eslint-disable no-await-in-loop -- Browser lifecycle transitions are deliberately serialized. */
import { strict as assert } from 'node:assert';

import { type BuiltSuiteContext, type FirstReadResult } from './delivery.suite';
import { createBuiltConfiguration } from './engine.suite';

/**
 * Mandatory lifecycle evidence cannot silently disappear after a partial run.
 */
export const lifecycleCaseNames = [
    'preserves scope across tabs frames windows and worker restarts',
    'captures old generation before replacement and current generation afterward',
    'reconciles revocation restoration and extension update',
    'records lifecycle registration loss and enforces acknowledged reinstall',
] as const;

/**
 * Checks current generation against actual first-inline output without a page marker.
 *
 * @param context Privileged built-consumer transport.
 * @param observation Actual fixture result.
 * @param id Independent oracle command identifier.
 *
 * @returns The seed-free generation/revision whose independent bitmap matches.
 */
export const verifyCapturedScope = async (
    context: BuiltSuiteContext,
    observation: FirstReadResult,
    id: string,
): Promise<{ readonly generation: string; readonly revision: string }> => {
    const pixels = Array.from({ length: 64 * 64 * 4 }, (_value, offset) => {
        return offset % 4 === 3 ? 255 : (Math.floor(offset / 4) * [7, 31, 3][offset % 4]) & 255;
    });
    const result = await context.command({
        id,
        operation: 'consumer-oracle',
        host: new URL(observation.url).hostname,
        pixels,
        width: 64,
        height: 64,
    });
    assert.equal(result.status, 'succeeded', JSON.stringify(result));
    const expected = (
        result.value as {
            result: {
                generation: string;
                revision: string;
                pixels: readonly number[];
            };
        }
    ).result;
    assert.equal(observation.engine!.outcome, 'installed');
    assert.deepEqual(observation.engine!.failures, []);
    assert.deepEqual(observation.engine!.pixels, expected.pixels);
    return { generation: expected.generation, revision: expected.revision };
};

/**
 * Checks persisted disabled and exact excluded decisions across actual restart boundaries.
 *
 * @param context Privileged built-consumer transport.
 * @param transition Native extension replacement or ordinary Firefox cold startup.
 */
const verifyRestartDecisions = async (
    context: BuiltSuiteContext,
    transition: 'replacement' | 'cold-start',
): Promise<void> => {
    for (const mode of ['disabled', 'excluded'] as const) {
        const id = `${transition}-${mode}`;
        const targetId = `${id}-target`;
        let evidence: Record<string, unknown> = {};
        try {
            const configuration = createBuiltConfiguration(context.browser, mode !== 'disabled', id);
            const policy = configuration.canvasProtectionPolicy as Record<string, unknown>;
            if (mode === 'excluded') {
                policy.ownFrameExclusions = [{
                    requestTypes: ['document', 'subdocument'],
                    condition: {
                        type: 'url-regexp', input: 'frame-url', pattern: `[?&]id=${targetId}(?:&|$)`, flags: '',
                    },
                }];
            }
            const setup = await context.command({ id: `${id}-setup`, operation: 'consumer-configure', configuration });
            assert.equal(setup.status, 'succeeded', JSON.stringify(setup));
            const before = await context.command({ id: `${id}-before`, operation: 'consumer-session' });
            const changed = transition === 'cold-start'
                ? await context.restartBrowser(`${context.origin}/engine?id=${targetId}`)
                : await context.replaceExtension(mode === 'disabled' ? '1.0.2' : '1.0.3');
            const first = (changed as { startup?: FirstReadResult; first?: FirstReadResult }).startup
                ?? (changed as { first: FirstReadResult }).first;
            const acknowledged = await context.command({ id: `${id}-ack`, operation: 'consumer-diagnostics' });
            assert.equal(acknowledged.status, 'succeeded', JSON.stringify(acknowledged));
            const saved = await context.command({ id: `${id}-saved`, operation: 'consumer-session' });
            const state = (saved.value as { result: {
                requested: unknown; generation: string | null; state: { status: string };
            }; }).result;
            assert.deepEqual(state.requested, {
                gates: { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: mode !== 'disabled' },
                policy,
            });
            assert.equal(state.state.status, mode === 'disabled' ? 'disabled' : 'installed');
            assert.notEqual(state.generation, (before.value as { result: { generation: string } }).result.generation);
            const retained = await context.evaluate<readonly number[]>(context.browser === 'chromium'
                ? 'window.canvasFixtureRead()' : 'return window.canvasFixtureRead();');
            assert.deepEqual(retained, first.engine!.pixels);
            const reloaded = await context.reloadPage();
            if (mode === 'disabled' || transition === 'cold-start') {
                assert.equal(reloaded.engine!.hash, reloaded.engine!.nativeHash);
            } else {
                await verifyCapturedScope(context, reloaded, `${id}-reloaded-oracle`);
            }
            const target = await context.read(targetId);
            evidence = {
                setup, before, changed, first, acknowledged, saved, retained, reloaded, target,
            };
            assert.equal(target.engine!.hash, target.engine!.nativeHash);
            assert.deepEqual(target.engine!.failures, []);
            const positive = mode === 'excluded' ? await context.read(`${id}-positive`) : undefined;
            evidence.positive = positive;
            const scope = positive ? await verifyCapturedScope(context, positive, `${id}-positive-oracle`) : undefined;
            if (scope) {
                assert.equal(scope.revision, id);
                assert.equal(scope.generation, state.generation);
                const previousGeneration = (before.value as { result: { generation: string } }).result.generation;
                assert.notEqual(scope.generation, previousGeneration);
            }
            context.cases.push({
                name: `current ${mode} decision after ${transition}`,
                status: 'passed',
                reason: 'Persisted request, actual acknowledgment and exact fresh-document decision',
                evidence: {
                    setup, before, changed, first, acknowledged, saved, retained, reloaded, target, positive, scope,
                },
            });
        } catch (error) {
            context.cases.push({
                name: `current ${mode} decision after ${transition}`,
                status: 'failed',
                reason: String(error),
                evidence: { ...evidence, nativeEvents: [...context.events] },
            });
        }
    }
};

/**
 * Executes real window, worker, full-shutdown and registration-access transitions.
 *
 * @param context Actual loaded built-consumer transport.
 *
 * @returns Completion after mandatory lifecycle contracts.
 */
export const runLifecycleSuite = async (context: BuiltSuiteContext): Promise<void> => {
    const start = await context.command({
        id: 'lifecycle-start',
        operation: 'consumer-start',
        configuration: createBuiltConfiguration(context.browser, true, 'lifecycle-initial'),
    });
    assert.equal(start.status, 'succeeded', JSON.stringify(start));
    const first = await context.read('lifecycle-first');
    const original = await verifyCapturedScope(context, first, 'lifecycle-first-oracle');
    const disabled = await context.command({
        id: 'scope-disable', operation: 'consumer-enable', enabled: false,
    });
    assert.equal((disabled.value as { result: { status: string } }).result.status, 'disabled');
    const retainedDuringDisable = await context.evaluate<readonly number[]>(context.browser === 'chromium'
        ? 'window.canvasFixtureRead()' : 'return window.canvasFixtureRead();');
    assert.deepEqual(retainedDuringDisable, first.engine!.pixels);
    const nativeDuringDisable = await context.read('scope-disabled-native');
    assert.equal(nativeDuringDisable.engine!.hash, nativeDuringDisable.engine!.nativeHash);
    const reenabled = await context.command({ id: 'scope-reenable', operation: 'consumer-enable', enabled: true });
    assert.equal((reenabled.value as { result: { status: string } }).result.status, 'installed');
    const afterReenable = await context.read('scope-reenabled');
    const reenabledScope = await verifyCapturedScope(context, afterReenable, 'scope-reenabled-oracle');
    assert.equal(reenabledScope.generation, original.generation);
    assert.deepEqual(afterReenable.engine!.pixels, first.engine!.pixels);
    const revised = await context.command({
        id: 'scope-policy-revision',
        operation: 'consumer-configure',
        configuration: createBuiltConfiguration(context.browser, true, 'lifecycle-policy-updated'),
    });
    assert.equal(revised.status, 'succeeded', JSON.stringify(revised));
    const afterPolicy = await context.read('scope-policy-updated');
    const revisedScope = await verifyCapturedScope(context, afterPolicy, 'scope-policy-updated-oracle');
    assert.equal(revisedScope.generation, original.generation);
    assert.equal(revisedScope.revision, 'lifecycle-policy-updated');
    assert.deepEqual(afterPolicy.engine!.pixels, first.engine!.pixels);
    context.cases.push({
        name: 'retains session scope across settings and policy updates',
        status: 'passed',
        reason: 'Public configuration changes retain exact protected output and generation across fresh documents',
        evidence: {
            original,
            disabled,
            retainedDuringDisable,
            nativeDuringDisable,
            reenabled,
            afterReenable,
            reenabledScope,
            revised,
            afterPolicy,
            revisedScope,
        },
    });
    const frames = [];
    for (const host of ['127.0.0.1', 'site-1.localhost']) {
        const frame = await context.read(`lifecycle-frame-${host}`, {
            route: '/engine-frame',
            host,
        });
        assert.equal(frame.engine!.hash, first.engine!.hash);
        frames.push({
            topHost: host,
            capturedTopGeneration: 'unavailable',
            capturedTopRevision: 'unavailable',
            frame,
        });
    }
    const second = await context.read('lifecycle-second');
    assert.equal(second.engine!.hash, first.engine!.hash);
    const normal = await context.openWindow('lifecycle-normal-window', false);
    assert.equal((normal.command.value as { incognito: boolean }).incognito, false);
    assert.equal(normal.observation.engine!.hash, first.engine!.hash);
    let privateWindow: Awaited<ReturnType<BuiltSuiteContext['openWindow']>> | undefined;
    let privateVerified = false;
    try {
        privateWindow = await context.openWindow('lifecycle-private-window', true);
        assert.equal((privateWindow.command.value as { incognito: boolean }).incognito, true);
        assert.equal(privateWindow.observation.engine!.hash, first.engine!.hash);
        privateVerified = true;
    } catch (error) {
        context.cases.push({
            name: 'actual private window scope',
            status: 'failed',
            reason: String(error),
            evidence: { normal, privateWindow },
        });
    }
    for (const opened of [normal, ...(privateWindow ? [privateWindow] : [])]) {
        await context.command({
            id: `close-${opened.observation.id}`,
            operation: 'close',
            windowId: (opened.command.value as { id: number }).id,
        });
    }
    const afterClose = await context.read('lifecycle-after-window-close');
    assert.equal(afterClose.engine!.hash, first.engine!.hash);
    const afterCloseScope = await verifyCapturedScope(
        context,
        afterClose,
        'lifecycle-close-oracle',
    );
    assert.equal(afterCloseScope.generation, original.generation);
    let worker: unknown;
    if (context.browser === 'chromium') {
        worker = await context.stopWorker();
        const stopped = await context.read('lifecycle-worker-stopped');
        assert.equal(stopped.engine!.hash, first.engine!.hash);
        const resumed = await verifyCapturedScope(context, stopped, 'lifecycle-wake-oracle');
        assert.equal(resumed.generation, original.generation);
        worker = { transition: worker, stopped, resumed };
    }
    context.cases.push({
        name: lifecycleCaseNames[0],
        status: privateVerified ? 'passed' : 'unverified',
        reason: 'Actual normal/private window metadata, exact shared output, closure and applicable worker stop/wake',
        evidence: {
            start,
            first,
            original,
            frames,
            normal,
            privateWindow,
            afterClose,
            afterCloseScope,
            worker,
        },
    });
    try {
        const restart = await context.restartBrowser(
            `${context.origin}/engine?id=lifecycle-startup`,
        );
        const { startup } = restart as { startup: FirstReadResult };
        const acknowledgedStartup = await context.command({
            id: 'startup-ack-diagnostics', operation: 'consumer-diagnostics',
        });
        const retained = await context.evaluate<readonly number[]>(
            context.browser === 'chromium' ? 'window.canvasFixtureRead()' : 'return window.canvasFixtureRead();',
        );
        assert.deepEqual(retained, startup.engine!.pixels);
        const reloaded = await context.reloadPage();
        const reloadedScope = await verifyCapturedScope(context, reloaded, 'startup-reloaded-oracle');
        const current = await context.read('lifecycle-restarted-postack');
        const currentScope = await verifyCapturedScope(context, current, 'lifecycle-postack-oracle');
        const currentSession = await context.command({ id: 'startup-session-readback', operation: 'consumer-session' });
        assert.equal(currentScope.generation, reloadedScope.generation);
        assert.notEqual(currentScope.generation, original.generation);
        assert.notEqual(current.engine!.hash, first.engine!.hash);
        assert.deepEqual(startup.engine!.failures, []);
        const startupMatchesPrior = JSON.stringify(startup.engine!.pixels) === JSON.stringify(first.engine!.pixels);
        const startupMatchesCurrent = JSON.stringify(startup.engine!.pixels) === JSON.stringify(current.engine!.pixels);
        let coldBoundary: unknown;
        if (context.browser === 'firefox') {
            const diagnostics = (acknowledgedStartup.value as { result: {
                contextId: string; nativeEvents: { event: string; at: number; detail?: { delay?: number } }[];
            }; acknowledgedAt: number; });
            const events = diagnostics.result.nativeEvents;
            const initialized = events.find((value) => value.event === 'built-request-events-initialized')!;
            const hydrated = events.find((value) => value.event === 'fixture-delay-hydrated')!;
            const called = events.find((value) => value.event === 'register-native-called')!;
            const fulfilled = events.find((value) => value.event === 'register-native-fulfilled')!;
            assert.ok(initialized && hydrated && called && fulfilled, JSON.stringify(events));
            assert.equal(hydrated.detail!.delay, 0);
            assert.ok(initialized.at <= hydrated.at && hydrated.at <= called.at);
            assert.ok(called.at <= fulfilled.at && fulfilled.at <= diagnostics.acknowledgedAt);
            assert.ok(current.at! >= diagnostics.acknowledgedAt);
            if (startup.engine!.outcome === null) {
                assert.equal(startup.engine!.hash, startup.engine!.nativeHash);
                assert.ok(startup.at! < fulfilled.at, JSON.stringify({ startupAt: startup.at, fulfilled }));
            } else {
                assert.ok(startupMatchesCurrent, 'Post-registration Firefox startup must use current scope');
            }
            coldBoundary = {
                initialized,
                hydrated,
                called,
                fulfilled,
                capturedPolicy: startup.engine!.outcome === null ? 'unavailable' : currentScope.revision,
                capturedGeneration: startup.engine!.outcome === null ? 'unavailable' : currentScope.generation,
                nativeExposure: startup.engine!.outcome === null,
                recovery: 'Earlier native references remain native until navigation after acknowledgment',
            };
        } else {
            assert.ok(
                startupMatchesPrior || startupMatchesCurrent,
                'Chromium startup output must match an independently proved prior or current scope',
            );
        }
        context.cases.push({
            name: lifecycleCaseNames[1],
            status: 'passed',
            reason: 'Full shutdown resets the session; startup clocks and retained/reloaded captures are measured',
            evidence: {
                restart,
                acknowledgedStartup,
                currentSession,
                retained,
                reloaded,
                reloadedScope,
                startupMatchesPrior,
                startupMatchesCurrent,
                current,
                original,
                currentScope,
                coldBoundary,
            },
        });
    } catch (error) {
        context.cases.push({
            name: lifecycleCaseNames[1],
            status: 'failed',
            reason: String(error),
            evidence: { nativeEvents: [...context.events] },
        });
    }
    if (context.browser === 'chromium') {
        for (const mode of ['disabled', 'excluded'] as const) {
            try {
                const configuration = createBuiltConfiguration(context.browser, true, `access-${mode}-initial`);
                await context.command({ id: `access-${mode}-setup`, operation: 'consumer-configure', configuration });
                const installed = await context.read(`access-${mode}-installed`);
                const installedScope = await verifyCapturedScope(context, installed, `access-${mode}-oracle`);
                const revoke = await context.setUserScriptAccess(false);
                const excludedPolicy = {
                    ...configuration.canvasProtectionPolicy as Record<string, unknown>,
                    revision: 'access-excluded-current',
                    ownFrameExclusions: [{
                        requestTypes: ['document', 'subdocument'],
                        condition: {
                            type: 'url-regexp',
                            input: 'frame-url',
                            pattern: '[?&]id=access-excluded-target(?:&|$)',
                            flags: '',
                        },
                    }],
                };
                const pending = await context.command(mode === 'disabled' ? {
                    id: `access-${mode}-pending`, operation: 'consumer-enable', enabled: false,
                } : { id: `access-${mode}-pending`, operation: 'consumer-policy', policy: excludedPolicy });
                const pendingState = (pending.value as { result: { status: string } }).result;
                assert.equal(pendingState.status, 'unavailable');
                const saved = await context.command({ id: `access-${mode}-saved`, operation: 'consumer-session' });
                const savedRequest = (saved.value as { result: { requested: unknown } }).result.requested;
                assert.deepEqual(savedRequest, {
                    gates: { filteringEnabled: true, stealthModeEnabled: true, protectCanvas: mode !== 'disabled' },
                    policy: mode === 'disabled' ? configuration.canvasProtectionPolicy : excludedPolicy,
                });
                const restoration = await context.setUserScriptAccess(true);
                const before = await context.read(`access-${mode}-target`);
                assert.equal(before.engine!.outcome, 'installed');
                assert.deepEqual(before.engine!.pixels, installed.engine!.pixels);
                const acknowledged = await context.command({
                    id: `access-${mode}-reconcile`, operation: 'consumer-reconcile',
                });
                assert.equal(
                    (acknowledged.value as { result: { status: string } }).result.status,
                    mode === 'disabled' ? 'disabled' : 'installed',
                );
                const retained = await context.evaluate<readonly number[]>('window.canvasFixtureRead()');
                assert.deepEqual(retained, before.engine!.pixels);
                const reloaded = await context.reloadPage();
                assert.equal(reloaded.engine!.hash, reloaded.engine!.nativeHash);
                const after = await context.read(`access-${mode}-target`);
                assert.equal(after.engine!.hash, after.engine!.nativeHash);
                const positive = mode === 'excluded' ? await context.read('access-excluded-positive') : undefined;
                const positiveScope = positive
                    ? await verifyCapturedScope(context, positive, 'access-excluded-positive-oracle') : undefined;
                if (positiveScope) {
                    assert.equal(positiveScope.generation, installedScope.generation);
                    assert.equal(positiveScope.revision, 'access-excluded-current');
                }
                context.cases.push({
                    name: `actual Chromium revoked pending ${mode} and acknowledged reconciliation`,
                    status: 'passed',
                    reason: 'Pending request, stale access restoration, retained capture and exact postack decision',
                    evidence: {
                        installed,
                        installedScope,
                        revoke,
                        pending,
                        saved,
                        restoration,
                        before,
                        acknowledged,
                        retained,
                        reloaded,
                        after,
                        positive,
                        positiveScope,
                    },
                });
            } catch (error) {
                context.cases.push({
                    name: `actual Chromium revoked pending ${mode} and acknowledged reconciliation`,
                    status: 'failed',
                    reason: String(error),
                    evidence: { nativeEvents: [...context.events] },
                });
                await context.setUserScriptAccess(true);
            }
        }
    }

    const enabled = await context.command({
        id: 'lifecycle-reenable',
        operation: 'consumer-configure',
        configuration: createBuiltConfiguration(context.browser, true, 'lifecycle-replacement'),
    });
    assert.equal(enabled.status, 'succeeded', JSON.stringify(enabled));
    const prior = await context.read('replacement-prior');
    const priorScope = await verifyCapturedScope(context, prior, 'replacement-prior-oracle');
    const delayed = await context.command({
        id: 'replacement-delay',
        operation: 'consumer-delay',
        delay: 5000,
    });
    assert.equal(delayed.status, 'succeeded', JSON.stringify(delayed));
    const transitions = [];
    for (const [attempt, version] of ['1.0.1', '1.0.1'].entries()) {
        let transition: {
            first: FirstReadResult;
            events: readonly { value: { event: string; at: number } }[];
            acknowledgment: unknown;
            requestedAt: number;
        } | undefined;
        try {
            transition = await context.replaceExtension(version) as NonNullable<typeof transition>;
            const preack = transition.first;
            assert.equal(preack.engine!.hash, preack.engine!.nativeHash);
            assert.equal(preack.engine!.outcome, null);
            const fulfilled = transition.events.find(
                (event) => event.value.event === 'register-native-fulfilled',
            )
                ?? transition.events.find((event) => event.value.event === 'update-native-fulfilled');
            assert.ok(fulfilled, JSON.stringify(transition.events));
            assert.ok(
                preack.at! >= transition.requestedAt && preack.at! < fulfilled.value.at,
                JSON.stringify({
                    requestedAt: transition.requestedAt,
                    firstAt: preack.at,
                    fulfilled: fulfilled.value.at,
                }),
            );
            const retained = await context.evaluate<readonly number[]>(
                context.browser === 'chromium'
                    ? 'window.canvasFixtureRead()'
                    : 'return window.canvasFixtureRead();',
            );
            assert.deepEqual(retained, preack.engine!.pixels);
            const reloaded = await context.reloadPage();
            const reloadedScope = await verifyCapturedScope(
                context,
                reloaded,
                `replacement-reloaded-${transitions.length}-oracle`,
            );
            const after = await context.read(`replacement-after-${transitions.length}`);
            const afterScope = await verifyCapturedScope(
                context,
                after,
                `replacement-after-${transitions.length}-oracle`,
            );
            assert.equal(afterScope.generation, reloadedScope.generation);
            assert.notEqual(
                afterScope.generation,
                transitions.length ? transitions[0].afterScope.generation : priorScope.generation,
            );
            context.cases.push({
                name: `actual extension replacement ${version} attempt ${attempt}`,
                status: 'passed',
                reason: 'Native registration loss, acknowledgment, retained native capture and fresh current scope',
                evidence: {
                    transition, retained, reloaded, reloadedScope, after, afterScope,
                },
            });
            transitions.push({
                transition,
                retained,
                reloaded,
                reloadedScope,
                after,
                afterScope,
            });
        } catch (error) {
            context.cases.push({
                name: `actual extension replacement ${version} attempt ${attempt}`,
                status: 'failed',
                reason: String(error),
                evidence: { transition, nativeEvents: [...context.events] },
            });
        }
    }
    let unload: unknown;
    let unloadVerified = false;
    if (context.browser === 'firefox') {
        try {
            const unloadSetup = await context.command({
                id: 'background-unload-enabled-setup',
                operation: 'consumer-configure',
                configuration: createBuiltConfiguration(context.browser, true, 'lifecycle-unload'),
            });
            assert.equal(unloadSetup.status, 'succeeded', JSON.stringify(unloadSetup));
            const beforeUnload = await context.read('background-before-unload');
            const beforeUnloadScope = await verifyCapturedScope(context, beforeUnload, 'before-unload-oracle');
            unload = await context.unloadBackground();
            const native = (unload as { first: FirstReadResult }).first;
            assert.equal(
                (unload as { sessionGeneration: { generation: string } }).sessionGeneration.generation,
                beforeUnloadScope.generation,
            );
            assert.equal(native.engine!.outcome, null);
            assert.equal(native.engine!.hash, native.engine!.nativeHash);
            const recovery = unload as {
                retained: readonly number[]; reloaded: FirstReadResult;
                nativeUnload: { removedAt: number; identity: { childId: string } };
                recovery: { before: { at: number; state: string }; views: { childId: string }[] };
                acknowledgment: { value: { acknowledgedAt: number; result: { nativeEvents: {
                    event: string; at: number;
                }[]; }; }; };
                afterSession: { value: { result: { generation: string; snapshotGeneration: string } } };
            };
            assert.deepEqual(recovery.retained, native.engine!.pixels);
            const fulfilled = recovery.acknowledgment.value.result.nativeEvents.find(
                (event) => event.event === 'register-native-fulfilled',
            )!;
            assert.ok(fulfilled, JSON.stringify(recovery.acknowledgment));
            assert.ok(native.at! >= recovery.nativeUnload.removedAt && native.at! < recovery.recovery.before.at);
            assert.ok(recovery.recovery.before.at <= fulfilled.at);
            assert.ok(fulfilled.at <= recovery.acknowledgment.value.acknowledgedAt);
            assert.equal(recovery.recovery.before.state, 'stopped');
            assert.equal(recovery.recovery.views.length, 1);
            assert.notEqual(recovery.recovery.views[0].childId, recovery.nativeUnload.identity.childId);
            assert.equal(recovery.afterSession.value.result.generation, beforeUnloadScope.generation);
            assert.equal(recovery.afterSession.value.result.snapshotGeneration, beforeUnloadScope.generation);
            const reloadedScope = await verifyCapturedScope(context, recovery.reloaded, 'unload-reload-oracle');
            const restored = await context.read('background-restored-postack');
            const restoredScope = await verifyCapturedScope(context, restored, 'background-restored-oracle');
            assert.equal(restoredScope.generation, beforeUnloadScope.generation);
            assert.equal(reloadedScope.generation, restoredScope.generation);
            unload = {
                unloadSetup,
                beforeUnload,
                beforeUnloadScope,
                unload,
                reloadedScope,
                restored,
                restoredScope,
                recovery: 'Explicit native same-addon background wake; session retained without extension replacement',
            };
            unloadVerified = true;
        } catch (error) {
            context.cases.push({
                name: 'actual Firefox background unload and restoration',
                status: 'failed',
                reason: String(error),
                evidence: { unload, nativeEvents: [...context.events] },
            });
            return;
        }
    }
    await verifyRestartDecisions(context, 'replacement');
    await context.command({ id: 'replacement-delay-reset', operation: 'consumer-delay', delay: 0 });
    if (context.browser === 'firefox') {
        await verifyRestartDecisions(context, 'cold-start');
    }
    context.cases.push({
        name: lifecycleCaseNames[2],
        status: transitions.length === 2 ? 'passed' : 'unverified',
        reason: 'Actual built consumer acknowledged current request and actual extension version replacement',
        evidence: {
            enabled,
            prior,
            priorScope,
            transitions,
        },
    });
    context.cases.push({
        name: lifecycleCaseNames[3],
        status:
            transitions.length === 2 && (context.browser !== 'firefox' || unloadVerified)
                ? 'passed'
                : 'unverified',
        reason: 'Native API clocks, preack captures, postack scope and reload; applicable background unload',
        evidence: { delayed, transitions, unload },
    });
};
