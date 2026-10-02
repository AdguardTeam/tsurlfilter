import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';

import { collectBenchmarkPage } from './benchmark.suite';
import { type FirstReadResult } from './delivery.suite';
import { collectBuiltEnginePage } from './engine.suite';

/**
 * Fixture commands are consumed by the Firefox persistent test background.
 */
export interface FixtureCommand {
    readonly id: string;
    readonly operation:
    | 'install'
    | 'remove'
    | 'navigate'
    | 'private'
    | 'window'
    | 'close'
    | 'reload'
    | 'availability'
    | 'consumer-start'
    | 'consumer-configure'
    | 'consumer-stop'
    | 'consumer-enable'
    | 'consumer-policy'
    | 'consumer-delay'
    | 'consumer-diagnostics'
    | 'consumer-reconcile'
    | 'consumer-state'
    | 'consumer-session'
    | 'consumer-oracle';
    readonly code?: string;
    readonly matches?: readonly string[];
    readonly url?: string;
    readonly excluded?: boolean;
    readonly requested?: 'disable' | 'exclude' | 'enable';
    readonly windowId?: number;
    readonly configuration?: Record<string, unknown>;
    readonly enabled?: boolean;
    readonly policy?: unknown;
    readonly host?: string;
    readonly pixels?: readonly number[];
    readonly width?: number;
    readonly height?: number;
    readonly delay?: number;
}

/**
 * The fixture background acknowledges each command through the local collector.
 */
export interface CommandResult {
    readonly kind: 'command';
    readonly id: string;
    readonly status: 'succeeded' | 'failed' | 'unavailable' | 'baseline';
    readonly value?: unknown;
    readonly reason?: string;
}

/**
 * Loopback origins, command queue and first-read results belong to one test run.
 */
export interface FixtureServer {
    readonly origin: string;
    readonly crossOrigin: string;
    readonly missingPermissionOrigin: string;
    readonly collector: string;
    readonly events: readonly CommandResult[];
    enqueue(command: FixtureCommand): Promise<CommandResult>;
    waitForCommand(id: string): Promise<CommandResult>;
    waitForRead(id: string): Promise<FirstReadResult>;
    close(): Promise<void>;
}

/**
 * Starts one IPv4 loopback listener and resolves its ephemeral origin.
 *
 * @param server The fixture server.
 * @param host Loopback address.
 *
 * @returns The listening HTTP origin.
 */
const listen = async (server: Server, host: string): Promise<string> => {
    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, host, resolve);
    });
    const address = server.address();
    if (address === null || typeof address === 'string') {
        throw new Error('Fixture did not acquire a TCP port');
    }
    return `http://${host.includes(':') ? `[${host}]` : host}:${address.port}`;
};

/**
 * Starts HTTP first-inline pages, frame cases and a local command/result collector.
 *
 * @returns A server owning all sockets and collected results for the run.
 */
export const startFixtureServer = async (): Promise<FixtureServer> => {
    const fixtureDirectory = fileURLToPath(new URL('./fixtures/', import.meta.url));
    const firstRead = await readFile(`${fixtureDirectory}/first-read.html`, 'utf8');
    const framePage = await readFile(`${fixtureDirectory}/frame.html`, 'utf8');
    const results = new Map<string, FirstReadResult | CommandResult>();
    type ResultConsumer = (result: FirstReadResult | CommandResult) => void;
    const pending = new Map<string, ResultConsumer>();
    const commands: FixtureCommand[] = [];
    const events: CommandResult[] = [];
    let origin = '';
    let crossOrigin = '';

    /**
     * Waits for a browser observation without treating a timeout as a pass.
     *
     * @param id Unique fixture or command identifier.
     *
     * @returns The browser's observation.
     */
    const waitFor = (id: string): Promise<FirstReadResult | CommandResult> => {
        const existing = results.get(id);
        if (existing) {
            results.delete(id);
            return Promise.resolve(existing);
        }
        return new Promise((resolve, reject) => {
            const timeoutSeconds = id.startsWith('benchmark-') ? 900 : 120;
            const timeout = setTimeout(
                () => {
                    pending.delete(id);
                    reject(new Error(`No browser result for ${id} within ${timeoutSeconds} seconds`));
                },
                timeoutSeconds * 1000,
            );
            pending.set(id, (result) => {
                clearTimeout(timeout);
                results.delete(id);
                resolve(result);
            });
        });
    };

    /**
     * Embeds collector coordinates before the first inline script executes.
     *
     * @param id Case identifier.
     *
     * @returns A self-contained first-read page.
     */
    const renderFirstRead = (id: string): string => firstRead
        .replace('__CASE_ID__', JSON.stringify(id))
        .replace('__COLLECTOR__', JSON.stringify(`${origin}/results`));

    const server = createServer(async (request, response) => {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        response.setHeader('Cache-Control', 'no-store');
        if (request.method === 'OPTIONS') {
            response.writeHead(204).end();
            return;
        }
        const url = new URL(request.url ?? '/', origin || 'http://127.0.0.1');
        if (url.pathname === '/commands') {
            response.setHeader('Content-Type', 'application/json');
            response.end(JSON.stringify(commands.shift() ?? null));
            return;
        }
        if (url.pathname === '/results' && request.method === 'POST') {
            let body = '';
            for await (const chunk of request) {
                body += chunk;
            }
            // Both result producers are owned test fixtures; malformed output fails loudly.
            const result = JSON.parse(body) as FirstReadResult | CommandResult;
            if (result.kind === 'command' && result.id.startsWith('native-event:')) {
                events.push(result);
            }
            results.set(result.id, result);
            pending.get(result.id)?.(result);
            pending.delete(result.id);
            response.writeHead(204).end();
            return;
        }
        if (url.pathname === '/image.svg') {
            response.removeHeader('Access-Control-Allow-Origin');
            response.setHeader('Content-Type', 'image/svg+xml');
            response.end(
                '<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"><path fill="red" d="M0 0h2v2H0"/></svg>',
            );
            return;
        }
        response.setHeader('Content-Type', 'text/html');
        const id = url.searchParams.get('id') ?? 'first-inline';
        if (url.pathname === '/benchmark') {
            response.end(`<!doctype html><meta charset="utf-8"><script>
                const __name = (value) => value;
                (${collectBenchmarkPage.toString()})(${JSON.stringify(id)},
                    ${JSON.stringify(`${origin}/results`)},
                    ${Number(url.searchParams.get('width'))}, ${Number(url.searchParams.get('height'))}
                ).catch(error => fetch(${JSON.stringify(`${origin}/results`)}, { method: 'POST',
                    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                        kind: 'first-read', id: ${JSON.stringify(id)}, pixel: [], private: null,
                        benchmark: { width: 0, height: 0, samples: {}, callbacks: 0, failures: [String(error)] }
                    }) }));</script><title>Built canvas benchmark</title>`);
            return;
        }
        if (url.pathname === '/engine') {
            response.end(`<!doctype html><meta charset="utf-8"><script>
                // The CLI transpiler names local fixture functions through this helper.
                const __name = (value) => value;
                (${collectBuiltEnginePage.toString()})(${JSON.stringify(id)},
                    ${JSON.stringify(`${origin}/results`)},
                    ${Number(url.searchParams.get('corpus') ?? 1)},
                    ${Number(url.searchParams.get('reads') ?? 2)}).catch(error => fetch(
                        ${JSON.stringify(`${origin}/results`)}, { method: 'POST',
                        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
                            kind: 'first-read', id: ${JSON.stringify(id)}, pixel: [], private: null,
                            url: location.href, origin: location.origin, referrer: document.referrer,
                            at: Date.now(), documentTimeOrigin: performance.timeOrigin,
                            engine: { outcome: null, hash: '', nativeHash: '', changed: 0, eligible: 0,
                                fixtures: 0, reads: 0, failures: [String(error)], observations: [] }
                        }) }));</script><title>Built canvas fixture</title>`);
            return;
        }
        if (url.pathname === '/native-reference') {
            response.end(
                '<!doctype html><meta charset="utf-8"><body>Native serializer reference</body>',
            );
            return;
        }
        if (url.pathname === '/engine-frame') {
            const child = new URL('/engine', origin);
            child.searchParams.set('id', id);
            child.searchParams.set('reads', '20');
            response.end(
                `<!doctype html><meta charset="utf-8"><iframe src=${JSON.stringify(child.href)}></iframe>`,
            );
            return;
        }
        if (url.pathname === '/frames') {
            const kind = url.searchParams.get('kind') ?? 'same';
            const childOrigin = kind === 'same' || kind === 'detached' ? origin : crossOrigin;
            const childUrl = `${childOrigin}/first-read?id=${encodeURIComponent(id)}`;
            const child = renderFirstRead(id);
            let options = `frame.src = ${JSON.stringify(childUrl)};`;
            if (kind === 'sandbox') {
                options += '\nframe.sandbox = "allow-scripts";';
            } else if (kind === 'no-referrer') {
                options += '\nframe.referrerPolicy = "no-referrer";';
            } else if (kind === 'detached') {
                options += `\nframe.onload = () => {
                    const childWindow = frame.contentWindow;
                    const childUrl = childWindow.location.href;
                    const childOrigin = childWindow.origin;
                    const delivery = childWindow.canvasFixtureDelivery || null;
                    const beforeDetachPixel = childWindow.canvasFixtureRead();
                    frame.remove();
                    fetch(${JSON.stringify(`${origin}/results`)}, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ kind: 'first-read', id: ${JSON.stringify(`${id}-detached`)},
                            pixel: childWindow.canvasFixtureRead(), url: childUrl, origin: childOrigin,
                            referrer: '', topAccessible: true, private: null, delivery, beforeDetachPixel }),
                    });
                };`;
            } else if (kind === 'about:blank') {
                const firstScript = child.match(/<script>([\s\S]*?)<\/script>/)![1];
                options = `frame.onload = () => { frame.onload = null;
                    const script = frame.contentDocument.createElement('script');
                    script.textContent = ${JSON.stringify(firstScript)};
                    frame.contentDocument.head.append(script); }; frame.src = 'about:blank';`;
            } else if (kind === 'srcdoc') {
                options = `frame.srcdoc = ${JSON.stringify(child)};`;
            } else if (kind === 'data') {
                options = `frame.src = 'data:text/html,' + encodeURIComponent(${JSON.stringify(child)});`;
            } else if (kind === 'blob') {
                options = `frame.src = URL.createObjectURL(
                    new Blob([${JSON.stringify(child)}], { type: 'text/html' }),
                );`;
            }
            // Embedded fixture HTML includes closing script tags and must remain a script string.
            const embeddedFrame = framePage.replace(
                '__FRAME_OPTIONS__',
                options.replace(/<\/script/gi, '<\\/script'),
            );
            response.end(embeddedFrame);
            return;
        }
        response.end(renderFirstRead(id));
    });
    origin = await listen(server, '127.0.0.1');
    crossOrigin = origin.replace('127.0.0.1', 'localhost');
    const missing = createServer(
        server.listeners('request')[0] as Parameters<typeof createServer>[0],
    );
    let missingPermissionOrigin: string;
    try {
        missingPermissionOrigin = await listen(missing, '::1');
    } catch (error) {
        server.closeAllConnections();
        await new Promise<void>((resolve) => {
            server.close(() => resolve());
        });
        throw error;
    }
    return {
        origin,
        crossOrigin,
        missingPermissionOrigin,
        collector: `${origin}/results`,
        events,
        enqueue: async (command): Promise<CommandResult> => {
            commands.push(command);
            return (await waitFor(command.id)) as CommandResult;
        },
        waitForRead: async (id): Promise<FirstReadResult> => (await waitFor(id)) as FirstReadResult,
        waitForCommand: async (id): Promise<CommandResult> => (await waitFor(id)) as CommandResult,
        close: async (): Promise<void> => {
            server.closeAllConnections();
            missing.closeAllConnections();
            await Promise.all(
                [server, missing].map(
                    (listener) => new Promise<void>((resolve, reject) => {
                        listener.close((error) => (error ? reject(error) : resolve()));
                    }),
                ),
            );
        },
    };
};
