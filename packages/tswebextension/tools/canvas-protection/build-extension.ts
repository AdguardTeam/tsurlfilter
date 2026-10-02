import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import swc from '@rollup/plugin-swc';
import { rollup } from 'rollup';

import { type CanvasBootstrapSnapshot } from '../../src/lib/common/canvas-protection/contracts';
import { createProtectAllPolicy } from '../../test/lib/common/canvas-protection/fixtures/prepared-policies';

import { type CanvasTestBrowser } from './delivery.suite';

const toolDirectory = fileURLToPath(new URL('.', import.meta.url));

/**
 * Bundles a fixture entry without depending on generated production outputs.
 *
 * @param input The fixture TypeScript entry.
 * @param name Local IIFE export name.
 * @param requiredModule Optional built module whose resolution must be verified.
 *
 * @returns Self-contained browser code.
 */
const bundle = async (input: string, name: string, requiredModule?: string): Promise<string> => {
    const build = await rollup({
        input,
        treeshake: { moduleSideEffects: false },
        plugins: [
            swc(),
            resolve({ browser: true, extensions: ['.js', '.json', '.ts'] }),
            commonjs(),
        ],
    });
    try {
        if (
            requiredModule
            && ![...build.cache!.modules].some((module) => module.id === requiredModule)
        ) {
            throw new Error(
                `Built consumer did not resolve the required package artifact: ${requiredModule}`,
            );
        }
        const output = await build.generate({ format: 'iife', name });
        return output.output[0].code;
    } finally {
        await build.close();
    }
};

/**
 * Produces a delivery-only probe carrying an exact prepared policy snapshot.
 *
 * @param browser Browser path selected by the suite.
 * @param options Prepared exclusions or native selectors for a case.
 * @param options.disabled A false protection gate for the disable replacement.
 * @param options.excluded An exact path predicate for the exclusion replacement.
 * @param options.matches Native candidate selectors.
 * @param options.revision Identifies the prepared snapshot without changing its seed scope.
 * @param options.generation Test-only generation identifier.
 *
 * @returns Generated code and its seed-free prepared policy.
 */
export const createDeliveryCode = async (
    browser: CanvasTestBrowser,
    options: {
        readonly disabled?: boolean;
        readonly excluded?: boolean;
        readonly matches?: readonly string[];
        readonly revision?: string;
        readonly generation?: string;
    } = {},
): Promise<{ readonly code: string; readonly snapshot: CanvasBootstrapSnapshot }> => {
    const policy = createProtectAllPolicy(
        browser === 'chromium' ? 'chromium-mv3' : 'firefox-mv2',
        options.revision ?? 'delivery-fixture',
    );
    const snapshot: CanvasBootstrapSnapshot = {
        session: {
            root: '11111111111111111111111111111111',
            generation: options.generation ?? '22222222222222222222222222222222',
        },
        gates: {
            filteringEnabled: true,
            stealthModeEnabled: true,
            protectCanvas: !options.disabled,
        },
        policy: {
            ...policy,
            selectors: {
                matches: options.matches ?? ['http://127.0.0.1/*', 'http://localhost/*'],
                excludeMatches: [],
            },
            ownFrameExclusions: options.excluded
                ? [
                    {
                        requestTypes: ['document', 'subdocument'],
                        condition: {
                            type: 'url-regexp',
                            input: 'frame-url',
                            pattern: '/excluded(?:\\?|$)',
                            flags: '',
                        },
                    },
                ]
                : [],
        },
    };
    const probe = await bundle(
        path.join(toolDirectory, 'fixtures/delivery-probe.ts'),
        'deliveryProbe',
    );
    return {
        code: `(() => { ${probe}\ndeliveryProbe.installDeliveryProbe(${JSON.stringify(snapshot)}); })();`,
        snapshot,
    };
};

/**
 * Assembles a test-only extension for a dedicated profile.
 *
 * @param browser Browser path to build.
 * @param mode Delivery probe or built engine fixture.
 * @param collector Local command/result collector.
 * @param options Fixture extension version.
 * @param options.version Package update version.
 * @param options.suite Dedicated suite output, preserving delivery defaults.
 * @param options.restore Prepared fixture snapshot to register at installation.
 * @param options.restore.code Serialized MAIN-world fixture code.
 * @param options.restore.matches Native candidate selectors.
 * @param options.restore.requested Seed-free fixture intent for the new snapshot.
 *
 * @returns The assembled extension directory.
 *
 * @throws When the required actual built artifact cannot be resolved by the fixture bundle.
 */
export const buildCanvasTestExtension = async (
    browser: CanvasTestBrowser,
    mode: 'delivery' | 'engine',
    collector = '',
    options: {
        readonly version?: string;
        readonly suite?: 'delivery' | 'engine' | 'lifecycle' | 'benchmark';
        readonly restore?: {
            readonly code: string;
            readonly matches: readonly string[];
            readonly requested?: 'enable';
        };
    } = {},
): Promise<string> => {
    const manifestVersion = browser === 'chromium' ? 'mv3' : 'mv2';
    const directory = path.resolve(
        toolDirectory,
        '../../output-canvas-protection',
        `${browser}-${options.suite ?? mode}`,
        'extension',
    );
    await mkdir(directory, { recursive: true });
    if (mode === 'engine') {
        await mkdir(path.join(directory, 'resources'), { recursive: true });
        await writeFile(
            path.join(directory, 'resources/redirects.yml'),
            await readFile(
                path.resolve(toolDirectory, '../../test/lib/mv2/background/fixtures/redirects.yml'),
            ),
        );
    }
    const manifest = JSON.parse(
        await readFile(
            path.join(toolDirectory, `fixtures/manifest.${manifestVersion}.json`),
            'utf8',
        ),
    ) as { version: string };
    await writeFile(
        path.join(directory, 'manifest.json'),
        JSON.stringify(
            {
                ...manifest,
                version: options.version ?? manifest.version,
            },
            null,
            4,
        ),
    );
    const artifact = path.resolve(
        toolDirectory,
        '../../dist',
        browser === 'chromium' ? 'index.mv3.js' : 'index.js',
    );
    const background = await bundle(
        path.join(toolDirectory, `fixtures/background.${manifestVersion}.ts`),
        'fixture',
        mode === 'engine' ? artifact : undefined,
    );
    const config = JSON.stringify({
        collector,
        mode,
        baseline: process.env.CANVAS_DELIVERY_BASELINE === '1',
        restore: options.restore,
    });
    await writeFile(
        path.join(directory, 'background.js'),
        `const canvasFixtureConfig = ${config};\n${background}`,
    );
    if (mode === 'engine') {
        await writeFile(
            path.join(directory, 'build-artifacts.json'),
            JSON.stringify([
                {
                    path: artifact,
                    sha256: createHash('sha256')
                        .update(await readFile(artifact))
                        .digest('hex'),
                },
                {
                    path: path.join(directory, 'background.js'),
                    sha256: createHash('sha256')
                        .update(await readFile(path.join(directory, 'background.js')))
                        .digest('hex'),
                },
            ]),
        );
    }
    await writeFile(
        path.join(directory, 'control.html'),
        '<!doctype html><title>Extension fixture control</title>',
    );
    return directory;
};
