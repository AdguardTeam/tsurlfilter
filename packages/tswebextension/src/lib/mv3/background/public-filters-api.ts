import FiltersApi from './filters-api';

/**
 * Filters API for MV3.
 */
export namespace PublicFiltersApi {
    export const { getRawFilterList } = FiltersApi;
    export const { getPreprocessedFilterList } = FiltersApi;
    export const { getChecksum } = FiltersApi;
}
