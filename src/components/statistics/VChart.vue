<script setup lang="ts">
import { computed } from 'vue'
import VueEcharts from 'vue-echarts'
import type { EChartsOption } from 'echarts'

const props = defineProps<{
  option: EChartsOption
  height?: string
}>()

const chartHeight = computed(() => props.height ?? '320px')
</script>

<template>
  <VueEcharts class="chart" :option="option" autoresize :style="{ height: chartHeight }" />
</template>

<style scoped>
.chart {
  width: 100%;
}
</style>
