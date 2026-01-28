/**
 * unix.md Client Library
 *
 * Thin wrapper around @coder/mux-md-client for Unix app integration.
 * Re-exports types and provides convenience functions with default base URL.
 */

import {
  upload,
  download,
  deleteFile,
  setExpiration,
  parseUrl,
  type FileInfo,
  type SignOptions,
  type SignatureEnvelope,
  type UploadResult,
} from "@coder/mux-md-client";

// Re-export types from package
export type { FileInfo, SignOptions, SignatureEnvelope, UploadResult };

export const UNIX_MD_BASE_URL = "https://unix.md";
export const UNIX_MD_HOST = "unix.md";

// --- URL utilities ---

/**
 * Check if URL is a unix.md share link with encryption key in fragment
 */
export function isUnixMdUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.host === UNIX_MD_HOST && parseUrl(url) !== null;
  } catch {
    return false;
  }
}

/**
 * Parse unix.md URL to extract ID and key
 */
export function parseUnixMdUrl(url: string): { id: string; key: string } | null {
  return parseUrl(url);
}

export interface UploadOptions {
  /** Expiration time (ISO date string or Date object) */
  expiresAt?: string | Date;
  /**
   * Precomputed signature envelope to embed in the encrypted payload.
   * Takes precedence over `sign`.
   */
  signature?: SignatureEnvelope;
  /** Sign options for native signing via unix-md-client */
  sign?: SignOptions;
}

// --- Public API ---

/**
 * Upload content to unix.md with end-to-end encryption.
 */
export async function uploadToUnixMd(
  content: string,
  fileInfo: FileInfo,
  options: UploadOptions = {}
): Promise<UploadResult> {
  return upload(new TextEncoder().encode(content), fileInfo, {
    baseUrl: UNIX_MD_BASE_URL,
    expiresAt: options.expiresAt,
    signature: options.signature,
    sign: options.sign,
  });
}

/**
 * Delete a shared file from unix.md.
 */
export async function deleteFromUnixMd(id: string, mutateKey: string): Promise<void> {
  await deleteFile(id, mutateKey, { baseUrl: UNIX_MD_BASE_URL });
}

/**
 * Update expiration of a shared file on unix.md.
 */
export async function updateUnixMdExpiration(
  id: string,
  mutateKey: string,
  expiresAt: Date | string
): Promise<number | undefined> {
  const result = await setExpiration(id, mutateKey, expiresAt, { baseUrl: UNIX_MD_BASE_URL });
  return result.expiresAt;
}

// --- Download API ---

export interface DownloadResult {
  /** Decrypted content */
  content: string;
  /** File metadata (if available) */
  fileInfo?: FileInfo;
}

/**
 * Download and decrypt content from unix.md.
 */
export async function downloadFromUnixMd(
  id: string,
  keyMaterial: string,
  _signal?: AbortSignal
): Promise<DownloadResult> {
  const result = await download(id, keyMaterial, { baseUrl: UNIX_MD_BASE_URL });
  return {
    content: new TextDecoder().decode(result.data),
    fileInfo: result.info,
  };
}
