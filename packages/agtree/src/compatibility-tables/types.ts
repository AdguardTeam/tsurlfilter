/**
 * @file Compatibility tables types (hybrid trie structure).
 */

import type { TrieNode } from './trie';

/**
 * Hybrid compatibility table row.
 * Uses both a trie for wildcard queries and a flat map for O(1) specific lookups.
 *
 * @template T Type of the compatibility data.
 */
export interface HybridCompatibilityTableRow<T> {
    /**
     * Trie for hierarchical wildcard queries.
     * Keyed by path segments: product → type → specific.
     */
    trie: TrieNode<T>;

    /**
     * Flat map for O(1) specific platform lookups.
     * Keyed by platform string (e.g., 'adg_os_windows').
     */
    flatMap: Map<string, T>;

    /**
     * Shared storage for data deduplication.
     * Array of unique data entries referenced by trie and flatMap.
     */
    shared: T[];
}

/**
 * Compatibility table.
 * Maps feature names to their hybrid compatibility rows.
 *
 * @template T Type of the compatibility data.
 */
export interface CompatibilityTable<T> {
    /**
     * Map of feature names to their compatibility data.
     */
    rows: Map<string, HybridCompatibilityTableRow<T>>;
}
