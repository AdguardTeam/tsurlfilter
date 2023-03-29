// TODO remove the comment turning off the rule
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * This storage is used to keep track of counted rules received from node elements.
 */
export class HitsStorage {
    /**
     * Start count number.
     */
    private counter = 0;

    /**
     * Storage random identificator.
     */
    private randomKey = HitsStorage.generateRandomKey();

    /**
     * Map storage.
     */
    private map = new Map<number, { element: any; rule: string }>();

    /**
     * Checks if element is counted.
     *
     * @param element Html element.
     * @param rule Rule text.
     *
     * @returns True if element is counted.
     */
    public isCounted(element: any, rule: string): boolean {
        const hitAddress = element[this.randomKey];
        if (hitAddress) {
            const countedHit = this.map.get(hitAddress as number);
            if (countedHit) {
                return countedHit.element === element && countedHit.rule === rule;
            }
        }

        return false;
    }

    /**
     * Stores rule-element info in storage.
     *
     * @param element Html element.
     * @param rule Rule text.
     */
    public setCounted(element: any, rule: string): void {
        const counter = this.getCounter();

        // eslint-disable-next-line no-param-reassign
        element[this.randomKey] = counter;
        this.map.set(counter, { element, rule });
    }

    /**
     * Returns current counter value and increments it.
     *
     * @returns Count number.
     */
    public getCounter(): number {
        this.counter += 1;
        return this.counter;
    }

    // TODO replace with nanoid
    /**
     * Random id generator.
     *
     * @returns Random key with 10 characters length.
     */
    private static generateRandomKey(): string {
        const keyLength = 10;
        const possibleValues = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

        let result = '';
        for (let i = 0; i < keyLength; i += 1) {
            result += possibleValues.charAt(Math.floor(Math.random() * possibleValues.length));
        }

        return result;
    }
}
