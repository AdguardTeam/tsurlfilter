/**
 * Stream filter interface
 */
export interface StreamFilter {
    /**
     * Error
     */
    error: Error | undefined;

    /**
     * On data
     *
     * @param event
     */
    ondata: (event: { data: BufferSource }) => void;

    /**
     * On stop
     */
    onstop: () => void;

    /**
     * On error
     */
    onerror: () => void;

    /**
     * Writes data to stream
     *
     * @param data
     */
    write(data: BufferSource): void;

    /**
     * Disconnect
     */
    disconnect(): void;

    /**
     * Close
     */
    close(): void;
}
