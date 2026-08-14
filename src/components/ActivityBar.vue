<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useUiStore } from "../stores/ui";

const ui = useUiStore();
const { t } = useI18n();
</script>

<template>
  <nav class="activity-bar">
    <button
      class="activity-item"
      :class="{ active: ui.activity === 'files' }"
      :title="t('activity.files')"
      @click="ui.setActivity('files')"
    >
      <svg viewBox="0 0 16 16" width="22" height="22">
        <path
          fill="currentColor"
          d="M1.5 3.25A1.75 1.75 0 0 1 3.25 1.5h2.73c.53 0 1.04.24 1.38.66l.77.94h5.32A1.75 1.75 0 0 1 15.2 4.85l-.35 8.5a1.75 1.75 0 0 1-1.75 1.65H3.25a1.75 1.75 0 0 1-1.75-1.75V3.25z"
        />
      </svg>
    </button>
    <button
      class="activity-item"
      :class="{ active: ui.activity === 'ai' }"
      :title="t('activity.ai')"
      @click="ui.setActivity('ai')"
    >
      <svg viewBox="0 0 16 16" width="22" height="22">
        <path
          fill="currentColor"
          d="M8 1.5L9.7 5.9l4.3 1.6-4.3 1.6L8 13.5 6.3 9.1 2 7.5l4.3-1.6L8 1.5z"
        />
      </svg>
    </button>
    <button
      class="activity-item"
      :class="{ active: ui.activity === 'plugins' }"
      :title="t('activity.plugins')"
      @click="ui.setActivity('plugins')"
    >
      <svg viewBox="0 0 16 16" width="22" height="22">
        <path
          fill="currentColor"
          d="M8.5 2.5a2 2 0 0 1 2 2V6H13a1.5 1.5 0 0 1 1.5 1.5V11a1.5 1.5 0 0 1-1.5 1.5h-1a1 1 0 1 0 0 2 1 1 0 0 1 1 1 1.5 1.5 0 0 1-1.5 1.5H8a1.5 1.5 0 0 1-1.5-1.5 1 1 0 0 1 1-1 1 1 0 0 0 0-2H3.5A1.5 1.5 0 0 1 2 11V7.5A1.5 1.5 0 0 1 3.5 6h3V4.5a2 2 0 0 1 2-2zm0 1.5a.5.5 0 0 0-.5.5V6h1V4.5a.5.5 0 0 0-.5-.5z"
        />
      </svg>
    </button>
    <button
      class="activity-item"
      :class="{ active: ui.activity === 'search' }"
      :title="t('activity.search')"
      @click="ui.setActivity('search')"
    >
      <svg viewBox="0 0 16 16" width="22" height="22">
        <path
          fill="currentColor"
          d="M10.5 2.5a5 5 0 1 0 3.03 8.99l2.24 2.24a.75.75 0 1 1-1.06 1.06l-2.24-2.24A5 5 0 0 0 10.5 2.5zm-3.5 1.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"
        />
      </svg>
    </button>
    <div class="activity-spacer" />
    <button
      class="activity-item"
      :title="t('activity.settings')"
      @click="ui.openSettings()"
    >
      <svg viewBox="0 0 16 16" width="22" height="22">
        <path
          fill="currentColor"
          d="M6.5 1.5a1 1 0 0 1 3 0l.2.7a1 1 0 0 0 .6.7l.6.2a1 1 0 0 0 1.1-.4l.5-.7a1 1 0 0 1 2.6 1.5l-.5.7a1 1 0 0 0 0 1.1l.2.6a1 1 0 0 0 .8.6l.9.1a1 1 0 0 1 0 3l-.9.1a1 1 0 0 0-.8.6l-.2.6a1 1 0 0 0 0 1.1l.5.7a1 1 0 0 1-2.6 1.5l-.5-.7a1 1 0 0 0-1.1-.4l-.6.2a1 1 0 0 0-.6.7l-.2.7a1 1 0 0 1-3 0l-.2-.7a1 1 0 0 0-.6-.7l-.6-.2a1 1 0 0 0-1.1.4l-.5.7a1 1 0 0 1-2.6-1.5l.5-.7a1 1 0 0 0 0-1.1l-.2-.6a1 1 0 0 0-.8-.6l-.9-.1a1 1 0 0 1 0-3l.9-.1a1 1 0 0 0 .8-.6l.2-.6a1 1 0 0 0 0-1.1l-.5-.7a1 1 0 0 1 2.6-1.5l.5.7a1 1 0 0 0 1.1.4l.6-.2a1 1 0 0 0 .6-.7l.2-.7zM8 6a2 2 0 1 0 0 4 2 2 0 0 0 0-4z"
        />
      </svg>
    </button>
  </nav>
</template>
