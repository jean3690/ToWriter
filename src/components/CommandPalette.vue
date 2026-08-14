<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useUiStore } from "../stores/ui";
import { commandService, type CommandEntry } from "../plugins/commands";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

const { t } = useI18n();
const ui = useUiStore();
const open = ref(false);
const items = ref<CommandEntry[]>([]);

const grouped = computed(() => {
  const map = new Map<string, CommandEntry[]>();
  for (const it of items.value) {
    const cat = it.categoryKey ? t(it.categoryKey) : it.category;
    const arr = map.get(cat) ?? [];
    arr.push(it);
    map.set(cat, arr);
  }
  return [...map.entries()].map(([cat, list]) => ({ cat, list }));
});

onMounted(() => {
  items.value = commandService.list().sort((a, b) => a.category.localeCompare(b.category));
  open.value = true;
});

function run(item: CommandEntry) {
  ui.closeCommandPalette();
  void commandService.execute(item.id).catch((e) => {
    ui.showToast(e instanceof Error ? e.message : String(e), true);
  });
}
</script>

<template>
  <CommandDialog
    v-model:open="open"
    :title="t('commandPalette.title')"
    :description="t('commandPalette.desc')"
    @update:open="(v: boolean) => { if (!v) ui.closeCommandPalette() }"
  >
    <CommandInput :placeholder="t('commandPalette.placeholder')" />
    <CommandList>
      <CommandEmpty>{{ t("commandPalette.empty") }}</CommandEmpty>
      <CommandGroup v-for="g in grouped" :key="g.cat" :heading="g.cat">
        <CommandItem
          v-for="item in g.list"
          :key="item.id"
          :value="`${g.cat} ${item.titleKey ? t(item.titleKey) : item.title} ${item.id}`"
          @select="run(item)"
        >
          <span class="text-muted-foreground">{{ g.cat }}</span>
          <span class="flex-1">{{ item.titleKey ? t(item.titleKey) : item.title }}</span>
          <span class="text-xs text-muted-foreground">{{ item.id }}</span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
