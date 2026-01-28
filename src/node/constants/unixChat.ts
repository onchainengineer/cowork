import * as path from "path";

/**
 * Returns the on-disk projectPath for the built-in Chat with Unix system workspace.
 *
 * Note: This must be computed from the active unix home dir (Config.rootDir) so
 * tests and dev installs (UNIX_ROOT) behave consistently.
 */
export function getUnixHelpChatProjectPath(unixHome: string): string {
  // Use a pretty basename for UI display (project name = basename of projectPath).
  return path.join(unixHome, "system", "Unix");
}
