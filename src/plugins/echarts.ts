import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  BarChart,
  LineChart,
  PieChart,
  MapChart,
  FunnelChart,
  ScatterChart,
  EffectScatterChart,
  HeatmapChart,
} from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  GeoComponent,
  VisualMapComponent,
} from 'echarts/components'

use([
  CanvasRenderer,
  BarChart,
  LineChart,
  PieChart,
  MapChart,
  FunnelChart,
  ScatterChart,
  EffectScatterChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  GeoComponent,
  VisualMapComponent,
])

export const chartColors = {
  blue: '#5B8FF9',
  green: '#5AD8A6',
  orange: '#F6BD16',
  red: '#E8684A',
  purple: '#9270CA',
  cyan: '#6DC8EC',
  pink: '#FF99C3',
}
