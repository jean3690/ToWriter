import { createApp } from "vue";
import { createPinia } from "pinia";
import "vue-sonner/style.css";
import App from "./App.vue";
import "./assets/index.css";
import "./assets/styles.css";
import { i18n, setLocale } from "./i18n";

// 应用持久化的语言设置（不迟于首帧应用，避免语言闪烁）
try {
  const raw = localStorage.getItem("towriter.settings");
  if (raw) {
    const parsed = JSON.parse(raw) as { language?: string };
    if (parsed.language === "en-US" || parsed.language === "zh-CN") {
      setLocale(parsed.language);
    }
  }
} catch {
  /* ignore */
}

createApp(App).use(createPinia()).use(i18n).mount("#app");
