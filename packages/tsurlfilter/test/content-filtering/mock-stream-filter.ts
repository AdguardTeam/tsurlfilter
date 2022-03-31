import { WebRequest } from 'webextension-polyfill';
import { StreamFilter } from '../../src/content-filtering/stream-filter';

/**
 * Mock filter implementation
 */
export class MockStreamFilter implements StreamFilter {
    status: WebRequest.StreamFilterStatus = 'uninitialized';

    content: BufferSource | undefined;

    error = '';

    onstart = (): void => {};

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ondata = (event: { data: BufferSource }): void => {};

    onerror = (): void => {};

    onstop = (): void => {};

    close(): void {
    }

    disconnect(): void {
    }

    resume(): void {    
    }

    suspend(): void {
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    create(requestId: number, addonId: string): void {
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
        this.onstart();
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
