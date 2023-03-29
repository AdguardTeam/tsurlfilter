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

import { FiltersApi } from "./api";

/**
 *  Service for scheduling filters rules updates
 */
export class FiltersUpdateService {
    // update checking initialization delay
    private static initDelay = 1000 * 60 * 5; // 5 min

    // update checking period
    private static checkPeriodMs = 1000 * 60 * 30; // 30 min

    // current update timer
    private updateTimerId: number | undefined;

    // current initialization delay timer
    private delayTimerId: number | undefined;

    // API for managing filters data
    private api: FiltersApi;

    constructor(api: FiltersApi) {
        this.api = api;
    }

    /**
     * Initialize update scheduler with {@link initDelay}
     */
    public start(): void {
        this.delayTimerId = window.setTimeout(async () => {
            await this.scheduleUpdate();
        }, FiltersUpdateService.initDelay);
    }

    /**
     * Clear current timers
     */
    public stop(): void {
        if (this.delayTimerId) {
            window.clearTimeout(this.delayTimerId);
        }

        if (this.updateTimerId) {
            window.clearTimeout(this.updateTimerId);
        }
    }

    /**
     * Schedule filter data update after {@link checkPeriodMs}
     */
    private async scheduleUpdate(): Promise<void> {
        if (this.updateTimerId) {
            window.clearTimeout(this.updateTimerId);
        }

        await this.api.updateFilters();

        this.updateTimerId = window.setTimeout(async () => {
            await this.scheduleUpdate();
        }, FiltersUpdateService.checkPeriodMs);
    }
}
