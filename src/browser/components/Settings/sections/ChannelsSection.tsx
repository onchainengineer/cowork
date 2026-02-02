import React, { useCallback, useEffect, useState } from "react";
import {
  MessageSquare,
  Plus,
  Power,
  PowerOff,
  Trash2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Send,
} from "lucide-react";
import { Button } from "@/browser/components/ui/button";
import { Input } from "@/browser/components/ui/input";
import { Switch } from "@/browser/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/browser/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/browser/components/ui/dialog";
import { useAPI } from "@/browser/contexts/API";
import type { ChannelListItem, ChannelConfig } from "@/common/types/channel";

// ── Platform metadata ──────────────────────────────────────────────────

const PLATFORM_INFO: Record<
  string,
  { label: string; icon: string; credentialLabel: string; credentialKey: string; placeholder: string }
> = {
  telegram: {
    label: "Telegram",
    icon: "T",
    credentialLabel: "Bot Token",
    credentialKey: "botToken",
    placeholder: "123456:ABC-DEF1234ghIkl-zyx57W2v...",
  },
  discord: {
    label: "Discord",
    icon: "D",
    credentialLabel: "Bot Token",
    credentialKey: "botToken",
    placeholder: "MTA5NzE5OTk4NjM0...",
  },
  slack: {
    label: "Slack",
    icon: "S",
    credentialLabel: "Bot Token",
    credentialKey: "botToken",
    placeholder: "xoxb-...",
  },
  whatsapp: {
    label: "WhatsApp",
    icon: "W",
    credentialLabel: "Access Token",
    credentialKey: "accessToken",
    placeholder: "EAAx...",
  },
};

// ── Status badge ──────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    connected: "bg-green-500/20 text-green-400",
    connecting: "bg-yellow-500/20 text-yellow-400",
    disconnected: "bg-zinc-500/20 text-zinc-400",
    error: "bg-red-500/20 text-red-400",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${colors[status] ?? colors.disconnected}`}>
      {status}
    </span>
  );
}

// ── Platform icon ─────────────────────────────────────────────────────

function PlatformIcon({ type }: { type: string }) {
  const colors: Record<string, string> = {
    telegram: "bg-blue-500/20 text-blue-400",
    discord: "bg-indigo-500/20 text-indigo-400",
    slack: "bg-purple-500/20 text-purple-400",
    whatsapp: "bg-green-500/20 text-green-400",
  };
  const info = PLATFORM_INFO[type];
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-bold ${colors[type] ?? "bg-zinc-500/20 text-zinc-400"}`}
    >
      {info?.icon ?? "?"}
    </div>
  );
}

// ── Channel item row ──────────────────────────────────────────────────

interface ChannelItemProps {
  channel: ChannelListItem;
  onConnect: (accountId: string) => void;
  onDisconnect: (accountId: string) => void;
  onRemove: (accountId: string) => void;
  onToggle: (channel: ChannelListItem, enabled: boolean) => void;
  expanded: boolean;
  onToggleExpand: () => void;
  config?: ChannelConfig;
}

function ChannelItem({
  channel,
  onConnect,
  onDisconnect,
  onRemove,
  expanded,
  onToggleExpand,
  config,
}: ChannelItemProps) {
  const info = PLATFORM_INFO[channel.type];
  const isConnected = channel.status === "connected";
  const isConnecting = channel.status === "connecting";
  const sessionCount = channel.sessionCount;

  return (
    <div className="border-border-medium rounded-lg border">
      {/* Header row */}
      <div
        className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-hover/50"
        onClick={onToggleExpand}
      >
        <button className="text-muted shrink-0">
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>
        <PlatformIcon type={channel.type} />
        <div className="flex-1">
          <div className="text-foreground flex items-center gap-2 text-sm font-medium">
            {info?.label ?? channel.type}
            <span className="text-muted font-normal">/{channel.accountId}</span>
          </div>
          <div className="text-muted mt-0.5 text-xs">
            Scope: {channel.sessionScope} &middot; Sessions: {sessionCount}
          </div>
        </div>
        <StatusBadge status={channel.status} />
        <div className="flex items-center gap-1">
          {isConnected ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onDisconnect(channel.accountId);
              }}
              title="Disconnect"
            >
              <PowerOff className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={(e) => {
                e.stopPropagation();
                onConnect(channel.accountId);
              }}
              disabled={isConnecting}
              title="Connect"
            >
              <Power className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted hover:text-error h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onRemove(channel.accountId);
            }}
            title="Remove channel"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && config && (
        <div className="border-border-medium space-y-3 border-t px-4 py-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <span className="text-muted">Account ID</span>
              <div className="text-foreground font-mono">{config.accountId}</div>
            </div>
            <div>
              <span className="text-muted">Session Scope</span>
              <div className="text-foreground">{config.sessionScope ?? "per-peer"}</div>
            </div>
            <div>
              <span className="text-muted">Default Project</span>
              <div className="text-foreground font-mono truncate" title={config.defaultProjectPath}>
                {config.defaultProjectPath ?? "Not set"}
              </div>
            </div>
            <div>
              <span className="text-muted">Enabled</span>
              <div className="text-foreground">{config.enabled ? "Yes" : "No"}</div>
            </div>
          </div>
          <div>
            <span className="text-muted text-xs">Credentials</span>
            <div className="text-foreground mt-1 font-mono text-xs">
              {Object.keys(config.credentials).map((key) => (
                <div key={key}>
                  {key}: {"*".repeat(8)}...
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Create channel dialog ─────────────────────────────────────────────

interface CreateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: () => void;
}

function ChannelCreateDialog({ isOpen, onClose, onCreated }: CreateDialogProps) {
  const { api } = useAPI();

  const [type, setType] = useState("telegram");
  const [accountId, setAccountId] = useState("");
  const [credential, setCredential] = useState("");
  const [projectPath, setProjectPath] = useState("");
  const [sessionScope, setSessionScope] = useState("per-peer");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<string[]>([]);

  const info = PLATFORM_INFO[type];

  // Load available projects when dialog opens
  useEffect(() => {
    if (!isOpen || !api) return;
    api.projects
      .list()
      .then((list) => {
        const paths = list.map(([path]) => path);
        setProjects(paths);
        // Auto-select first project if none selected
        if (!projectPath && paths.length > 0) {
          setProjectPath(paths[0]!);
        }
      })
      .catch(() => {
        // ignore — user can still type manually
      });
  }, [isOpen, api]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = useCallback(() => {
    setType("telegram");
    setAccountId("");
    setCredential("");
    setProjectPath("");
    setSessionScope("per-peer");
    setEnabled(true);
    setError("");
    setSaving(false);
  }, []);

  const handleCreate = useCallback(async () => {
    if (!api) return;

    const trimmedId = accountId.trim();
    const trimmedCred = credential.trim();
    const trimmedProject = projectPath.trim();

    if (!trimmedId) {
      setError("Account ID is required");
      return;
    }
    if (!trimmedCred) {
      setError(`${info?.credentialLabel ?? "Credential"} is required`);
      return;
    }
    if (!trimmedProject) {
      setError("Project is required — select which project receives inbound messages");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const config: ChannelConfig = {
        type: type as ChannelConfig["type"],
        accountId: trimmedId,
        enabled,
        defaultProjectPath: trimmedProject,
        sessionScope: sessionScope as ChannelConfig["sessionScope"],
        credentials: { [info?.credentialKey ?? "token"]: trimmedCred },
      };

      const result = await api.channels.create(config);
      if (!result.success) {
        setError(result.error ?? "Failed to create channel");
        setSaving(false);
        return;
      }

      resetForm();
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  }, [api, type, accountId, credential, projectPath, sessionScope, enabled, info, resetForm, onCreated, onClose]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          resetForm();
          onClose();
        }
      }}
    >
      <DialogContent maxWidth="480px" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add Channel</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Platform type */}
          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium">Platform</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="border-border-medium bg-background h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PLATFORM_INFO).map(([key, p]) => (
                  <SelectItem key={key} value={key}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account ID */}
          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium">Account ID</label>
            <p className="text-muted text-xs">A unique name for this channel (e.g. "my-bot", "support-bot")</p>
            <Input
              value={accountId}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAccountId(e.target.value)}
              placeholder="my-telegram-bot"
              className="border-border-medium bg-background h-9"
            />
          </div>

          {/* Credential */}
          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium">{info?.credentialLabel ?? "Token"}</label>
            <p className="text-muted text-xs">
              {type === "telegram"
                ? "Get this from @BotFather on Telegram"
                : type === "discord"
                  ? "Get this from the Discord Developer Portal"
                  : "Platform authentication token"}
            </p>
            <Input
              value={credential}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCredential(e.target.value)}
              placeholder={info?.placeholder ?? "Enter token..."}
              className="border-border-medium bg-background h-9 font-mono text-xs"
              type="password"
            />
          </div>

          {/* Default project */}
          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium">
              Project <span className="text-error">*</span>
            </label>
            <p className="text-muted text-xs">
              New workspaces will be created in this project when a new user messages the bot
            </p>
            {projects.length > 0 ? (
              <Select value={projectPath} onValueChange={setProjectPath}>
                <SelectTrigger className="border-border-medium bg-background h-9 w-full font-mono text-xs">
                  <SelectValue placeholder="Select a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => {
                    const shortName = p.split("/").slice(-2).join("/");
                    return (
                      <SelectItem key={p} value={p}>
                        {shortName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={projectPath}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setProjectPath(e.target.value)}
                placeholder="/path/to/your/project"
                className="border-border-medium bg-background h-9 font-mono text-xs"
              />
            )}
          </div>

          {/* Session scope */}
          <div className="space-y-1.5">
            <label className="text-foreground text-sm font-medium">Session Scope</label>
            <p className="text-muted text-xs">How messages from different users are routed</p>
            <Select value={sessionScope} onValueChange={setSessionScope}>
              <SelectTrigger className="border-border-medium bg-background h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="per-peer">Per User (isolated workspaces)</SelectItem>
                <SelectItem value="per-channel-peer">Per Channel + User</SelectItem>
                <SelectItem value="shared">Shared (all users in one workspace)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Enabled toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-foreground text-sm font-medium">Auto-connect</div>
              <div className="text-muted text-xs">Connect automatically when workbench starts</div>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Toggle auto-connect" />
          </div>

          {error && <p className="text-error text-xs">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            variant="secondary"
            onClick={() => {
              resetForm();
              onClose();
            }}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={saving}>
            {saving ? "Creating..." : "Create Channel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main section ──────────────────────────────────────────────────────

export function ChannelsSection() {
  const { api } = useAPI();
  const [channels, setChannels] = useState<ChannelListItem[]>([]);
  const [configs, setConfigs] = useState<Map<string, ChannelConfig>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadChannels = useCallback(async () => {
    if (!api) return;
    setError("");
    try {
      const list = await api.channels.list();
      setChannels(list);

      // Load full configs for each channel
      const configMap = new Map<string, ChannelConfig>();
      for (const ch of list) {
        try {
          const config = await api.channels.get({ accountId: ch.accountId });
          configMap.set(ch.accountId, config);
        } catch {
          // ignore individual config load failures
        }
      }
      setConfigs(configMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    loadChannels();

    // Auto-refresh every 5 seconds so status + session counts stay live
    const interval = setInterval(() => {
      loadChannels();
    }, 5000);
    return () => clearInterval(interval);
  }, [loadChannels]);

  const handleConnect = useCallback(
    async (accountId: string) => {
      if (!api) return;
      try {
        const result = await api.channels.connect({ accountId });
        if (!result.success) {
          setError(result.error ?? "Failed to connect");
        }
        await loadChannels();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, loadChannels]
  );

  const handleDisconnect = useCallback(
    async (accountId: string) => {
      if (!api) return;
      try {
        const result = await api.channels.disconnect({ accountId });
        if (!result.success) {
          setError(result.error ?? "Failed to disconnect");
        }
        await loadChannels();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, loadChannels]
  );

  const handleRemove = useCallback(
    async (accountId: string) => {
      if (!api) return;
      try {
        const result = await api.channels.remove({ accountId });
        if (!result.success) {
          setError(result.error ?? "Failed to remove");
        }
        await loadChannels();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, loadChannels]
  );

  const handleToggle = useCallback(
    async (channel: ChannelListItem, enabled: boolean) => {
      if (!api) return;
      const config = configs.get(channel.accountId);
      if (!config) return;
      try {
        await api.channels.update({ ...config, enabled });
        await loadChannels();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    },
    [api, configs, loadChannels]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted text-xs">
            Connect external messaging platforms (Telegram, Discord, etc.) to your workbench. Each
            channel acts as a single identity — the octopus — routing messages to isolated workspace
            sessions per user.
          </p>
        </div>
      </div>

      {/* Actions bar */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Channel
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setLoading(true);
            loadChannels();
          }}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {error && <p className="text-error text-xs">{error}</p>}

      {/* Channel list */}
      {loading && channels.length === 0 ? (
        <div className="text-muted flex items-center justify-center py-12 text-sm">Loading channels...</div>
      ) : channels.length === 0 ? (
        <div className="border-border-medium flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed py-12">
          <MessageSquare className="text-muted h-8 w-8" />
          <div className="text-center">
            <p className="text-foreground text-sm font-medium">No channels configured</p>
            <p className="text-muted mt-1 text-xs">
              Add a Telegram or Discord bot to receive messages from external users
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)} className="mt-2 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Channel
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((ch) => (
            <ChannelItem
              key={ch.accountId}
              channel={ch}
              config={configs.get(ch.accountId)}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onRemove={handleRemove}
              onToggle={handleToggle}
              expanded={expandedId === ch.accountId}
              onToggleExpand={() => setExpandedId(expandedId === ch.accountId ? null : ch.accountId)}
            />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <ChannelCreateDialog isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} onCreated={loadChannels} />
    </div>
  );
}
