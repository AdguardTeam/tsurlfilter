import { companiesDbService } from './services/companies-db-service';

/**
 * Companies db api.
 */
export class CompaniesDbApi {
    /**
     * Starts companies db api — loads companies db by path.
     *
     * @param companiesDbPath Path to the companies db.
     * @throws Error if companiesDbService method loadCompanies throws an error.
     */
    public static async start(companiesDbPath: string): Promise<void> {
        await companiesDbService.loadCompanies(companiesDbPath);
    }

    /**
     * Returns companies db categories.
     *
     * @returns Companies db categories.
     * @throws Error if companiesDbService method getCompaniesDbCategories throws an error.
     */
    public static getCategories(): Record<string, string> {
        return companiesDbService.getCompaniesDbCategories();
    }
}
