/* eslint-disable class-methods-use-this */
import { WebRequest } from 'webextension-polyfill';

/**
 * Mock filter implementation
 */
export class MockStreamFilter implements WebRequest.StreamFilter {
    content: BufferSource | undefined;

    status: WebRequest.StreamFilterStatus = 'uninitialized';

    error = '';

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ondata = (event: { data: BufferSource }): void => {};

    onerror(): void {}

    onstop(): void {}

    create(): void {}

    suspend(): void {}

    resume(): void {}

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
