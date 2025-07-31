import { RuleStorage } from '../filterlist/rule-storage-new';
import { StringRuleList } from '../filterlist/string-rule-list';
import { Engine } from './engine';

/**
 * Filter list for engine factory.
 */
export interface EngineFactoryFilterList {
    /**
     * Filter list identifier.
     */
    id: number;

    /**
     * Filter list text.
     */
    text: string;

    /**
     * Whether to ignore cosmetic rules from this filter list.
     */
    ignoreCosmetic?: boolean;

    /**
     * Whether to ignore javascript rules from this filter list.
     */
    ignoreJS?: boolean;

    /**
     * Whether to ignore unsafe rules from this filter list.
     */
    ignoreUnsafe?: boolean;
}

/**
 * Engine factory options.
 */
export interface EngineFactoryOptions {
    /**
     * List of filters.
     */
    filters: EngineFactoryFilterList[];

    /**
     * Whether to skip initial scan.
     */
    skipInitialScan?: boolean;

    /**
     * Request cache size. If not specified, the default value is used, which is 500.
     */
    requestCacheSize?: number;
}

/**
 * Engine factory.
 * This utility class simplifies engine creation.
 */
export class EngineFactory {
    /**
     * Creates engine.
     *
     * @param options Engine options.
     *
     * @returns Engine.
     */
    public static createEngine(options: EngineFactoryOptions): Engine {
        const lists = options.filters.map(
            (f) => new StringRuleList(
                f.id,
                f.text,
                f.ignoreCosmetic ?? false,
                f.ignoreJS ?? false,
                f.ignoreUnsafe ?? false,
            ),
        );

        const storage = new RuleStorage(lists);

        return new Engine(storage, !!options.skipInitialScan);
    }
}
