import { invoke } from "@tauri-apps/api/core";

export const fsService = {
  readTextFile(path: string): Promise<string> {
    return invoke("read_text_file", { path });
  },
  writeTextFile(path: string, content: string): Promise<void> {
    return invoke("write_text_file", { path, content });
  },
};
