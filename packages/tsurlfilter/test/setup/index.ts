import { vi } from 'vitest';

// Create exports for the mock functions to spy on them in tests.
export const loggerMocks = {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
    trace: vi.fn(),
};

// Mock logger since we have several tests that are using it
// and we don't want to see the logs in the test output.
vi.mock('@adguard/logger', () => {
    return {
        Logger: vi.fn().mockImplementation(() => loggerMocks),
    };
});
