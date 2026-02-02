/**
 * BrowserSessionManager - Manages Playwright browser instances per workspace.
 *
 * Each workspace (and sub-agent) can have its own isolated browser session.
 * Sessions are lazily created and automatically cleaned up on workspace close.
 *
 * Uses Playwright's Chromium browser for full browser automation:
 * - Navigate, click, type, scroll, screenshot, extract text/HTML
 * - Supports multiple pages (tabs) per session
 * - Screenshots returned as base64 PNG for agent consumption
 * - CDP session exposed for advanced use cases
 */

import { EventEmitter } from "events";
import { log } from "@/node/services/log";

// Playwright types - dynamically imported to avoid hard dependency at startup
type PlaywrightBrowser = import("playwright").Browser;
type PlaywrightBrowserContext = import("playwright").BrowserContext;
type PlaywrightPage = import("playwright").Page;

// ── Types ────────────────────────────────────────────────────────────

export interface BrowserSession {
  id: string;
  workspaceId: string;
  browser: PlaywrightBrowser;
  context: PlaywrightBrowserContext;
  pages: Map<string, PlaywrightPage>;
  activePageId: string;
  status: "active" | "closed";
  createdAt: number;
  lastActivity: number;
  /** Whether this session is headless (no visible UI) */
  headless: boolean;
  /** CDP WebSocket endpoint — used to connect the frontend <webview> to the same browser */
  cdpUrl: string | null;
  /** HTTP URL for the page being viewed — frontend can load this in a webview */
  debugUrl: string | null;
}

export type BrowserActionType =
  | "navigate"
  | "click"
  | "type"
  | "scroll"
  | "screenshot"
  | "read_text"
  | "read_html"
  | "wait"
  | "select"
  | "hover"
  | "go_back"
  | "go_forward"
  | "new_tab"
  | "close_tab"
  | "list_tabs"
  | "switch_tab"
  | "evaluate";

export interface BrowserAction {
  action: BrowserActionType;
  url?: string;
  selector?: string;
  text?: string;
  value?: string;
  /** Scroll direction: "up" | "down" | "left" | "right" */
  direction?: string;
  /** Scroll amount in pixels */
  amount?: number;
  /** Wait timeout in ms */
  timeoutMs?: number;
  /** JavaScript code for evaluate action */
  code?: string;
  /** Whether to take a full-page screenshot */
  fullPage?: boolean;
  /** Page/tab ID for tab operations */
  pageId?: string;
  /** Coordinate for click [x, y] */
  coordinate?: [number, number];
}

export interface BrowserActionResult {
  success: true;
  /** The type of content returned */
  contentType: "text" | "html" | "screenshot" | "info";
  /** The content (text, html, base64 png, or info message) */
  content: string;
  /** Current page URL after action */
  url: string;
  /** Current page title */
  title: string;
}

export interface BrowserActionError {
  success: false;
  error: string;
}

/** Snapshot of the browser's visual state — stored per workspace for UI rendering. */
export interface BrowserSnapshot {
  /** Base64-encoded PNG screenshot */
  screenshot: string;
  /** Current page URL */
  url: string;
  /** Current page title */
  title: string;
  /** Timestamp when this snapshot was taken */
  timestamp: number;
  /** The action that triggered this snapshot */
  lastAction: string;
}

// Actions that change the visual state (worth auto-capturing after)
const VISUAL_ACTIONS = new Set<BrowserActionType>([
  "navigate", "click", "type", "scroll", "select", "hover",
  "go_back", "go_forward", "new_tab", "switch_tab", "evaluate",
]);

// ── Session Manager ──────────────────────────────────────────────────

export class BrowserSessionManager extends EventEmitter {
  private sessions = new Map<string, BrowserSession>();
  private playwright: typeof import("playwright") | null = null;
  private sessionCounter = 0;
  /** Latest visual snapshot per workspace — consumed by the BrowserTab UI */
  private snapshots = new Map<string, BrowserSnapshot>();
  /** Track used debug ports to avoid conflicts */
  private usedPorts = new Set<number>();
  /** Base port for CDP debugging (each session gets a unique port) */
  private static BASE_DEBUG_PORT = 9222;

  /**
   * Lazily import Playwright to avoid loading it at startup.
   */
  private async getPlaywright(): Promise<typeof import("playwright")> {
    if (!this.playwright) {
      try {
        this.playwright = await import("playwright");
      } catch (err) {
        throw new Error(
          "Playwright is not installed. Run: npx playwright install chromium"
        );
      }
    }
    return this.playwright;
  }

  /**
   * Find an available debug port for a new session.
   */
  private getNextDebugPort(): number {
    let port = BrowserSessionManager.BASE_DEBUG_PORT;
    while (this.usedPorts.has(port)) {
      port++;
    }
    this.usedPorts.add(port);
    return port;
  }

  /**
   * Create a new browser session for a workspace.
   *
   * Launches Chromium with --remote-debugging-port so the frontend can
   * embed a live <webview> pointing at the same browser the agent controls.
   * Playwright connects via CDP to automate the same browser instance.
   */
  async createSession(
    workspaceId: string,
    options?: { headless?: boolean }
  ): Promise<BrowserSession> {
    const pw = await this.getPlaywright();
    const headless = options?.headless ?? false; // Default to visible for embedded view
    const debugPort = this.getNextDebugPort();

    // Launch Chromium with remote debugging enabled.
    // Use stealth-friendly flags to avoid bot detection on sites like X, Reddit, etc.
    const browser = await pw.chromium.launch({
      headless,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        `--remote-debugging-port=${debugPort}`,
        // Allow the Electron webview to connect
        "--remote-allow-origins=*",
        // Stealth: disable automation flags that sites check
        "--disable-blink-features=AutomationControlled",
        // Stealth: enable GPU so WebGL fingerprint looks real
        "--enable-webgl",
        "--enable-accelerated-2d-canvas",
        // Realistic window size
        "--window-size=1280,800",
      ],
      ignoreDefaultArgs: [
        // Remove the "Chrome is being controlled by automated test software" bar
        "--enable-automation",
      ],
    });

    // Get the CDP WebSocket endpoint from the browser
    // Playwright exposes this after launch when remote-debugging-port is set
    let cdpUrl: string | null = null;
    let debugUrl: string | null = null;
    try {
      // Fetch the CDP info from the debug endpoint
      const resp = await fetch(`http://127.0.0.1:${debugPort}/json/version`);
      if (resp.ok) {
        const info = await resp.json() as { webSocketDebuggerUrl?: string };
        cdpUrl = info.webSocketDebuggerUrl ?? null;
      }
      debugUrl = `http://127.0.0.1:${debugPort}`;
    } catch {
      log.warn("[BrowserSessionManager] Could not fetch CDP info", { debugPort });
    }

    // Use a realistic, up-to-date user agent (Chrome 131 on macOS)
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      locale: "en-US",
      timezoneId: "America/New_York",
      // Realistic screen dimensions
      screen: { width: 1440, height: 900 },
    });

    // Remove navigator.webdriver flag — sites like X check for this
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
      // Fake plugins array so it looks like a real browser
      Object.defineProperty(navigator, "plugins", {
        get: () => [1, 2, 3, 4, 5],
      });
      // Fake languages
      Object.defineProperty(navigator, "languages", {
        get: () => ["en-US", "en"],
      });
    });

    const page = await context.newPage();
    const sessionId = `browser-${workspaceId}-${++this.sessionCounter}`;
    const pageId = `page-0`;

    const session: BrowserSession = {
      id: sessionId,
      workspaceId,
      browser,
      context,
      pages: new Map([[pageId, page]]),
      activePageId: pageId,
      status: "active",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      headless,
      cdpUrl,
      debugUrl,
    };

    this.sessions.set(sessionId, session);
    log.info("[BrowserSessionManager] Created session", {
      sessionId, workspaceId, headless, debugPort, cdpUrl,
    });
    this.emit("session-created", { sessionId, workspaceId });

    return session;
  }

  /**
   * Get existing session by ID, or null if not found/closed.
   */
  getSession(sessionId: string): BrowserSession | null {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "closed") return null;
    return session;
  }

  /**
   * Get or create a session for a workspace.
   * Returns existing active session if one exists, otherwise creates new.
   */
  async getOrCreateSession(
    workspaceId: string,
    options?: { headless?: boolean }
  ): Promise<BrowserSession> {
    // Find existing active session for this workspace
    for (const session of this.sessions.values()) {
      if (session.workspaceId === workspaceId && session.status === "active") {
        session.lastActivity = Date.now();
        return session;
      }
    }
    return this.createSession(workspaceId, options);
  }

  /**
   * List all sessions, optionally filtered by workspace.
   */
  listSessions(workspaceId?: string): BrowserSession[] {
    const all = Array.from(this.sessions.values());
    if (workspaceId) {
      return all.filter((s) => s.workspaceId === workspaceId);
    }
    return all;
  }

  /**
   * Get the active page for a session.
   */
  private getActivePage(session: BrowserSession): PlaywrightPage {
    const page = session.pages.get(session.activePageId);
    if (!page) {
      // Fallback to first available page
      const first = session.pages.values().next().value;
      if (!first) throw new Error("No pages available in session");
      return first;
    }
    return page;
  }

  /**
   * Execute a browser action on a session.
   * After visual actions (navigate, click, type, scroll, etc.), automatically
   * captures a screenshot and stores it for the BrowserTab UI to display.
   */
  async executeAction(
    sessionId: string,
    action: BrowserAction
  ): Promise<BrowserActionResult | BrowserActionError> {
    const session = this.getSession(sessionId);
    if (!session) {
      return { success: false, error: `Session ${sessionId} not found or closed` };
    }

    session.lastActivity = Date.now();
    const page = this.getActivePage(session);
    const timeout = action.timeoutMs ?? 30_000;

    const result = await this._executeActionInner(session, page, action, timeout);

    // Auto-capture screenshot after visual actions for the live BrowserTab panel
    if (result.success && VISUAL_ACTIONS.has(action.action)) {
      this.autoCapture(session, page, action.action).catch(() => {
        // Non-fatal: auto-capture is best-effort for the UI
      });
    }
    // If the action itself was a screenshot, store it too
    if (result.success && action.action === "screenshot") {
      this.snapshots.set(session.workspaceId, {
        screenshot: result.content,
        url: result.url,
        title: result.title,
        timestamp: Date.now(),
        lastAction: "screenshot",
      });
      this.emit("snapshot", { workspaceId: session.workspaceId });
    }

    return result;
  }

  /**
   * Auto-capture a screenshot after a visual action.
   */
  private async autoCapture(
    session: BrowserSession,
    page: PlaywrightPage,
    actionName: string
  ): Promise<void> {
    try {
      const buffer = await page.screenshot({ fullPage: false, type: "png" });
      const base64 = buffer.toString("base64");
      const snapshot: BrowserSnapshot = {
        screenshot: base64,
        url: page.url(),
        title: await page.title(),
        timestamp: Date.now(),
        lastAction: actionName,
      };
      this.snapshots.set(session.workspaceId, snapshot);
      this.emit("snapshot", { workspaceId: session.workspaceId });
    } catch {
      // Ignore — page may have closed or navigated during capture
    }
  }

  /**
   * Get the latest snapshot for a workspace (consumed by BrowserTab UI).
   */
  getSnapshot(workspaceId: string): BrowserSnapshot | null {
    return this.snapshots.get(workspaceId) ?? null;
  }

  /**
   * Get the page URL that the active page is currently on.
   * Used by the frontend to show what the agent is browsing.
   */
  getActivePageUrl(workspaceId: string): string | null {
    for (const session of this.sessions.values()) {
      if (session.workspaceId === workspaceId && session.status === "active") {
        const page = session.pages.get(session.activePageId);
        return page?.url() ?? null;
      }
    }
    return null;
  }

  /**
   * Internal action execution (no auto-capture).
   */
  private async _executeActionInner(
    session: BrowserSession,
    page: PlaywrightPage,
    action: BrowserAction,
    timeout: number
  ): Promise<BrowserActionResult | BrowserActionError> {
    try {
      switch (action.action) {
        case "navigate": {
          if (!action.url) return { success: false, error: "url is required for navigate" };
          await page.goto(action.url, { timeout, waitUntil: "domcontentloaded" });
          return {
            success: true,
            contentType: "info",
            content: `Navigated to ${action.url}`,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "click": {
          if (action.coordinate) {
            await page.mouse.click(action.coordinate[0], action.coordinate[1]);
          } else if (action.selector) {
            await page.click(action.selector, { timeout });
          } else {
            return { success: false, error: "selector or coordinate required for click" };
          }
          // Wait briefly for any navigation/rendering
          await page.waitForTimeout(500);
          return {
            success: true,
            contentType: "info",
            content: `Clicked ${action.selector ?? `(${action.coordinate![0]}, ${action.coordinate![1]})`}`,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "type": {
          if (!action.text) return { success: false, error: "text is required for type" };
          if (action.selector) {
            await page.fill(action.selector, action.text, { timeout });
          } else {
            // Type into currently focused element
            await page.keyboard.type(action.text);
          }
          return {
            success: true,
            contentType: "info",
            content: `Typed "${action.text.slice(0, 50)}${action.text.length > 50 ? "..." : ""}" into ${action.selector ?? "focused element"}`,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "select": {
          if (!action.selector) return { success: false, error: "selector required for select" };
          if (!action.value) return { success: false, error: "value required for select" };
          await page.selectOption(action.selector, action.value, { timeout });
          return {
            success: true,
            contentType: "info",
            content: `Selected "${action.value}" in ${action.selector}`,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "hover": {
          if (action.coordinate) {
            await page.mouse.move(action.coordinate[0], action.coordinate[1]);
          } else if (action.selector) {
            await page.hover(action.selector, { timeout });
          } else {
            return { success: false, error: "selector or coordinate required for hover" };
          }
          return {
            success: true,
            contentType: "info",
            content: `Hovered over ${action.selector ?? `(${action.coordinate![0]}, ${action.coordinate![1]})`}`,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "scroll": {
          const dir = action.direction ?? "down";
          const amount = action.amount ?? 500;
          const deltaX = dir === "left" ? -amount : dir === "right" ? amount : 0;
          const deltaY = dir === "up" ? -amount : dir === "down" ? amount : 0;
          await page.mouse.wheel(deltaX, deltaY);
          await page.waitForTimeout(300);
          return {
            success: true,
            contentType: "info",
            content: `Scrolled ${dir} by ${amount}px`,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "screenshot": {
          const buffer = await page.screenshot({
            fullPage: action.fullPage ?? false,
            type: "png",
          });
          const base64 = buffer.toString("base64");
          return {
            success: true,
            contentType: "screenshot",
            content: base64,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "read_text": {
          let text: string;
          if (action.selector) {
            text = await page.textContent(action.selector, { timeout }) ?? "";
          } else {
            text = await page.evaluate(() => document.body.innerText);
          }
          // Truncate to avoid token explosion
          if (text.length > 50_000) {
            text = text.slice(0, 50_000) + "\n\n[Content truncated at 50,000 chars]";
          }
          return {
            success: true,
            contentType: "text",
            content: text,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "read_html": {
          let html: string;
          if (action.selector) {
            html = await page.innerHTML(action.selector, { timeout });
          } else {
            html = await page.content();
          }
          if (html.length > 100_000) {
            html = html.slice(0, 100_000) + "\n\n<!-- Content truncated -->";
          }
          return {
            success: true,
            contentType: "html",
            content: html,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "wait": {
          if (action.selector) {
            await page.waitForSelector(action.selector, { timeout });
            return {
              success: true,
              contentType: "info",
              content: `Element ${action.selector} appeared`,
              url: page.url(),
              title: await page.title(),
            };
          }
          const waitMs = action.timeoutMs ?? 1000;
          await page.waitForTimeout(waitMs);
          return {
            success: true,
            contentType: "info",
            content: `Waited ${waitMs}ms`,
            url: page.url(),
            title: await page.title(),
          };
        }

        case "go_back": {
          await page.goBack({ timeout });
          return {
            success: true,
            contentType: "info",
            content: "Navigated back",
            url: page.url(),
            title: await page.title(),
          };
        }

        case "go_forward": {
          await page.goForward({ timeout });
          return {
            success: true,
            contentType: "info",
            content: "Navigated forward",
            url: page.url(),
            title: await page.title(),
          };
        }

        case "new_tab": {
          const newPage = await session.context.newPage();
          const newPageId = `page-${session.pages.size}`;
          session.pages.set(newPageId, newPage);
          session.activePageId = newPageId;
          if (action.url) {
            await newPage.goto(action.url, { timeout, waitUntil: "domcontentloaded" });
          }
          return {
            success: true,
            contentType: "info",
            content: `Opened new tab ${newPageId}${action.url ? ` at ${action.url}` : ""}`,
            url: newPage.url(),
            title: await newPage.title(),
          };
        }

        case "close_tab": {
          const targetPageId = action.pageId ?? session.activePageId;
          const targetPage = session.pages.get(targetPageId);
          if (!targetPage) {
            return { success: false, error: `Tab ${targetPageId} not found` };
          }
          if (session.pages.size <= 1) {
            return { success: false, error: "Cannot close the last tab" };
          }
          await targetPage.close();
          session.pages.delete(targetPageId);
          // Switch to first remaining page
          if (session.activePageId === targetPageId) {
            session.activePageId = session.pages.keys().next().value!;
          }
          const activePage = this.getActivePage(session);
          return {
            success: true,
            contentType: "info",
            content: `Closed tab ${targetPageId}. Active tab: ${session.activePageId}`,
            url: activePage.url(),
            title: await activePage.title(),
          };
        }

        case "list_tabs": {
          const tabs: string[] = [];
          for (const [id, p] of session.pages) {
            const isActive = id === session.activePageId ? " (active)" : "";
            tabs.push(`${id}${isActive}: ${p.url()}`);
          }
          return {
            success: true,
            contentType: "text",
            content: tabs.join("\n"),
            url: page.url(),
            title: await page.title(),
          };
        }

        case "switch_tab": {
          if (!action.pageId) return { success: false, error: "pageId required for switch_tab" };
          const switchPage = session.pages.get(action.pageId);
          if (!switchPage) {
            return { success: false, error: `Tab ${action.pageId} not found` };
          }
          session.activePageId = action.pageId;
          await switchPage.bringToFront();
          return {
            success: true,
            contentType: "info",
            content: `Switched to tab ${action.pageId}`,
            url: switchPage.url(),
            title: await switchPage.title(),
          };
        }

        case "evaluate": {
          if (!action.code) return { success: false, error: "code required for evaluate" };
          const result = await page.evaluate(action.code);
          const resultStr = typeof result === "string" ? result : JSON.stringify(result, null, 2);
          return {
            success: true,
            contentType: "text",
            content: resultStr ?? "undefined",
            url: page.url(),
            title: await page.title(),
          };
        }

        default:
          return { success: false, error: `Unknown action: ${action.action}` };
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      log.warn("[BrowserSessionManager] Action failed", {
        sessionId: session.id,
        action: action.action,
        error: message,
      });
      return { success: false, error: message };
    }
  }

  /**
   * Close a browser session and clean up resources.
   */
  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = "closed";
    // Release debug port
    if (session.debugUrl) {
      try {
        const url = new URL(session.debugUrl);
        this.usedPorts.delete(Number(url.port));
      } catch { /* ignore */ }
    }
    try {
      await session.browser.close();
    } catch {
      // Browser may already be closed
    }
    this.sessions.delete(sessionId);
    log.info("[BrowserSessionManager] Closed session", { sessionId });
    this.emit("session-closed", { sessionId, workspaceId: session.workspaceId });
  }

  /**
   * Close all sessions for a workspace (called on workspace removal).
   */
  async closeWorkspaceSessions(workspaceId: string): Promise<void> {
    const sessions = this.listSessions(workspaceId);
    await Promise.all(sessions.map((s) => this.closeSession(s.id)));
  }

  /**
   * Close all sessions (called on app shutdown).
   */
  async closeAll(): Promise<void> {
    const all = Array.from(this.sessions.keys());
    await Promise.all(all.map((id) => this.closeSession(id)));
  }

  /**
   * Get session info (safe for serialization — no Playwright objects).
   */
  getSessionInfo(sessionId: string): {
    id: string;
    workspaceId: string;
    status: string;
    headless: boolean;
    pageCount: number;
    activePageId: string;
    createdAt: number;
    lastActivity: number;
    cdpUrl: string | null;
    debugUrl: string | null;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    return {
      id: session.id,
      workspaceId: session.workspaceId,
      status: session.status,
      headless: session.headless,
      pageCount: session.pages.size,
      activePageId: session.activePageId,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      cdpUrl: session.cdpUrl,
      debugUrl: session.debugUrl,
    };
  }
}
