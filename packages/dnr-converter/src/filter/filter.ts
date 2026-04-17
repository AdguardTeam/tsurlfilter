/**
 * @file Concrete Filter implementation for both simple and advanced DNR
 * conversion flows.
 */

import { UnavailableFilterSourceError } from '../errors/unavailable-sources-errors';
import { LazyLoader } from '../utils/lazy-loader';

import { type IFilter } from './types';

/**
 * Concrete filter implementation for the DNR converter.
 *
 * Supports two construction modes:
 * - **Pre-loaded**: `new Filter(id, content)` — content is a plain string,
 *   `getContent()` resolves immediately, `unloadContent()` is a no-op.
 * - **Lazy-loaded**: `new Filter(id, source)` — content is fetched on the first
 *   call to `getContent()`, with promise deduplication and unload/reload support.
 *
 * Use with {@link FilterConverter}.
 */
export class Filter implements IFilter {
    /**
     * Line separator used to split filter content into rule lines.
     */
    private static readonly NEWLINE = '\n';

    /**
     * ID of filter.
     */
    private readonly id: number;

    /**
     * Pre-loaded content, set only in pre-loaded mode. When non-null,
     * `getContent()` returns it directly and `unloadContent()` is a no-op
     * (pre-loaded filters have no source to reload from).
     */
    private readonly preloadedContent: string | null;

    /**
     * Lazy content loader, set only in lazy-loaded mode.
     * {@link LazyLoader} Handles caching, concurrent-call coalescing, and
     * safe unload-during-load.
     */
    private readonly contentLoader: LazyLoader<string> | null;

    /**
     * Lazily-built map from rule-start character offset to rule text, used
     * by {@link getRuleByIndex} for O(1) lookups. Rebuilt on first access
     * after content is (re)loaded; cleared on {@link unloadContent}.
     */
    private ruleByOffset: Map<number, string> | null = null;

    /**
     * Creates a pre-loaded Filter that wraps a plain string.
     * GetContent() resolves immediately; unloadContent() is a no-op..
     *
     * @param id Numeric filter identifier.
     * @param content Pre-loaded filter content (one rule per line).
     */
    constructor(id: number, content: string);

    /**
     * Creates a lazy-loaded Filter.
     * The getSource callback is invoked at most once per load cycle; concurrent
     * getContent() calls coalesce onto a single in-flight Promise.
     *
     * @param id Numeric filter identifier.
     * @param getSource Zero-argument async callback that resolves to filter content.
     */
    constructor(id: number, getSource: () => Promise<string>);

    // eslint-disable-next-line jsdoc/require-jsdoc
    constructor(
        id: number,
        contentOrGetSource: string | (() => Promise<string>),
    ) {
        this.id = id;
        if (typeof contentOrGetSource === 'string') {
            this.preloadedContent = contentOrGetSource;
            this.contentLoader = null;
        } else {
            this.preloadedContent = null;
            const getSource = contentOrGetSource;
            this.contentLoader = new LazyLoader<string>(async () => {
                try {
                    return await getSource();
                } catch (e) {
                    throw new UnavailableFilterSourceError(
                        'Filter content is unavailable',
                        this.id,
                        e as Error,
                    );
                }
            });
        }
    }

    /** @inheritdoc */
    public getId(): number {
        return this.id;
    }

    /** @inheritdoc */
    public async getContent(): Promise<string> {
        if (this.preloadedContent !== null) {
            return this.preloadedContent;
        }
        // contentLoader is non-null whenever preloadedContent is null (constructor invariant).
        return this.contentLoader!.get();
    }

    /** @inheritdoc */
    public async getRuleByIndex(index: number): Promise<string> {
        const content = await this.getContent();

        // Lazily build an offset->line index on first access so subsequent
        // lookups are O(1). index is node.start from the AGTree AST - the
        // character offset at which a rule's text begins in the raw filter string.
        if (this.ruleByOffset === null) {
            const map = new Map<number, string>();
            const lines = content.split(Filter.NEWLINE);
            let offset = 0;
            for (const line of lines) {
                map.set(offset, line);
                // +1 accounts for the '\n' separator stripped by split.
                offset += line.length + 1;
            }
            this.ruleByOffset = map;
        }

        return this.ruleByOffset.get(index) ?? '';
    }

    /** @inheritdoc */
    public unloadContent(): void {
        // Pre-loaded filters are not unloadable - no source to reload from.
        // (contentLoader is null iff the filter was constructed with a plain string.)
        if (this.contentLoader === null) {
            return;
        }
        this.contentLoader.reset();
        this.ruleByOffset = null;
    }
}
