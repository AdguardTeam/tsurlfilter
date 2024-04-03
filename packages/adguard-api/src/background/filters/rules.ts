/**
 * @file
 * This file is part of Adguard API library (https://github.com/AdguardTeam/tsurlfilter/packages/adguard-api).
 *
 * Adguard API is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Adguard API is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Adguard API. If not, see <http://www.gnu.org/licenses/>.
 */

import { Storage } from '../storage';

/**
 * Api for write and read filters rules from extension storage
 */
export class FilterRulesApi {
    // Dev-friendly API for key-value extension storage
    storage: Storage;

    constructor(storage: Storage) {
        this.storage = storage;
    }

    /**
     * Gets specified filter rules lines from extension storage
     *
     * @param filterId - Filter id
     * @returns specified filter rules lines
     */
    async get(filterId: number): Promise<string[] | undefined> {
        return this.storage.get(FilterRulesApi.getFilterKey(filterId)) as Promise<string[] | undefined>;
    }

    /**
     * Sets specified filter rules lines to extension storage
     *
     * @param filterId - Filter id
     * @param rules - Filter rules lines
     */
    async set(filterId: number, rules: string[]): Promise<void> {
        await this.storage.set(FilterRulesApi.getFilterKey(filterId), rules);
    }

    /**
     * Removes specified filter list from {@link storage}.
     *
     * @param filterId Filter id.
     */
    async remove(filterId: number): Promise<void> {
        await this.storage.remove(FilterRulesApi.getFilterKey(filterId));
    }

    /**
     * Generates {@link Storage} key for specified filter rules
     *
     * @param filterId - Filter Id
     * @returns storage key
     */
    private static getFilterKey(filterId: number): string {
        return `filterrules_${filterId}.txt`;
    }
}
