import { type Frame } from './frame';

/**
 * Wrapper around a map for frames.
 */
export class Frames {
    /**
     * A map where the key is the frame ID and the value is the frame object.
     */
    private framesMap = new Map<number, Frame>();

    /**
     * Sets frame by id.
     * @param frameId Frame id.
     * @param frame Frame to save.
     */
    public set(frameId: number, frame: Frame): void {
        this.framesMap.set(frameId, frame);
    }

    /**
     * Returns frame by id.
     * @param frameId Frame id.
     *
     * @returns Frame or undefined if frame not found.
     */
    public get(frameId: number): Frame | undefined {
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
     * @param frameId Frame id.
     */
    public delete(frameId: number): void {
        this.framesMap.delete(frameId);
    }

    /**
     * Returns all frames.
     * @returns array of frames.
     */
    public values(): Frame[] {
        return [...this.framesMap.values()];
    }
}
