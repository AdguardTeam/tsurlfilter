import { StreamFilter } from '../../src/content-filtering/stream-filter';

/**
 * Mock filter implementation
 */
export class MockStreamFilter implements StreamFilter {
    content: BufferSource | undefined;

    error: Error | undefined;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ondata = (event: { data: BufferSource }): void => {};

    onerror = (): void => {};

    onstop = (): void => {};

    // eslint-disable-next-line class-methods-use-this
    close(): void {
    }

    // eslint-disable-next-line class-methods-use-this
    disconnect(): void {
    }

    write(data: ArrayBufferView | ArrayBuffer): void {
        this.content = data;
    }

    /**
     * Mock method to send data
     *
     * @param data
     */
    send(data: BufferSource): void {
        this.ondata({ data });

        this.onstop();
    }

    /**
     * Mock receive
     */
    receive(): BufferSource {
        const result = this.content;
        return result!;
    }
}
