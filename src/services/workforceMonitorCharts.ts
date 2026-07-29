import type { EChartsOption } from 'echarts'
import type { CallbackDataParams } from 'echarts/types/dist/shared'
import type { CityHeat, RegionOnDuty } from '@/mock/workforceBiSeed'
import { chartColors } from '@/plugins/echarts'

const PRIMARY = '#e60012'
const PRIMARY_LIGHT = '#ff4d4f'

const tooltip = {
  backgroundColor: '#fff',
  borderColor: '#ebeef5',
  textStyle: { color: '#303133' },
  extraCssText: 'box-shadow: 0 2px 12px rgba(0,0,0,0.08);',
}

const axisStyle = {
  axisLine: { lineStyle: { color: '#e8e8e8' } },
  axisLabel: { color: '#909399', fontSize: 11 },
  splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' as const } },
}

export function darkMultiLineOption(
  labels: string[],
  series: { name: string; data: number[]; color: string; area?: boolean }[],
  yMax?: number,
): EChartsOption {
  return {
    tooltip: { trigger: 'axis', ...tooltip },
    legend: { right: 8, top: 0, textStyle: { color: '#606266', fontSize: 11 }, icon: 'circle', itemWidth: 8 },
    grid: { left: 48, right: 16, top: 32, bottom: 28 },
    xAxis: { type: 'category', data: labels, boundaryGap: false, ...axisStyle },
    yAxis: { type: 'value', max: yMax, ...axisStyle },
    series: series.map((s) => ({
      name: s.name,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 2, color: s.color },
      itemStyle: { color: s.color },
      areaStyle: s.area
        ? {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: s.color + '33' },
                { offset: 1, color: s.color + '05' },
              ],
            },
          }
        : undefined,
      data: s.data,
    })),
  }
}

export function darkPieOption(
  items: { name: string; value: number; color?: string }[],
  opts?: { donut?: boolean; centerText?: string },
): EChartsOption {
  return {
    tooltip: { trigger: 'item', ...tooltip, formatter: '{b}: {c} ({d}%)' },
    legend: { orient: 'vertical', right: 0, top: 'center', textStyle: { color: '#606266', fontSize: 10 }, icon: 'circle', itemWidth: 8 },
    series: [{
      type: 'pie',
      radius: opts?.donut ? ['45%', '68%'] : '68%',
      center: opts?.donut ? ['38%', '50%'] : ['50%', '50%'],
      label: opts?.centerText
        ? { show: true, position: 'center', formatter: opts.centerText, fontSize: 16, fontWeight: 700, color: '#1a1a2e' }
        : { color: '#606266', fontSize: 10 },
      data: items.map((i, idx) => ({
        name: i.name,
        value: i.value,
        itemStyle: {
          color: i.color ?? [PRIMARY, chartColors.blue, chartColors.green, chartColors.orange, chartColors.purple][idx % 5],
        },
      })),
    }],
  }
}

export function darkHBarOption(
  items: { name: string; value: number }[],
  opts?: { unit?: string; warnBelow?: number; max?: number },
): EChartsOption {
  const sorted = [...items].sort((a, b) => a.value - b.value)
  const unit = opts?.unit ?? ''
  return {
    tooltip: { trigger: 'axis', ...tooltip },
    grid: { left: 90, right: 48, top: 8, bottom: 8 },
    xAxis: { type: 'value', max: opts?.max, ...axisStyle, axisLabel: { ...axisStyle.axisLabel, formatter: `{value}${unit}` } },
    yAxis: { type: 'category', data: sorted.map((s) => s.name), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: '#606266', fontSize: 10 } },
    series: [{
      type: 'bar',
      data: sorted.map((s) => ({
        value: s.value,
        itemStyle: {
          borderRadius: [0, 4, 4, 0],
          color: opts?.warnBelow && s.value < opts.warnBelow
            ? chartColors.red
            : {
                type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
                colorStops: [{ offset: 0, color: PRIMARY }, { offset: 1, color: PRIMARY_LIGHT }],
              },
        },
      })),
      barMaxWidth: 14,
      label: { show: true, position: 'right', color: '#909399', fontSize: 10, formatter: `{c}${unit}` },
    }],
  }
}

export function darkBarOption(labels: string[], values: number[], color = PRIMARY): EChartsOption {
  return {
    tooltip: { trigger: 'axis', ...tooltip },
    grid: { left: 48, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: labels, ...axisStyle },
    yAxis: { type: 'value', ...axisStyle },
    series: [{
      type: 'bar',
      data: values,
      barMaxWidth: 28,
      itemStyle: {
        borderRadius: [4, 4, 0, 0],
        color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color }, { offset: 1, color: PRIMARY_LIGHT }] },
      },
    }],
  }
}

export function darkDualAxisOption(
  labels: string[],
  bars: { name: string; data: number[]; color: string },
  line: { name: string; data: number[]; color: string },
): EChartsOption {
  return {
    tooltip: { trigger: 'axis', ...tooltip },
    legend: { right: 8, top: 0, textStyle: { color: '#606266', fontSize: 11 }, icon: 'circle', itemWidth: 8 },
    grid: { left: 48, right: 48, top: 32, bottom: 28 },
    xAxis: { type: 'category', data: labels, ...axisStyle },
    yAxis: [
      { type: 'value', ...axisStyle },
      { type: 'value', splitLine: { show: false }, axisLabel: { color: '#909399', fontSize: 11 } },
    ],
    series: [
      { name: bars.name, type: 'bar', barMaxWidth: 20, itemStyle: { color: bars.color, borderRadius: [4, 4, 0, 0] }, data: bars.data },
      { name: line.name, type: 'line', yAxisIndex: 1, smooth: true, symbol: 'circle', symbolSize: 4, lineStyle: { color: line.color }, itemStyle: { color: line.color }, data: line.data },
    ],
  }
}

export function darkStackedBarOption(
  labels: string[],
  series: { name: string; data: number[]; color: string }[],
): EChartsOption {
  return {
    tooltip: { trigger: 'axis', ...tooltip },
    legend: { right: 8, top: 0, textStyle: { color: '#606266', fontSize: 11 }, icon: 'circle', itemWidth: 8 },
    grid: { left: 48, right: 16, top: 32, bottom: 28 },
    xAxis: { type: 'category', data: labels, ...axisStyle },
    yAxis: { type: 'value', ...axisStyle },
    series: series.map((s) => ({
      name: s.name, type: 'bar', stack: 'total', barMaxWidth: 24,
      itemStyle: { color: s.color }, data: s.data,
    })),
  }
}

export function darkHeatmapOption(
  xLabels: string[],
  yLabels: string[],
  data: [number, number, number][],
): EChartsOption {
  const max = Math.max(...data.map((d) => d[2]), 1)
  return {
    tooltip: {
      position: 'top',
      ...tooltip,
      formatter: (p) => {
        const params = p as CallbackDataParams
        const val = params.value as number[]
        return `${yLabels[val[1]]} · ${xLabels[val[0]]}<br/>${val[2]} 人次`
      },
    },
    grid: { left: 80, right: 16, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: xLabels, ...axisStyle, splitArea: { show: true, areaStyle: { color: ['#fff', '#fafafa'] } } },
    yAxis: { type: 'category', data: yLabels, ...axisStyle, splitArea: { show: true, areaStyle: { color: ['#fff', '#fafafa'] } } },
    visualMap: {
      min: 0, max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0,
      inRange: { color: ['#fff1f0', '#faccd0', '#f06673', '#e60012', '#c4000f'] },
      textStyle: { color: '#909399', fontSize: 10 },
    },
    series: [{
      type: 'heatmap',
      data,
      label: { show: true, color: '#606266', fontSize: 10 },
      emphasis: { itemStyle: { shadowBlur: 8, shadowColor: 'rgba(230,0,18,0.15)' } },
    }],
  }
}

export function darkTrendOption(
  labels: string[],
  applicants: number[],
  onDuty: number[],
): EChartsOption {
  return darkMultiLineOption(labels, [
    { name: '系列A', data: applicants, color: chartColors.blue, area: true },
    { name: '系列B', data: onDuty, color: chartColors.green, area: true },
  ])
}

export function darkRegionBarOption(regions: RegionOnDuty[]): EChartsOption {
  return darkBarOption(
    regions.map((r) => r.region),
    regions.map((r) => r.count),
  )
}

export function darkChinaMapOption(cities: CityHeat[]): EChartsOption {
  return {
    tooltip: {
      trigger: 'item',
      ...tooltip,
      formatter: (params) => {
        const p = params as CallbackDataParams
        if (p.seriesType === 'effectScatter') {
          const val = p.value as number[]
          return `${p.name}<br/>在岗 ${val[2]} 人`
        }
        return String(p.name ?? '')
      },
    },
    geo: {
      map: 'china',
      roam: false,
      zoom: 1.15,
      center: [105, 36],
      itemStyle: {
        areaColor: '#f5f7fa',
        borderColor: '#dcdfe6',
        borderWidth: 1,
      },
      emphasis: {
        itemStyle: {
          areaColor: '#fff1f0',
        },
        label: { show: false },
      },
      label: { show: false },
    },
    series: [
      {
        type: 'effectScatter',
        coordinateSystem: 'geo',
        data: cities.map((c) => ({
          name: c.name,
          value: [...c.coord, c.value],
        })),
        symbolSize: (val: number[]) => Math.max(12, Math.sqrt(val[2] ?? 0) / 2.5),
        showEffectOn: 'render',
        rippleEffect: {
          brushType: 'stroke',
          scale: 3,
          period: 4,
        },
        label: {
          show: true,
          position: 'right',
          color: '#303133',
          fontSize: 11,
          formatter: (params) => {
            const p = params as CallbackDataParams
            const val = p.value as number[]
            return `${p.name}\n${val[2]}`
          },
        },
        itemStyle: {
          color: PRIMARY,
          shadowBlur: 8,
          shadowColor: 'rgba(230, 0, 18, 0.25)',
        },
      },
    ],
  }
}
