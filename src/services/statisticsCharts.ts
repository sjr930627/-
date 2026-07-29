import type { EChartsOption } from 'echarts'
import { chartColors } from '@/plugins/echarts'

export function lineChartOption(
  labels: string[],
  series: { name: string; data: number[]; color: string; dashed?: boolean }[],
  yMax = 100,
): EChartsOption {
  return {
    color: series.map((s) => s.color),
    tooltip: { trigger: 'axis' },
    legend: { right: 0, top: 0, icon: 'circle', itemWidth: 8, itemHeight: 8 },
    grid: { left: 40, right: 16, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisLabel: { color: '#909399', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      max: yMax,
      splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
      axisLabel: { color: '#909399', fontSize: 11, formatter: yMax <= 100 ? '{value}%' : '{value}' },
    },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, type: s.dashed ? 'dashed' : 'solid' },
      data: s.data,
    })),
  }
}

export function barChartOption(
  labels: string[],
  series: { name: string; data: number[]; color: string | string[]; stack?: string }[],
  horizontal = false,
): EChartsOption {
  const isMultiColor = Array.isArray(series[0]?.color)
  return {
    tooltip: { trigger: 'axis' },
    legend: series.length > 1 ? { right: 0, top: 0, icon: 'circle', itemWidth: 8 } : undefined,
    grid: { left: horizontal ? 80 : 40, right: 16, top: 36, bottom: 28 },
    xAxis: horizontal
      ? { type: 'value', splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } } }
      : {
          type: 'category',
          data: labels,
          axisLine: { lineStyle: { color: '#e8e8e8' } },
          axisLabel: { color: '#909399', fontSize: 11 },
        },
    yAxis: horizontal
      ? {
          type: 'category',
          data: labels,
          axisLine: { show: false },
          axisTick: { show: false },
          axisLabel: { color: '#606266', fontSize: 12 },
        }
      : {
          type: 'value',
          splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
          axisLabel: { color: '#909399', fontSize: 11 },
        },
    series: series.map((s) => ({
      name: s.name,
      type: 'bar',
      stack: s.stack,
      barMaxWidth: 32,
      itemStyle: {
        borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
        color: isMultiColor ? undefined : (s.color as string),
      },
      data: s.data,
      ...(isMultiColor
        ? {
            itemStyle: {
              borderRadius: horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0],
              color: (params: { dataIndex: number }) =>
                (s.color as string[])[params.dataIndex] ?? chartColors.blue,
            },
          }
        : {}),
    })),
  }
}

export function donutChartOption(
  items: { name: string; value: number; color: string }[],
  centerText: string,
): EChartsOption {
  return {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 0, top: 'center', icon: 'circle', itemWidth: 8 },
    series: [
      {
        type: 'pie',
        radius: ['52%', '72%'],
        center: ['38%', '50%'],
        avoidLabelOverlap: false,
        label: {
          show: true,
          position: 'center',
          formatter: centerText,
          fontSize: 14,
          fontWeight: 600,
          color: '#303133',
          lineHeight: 20,
        },
        emphasis: { label: { show: true, fontSize: 14, fontWeight: 600 } },
        labelLine: { show: false },
        data: items.map((i) => ({ name: i.name, value: i.value, itemStyle: { color: i.color } })),
      },
    ],
  }
}

export function comboChartOption(
  labels: string[],
  bars: { name: string; data: number[]; color: string }[],
  line: { name: string; data: number[]; color: string },
): EChartsOption {
  return {
    tooltip: { trigger: 'axis' },
    legend: { right: 0, top: 0, icon: 'circle', itemWidth: 8 },
    grid: { left: 40, right: 40, top: 36, bottom: 28 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisLabel: { color: '#909399', fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
        axisLabel: { color: '#909399', fontSize: 11 },
      },
      {
        type: 'value',
        splitLine: { show: false },
        axisLabel: { color: '#909399', fontSize: 11 },
      },
    ],
    series: [
      ...bars.map((b) => ({
        name: b.name,
        type: 'bar' as const,
        barMaxWidth: 20,
        itemStyle: { color: b.color, borderRadius: [4, 4, 0, 0] },
        data: b.data,
      })),
      {
        name: line.name,
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, color: line.color },
        itemStyle: { color: line.color },
        data: line.data,
      },
    ],
  }
}

export function formatWan(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}万`
  return value.toLocaleString('zh-CN')
}

export function trendText(value: number, suffix = '较上月'): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value}% ${suffix}`
}
