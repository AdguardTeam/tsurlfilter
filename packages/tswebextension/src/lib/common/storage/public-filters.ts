import { FiltersStorage as FullFiltersStorage } from './filters';

/**
 * Publicly available methods to work with filters storage.
 */
export namespace FiltersStorage {
    export const { has } = FullFiltersStorage;
    export const { getConvertedFilterList } = FullFiltersStorage;
    export const { getConversionData } = FullFiltersStorage;
}
