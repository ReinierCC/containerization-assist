/**
 * Snyk Security Scanner Implementation
 *
 * Integrates with Snyk CLI for container image vulnerability scanning.
 * Snyk is a developer security platform by Snyk Ltd.
 *
 * @see https://docs.snyk.io/snyk-cli
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { Logger } from 'pino';

import { extractErrorMessage } from '@/lib/errors';
import { Result, Success, Failure } from '@/types';
import type { BasicScanResult } from './scanner';
import { LIMITS } from '@/config/constants';
import {
  validateImageId,
  SeverityCounter,
  normalizeSeverity,
  logScanStart,
  logScanComplete,
} from './scanner-common';

const execFileAsync = promisify(execFile);

// Snyk JSON output structures
interface SnykVulnerability {
  id: string;
  title: string;
  severity: string; // lowercase: critical, high, medium, low
  packageName: string;
  version: string;
  nearestFixedInVersion?: string;
  cvssScore?: number;
  references?: Array<{
    title: string;
    url: string;
  }>;
  from?: string[];
}

interface SnykOutput {
  vulnerabilities?: SnykVulnerability[];
  ok: boolean;
  dependencyCount?: number;
  uniqueCount?: number;
  summary?: string;
  error?: string;
  path?: string;
}

/**
 * Parse Snyk JSON output to our BasicScanResult format
 */
function parseSnykOutput(snykOutput: SnykOutput, imageId: string): BasicScanResult {
  const vulnerabilities: BasicScanResult['vulnerabilities'] = [];
  const counter = new SeverityCounter();

  // Snyk uses flat vulnerabilities array
  for (const vuln of snykOutput.vulnerabilities || []) {
    const severity = normalizeSeverity(vuln.severity);
    counter.increment(severity);

    // Build vulnerability entry
    const vulnEntry: BasicScanResult['vulnerabilities'][number] = {
      id: vuln.id,
      severity,
      package: vuln.packageName,
      version: vuln.version,
      description: vuln.title || 'No description available',
    };

    // Add fixedVersion if available (using Snyk's nearestFixedInVersion)
    if (vuln.nearestFixedInVersion !== undefined) {
      vulnEntry.fixedVersion = vuln.nearestFixedInVersion;
    }

    vulnerabilities.push(vulnEntry);
  }

  return {
    imageId,
    vulnerabilities,
    scanDate: new Date(),
    ...counter.getCounts(),
  };
}

/**
 * Get Snyk version
 * @throws Error if Snyk is not installed or execution fails
 */
async function getSnykVersion(logger: Logger): Promise<Result<string>> {
  try {
    const { stdout } = await execFileAsync('snyk', ['--version'], { timeout: 5000 });
    // Snyk version output format: just the version number (e.g., "1.1230.0")
    const version = stdout.trim();
    if (!version) {
      return Failure('Snyk version could not be parsed', {
        message: 'Snyk version check failed',
        hint: 'Snyk CLI may not be properly configured',
        resolution: 'Try running: snyk --version',
      });
    }
    return Success(version);
  } catch (error: unknown) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === 'ETIMEDOUT') {
      logger.error({ error }, 'Snyk version check timed out');
      return Failure('Snyk version check timed out', {
        message: 'Command execution timeout',
        hint: 'Snyk CLI took too long to respond',
        resolution: 'Check if Snyk is functioning correctly: snyk --version',
      });
    }
    throw error;
  }
}

/**
 * Check if Snyk is installed and accessible
 */
export async function checkSnykAvailability(logger: Logger): Promise<Result<string>> {
  try {
    const versionResult = await getSnykVersion(logger);
    if (!versionResult.ok) {
      return versionResult;
    }
    return Success(versionResult.value);
  } catch (error) {
    return Failure('Snyk not installed or not in PATH', {
      message: 'Snyk CLI not found',
      hint: 'Snyk CLI is required for security scanning',
      resolution:
        'Install Snyk: npm install -g snyk or download from https://docs.snyk.io/snyk-cli/install-the-snyk-cli',
      details: { error: extractErrorMessage(error) },
    });
  }
}

/**
 * Check if Snyk is authenticated
 */
async function checkSnykAuth(logger: Logger): Promise<Result<boolean>> {
  // Check for SNYK_TOKEN environment variable
  if (process.env.SNYK_TOKEN) {
    logger.debug('SNYK_TOKEN environment variable found');
    return Success(true);
  }

  // Try to verify auth status by running a quick command
  try {
    await execFileAsync('snyk', ['config', 'get', 'api'], { timeout: 5000 });
    return Success(true);
  } catch (error) {
    return Failure('Snyk authentication required', {
      message: 'Snyk CLI requires authentication',
      hint: 'Snyk needs an API token to scan images',
      resolution:
        'Set SNYK_TOKEN environment variable or run: snyk auth\nGet a token from: https://app.snyk.io/account',
      details: { error: extractErrorMessage(error) },
    });
  }
}

/**
 * Scan a Docker image using Snyk
 */
export async function scanImageWithSnyk(
  imageId: string,
  logger: Logger,
): Promise<Result<BasicScanResult>> {
  // Validate imageId to prevent command injection
  if (!validateImageId(imageId)) {
    return Failure('Invalid imageId format', {
      message: 'ImageId contains invalid characters',
      hint: 'ImageId must contain only alphanumeric characters, dots, colons, slashes, at-signs, underscores, and hyphens',
      resolution: 'Verify the imageId is a valid Docker image identifier',
      details: { imageId },
    });
  }

  // Check if Snyk is available
  const availabilityCheck = await checkSnykAvailability(logger);
  if (!availabilityCheck.ok) {
    return Failure(availabilityCheck.error, availabilityCheck.guidance);
  }

  // Check if Snyk is authenticated
  const authCheck = await checkSnykAuth(logger);
  if (!authCheck.ok) {
    return Failure(authCheck.error, authCheck.guidance);
  }

  const snykVersion = availabilityCheck.value;
  logScanStart(logger, 'Snyk', snykVersion, imageId);

  try {
    // Run Snyk scan with JSON output
    // container test: scan container image
    // --json: output in JSON format
    const args = ['container', 'test', imageId, '--json'];
    logger.debug({ args }, 'Executing Snyk command');

    const { stdout, stderr } = await execFileAsync('snyk', args, {
      maxBuffer: LIMITS.MAX_SCAN_BUFFER,
      env: {
        ...process.env,
        // Ensure token is passed if set
        ...(process.env.SNYK_TOKEN && { SNYK_TOKEN: process.env.SNYK_TOKEN }),
      },
    });

    // Log any warnings from stderr
    if (stderr) {
      logger.debug({ stderr }, 'Snyk stderr output');
    }

    // Validate output size before parsing
    if (stdout.length === 0) {
      return Failure('Snyk returned empty output', {
        message: 'No scan results received',
        hint: 'Snyk may not have found the image or encountered an error',
        resolution: `Verify image exists: docker image inspect ${imageId}`,
      });
    }

    // Parse JSON output
    let snykOutput: SnykOutput;
    try {
      snykOutput = JSON.parse(stdout);
    } catch (parseError) {
      return Failure('Failed to parse Snyk output', {
        message: 'Snyk output parsing failed',
        hint: 'Snyk may have returned invalid JSON',
        resolution: `Try running Snyk manually to verify: snyk container test ${imageId} --json`,
        details: {
          parseError: extractErrorMessage(parseError),
          outputPreview: stdout.substring(0, 200),
        },
      });
    }

    // Check for errors in the output
    if (snykOutput.error) {
      return Failure(`Snyk scan error: ${snykOutput.error}`, {
        message: 'Snyk encountered an error',
        hint: snykOutput.error,
        resolution: 'Check Snyk documentation or run command manually for more details',
      });
    }

    // Parse the Snyk output into our format
    const scanResult = parseSnykOutput(snykOutput, imageId);

    logScanComplete(
      logger,
      'Snyk',
      imageId,
      scanResult.totalVulnerabilities,
      scanResult.criticalCount,
      scanResult.highCount,
    );

    return Success(scanResult);
  } catch (error) {
    // When Snyk exits with non-zero code, try to parse stdout for error details
    const hasStdout = (err: unknown): err is { stdout: string | Buffer } => {
      return typeof err === 'object' && err !== null && 'stdout' in err;
    };

    if (hasStdout(error)) {
      const stdout = String(error.stdout || '').trim();

      if (stdout) {
        try {
          const snykOutput = JSON.parse(stdout) as SnykOutput;
          if (snykOutput.error) {
            const isAuthError =
              snykOutput.error.includes('auth') || snykOutput.error.includes('authenticate');

            return Failure(
              `Snyk ${isAuthError ? 'authentication failed' : 'scan error'}: ${snykOutput.error}`,
              {
                message: isAuthError ? 'Authentication required' : 'Snyk encountered an error',
                hint: snykOutput.error,
                resolution: isAuthError
                  ? 'Option 1: Set environment variable: export SNYK_TOKEN=<your-token>\nOption 2: Run: snyk auth\n\nGet a token from: https://app.snyk.io/account'
                  : 'Check Snyk documentation or run command manually for more details',
                details: { error: snykOutput.error },
              },
            );
          }
        } catch {
          // Fall through if JSON parsing fails
        }
      }
    }

    // Generic error handling
    const errorMessage = extractErrorMessage(error);
    logger.error({ error: errorMessage, imageId }, 'Snyk scan failed');

    return Failure(`Snyk scan failed: ${errorMessage}`, {
      message: 'Security scan execution failed',
      hint: 'Snyk encountered an error while scanning the image',
      resolution: `Check image exists and is accessible: docker image ls | grep ${imageId}`,
      details: { error: errorMessage },
    });
  }
}
