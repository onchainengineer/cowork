import type { UnixFrontendMetadata, UnixMessage, UnixMetadata } from "@/common/types/message";

interface LegacyUnixMetadata extends UnixMetadata {
  cunixMetadata?: UnixFrontendMetadata;
  idleCompacted?: boolean;
}

/**
 * Normalize persisted messages from older builds.
 *
 * Migrations:
 * - `cunixMetadata` → `unixMetadata` (unix rename)
 * - `{ compacted: true, idleCompacted: true }` → `{ compacted: "idle" }`
 */
export function normalizeLegacyUnixMetadata(message: UnixMessage): UnixMessage {
  const metadata = message.metadata as LegacyUnixMetadata | undefined;
  if (!metadata) return message;

  let normalized: UnixMetadata = { ...metadata };
  let changed = false;

  // Migrate cunixMetadata → unixMetadata
  if (metadata.cunixMetadata !== undefined) {
    const { cunixMetadata, ...rest } = normalized as LegacyUnixMetadata;
    normalized = rest;
    if (!metadata.unixMetadata) {
      normalized.unixMetadata = cunixMetadata;
    }
    changed = true;
  }

  // Migrate idleCompacted: true → compacted: "idle"
  if (metadata.idleCompacted === true) {
    const { idleCompacted, ...rest } = normalized as LegacyUnixMetadata;
    normalized = { ...rest, compacted: "idle" };
    changed = true;
  }

  return changed ? { ...message, metadata: normalized } : message;
}
