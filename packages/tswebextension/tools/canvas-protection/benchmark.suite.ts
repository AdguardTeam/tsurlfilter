/* eslint-disable no-await-in-loop -- Native/protected samples are paired in one browser process. */
import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';

import { type BuiltSuiteContext } from './delivery.suite';
import { createBuiltConfiguration } from './engine.suite';

/**
 * Runs readout timing in the browser, including native Blob callback latency.
 *
 * @param id Owned result identifier.
 * @param collector Local test result endpoint.
 * @param width Original canvas width.
 * @param height Original canvas height.
 *
 * @returns Completion after all repeated timings are collected.
 */
export async function collectBenchmarkPage(
    id: string,
    collector: string,
    width: number,
    height: number,
): Promise<void> {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'rgb(32,64,96)';
    context.fillRect(0, 0, width, height);
    const failures: string[] = [];
    const samples: Record<string, number[]> = { raw: [], toDataURL: [], toBlob: [] };
    let callbacks = 0;
    for (const api of ['raw', 'toDataURL', 'toBlob']) {
        for (let iteration = 0; iteration < 12; iteration += 1) {
            const started = performance.now();
            if (api === 'raw') {
                const image = context.getImageData(0, 0, width, height);
                if (image.width !== width || image.height !== height) {
                    failures.push('Raw readout dimensions changed');
                }
            } else if (api === 'toDataURL') {
                if (!canvas.toDataURL().startsWith('data:image/png;base64,')) {
                    failures.push('PNG URL result changed');
                }
            } else {
                // eslint-disable-next-line @typescript-eslint/no-loop-func -- Samples await this callback serially.
                await new Promise<void>((resolve) => {
                    canvas.toBlob((blob) => {
                        callbacks += 1;
                        if (blob === null || blob.type !== 'image/png') {
                            failures.push('PNG Blob result changed');
                        }
                        resolve();
                    });
                });
            }
            const elapsed = performance.now() - started;
            if (iteration >= 3) {
                samples[api].push(elapsed);
            }
        }
    }
    await fetch(collector, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            kind: 'first-read',
            id,
            url: window.location.href,
            origin: window.origin,
            referrer: document.referrer,
            topAccessible: true,
            pixel: [],
            at: Date.now(),
            private: null,
            benchmark: {
                width,
                height,
                samples,
                callbacks,
                failures,
                outcome:
                    (Reflect.get(window, '__adguardCanvasInstallation') as
                        { outcome: string } | undefined)?.outcome ?? null,
            },
        }),
    });
}

/**
 * Reads resident memory for the selected browser and its actual OS descendants.
 *
 * @param root Browser process ID, obtained from its native automation capability.
 *
 * @returns Total browser-tree RSS in bytes and the selected process IDs.
 */
const readBrowserMemory = (root: number): { readonly bytes: number; readonly pids: readonly number[] } => {
    const rows = execFileSync('ps', ['-axo', 'pid=,ppid=,rss='], { encoding: 'utf8' })
        .trim()
        .split('\n')
        .map((line) => line.trim().split(/\s+/).map(Number));
    const selected = new Set([root]);
    let previous = 0;
    while (previous !== selected.size) {
        previous = selected.size;
        rows.forEach(([pid, parent]) => {
            if (selected.has(parent)) {
                selected.add(pid);
            }
        });
    }
    return {
        bytes: rows.reduce((total, [pid, , rss]) => total + (selected.has(pid) ? rss * 1024 : 0), 0),
        pids: [...selected],
    };
};

/**
 * Measures both modes on named hardware without inventing a performance budget.
 *
 * @param context Actual loaded extension and browser process transport.
 *
 * @returns Completion after all three required size/API pairs.
 */
export const runBenchmarkSuite = async (context: BuiltSuiteContext): Promise<void> => {
    let started = false;
    for (const [width, height] of [
        [256, 128],
        [1024, 1024],
        [4096, 4096],
    ]) {
        const measurements = [];
        for (const protectedRead of [false, true]) {
            const configured = await context.command({
                id: `benchmark-${width}-${protectedRead}`,
                operation: started ? 'consumer-configure' : 'consumer-start',
                configuration: createBuiltConfiguration(context.browser, protectedRead),
            });
            assert.equal(configured.status, 'succeeded', JSON.stringify(configured));
            const canvas = (configured.value as { result: { canvasProtection: {
                status: string; installed: { status: string }; requested: { gates: { protectCanvas: boolean } };
            }; }; }).result.canvasProtection;
            assert.equal(canvas.status, protectedRead ? 'installed' : 'disabled', JSON.stringify(configured));
            assert.equal(canvas.requested.gates.protectCanvas, protectedRead, JSON.stringify(configured));
            assert.equal(
                canvas.installed.status,
                protectedRead ? 'available' : 'unavailable',
                JSON.stringify(configured),
            );
            started = true;
            const baseline = readBrowserMemory(context.processId);
            const memory = {
                baselineBytes: baseline.bytes,
                peakBytes: baseline.bytes,
                samples: 1,
                pids: baseline.pids,
                startedAt: Date.now(),
                endedAt: 0,
            };
            const timer = setInterval(() => {
                const sample = readBrowserMemory(context.processId);
                memory.peakBytes = Math.max(memory.peakBytes, sample.bytes);
                memory.pids = sample.pids;
                memory.samples += 1;
            }, 50);
            let observation;
            try {
                observation = await context.read(`benchmark-${width}-${height}-${protectedRead}`, {
                    route: `/benchmark?width=${width}&height=${height}`,
                });
            } finally {
                clearInterval(timer);
                memory.endedAt = Date.now();
            }
            const result = observation.benchmark!;
            assert.deepEqual(result.failures, []);
            assert.equal(result.callbacks, 12);
            assert.equal(result.width, width);
            assert.equal(result.height, height);
            assert.equal(result.outcome, protectedRead ? 'installed' : null);
            const latency = Object.fromEntries(
                Object.entries(result.samples).map(([api, values]) => {
                    assert.equal(values.length, 9);
                    const sorted = [...values].sort((left, right) => left - right);
                    return [
                        api,
                        {
                            samplesMs: values,
                            medianMs: sorted[Math.floor(sorted.length / 2)],
                            p95Ms: sorted[Math.ceil(sorted.length * 0.95) - 1],
                        },
                    ];
                }),
            );
            measurements.push({
                protectedRead,
                configured,
                result,
                latency,
                memory: {
                    ...memory,
                    deltaBytes: memory.peakBytes - memory.baselineBytes,
                    browserPid: context.processId,
                    method: 'OS ps PID/PPID/RSS process tree, 50ms sampling, KiB converted to bytes',
                },
            });
        }
        context.cases.push({
            name: `measures native and protected readout cost ${width}x${height}`,
            status: 'passed',
            reason: 'Three warm-up and nine measured calls per API; asynchronous callback included; browser-tree RSS',
            evidence: { measurements },
        });
    }
};
