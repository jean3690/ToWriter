<script setup lang="ts">
import { nextTick, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { open as dialogOpen, save as dialogSave } from "@tauri-apps/plugin-dialog";
import { useAiStore } from "../stores/ai";
import { useWorkspaceStore } from "../stores/workspace";
import { useUiStore } from "../stores/ui";
import { usePromptsStore } from "../stores/prompts";
import { useRulesStore } from "../stores/rules";
import { fsService } from "../services/fsService";
import { streamChat } from "../ai/client";
import { buildBookContext } from "../ai/context";
import { chatMessages } from "../ai/prompts";
import { runConsistency, type ConsistencyIssue } from "../ai/consistency";
import { generateOutline, saveOutlineContent } from "../ai/outline";
import { insertAtCursor } from "../editor/bridge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import PromptDialog from "./PromptDialog.vue";

type ChatRole = "user" | "assistant";
interface Msg {
  role: ChatRole;
  content: string;
  streaming?: boolean;
}

const { t } = useI18n();
const ai = useAiStore();
const ws = useWorkspaceStore();
const ui = useUiStore();
const prompts = usePromptsStore();
const rules = useRulesStore();

const tab = ref<"chat" | "consistency" | "outline" | "prompts">("chat");
const rulesOpen = ref(false);
const newRuleName = ref("");
const newRuleDesc = ref("");
const promptDialog = ref<InstanceType<typeof PromptDialog>>();

// ---- chat ----
const messages = ref<Msg[]>([]);
const input = ref("");
const includeContext = ref(true);
const chatBusy = ref(false);
const chatBody = ref<HTMLElement>();
let chatAbort: AbortController | null = null;

watch(messages, async () => {
  await nextTick();
  chatBody.value?.scrollTo({ top: chatBody.value.scrollHeight });
});

async function send() {
  const text = input.value.trim();
  if (!text || chatBusy.value) return;
  input.value = "";
  const userMsg: Msg = { role: "user", content: text };
  const botMsg: Msg = { role: "assistant", content: "", streaming: true };
  messages.value.push(userMsg, botMsg);
  chatBusy.value = true;
  const ctrl = new AbortController();
  chatAbort = ctrl;
  try {
    const ctx = includeContext.value ? buildBookContext(ws.book) : "";
    const prior = messages.value.slice(0, -2).map((m) => ({ role: m.role, content: m.content }));
    const msgs = chatMessages(ctx, prior, text);
    await streamChat({
      clientType: ai.activeConfig.clientType,
      config: ai.activeConfig,
      messages: msgs,
      temperature: ai.temperature,
      maxTokens: ai.maxTokens,
      signal: ctrl.signal,
      onToken: (d) => {
        botMsg.content += d;
      },
    });
  } catch (e) {
    if (!ctrl.signal.aborted) {
      botMsg.content = `${botMsg.content}\n[${t("store.aiErrorPrefix")}] ${e instanceof Error ? e.message : String(e)}`;
    }
  } finally {
    botMsg.streaming = false;
    chatBusy.value = false;
    chatAbort = null;
  }
}

function stopChat() {
  chatAbort?.abort();
}

function clearChat() {
  if (chatBusy.value) return;
  messages.value = [];
}

function saveCurrentAsPrompt() {
  const text = input.value.trim();
  if (!text) return;
  prompts.add(text.split("\n")[0], text);
  input.value = "";
  ui.showToast(t("ai.savedToPrompts"));
}

// ---- prompts ----
function usePrompt(content: string) {
  input.value = content;
  tab.value = "chat";
}

async function copyPrompt(content: string) {
  try {
    await navigator.clipboard.writeText(content);
    ui.showToast(t("ai.copied"));
  } catch {
    ui.showToast(t("ai.copyFail"), true);
  }
}

async function renamePrompt(id: string, current: string) {
  const name = await promptDialog.value?.prompt(t("ai.promptTitle"), current);
  if (name) prompts.rename(id, name);
}

async function exportPrompts() {
  const path = await dialogSave({
    defaultPath: "towriter-prompts.json",
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (!path) return;
  try {
    await fsService.writeTextFile(path, prompts.exportData());
    ui.showToast(t("ai.exportedPrompts", { path }));
  } catch (e) {
    ui.showToast(e instanceof Error ? e.message : String(e), true);
  }
}

async function importPrompts() {
  const path = await dialogOpen({
    multiple: false,
    filters: [{ name: "JSON", extensions: ["json"] }],
  });
  if (typeof path !== "string") return;
  try {
    const raw = await fsService.readTextFile(path);
    const count = prompts.importData(raw);
    ui.showToast(t("ai.imported", { count }));
  } catch (e) {
    ui.showToast(e instanceof Error ? e.message : String(e), true);
  }
}

// ---- consistency ----
const issues = ref<ConsistencyIssue[]>([]);
const checkRunning = ref(false);
const checkProgress = ref("");

async function check() {
  if (checkRunning.value) return;
  checkRunning.value = true;
  issues.value = [];
  checkProgress.value = "";
  try {
    issues.value = await runConsistency((t) => {
      checkProgress.value = t;
    });
  } finally {
    checkRunning.value = false;
  }
}

function gotoChapter(title: string) {
  const ch = ws.book?.chapters.find((c) => c.title === title);
  if (ch) void ws.openChapter(ch);
}

function addRule() {
  rules.add(newRuleName.value, newRuleDesc.value);
  newRuleName.value = "";
  newRuleDesc.value = "";
}

// ---- outline ----
const outlineText = ref("");
const outlineBusy = ref(false);

async function genOutline() {
  if (outlineBusy.value) return;
  outlineBusy.value = true;
  outlineText.value = "";
  try {
    outlineText.value = await generateOutline((t) => {
      outlineText.value = t;
    });
  } finally {
    outlineBusy.value = false;
  }
}

async function applyOutline() {
  if (!outlineText.value.trim()) return;
  await saveOutlineContent(outlineText.value);
}
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <div class="flex items-center border-b">
      <Tabs v-model="tab" class="flex-1">
        <TabsList variant="line" class="w-full justify-start border-0">
          <TabsTrigger value="chat">{{ t("ai.chat") }}</TabsTrigger>
          <TabsTrigger value="consistency">{{ t("ai.consistency") }}</TabsTrigger>
          <TabsTrigger value="outline">{{ t("ai.outline") }}</TabsTrigger>
          <TabsTrigger value="prompts">{{ t("ai.prompts") }}</TabsTrigger>
        </TabsList>
      </Tabs>
      <Button variant="ghost" size="sm" class="mr-1.5 text-muted-foreground" :title="t('ai.settings')" @click="ui.openAiSettings()">
        {{ t("ai.settings") }}
      </Button>
    </div>

    <div v-if="ai.error" class="mx-2.5 mt-2 cursor-pointer rounded-md border border-destructive/50 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive" @click="ai.error = null">
      {{ ai.error }}
    </div>

    <template v-if="tab === 'chat'">
      <div ref="chatBody" class="chat-body">
        <div v-if="messages.length === 0" class="chat-empty">
          {{ t("ai.chatEmpty") }}
        </div>
        <div v-for="(m, i) in messages" :key="i" class="chat-msg" :class="m.role">
          <div class="chat-bubble">
            {{ m.content }}<span v-if="m.streaming" class="caret">▌</span>
          </div>
          <div v-if="m.role === 'assistant' && m.content && !m.streaming" class="chat-actions">
            <Button variant="ghost" size="xs" @click="insertAtCursor(m.content)">{{ t("ai.insertToDoc") }}</Button>
            <Button variant="ghost" size="xs" @click="messages.splice(i, 1)">{{ t("ai.delete") }}</Button>
          </div>
        </div>
      </div>
      <div class="chat-input">
        <label class="ctx-toggle" :title="t('ai.contextToggleTitle')">
          <Checkbox :checked="includeContext" @update:checked="includeContext = !!$event" />
          {{ t("ai.ctxToggle") }}
        </label>
        <Textarea
          v-model="input"
          rows="2"
          class="min-h-[3.5rem] resize-none"
          :placeholder="t('ai.chatPlaceholder')"
          @keydown.enter.exact.prevent="send"
        />
        <div class="chat-btns">
          <Button v-if="chatBusy" size="sm" @click="stopChat">{{ t("ai.stop") }}</Button>
          <Button v-else size="sm" :disabled="!input.trim()" @click="send">{{ t("ai.send") }}</Button>
          <Button size="sm" variant="outline" :disabled="!input.trim()" :title="t('ai.saveAsPrompt')" @click="saveCurrentAsPrompt">
            {{ t("ai.saveAsPrompt") }}
          </Button>
          <Button size="sm" variant="ghost" :disabled="chatBusy || messages.length === 0" @click="clearChat">{{ t("ai.clear") }}</Button>
        </div>
      </div>
    </template>

    <template v-else-if="tab === 'consistency'">
      <div class="ai-panel-body">
        <div class="panel-actions">
          <Button :disabled="checkRunning" @click="check">
            {{ checkRunning ? t("ai.checking") : t("ai.checkAll") }}
          </Button>
          <Button variant="outline" size="sm" @click="rulesOpen = !rulesOpen">
            {{ t("ai.rules", { count: rules.enabledDescriptions.length }) }}
          </Button>
          <span class="hint">{{ t("ai.rulesHint") }}</span>
        </div>

        <div v-if="rulesOpen" class="rules-box">
          <div v-for="r in rules.displayRules" :key="r.id" class="rule-row">
            <Checkbox :checked="r.enabled" @update:checked="rules.toggle(r.id)" />
            <Label class="flex-1 cursor-pointer text-xs" @click="rules.toggle(r.id)">{{ r.name }}</Label>
            <span class="rule-desc">{{ r.description }}</span>
            <button v-if="r.custom" class="rule-del" @click="rules.remove(r.id)">×</button>
          </div>
          <div class="rule-add">
            <input v-model="newRuleName" class="new-chapter-input m-0" :placeholder="t('ai.ruleName')" />
            <input v-model="newRuleDesc" class="new-chapter-input m-0" :placeholder="t('ai.ruleDesc')" />
            <Button size="sm" :disabled="!newRuleName.trim()" @click="addRule">{{ t("ai.add") }}</Button>
          </div>
        </div>

        <pre v-if="checkRunning && checkProgress" class="check-progress">{{ checkProgress }}</pre>
        <div v-if="issues.length" class="issue-list">
          <div v-for="(iss, i) in issues" :key="i" class="issue" :class="iss.level">
            <div class="issue-head">
              <span class="issue-level" :class="iss.level">{{ iss.level }}</span>
              <button v-if="iss.chapter" class="chapter-link" @click="gotoChapter(iss.chapter)">
                {{ iss.chapter }}
              </button>
            </div>
            <div class="issue-quote">「{{ iss.quote }}」</div>
            <div class="issue-desc">{{ iss.issue }}</div>
            <div v-if="iss.suggestion" class="issue-sugg">{{ iss.suggestion }}</div>
          </div>
        </div>
        <div v-else-if="!checkRunning" class="empty-hint">{{ t("ai.noIssues") }}</div>
      </div>
    </template>

    <template v-else-if="tab === 'outline'">
      <div class="ai-panel-body">
        <div class="panel-actions">
          <Button :disabled="outlineBusy || !ws.book" @click="genOutline">
            {{ outlineBusy ? t("ai.generating") : t("ai.genOutline") }}
          </Button>
          <Button variant="outline" :disabled="!outlineText.trim()" @click="applyOutline">{{ t("ai.writeOutline") }}</Button>
          <span class="hint">{{ t("ai.outlineHint") }}</span>
        </div>
        <pre class="outline-preview">{{ outlineText }}</pre>
      </div>
    </template>

    <template v-else>
      <div class="ai-panel-body">
        <div class="panel-actions">
          <Button size="sm" variant="outline" @click="exportPrompts">{{ t("ai.exportJson") }}</Button>
          <Button size="sm" variant="outline" @click="importPrompts">{{ t("ai.importJson") }}</Button>
          <span class="hint">{{ t("ai.promptsHint") }}</span>
        </div>
        <div class="prompt-list">
          <div v-for="p in prompts.prompts" :key="p.id" class="prompt-item">
            <div class="prompt-head">
              <span class="prompt-name">{{ p.name }}</span>
              <div class="prompt-actions">
                <Button variant="ghost" size="xs" @click="usePrompt(p.content)">{{ t("ai.use") }}</Button>
                <Button variant="ghost" size="xs" @click="copyPrompt(p.content)">{{ t("ai.copy") }}</Button>
                <Button variant="ghost" size="xs" @click="renamePrompt(p.id, p.name)">{{ t("ai.rename") }}</Button>
                <Button variant="ghost" size="xs" class="text-destructive hover:text-destructive" @click="prompts.remove(p.id)">{{ t("ai.deletePrompt") }}</Button>
              </div>
            </div>
            <div class="prompt-content">{{ p.content }}</div>
          </div>
          <div v-if="prompts.prompts.length === 0" class="empty-hint">{{ t("ai.promptsEmpty") }}</div>
        </div>
      </div>
    </template>
    <PromptDialog ref="promptDialog" />
  </div>
</template>
