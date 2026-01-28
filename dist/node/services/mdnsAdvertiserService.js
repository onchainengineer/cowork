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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MdnsAdvertiserService = exports.UNIX_MDNS_SERVICE_TYPE = void 0;
exports.buildUnixMdnsServiceOptions = buildUnixMdnsServiceOptions;
const assert_1 = __importDefault(require("../../common/utils/assert"));
const ciao_1 = require("@homebridge/ciao");
const net = __importStar(require("node:net"));
const os = __importStar(require("node:os"));
const log_1 = require("./log");
// NOTE: Avoid "unix" here: it's an IANA-registered service name ("Multiplexing Protocol"),
// and some discovery tools will display/handle it specially.
exports.UNIX_MDNS_SERVICE_TYPE = "unix-api";
function getNonInternalInterfaceNames(networkInterfaces, family) {
    const names = [];
    const emptyInfos = [];
    for (const name of Object.keys(networkInterfaces)) {
        const infos = networkInterfaces[name] ?? emptyInfos;
        for (const info of infos) {
            const infoFamily = info.family;
            if (family && infoFamily !== family) {
                continue;
            }
            if (info.internal) {
                continue;
            }
            const address = info.address;
            // Filter out link-local addresses (they are rarely what users want to connect to).
            if (infoFamily === "IPv4" && address.startsWith("169.254.")) {
                continue;
            }
            if (infoFamily === "IPv6" && address.toLowerCase().startsWith("fe80:")) {
                continue;
            }
            names.push(name);
            break;
        }
    }
    return Array.from(new Set(names)).sort();
}
function buildUnixMdnsServiceOptions(options) {
    const bindHost = options.bindHost.trim();
    (0, assert_1.default)(bindHost, "bindHost is required");
    (0, assert_1.default)(Number.isInteger(options.port) && options.port >= 1 && options.port <= 65535, "invalid port");
    const rawInstanceName = options.instanceName.trim();
    (0, assert_1.default)(rawInstanceName, "instanceName is required");
    // DNS-SD service instance names are encoded as a single DNS label. Dots are legal characters
    // in a label, but they must be escaped in the DNS wire format. `@homebridge/ciao` does not
    // appear to escape dots, which results in *multi-label* instance names like:
    //   unix-host.home._mux-api._tcp.local.
    // Those don't show up via Apple's DNSServiceBrowse/DNSServiceResolve APIs (e.g. `dns-sd -B/-L`).
    //
    // To keep discovery tool/client behavior predictable, replace dots with hyphens.
    const instanceName = rawInstanceName.replaceAll(".", "-");
    const version = options.version.trim();
    (0, assert_1.default)(version, "version is required");
    const txt = {
        path: "/orpc",
        wsPath: "/orpc/ws",
        version,
        authRequired: options.authRequired ? "1" : "0",
    };
    // Keep TXT payload intentionally small (think: "hints", not configuration).
    // DNS-SD TXT uses an array of length-prefixed strings; this is a rough budget check.
    const txtBytes = Object.entries(txt)
        .map(([k, v]) => Buffer.byteLength(`${k}=${v}`, "utf8"))
        .reduce((a, b) => a + b, 0);
    (0, assert_1.default)(txtBytes <= 512, `TXT record too large (${txtBytes} bytes)`);
    const serviceOptions = {
        name: instanceName,
        type: exports.UNIX_MDNS_SERVICE_TYPE,
        protocol: "tcp" /* Protocol.TCP */,
        port: options.port,
        txt,
    };
    const networkInterfaces = options.networkInterfaces ?? os.networkInterfaces();
    // If unix is bound to IPv4 wildcard only, don't advertise IPv6 addresses.
    if (bindHost === "0.0.0.0") {
        serviceOptions.disabledIpv6 = true;
        // Avoid advertising loopback-only addresses (e.g. 127.0.0.1). Clients on other devices may
        // naively pick the first resolved address and fail to connect.
        const interfaceNames = getNonInternalInterfaceNames(networkInterfaces, "IPv4");
        if (interfaceNames.length > 0) {
            serviceOptions.restrictedAddresses = interfaceNames;
        }
    }
    else if (bindHost === "::") {
        // Similar: when bound to IPv6 wildcard, don't include loopback-only addresses in DNS-SD records.
        const interfaceNames = getNonInternalInterfaceNames(networkInterfaces);
        if (interfaceNames.length > 0) {
            serviceOptions.restrictedAddresses = interfaceNames;
        }
    }
    else if (net.isIP(bindHost)) {
        // If unix is bound to a specific IP, only advertise that address (otherwise clients may
        // discover an address that doesn't accept connections).
        serviceOptions.restrictedAddresses = [bindHost];
    }
    return serviceOptions;
}
function stableTxtKey(txt) {
    return Object.entries(txt)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join("&");
}
function stableServiceKey(options) {
    const restricted = options.restrictedAddresses
        ? [...options.restrictedAddresses].sort().join(",")
        : "";
    const txt = options.txt && typeof options.txt === "object"
        ? stableTxtKey(options.txt)
        : "";
    return [
        options.name,
        options.type,
        options.protocol ?? "tcp",
        String(options.port ?? ""),
        restricted,
        String(options.disabledIpv6 ?? false),
        txt,
    ].join("|");
}
class MdnsAdvertiserService {
    responder = null;
    service = null;
    advertisedKey = null;
    chain = Promise.resolve();
    enqueue(fn) {
        // Ensure a failed operation doesn't poison future start/stop calls.
        this.chain = this.chain
            .catch((err) => {
            log_1.log.warn("mDNS advertiser previous operation failed:", err);
        })
            .then(fn);
        return this.chain;
    }
    start(serviceOptions) {
        (0, assert_1.default)(serviceOptions.name, "serviceOptions.name is required");
        (0, assert_1.default)(serviceOptions.type, "serviceOptions.type is required");
        return this.enqueue(async () => {
            const nextKey = stableServiceKey(serviceOptions);
            if (this.service && this.advertisedKey === nextKey) {
                return;
            }
            // If anything relevant changed (port, type, name, restrictions), republish.
            if (this.service) {
                await this.service.destroy();
                this.service = null;
                this.advertisedKey = null;
            }
            this.responder ?? (this.responder = (0, ciao_1.getResponder)());
            const responder = this.responder;
            (0, assert_1.default)(responder, "responder must be initialized");
            const service = responder.createService(serviceOptions);
            service.on("name-change" /* ServiceEvent.NAME_CHANGED */, (name) => {
                log_1.log.info(`mDNS service name changed due to conflict: ${name}`);
            });
            service.on("hostname-change" /* ServiceEvent.HOSTNAME_CHANGED */, (hostname) => {
                log_1.log.info(`mDNS hostname changed due to conflict: ${hostname}`);
            });
            await service.advertise();
            log_1.log.info("mDNS service advertised", {
                name: serviceOptions.name,
                type: serviceOptions.type,
                protocol: serviceOptions.protocol ?? "tcp",
                port: serviceOptions.port,
                restrictedAddresses: serviceOptions.restrictedAddresses,
                disabledIpv6: serviceOptions.disabledIpv6,
                txt: serviceOptions.txt,
            });
            this.service = service;
            this.advertisedKey = nextKey;
        });
    }
    stop() {
        return this.enqueue(async () => {
            const service = this.service;
            this.service = null;
            this.advertisedKey = null;
            if (service) {
                await service.destroy();
            }
            const responder = this.responder;
            this.responder = null;
            if (responder) {
                await responder.shutdown();
            }
            if (service || responder) {
                log_1.log.info("mDNS service stopped");
            }
        });
    }
}
exports.MdnsAdvertiserService = MdnsAdvertiserService;
//# sourceMappingURL=mdnsAdvertiserService.js.map