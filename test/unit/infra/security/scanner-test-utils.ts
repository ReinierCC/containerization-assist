/**
 * Shared Test Utilities for Scanner Tests
 *
 * Provides reusable mock setup, logger factory, and common test scenarios
 * to maintain DRY principle across all scanner unit tests.
 */

import { jest } from '@jest/globals';
import type { Logger } from 'pino';

/**
 * Create a mock logger instance with common logging methods
 */
export function createMockLogger(): Logger {
  return {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;
}

/**
 * Setup mock exec functions for child_process testing
 * Stores promisified function references for proper mock routing
 */
export function setupExecMocks() {
  type MockExecAsync = jest.MockedFunction<
    (command: string, options?: unknown) => Promise<{ stdout: string; stderr: string }>
  >;
  type MockExecFileAsync = jest.MockedFunction<
    (
      file: string,
      args: string[],
      options?: unknown,
    ) => Promise<{ stdout: string; stderr: string }>
  >;

  let mockExecAsync: MockExecAsync;
  let mockExecFileAsync: MockExecFileAsync;

  // Store promisified function references
  const promisifiedFunctions = new Map<Function, 'exec' | 'execFile'>();

  // Mock node:child_process
  jest.mock('node:child_process', () => {
    const mockExecFn = jest.fn();
    const mockExecFileFn = jest.fn();
    promisifiedFunctions.set(mockExecFn, 'exec');
    promisifiedFunctions.set(mockExecFileFn, 'execFile');
    return {
      exec: mockExecFn,
      execFile: mockExecFileFn,
    };
  });

  // Mock node:util to return our mocks
  jest.mock('node:util', () => {
    const actual = jest.requireActual<typeof import('node:util')>('node:util');
    return {
      ...actual,
      promisify: (fn: Function) => {
        const fnType = promisifiedFunctions.get(fn);
        // Return wrapper that delegates to our module-level mocks
        return (...args: unknown[]) => {
          if (fnType === 'execFile') {
            if (!mockExecFileAsync) {
              throw new Error('mockExecFileAsync not initialized');
            }
            return mockExecFileAsync(...(args as [string, string[], unknown?]));
          } else {
            if (!mockExecAsync) {
              throw new Error('mockExecAsync not initialized');
            }
            return mockExecAsync(...(args as [string, unknown?]));
          }
        };
      },
    };
  });

  return {
    initializeMocks: () => {
      mockExecAsync = jest.fn<
        (command: string, options?: unknown) => Promise<{ stdout: string; stderr: string }>
      >();
      mockExecFileAsync = jest.fn<
        (
          file: string,
          args: string[],
          options?: unknown,
        ) => Promise<{ stdout: string; stderr: string }>
      >();
      return { mockExecAsync, mockExecFileAsync };
    },
    getMocks: () => ({ mockExecAsync, mockExecFileAsync }),
  };
}

/**
 * Common test scenarios that apply to all scanners
 */
export const commonTestScenarios = {
  /**
   * Test data for validating imageId formats
   */
  invalidImageIds: [
    { id: 'test-image; rm -rf /', reason: 'shell metacharacters' },
    { id: 'test"image', reason: 'quotes' },
    { id: "test'image", reason: 'single quotes' },
    { id: 'test`image', reason: 'backticks' },
    { id: 'test$image', reason: 'dollar sign' },
  ],

  validImageIds: [
    'registry.example.com/namespace/image:v1.0.0',
    'myimage@sha256:abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    'simple-image:latest',
    'my_image:v1.0',
  ],

  /**
   * Common error scenarios
   */
  errors: {
    commandNotFound: () => {
      const error: any = new Error('command not found');
      error.code = 127;
      return error;
    },
    timeout: () => {
      const error: any = new Error('Timeout');
      error.code = 'ETIMEDOUT';
      return error;
    },
    execError: (message: string) => new Error(message),
  },
};

/**
 * Create mock vulnerability data for testing severity mapping
 */
export function createSeverityTestVulnerabilities<T extends { severity: string }>(
  severities: Array<{ level: string; id: string }>,
  createVulnFn: (id: string, severity: string) => T,
): T[] {
  return severities.map(({ level, id }) => createVulnFn(id, level));
}
