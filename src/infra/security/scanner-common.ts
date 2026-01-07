/**
 * Common Scanner Utilities
 *
 * Shared functionality across security scanner implementations
 * to reduce code duplication and centralize security-critical logic.
 */

import type { Logger } from 'pino';

/**
 * Validate imageId against allowlist pattern to prevent command injection
 * Allows: alphanumeric, dots, colons, slashes, at-signs, underscores, and hyphens
 */
export function validateImageId(imageId: string): boolean {
  const allowedPattern = /^[a-zA-Z0-9._:/@-]+$/;
  return allowedPattern.test(imageId);
}

/**
 * Standardized severity type
 */
export type StandardSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'NEGLIGIBLE' | 'UNKNOWN';

/**
 * Normalize severity string to our standard format
 * Handles various case formats (UPPERCASE, lowercase, TitleCase)
 */
export function normalizeSeverity(severity: string): StandardSeverity {
  const normalized = severity.toUpperCase();
  switch (normalized) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'MEDIUM';
    case 'LOW':
      return 'LOW';
    case 'NEGLIGIBLE':
      return 'NEGLIGIBLE';
    case 'UNKNOWN':
      return 'UNKNOWN';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Severity counter helper
 */
export class SeverityCounter {
  critical = 0;
  high = 0;
  medium = 0;
  low = 0;
  negligible = 0;
  unknown = 0;

  increment(severity: StandardSeverity): void {
    switch (severity) {
      case 'CRITICAL':
        this.critical++;
        break;
      case 'HIGH':
        this.high++;
        break;
      case 'MEDIUM':
        this.medium++;
        break;
      case 'LOW':
        this.low++;
        break;
      case 'NEGLIGIBLE':
        this.negligible++;
        break;
      case 'UNKNOWN':
        this.unknown++;
        break;
    }
  }

  get total(): number {
    return this.critical + this.high + this.medium + this.low + this.negligible + this.unknown;
  }

  getCounts(): {
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    negligibleCount: number;
    unknownCount: number;
    totalVulnerabilities: number;
  } {
    return {
      criticalCount: this.critical,
      highCount: this.high,
      mediumCount: this.medium,
      lowCount: this.low,
      negligibleCount: this.negligible,
      unknownCount: this.unknown,
      totalVulnerabilities: this.total,
    };
  }
}

/**
 * Parse version from scanner output using a regex pattern
 */
export function parseVersion(output: string, pattern: RegExp): string | undefined {
  const match = output.match(pattern);
  return match?.[1]?.trim();
}

/**
 * Log scanner information
 */
export function logScanStart(logger: Logger, scanner: string, version: string, imageId: string): void {
  logger.info({ scanner, version, imageId }, `Starting ${scanner} scan`);
}

/**
 * Log scan completion
 */
export function logScanComplete(
  logger: Logger,
  scanner: string,
  imageId: string,
  totalVulnerabilities: number,
  criticalCount: number,
  highCount: number,
): void {
  logger.info(
    {
      scanner,
      imageId,
      totalVulnerabilities,
      criticalCount,
      highCount,
    },
    `${scanner} scan completed successfully`,
  );
}
