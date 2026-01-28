import React, { createContext, useContext } from "react";
import { usePersistedState } from "@/browser/hooks/usePersistedState";
import type { UnixProviderOptions } from "@/common/types/providerOptions";

interface ProviderOptionsContextType {
  options: UnixProviderOptions;
  setAnthropicOptions: (options: UnixProviderOptions["anthropic"]) => void;
  setGoogleOptions: (options: UnixProviderOptions["google"]) => void;
}

const ProviderOptionsContext = createContext<ProviderOptionsContextType | undefined>(undefined);

export function ProviderOptionsProvider({ children }: { children: React.ReactNode }) {
  const [anthropicOptions, setAnthropicOptions] = usePersistedState<
    UnixProviderOptions["anthropic"]
  >("provider_options_anthropic", {
    use1MContext: false,
  });

  const [googleOptions, setGoogleOptions] = usePersistedState<UnixProviderOptions["google"]>(
    "provider_options_google",
    {}
  );

  const value = {
    options: {
      anthropic: anthropicOptions,
      google: googleOptions,
    },
    setAnthropicOptions,
    setGoogleOptions,
  };

  return (
    <ProviderOptionsContext.Provider value={value}>{children}</ProviderOptionsContext.Provider>
  );
}

export function useProviderOptionsContext() {
  const context = useContext(ProviderOptionsContext);
  if (!context) {
    throw new Error("useProviderOptionsContext must be used within a ProviderOptionsProvider");
  }
  return context;
}
