"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MuxGatewayOauthService = void 0;
const crypto = __importStar(require("crypto"));
const http = __importStar(require("http"));
const result_1 = require("../../common/types/result");
const muxGatewayOAuth_1 = require("../../common/constants/muxGatewayOAuth");
const log_1 = require("../../node/services/log");
const DEFAULT_DESKTOP_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_SERVER_TIMEOUT_MS = 10 * 60 * 1000;
const COMPLETED_DESKTOP_FLOW_TTL_MS = 60 * 1000;
function closeServer(server) {
    return new Promise((resolve) => {
        server.close(() => resolve());
    });
}
function createDeferred() {
    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });
    return { promise, resolve };
}
class MuxGatewayOauthService {
    providerService;
    windowService;
    desktopFlows = new Map();
    serverFlows = new Map();
    constructor(providerService, windowService) {
        this.providerService = providerService;
        this.windowService = windowService;
    }
    async startDesktopFlow() {
        const flowId = crypto.randomUUID();
        const { promise: resultPromise, resolve: resolveResult } = createDeferred();
        const server = http.createServer((req, res) => {
            const reqUrl = req.url ?? "/";
            const url = new URL(reqUrl, "http://localhost");
            if (req.method !== "GET" || url.pathname !== "/callback") {
                res.statusCode = 404;
                res.end("Not found");
                return;
            }
            const state = url.searchParams.get("state");
            if (!state || state !== flowId) {
                res.statusCode = 400;
                res.setHeader("Content-Type", "text/html");
                res.end("<h1>Invalid OAuth state</h1>");
                return;
            }
            const code = url.searchParams.get("code");
            const error = url.searchParams.get("error");
            const errorDescription = url.searchParams.get("error_description") ?? undefined;
            void this.handleDesktopCallback({
                flowId,
                code,
                error,
                errorDescription,
                res,
            });
        });
        try {
            await new Promise((resolve, reject) => {
                server.once("error", reject);
                server.listen(0, "127.0.0.1", () => resolve());
            });
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Failed to start OAuth callback listener: ${message}`);
        }
        const address = server.address();
        if (!address || typeof address === "string") {
            return (0, result_1.Err)("Failed to determine OAuth callback listener port");
        }
        const redirectUri = `http://127.0.0.1:${address.port}/callback`;
        const authorizeUrl = (0, muxGatewayOAuth_1.buildAuthorizeUrl)({ redirectUri, state: flowId });
        const timeout = setTimeout(() => {
            void this.finishDesktopFlow(flowId, (0, result_1.Err)("Timed out waiting for OAuth callback"));
        }, DEFAULT_DESKTOP_TIMEOUT_MS);
        this.desktopFlows.set(flowId, {
            flowId,
            authorizeUrl,
            redirectUri,
            server,
            timeout,
            cleanupTimeout: null,
            resultPromise,
            resolveResult,
            settled: false,
        });
        log_1.log.debug(`Mux Gateway OAuth desktop flow started (flowId=${flowId})`);
        return (0, result_1.Ok)({ flowId, authorizeUrl, redirectUri });
    }
    async waitForDesktopFlow(flowId, opts) {
        const flow = this.desktopFlows.get(flowId);
        if (!flow) {
            return (0, result_1.Err)("OAuth flow not found");
        }
        const timeoutMs = opts?.timeoutMs ?? DEFAULT_DESKTOP_TIMEOUT_MS;
        let timeoutHandle = null;
        const timeoutPromise = new Promise((resolve) => {
            timeoutHandle = setTimeout(() => {
                resolve((0, result_1.Err)("Timed out waiting for OAuth callback"));
            }, timeoutMs);
        });
        const result = await Promise.race([flow.resultPromise, timeoutPromise]);
        if (timeoutHandle !== null) {
            clearTimeout(timeoutHandle);
        }
        if (!result.success) {
            // Ensure listener is closed on timeout/errors.
            void this.finishDesktopFlow(flowId, result);
        }
        return result;
    }
    async cancelDesktopFlow(flowId) {
        const flow = this.desktopFlows.get(flowId);
        if (!flow)
            return;
        log_1.log.debug(`Mux Gateway OAuth desktop flow cancelled (flowId=${flowId})`);
        await this.finishDesktopFlow(flowId, (0, result_1.Err)("OAuth flow cancelled"));
    }
    startServerFlow(input) {
        const state = crypto.randomUUID();
        // Prune expired flows (best-effort; avoids unbounded growth if callbacks never arrive).
        const now = Date.now();
        for (const [key, flow] of this.serverFlows) {
            if (flow.expiresAtMs <= now) {
                this.serverFlows.delete(key);
            }
        }
        const authorizeUrl = (0, muxGatewayOAuth_1.buildAuthorizeUrl)({ redirectUri: input.redirectUri, state });
        this.serverFlows.set(state, {
            state,
            expiresAtMs: Date.now() + DEFAULT_SERVER_TIMEOUT_MS,
        });
        log_1.log.debug(`Mux Gateway OAuth server flow started (state=${state})`);
        return { authorizeUrl, state };
    }
    async handleServerCallbackAndExchange(input) {
        const state = input.state;
        if (!state) {
            return (0, result_1.Err)("Missing OAuth state");
        }
        const flow = this.serverFlows.get(state);
        if (!flow) {
            return (0, result_1.Err)("Unknown OAuth state");
        }
        if (Date.now() > flow.expiresAtMs) {
            this.serverFlows.delete(state);
            return (0, result_1.Err)("OAuth flow expired");
        }
        // Regardless of outcome, this flow should not be reused.
        this.serverFlows.delete(state);
        return this.handleCallbackAndExchange({
            state,
            code: input.code,
            error: input.error,
            errorDescription: input.errorDescription,
        });
    }
    async dispose() {
        // Best-effort: cancel all in-flight flows.
        const flowIds = [...this.desktopFlows.keys()];
        await Promise.all(flowIds.map((id) => this.finishDesktopFlow(id, (0, result_1.Err)("App shutting down"))));
        for (const flow of this.desktopFlows.values()) {
            clearTimeout(flow.timeout);
            if (flow.cleanupTimeout !== null) {
                clearTimeout(flow.cleanupTimeout);
            }
        }
        this.desktopFlows.clear();
        this.serverFlows.clear();
    }
    async handleDesktopCallback(input) {
        const flow = this.desktopFlows.get(input.flowId);
        if (!flow || flow.settled) {
            input.res.statusCode = 409;
            input.res.setHeader("Content-Type", "text/html");
            input.res.end("<h1>OAuth flow already completed</h1>");
            return;
        }
        log_1.log.debug(`Mux Gateway OAuth callback received (flowId=${input.flowId})`);
        const result = await this.handleCallbackAndExchange({
            state: input.flowId,
            code: input.code,
            error: input.error,
            errorDescription: input.errorDescription,
        });
        const title = result.success ? "Login complete" : "Login failed";
        const description = result.success
            ? "You can return to Mux. You may now close this tab."
            : escapeHtml(result.error);
        const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="dark light" />
    <meta name="theme-color" content="#0e0e0e" />
    <title>${title}</title>
    <!-- gateway CSS removed for internal builds -->
  </head>
  <body>
    <div class="page">
      <header class="site-header">
        <div class="container">
          <div class="header-title">mux</div>
        </div>
      </header>

      <main class="site-main">
        <div class="container">
          <div class="content-surface">
            <h1>${title}</h1>
            <p>${description}</p>
            ${result.success
            ? '<p class="muted">Mux should now be in the foreground. You can close this tab.</p>'
            : '<p class="muted">You can close this tab.</p>'}
          </div>
        </div>
      </main>
    </div>

    <script>
      (() => {
        const ok = ${result.success ? "true" : "false"};
        if (!ok) {
          return;
        }

        try {
          window.close();
        } catch {
          // Ignore close failures.
        }

        setTimeout(() => {
          try {
            window.close();
          } catch {
            // Ignore close failures.
          }
        }, 50);
      })();
    </script>
  </body>
</html>`;
        input.res.setHeader("Content-Type", "text/html");
        if (!result.success) {
            input.res.statusCode = 400;
        }
        input.res.end(html);
        await this.finishDesktopFlow(input.flowId, result);
    }
    async handleCallbackAndExchange(input) {
        if (input.error) {
            const message = input.errorDescription
                ? `${input.error}: ${input.errorDescription}`
                : input.error;
            return (0, result_1.Err)(`Mux Gateway OAuth error: ${message}`);
        }
        if (!input.code) {
            return (0, result_1.Err)("Missing OAuth code");
        }
        const tokenResult = await this.exchangeCodeForToken(input.code);
        if (!tokenResult.success) {
            return (0, result_1.Err)(tokenResult.error);
        }
        const persistResult = this.providerService.setConfig("mux-gateway", ["couponCode"], tokenResult.data);
        if (!persistResult.success) {
            return (0, result_1.Err)(persistResult.error);
        }
        log_1.log.debug(`Mux Gateway OAuth exchange completed (state=${input.state})`);
        this.windowService?.focusMainWindow();
        return (0, result_1.Ok)(undefined);
    }
    async exchangeCodeForToken(code) {
        try {
            const response = await fetch(muxGatewayOAuth_1.MUX_GATEWAY_EXCHANGE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: (0, muxGatewayOAuth_1.buildExchangeBody)({ code }),
            });
            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                const prefix = `Mux Gateway exchange failed (${response.status})`;
                return (0, result_1.Err)(errorText ? `${prefix}: ${errorText}` : prefix);
            }
            const json = (await response.json());
            const token = typeof json.access_token === "string" ? json.access_token : null;
            if (!token) {
                return (0, result_1.Err)("Mux Gateway exchange response missing access_token");
            }
            return (0, result_1.Ok)(token);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return (0, result_1.Err)(`Mux Gateway exchange failed: ${message}`);
        }
    }
    async finishDesktopFlow(flowId, result) {
        const flow = this.desktopFlows.get(flowId);
        if (!flow || flow.settled)
            return;
        flow.settled = true;
        clearTimeout(flow.timeout);
        try {
            flow.resolveResult(result);
            // Stop accepting new connections.
            await closeServer(flow.server);
        }
        catch (error) {
            log_1.log.debug("Failed to close OAuth callback listener:", error);
        }
        finally {
            // Keep the completed flow around briefly so callers can still await the result.
            if (flow.cleanupTimeout !== null) {
                clearTimeout(flow.cleanupTimeout);
            }
            flow.cleanupTimeout = setTimeout(() => {
                this.desktopFlows.delete(flowId);
            }, COMPLETED_DESKTOP_FLOW_TTL_MS);
        }
    }
}
exports.MuxGatewayOauthService = MuxGatewayOauthService;
function escapeHtml(input) {
    return input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}
//# sourceMappingURL=muxGatewayOauthService.js.map