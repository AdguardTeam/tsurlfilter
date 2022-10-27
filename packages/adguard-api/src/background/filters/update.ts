import { FiltersApi } from "./api";

export class FiltersUpdateService {
    // update checking initialization delay
    private static initDelay = 1000 * 60 * 5; // 5 min

    // update checking period
    private static checkPeriodMs = 1000 * 60 * 30; // 30 min

    private updateTimerId: number | undefined;

    private delayTimerId: number | undefined;

    private api: FiltersApi;

    constructor(api: FiltersApi) {
        this.api = api;
    }

    public start(): void {
        this.delayTimerId = window.setTimeout(async () => {
            await this.scheduleUpdate();
        }, FiltersUpdateService.initDelay);
    }

    public stop(): void {
        if (this.delayTimerId) {
            window.clearTimeout(this.delayTimerId);
        }

        if (this.updateTimerId) {
            window.clearTimeout(this.updateTimerId);
        }
    }

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
