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

import browser from "webextension-polyfill";

/**
 * Dev-friendly API for key-value extension storage
 */
export class Storage {
    // Storage instance
    private storage = browser.storage.local;

    /**
     * Save {@link value} for {@link key}
     *
     * @param key - storage key
     * @param value - storage value
     */
    public async set(key: string, value: unknown): Promise<void> {
        await this.storage.set({ [key]: value });
    }

    /**
     * Get storage value by {@link key}
     *
     * @param key - storage key
     * @returns storage value or undefined, if value was not found
     */
    public async get(key: string): Promise<unknown> {
        return (await this.storage.get(key))?.[key];
    }

    /**
     * Remove value for {@link key}
     *
     * @param key - storage key
     */
    public async remove(key: string): Promise<void> {
        await this.storage.remove(key);
    }
}
