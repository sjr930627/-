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

/** 工时/人数等绝对值折线（支持环比虚线对比，y 轴不强制百分比） */
export function valueLineChartOption(
  labels: string[],
  series: { name: string; data: number[]; color: string; dashed?: boolean }[],
  unit = '',
): EChartsOption {
  const all = series.flatMap((s) => s.data)
  const max = Math.max(0, ...all)
  const yMax = max <= 0 ? 10 : Math.ceil(max * 1.15)
  return {
    color: series.map((s) => s.color),
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as {
          axisValue?: string
          marker?: string
          seriesName?: string
          value?: number
        }[]
        const head = list[0]?.axisValue ?? ''
        const lines = list.map(
          (p) => `${p.marker ?? ''}${p.seriesName}：${p.value ?? 0}${unit}`,
        )
        return [head, ...lines].join('<br/>')
      },
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#909399', fontSize: 11 },
    },
    grid: { left: 44, right: 16, top: 20, bottom: 36 },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisLabel: { color: '#909399', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      max: yMax,
      splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
      axisLabel: { color: '#909399', fontSize: 11 },
    },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2.5, type: s.dashed ? 'dashed' : 'solid' },
      areaStyle: s.dashed
        ? undefined
        : { color: 'rgba(91, 79, 219, 0.08)' },
      data: s.data,
    })),
  }
}

/** 双轴折线：左轴工时、右轴人数，可附带环比虚线 */
export function dualMetricLineChartOption(
  labels: string[],
  left: { name: string; data: number[]; color: string; dashed?: boolean; unit?: string }[],
  right: { name: string; data: number[]; color: string; dashed?: boolean; unit?: string }[],
): EChartsOption {
  const leftMax = Math.max(0, ...left.flatMap((s) => s.data))
  const rightMax = Math.max(0, ...right.flatMap((s) => s.data))
  const allSeries = [...left, ...right]
  return {
    color: allSeries.map((s) => s.color),
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as {
          axisValue?: string
          marker?: string
          seriesName?: string
          value?: number
          seriesIndex?: number
        }[]
        const head = list[0]?.axisValue ?? ''
        const lines = list.map((p) => {
          const meta = allSeries[p.seriesIndex ?? 0]
          const unit = meta?.unit ?? ''
          return `${p.marker ?? ''}${p.seriesName}：${p.value ?? 0}${unit}`
        })
        return [head, ...lines].join('<br/>')
      },
    },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { color: '#909399', fontSize: 11 },
    },
    grid: { left: 44, right: 44, top: 20, bottom: 40 },
    xAxis: {
      type: 'category',
      data: labels,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisLabel: { color: '#909399', fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: '工时',
        nameTextStyle: { color: '#909399', fontSize: 10 },
        max: leftMax <= 0 ? 10 : Math.ceil(leftMax * 1.15),
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
        axisLabel: { color: '#909399', fontSize: 11 },
      },
      {
        type: 'value',
        name: '人数',
        nameTextStyle: { color: '#909399', fontSize: 10 },
        max: rightMax <= 0 ? 10 : Math.ceil(rightMax * 1.15),
        splitLine: { show: false },
        axisLabel: { color: '#909399', fontSize: 11 },
      },
    ],
    series: [
      ...left.map((s) => ({
        name: s.name,
        type: 'line' as const,
        yAxisIndex: 0,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, type: s.dashed ? ('dashed' as const) : ('solid' as const) },
        areaStyle: s.dashed ? undefined : { color: 'rgba(91, 79, 219, 0.08)' },
        data: s.data,
      })),
      ...right.map((s) => ({
        name: s.name,
        type: 'line' as const,
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2.5, type: s.dashed ? ('dashed' as const) : ('solid' as const) },
        data: s.data,
      })),
    ],
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

export function funnelChartOption(
  items: { name: string; value: number }[],
  colors?: string[],
): EChartsOption {
  const palette = colors ?? [
    chartColors.blue,
    chartColors.cyan,
    chartColors.orange,
    chartColors.green,
    chartColors.purple,
  ]
  return {
    tooltip: {
      trigger: 'item',
      formatter: (params: unknown) => {
        const p = params as { name?: string; value?: number; percent?: number }
        return `${p.name}<br/>人数：${p.value}<br/>占比：${p.percent ?? 0}%`
      },
    },
    series: [
      {
        type: 'funnel',
        left: '8%',
        top: 16,
        bottom: 16,
        width: '72%',
        min: 0,
        max: Math.max(...items.map((i) => i.value), 1),
        minSize: '18%',
        maxSize: '100%',
        sort: 'descending',
        gap: 4,
        label: {
          show: true,
          position: 'inside',
          formatter: '{b}\n{c}',
          color: '#fff',
          fontSize: 12,
        },
        labelLine: { length: 8, lineStyle: { width: 1, type: 'solid' } },
        itemStyle: { borderColor: '#fff', borderWidth: 1 },
        data: items.map((item, i) => ({
          name: item.name,
          value: item.value,
          itemStyle: { color: palette[i % palette.length] },
        })),
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
