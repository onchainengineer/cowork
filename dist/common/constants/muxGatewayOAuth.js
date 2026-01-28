"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MUX_GATEWAY_EXCHANGE_URL = exports.MUX_GATEWAY_AUTHORIZE_URL = exports.MUX_GATEWAY_CLIENT_SECRET = exports.MUX_GATEWAY_CLIENT_ID = exports.MUX_GATEWAY_ORIGIN = void 0;
exports.buildAuthorizeUrl = buildAuthorizeUrl;
exports.buildExchangeBody = buildExchangeBody;
exports.MUX_GATEWAY_ORIGIN = "";
exports.MUX_GATEWAY_CLIENT_ID = "mux-client";
exports.MUX_GATEWAY_CLIENT_SECRET = "mux-client";
exports.MUX_GATEWAY_AUTHORIZE_URL = `${exports.MUX_GATEWAY_ORIGIN}/oauth2/authorize`;
exports.MUX_GATEWAY_EXCHANGE_URL = `${exports.MUX_GATEWAY_ORIGIN}/api/v1/oauth2/exchange`;
function buildAuthorizeUrl(input) {
    const url = new URL(exports.MUX_GATEWAY_AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", exports.MUX_GATEWAY_CLIENT_ID);
    url.searchParams.set("redirect_uri", input.redirectUri);
    url.searchParams.set("state", input.state);
    return url.toString();
}
function buildExchangeBody(input) {
    const body = new URLSearchParams();
    body.set("grant_type", "authorization_code");
    body.set("code", input.code);
    body.set("client_id", exports.MUX_GATEWAY_CLIENT_ID);
    body.set("client_secret", exports.MUX_GATEWAY_CLIENT_SECRET);
    return body;
}
//# sourceMappingURL=muxGatewayOAuth.js.map