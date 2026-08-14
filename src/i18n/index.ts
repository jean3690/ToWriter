import { createI18n } from "vue-i18n";
import zhCN from "./locales/zh-CN";
import enUS from "./locales/en-US";

export type Locale = "zh-CN" | "en-US";

export const LOCALES: Array<{ value: Locale; label: string }> = [
  { value: "zh-CN", label: "简体中文" },
  { value: "en-US", label: "English" },
];

export const i18n = createI18n({
  legacy: false,
  locale: "zh-CN",
  fallbackLocale: "zh-CN",
  messages: {
    "zh-CN": zhCN,
    "en-US": enUS,
  },
});

export function setLocale(locale: Locale) {
  i18n.global.locale.value = locale;
  document.documentElement.lang = locale === "en-US" ? "en" : "zh-CN";
}
