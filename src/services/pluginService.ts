import { invoke } from "@tauri-apps/api/core";
import type { PluginManifest } from "../plugins/manifest";

export interface MarketPlugin {
  manifest: PluginManifest;
  dir: string;
}

export const pluginService = {
  scanPlugins(workspace: string): Promise<PluginManifest[]> {
    return invoke("scan_plugins", { workspace });
  },
  readPluginSource(dir: string, main: string): Promise<string> {
    return invoke("read_plugin_source", { dir, main });
  },
  ensureExamplePlugin(workspace: string): Promise<void> {
    return invoke("ensure_example_plugin", { workspace });
  },
  scanMarket(): Promise<MarketPlugin[]> {
    return invoke("scan_market");
  },
  installMarketPlugin(pluginName: string, workspace: string): Promise<void> {
    return invoke("install_market_plugin", { pluginName, workspace });
  },
  openMarketFolder(): Promise<void> {
    return invoke("open_market_folder");
  },
};
