<script setup lang="ts">
import { useI18n } from "vue-i18n";

const { t } = useI18n();
</script>

<template>
  <!-- 工具箱占位：创建工具暂时留在顶栏，下一票把工具目录搬进这块面板 -->
  <div class="h-full overflow-auto bg-white p-3 text-sm text-zinc-600">
    {{ t("toolbox.placeholder") }}
  </div>
</template>
