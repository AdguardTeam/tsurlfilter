import { type FrameCommon } from './frame';

/**
 * Wrapper around a map for frames.
 */
export class Frames<F extends FrameCommon> {
    /**
     * A map where the key is the frame ID and the value is the frame object.
     */
    private framesMap = new Map<number, F>();

    /**
     * Sets frame by id.
     *
     * @param frameId Frame id.
     * @param frame Frame to save.
     */
    public set(frameId: number, frame: F): void {
        this.framesMap.set(frameId, frame);
    }

    /**
     * Returns frame by id.
     *
     * @param frameId Frame id.
     *
     * @returns Frame or undefined if frame not found.
     */
    public get(frameId: number): F | undefined {
        return this.framesMap.get(frameId);
    }

    /**
     * Clears all frames.
     */
    public clear(): void {
        this.framesMap.clear();
    }

    /**
     * Deletes frame by id.
     *
     * @param frameId Frame id.
     */
    public delete(frameId: number): void {
        this.framesMap.delete(frameId);
    }

    /**
     * Returns all frames.
     *
     * @returns Array of frames.
     */
    public values(): FrameCommon[] {
        return [...this.framesMap.values()];
    }
}
