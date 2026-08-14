export interface CommandContribution {
  command: string;
  title: string;
  category: string;
}

export interface ViewContribution {
  id: string;
  title: string;
}

export interface KeybindingContribution {
  command: string;
  key: string;
}

export interface Contributes {
  commands: CommandContribution[];
  views: ViewContribution[];
  keybindings: KeybindingContribution[];
}

export interface PluginManifest {
  name: string;
  displayName: string;
  version: string;
  publisher: string;
  main: string;
  engines: Record<string, string>;
  contributes: Contributes;
  dir: string;
  compatible?: boolean;
}
