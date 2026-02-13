/* eslint-disable @typescript-eslint/no-this-alias */
/**
 * @file Trie data structure for hierarchical platform storage.
 */

/**
 * Trie node for storing hierarchical platform data.
 *
 * @template T Type of data stored in the trie.
 */
export class TrieNode<T> {
    /**
     * Data stored at this node (if this is a leaf or intermediate node with data).
     */
    public data?: T;

    /**
     * Child nodes, keyed by path segment.
     */
    public children: Map<string, TrieNode<T>>;

    /**
     * Cache for subtree data collection (used for wildcard queries).
     */
    private subtreeCache?: T[];

    /**
     * Creates a new trie node.
     */
    constructor() {
        this.children = new Map();
    }

    /**
     * Inserts data at the specified path.
     *
     * @param path Path segments (e.g., ['adg', 'os', 'windows']).
     * @param data Data to store.
     */
    insert(path: string[], data: T): void {
        let node: TrieNode<T> = this;

        // Invalidate cache on root
        node.invalidateCache();

        for (const segment of path) {
            if (!node.children.has(segment)) {
                node.children.set(segment, new TrieNode<T>());
            }
            node = node.children.get(segment)!;

            // Invalidate cache on each node along the path
            node.invalidateCache();
        }

        node.data = data;
    }

    /**
     * Gets data at the exact path.
     *
     * @param path Path segments.
     * @returns Data if found, undefined otherwise.
     */
    get(path: string[]): T | undefined {
        let node: TrieNode<T> = this;

        for (const segment of path) {
            const child = node.children.get(segment);
            if (!child) {
                return undefined;
            }
            node = child;
        }

        return node.data;
    }

    /**
     * Queries all data under a given prefix path.
     * Supports wildcard queries by collecting all data in the subtree.
     *
     * @param path Prefix path segments.
     * @returns Array of all data under the prefix.
     */
    query(path: string[]): T[] {
        let node: TrieNode<T> = this;

        // Navigate to the prefix node
        for (const segment of path) {
            const child = node.children.get(segment);
            if (!child) {
                return [];
            }
            node = child;
        }

        // Collect all data in subtree (with caching)
        return node.collectAll();
    }

    /**
     * Checks if any data exists under a given prefix path.
     *
     * @param path Prefix path segments.
     * @returns True if any data exists, false otherwise.
     */
    has(path: string[]): boolean {
        let node: TrieNode<T> = this;

        for (const segment of path) {
            const child = node.children.get(segment);
            if (!child) {
                return false;
            }
            node = child;
        }

        return node.hasData();
    }

    /**
     * Collects all data in this subtree.
     * Uses caching for repeated queries.
     *
     * @returns Array of all data in subtree.
     */
    private collectAll(): T[] {
        // Return cached results if available
        if (this.subtreeCache) {
            return this.subtreeCache;
        }

        const results: T[] = [];

        // Add this node's data if present
        if (this.data) {
            results.push(this.data);
        }

        // Recursively collect from children
        for (const child of this.children.values()) {
            results.push(...child.collectAll());
        }

        // Cache the results
        this.subtreeCache = results;

        return results;
    }

    /**
     * Checks if this subtree has any data.
     *
     * @returns True if any data exists in subtree.
     */
    private hasData(): boolean {
        if (this.data) {
            return true;
        }

        for (const child of this.children.values()) {
            if (child.hasData()) {
                return true;
            }
        }

        return false;
    }

    /**
     * Invalidates the subtree cache.
     * Should be called when data is modified.
     */
    private invalidateCache(): void {
        this.subtreeCache = undefined;
    }

    /**
     * Serializes the trie to a JSON-compatible structure.
     *
     * @returns JSON-serializable object.
     */
    toJSON(): unknown {
        const result: {
            data?: T;
            children?: Record<string, unknown>;
        } = {};

        if (this.data) {
            result.data = this.data;
        }

        if (this.children.size > 0) {
            result.children = {};
            for (const [key, child] of this.children.entries()) {
                result.children[key] = child.toJSON();
            }
        }

        return result;
    }

    /**
     * Deserializes a trie from JSON.
     *
     * @param json JSON object.
     * @returns TrieNode instance.
     */
    static fromJSON<T>(json: unknown): TrieNode<T> {
        const node = new TrieNode<T>();
        const obj = json as {
            data?: T;
            children?: Record<string, unknown>;
        };

        if (obj.data) {
            node.data = obj.data;
        }

        if (obj.children) {
            for (const [key, childJson] of Object.entries(obj.children)) {
                node.children.set(key, TrieNode.fromJSON<T>(childJson));
            }
        }

        return node;
    }
}
