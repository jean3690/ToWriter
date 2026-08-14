import { defineStore } from "pinia";
import { i18n } from "../i18n";
import { persistLoad, persistSave } from "../services/persist";

const STORE_KEY = "towriter:rules";

export interface ConsistencyRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  custom?: boolean;
  /** 内置规则的 i18n key（存在时优先用 key 翻译展示） */
  nameKey?: string;
  descKey?: string;
}

const DEFAULT_RULES: ConsistencyRule[] = [
  { id: "characters", name: "人物设定", nameKey: "store.ruleCharacters", description: "姓名 / 年龄 / 性格 / 关系与人物设定一致", descKey: "store.ruleCharactersDesc", enabled: true },
  { id: "timeline", name: "时间线", nameKey: "store.ruleTimeline", description: "事件发生时间与先后顺序一致", descKey: "store.ruleTimelineDesc", enabled: true },
  { id: "space", name: "地点与空间", nameKey: "store.ruleSpace", description: "场景位置与空间布局前后一致", descKey: "store.ruleSpaceDesc", enabled: true },
  { id: "logic", name: "事件逻辑", nameKey: "store.ruleLogic", description: "因果与事件推进逻辑自洽", descKey: "store.ruleLogicDesc", enabled: true },
  { id: "foreshadow", name: "伏笔呼应", nameKey: "store.ruleForeshadow", description: "伏笔埋设与回收形成闭环", descKey: "store.ruleForeshadowDesc", enabled: true },
  { id: "dialogue", name: "对话呼应", nameKey: "store.ruleDialogue", description: "人物对话前后呼应、口吻一致", descKey: "store.ruleDialogueDesc", enabled: true },
];

interface RulesState {
  rules: ConsistencyRule[];
  loaded: boolean;
}

export const useRulesStore = defineStore("rules", {
  state: (): RulesState => ({
    rules: DEFAULT_RULES.map((r) => ({ ...r })),
    loaded: false,
  }),
  getters: {
    /** 展示用：名字与描述按当前语言翻译 */
    displayRules(state): ConsistencyRule[] {
      return state.rules.map((r) => {
        if (r.custom) return r;
        return {
          ...r,
          name: r.nameKey ? i18n.global.t(r.nameKey) : r.name,
          description: r.descKey ? i18n.global.t(r.descKey) : r.description,
        };
      });
    },
    enabledDescriptions(state): string[] {
      return state.rules
        .filter((r) => r.enabled)
        .map((r) => {
          const name = r.nameKey ? i18n.global.t(r.nameKey) : r.name;
          const desc = r.descKey ? i18n.global.t(r.descKey) : r.description;
          return desc ? `${name}（${desc}）` : name;
        });
    },
  },
  actions: {
    async load() {
      const data = await persistLoad<ConsistencyRule[]>(STORE_KEY);
      if (Array.isArray(data) && data.length > 0) {
        this.rules = data;
      }
      this.loaded = true;
    },
    async persist() {
      await persistSave(STORE_KEY, this.rules);
    },
    toggle(id: string) {
      const r = this.rules.find((x) => x.id === id);
      if (r) {
        r.enabled = !r.enabled;
        void this.persist();
      }
    },
    add(name: string, description: string) {
      if (!name.trim()) return;
      this.rules.push({
        id: `custom-${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        enabled: true,
        custom: true,
      });
      void this.persist();
    },
    remove(id: string) {
      this.rules = this.rules.filter((x) => x.id !== id);
      void this.persist();
    },
  },
});
