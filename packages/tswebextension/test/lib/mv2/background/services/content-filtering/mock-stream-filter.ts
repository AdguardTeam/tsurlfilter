/* eslint-disable class-methods-use-this */
import { WebRequest } from 'webextension-polyfill';

/**
 * Mock filter implementation.
 */
export class MockStreamFilter implements WebRequest.StreamFilter {
    status: WebRequest.StreamFilterStatus = 'uninitialized';

    content: BufferSource | undefined;

    error = '';

    /**
     * Mocked on start method.
     */
    onstart(): void {}

    /**
     * Mocked on data method.
     *
     * @param event Event.
     * @param event.data Data.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ondata(event: { data: BufferSource }): void {}

    /**
     * On error mock.
     */
    onerror(): void {}

    /**
     * On stop mock.
     */
    onstop(): void {}

    /**
     * On create mock.
     */
    create(): void {}

    /**
     * On suspend mock.
     */
    suspend(): void {}

    /**
     * Resume mock.
     */
    resume(): void {}

    /**
     * Close mock.
     */
    close(): void {}

    /**
     * Disconnect mock.
     */
    disconnect(): void {}

    /**
     * Write mock.
     *
     * @param data Data to write.
     */
    write(data: ArrayBufferView | ArrayBuffer): void {
        this.content = data;
    }

    /**
     * Mock method to send data.
     *
     * @param data Data to send.
     */
    send(data: BufferSource): void {
        this.onstart();
        this.ondata({ data });
        this.onstop();
    }

    /**
     * Mock receive.
     *
     * @returns Data received.
     */
    receive(): BufferSource {
        const result = this.content;
        return result!;
    }
}
