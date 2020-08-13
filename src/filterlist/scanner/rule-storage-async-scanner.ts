import { RuleStorageScanner } from './rule-storage-scanner';
import { RuleScanner } from './rule-scanner';

/**
 * Async rule storage scanner
 */
export class RuleStorageAsyncScanner extends RuleStorageScanner {
    private counter = 0;

    private readonly chunkSize: number;

    /**
     * Constructor
     *
     * @param scanners
     * @param chunkSize
     */
    constructor(scanners: RuleScanner[], chunkSize = 0) {
        super(scanners);

        this.chunkSize = chunkSize;
    }

    /**
     * Async scans chunk by chunk
     */
    public async scanAsync(): Promise<boolean> {
        if (this.chunkSize === 0) {
            return super.scan();
        }

        this.counter += 1;
        if (this.counter >= this.chunkSize) {
            this.counter = 0;

            await new Promise((resolve) => setTimeout(resolve, 1));
        }

        return super.scan();
    }
}
