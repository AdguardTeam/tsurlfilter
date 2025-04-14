import FiltersApi from './filters-api';

/**
 * Filters API for MV3.
 */
export namespace PublicFiltersApi {
    /**
     * @see {@link FiltersApi.getRawFilterList}
     */
    export const { getRawFilterList } = FiltersApi;

    /**
     * @see {@link FiltersApi.getPreprocessedFilterList}
     */
    export const { getPreprocessedFilterList } = FiltersApi;

    /**
     * @see {@link FiltersApi.getChecksum}
     */
    export const { getChecksum } = FiltersApi;
}
