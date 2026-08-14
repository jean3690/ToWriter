<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useWritingStore } from "../stores/writing";
import { useFocusStore } from "../stores/focus";
import { useUiStore } from "../stores/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const { t } = useI18n();
const writing = useWritingStore();
const focus = useFocusStore();
const ui = useUiStore();

const goalInput = ref(String(writing.dailyGoal));
const editingGoal = ref(false);

const days = computed(() => writing.lastDays(7));
const maxWords = computed(() => Math.max(1, ...days.value.map((d) => d.words)));

async function saveGoal() {
  await writing.setDailyGoal(Number(goalInput.value) || 0);
  editingGoal.value = false;
  ui.showToast(t("stats.goalUpdated"));
}
</script>

<template>
  <div class="stats-panel">
    <div class="stats-card">
      <div class="stats-card-head">
        <span class="stats-title">{{ t("stats.today") }}</span>
        <Button variant="ghost" size="xs" @click="editingGoal = !editingGoal">
          {{ editingGoal ? t("stats.done") : t("stats.setGoal") }}
        </Button>
      </div>
      <template v-if="editingGoal">
        <div class="goal-row">
          <Input v-model="goalInput" type="number" min="0" class="h-8" />
          <Button size="sm" @click="saveGoal">{{ t("stats.done") }}</Button>
        </div>
      </template>
      <template v-else>
        <div class="big-number">{{ writing.todayWords }}</div>
        <div class="stats-meta">{{ t("stats.todayWritten", { today: writing.todayWords, goal: writing.dailyGoal }) }}</div>
        <div class="progress-track">
          <div class="progress-fill" :style="{ width: `${writing.todayPercent}%` }" />
        </div>
        <div class="stats-meta">{{ t("stats.streakTotal", { percent: writing.todayPercent, streak: writing.streak, total: writing.totalWords }) }}</div>
      </template>
    </div>

    <div class="stats-card">
      <div class="stats-card-head">
        <span class="stats-title">{{ t("stats.last7days") }}</span>
      </div>
      <div class="bar-chart">
        <div v-for="(d, i) in days" :key="i" class="bar-col" :title="`${d.label}: ${d.words}`">
          <div class="bar-track">
            <div
              class="bar-fill"
              :class="{ today: d.isToday }"
              :style="{ height: `${Math.round((d.words / maxWords) * 100)}%` }"
            />
          </div>
          <div class="bar-label" :class="{ today: d.isToday }">{{ d.label }}</div>
        </div>
      </div>
    </div>

    <div class="stats-card">
      <div class="stats-card-head">
        <span class="stats-title">{{ t("stats.focus") }}</span>
      </div>
      <div class="big-number small">{{ focus.completedToday }}</div>
      <div class="stats-meta">{{ t("stats.focusStats", { today: focus.completedToday, total: focus.totalCompleted }) }}</div>
    </div>
  </div>
</template>
