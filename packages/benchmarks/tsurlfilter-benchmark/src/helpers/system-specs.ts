/**
 * @file Helper functions to get system specs.
 */
import si from 'systeminformation';

import { printBytesAsMegabytes } from './format-size';

/**
 * Interface for the system specs.
 */
export interface SystemSpecs {
    /**
     * CPU specs.
     */
    CPU: string;

    /**
     * Memory (RAM) specs.
     */
    Memory: string;

    /**
     * OS specs.
     */
    OS: string;

    /**
     * Node.js version.
     */
    Node: string;
}

/**
 * Helper function to get system specs.
 *
 * @returns System specs.
 */
export const getSystemSpecs = async (): Promise<SystemSpecs> => {
    const cpu = await si.cpu();
    const os = await si.osInfo();
    const mem = await si.mem();

    return {
        CPU: `${cpu.manufacturer} ${cpu.brand} (${cpu.cores} cores)`,
        Memory: `${printBytesAsMegabytes(mem.total)}`,
        OS: `${os.distro} ${os.release} ${os.arch}`,
        Node: process.version,
    };
};
