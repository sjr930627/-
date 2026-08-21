<script setup lang="ts">
import { computed, ref } from 'vue'
import type {
  DepartmentOpenRole,
  RecruitmentFunnelData,
} from '@/services/workbenchDashboard'

const props = defineProps<{
  funnel: RecruitmentFunnelData
  departments: DepartmentOpenRole[]
}>()

const range = ref<'month' | '30d'>('month')

const toneColor: Record<string, string> = {
  purple: '#8b5cf6',
  blue: '#3b82f6',
  orange: '#f97316',
  green: '#22c55e',
  teal: '#14b8a6',
}

const maxStageCount = computed(() =>
  Math.max(...props.funnel.stages.map((s) => s.count), 1),
)

const deptMax = (items: DepartmentOpenRole[]) =>
  Math.max(...items.map((d) => d.count), 1)

function formatRate(rate: number | null) {
  if (rate === null) return '-'
  return `${rate}%`
}
</script>

<template>
  <section class="wb-card">
    <div class="card-head">
      <h3 class="card-title">招聘数据概览</h3>
      <el-radio-group v-model="range" size="small">
        <el-radio-button value="month">本月</el-radio-button>
        <el-radio-button value="30d">近30天</el-radio-button>
      </el-radio-group>
    </div>

    <div class="section-label">招聘漏斗</div>
    <div class="funnel-list">
      <div v-for="stage in funnel.stages" :key="stage.label" class="funnel-row">
        <span class="funnel-label">{{ stage.label }}</span>
        <div class="funnel-bar-wrap">
          <div
            class="funnel-bar"
            :style="{
              width: `${Math.max(8, (stage.count / maxStageCount) * 100)}%`,
              background: toneColor[stage.tone],
            }"
          />
        </div>
        <span class="funnel-count">{{ stage.count }}</span>
      </div>
    </div>

    <div class="conversion-grid">
      <div
        v-for="item in funnel.conversions"
        :key="item.label"
        class="conversion-item"
      >
        <div class="conversion-icon">
          <el-icon :size="14"><TrendCharts /></el-icon>
        </div>
        <div>
          <div class="conversion-label">{{ item.label }}</div>
          <div class="conversion-rate">{{ formatRate(item.rate) }}</div>
          <div class="conversion-formula">
            {{ item.numerator }}/{{ item.denominator }}
          </div>
        </div>
      </div>
    </div>

    <div class="section-label dept-label">部门缺口</div>
    <div class="dept-list">
      <div v-for="dept in departments" :key="dept.department" class="dept-row">
        <span class="dept-name">{{ dept.department }}</span>
        <div class="dept-bar-wrap">
          <div
            class="dept-bar"
            :style="{ width: `${(dept.count / deptMax(departments)) * 100}%` }"
          />
        </div>
        <span class="dept-count">{{ dept.count }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wb-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px rgba(15, 23, 42, 0.04);
  border: 1px solid #eef2f7;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  padding-left: 10px;
  border-left: 3px solid #2563eb;
  line-height: 1.2;
}

.section-label {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 12px;
}

.dept-label {
  margin-top: 18px;
}

.funnel-list,
.dept-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.funnel-row,
.dept-row {
  display: grid;
  grid-template-columns: 56px 1fr 36px;
  align-items: center;
  gap: 10px;
}

.funnel-label,
.dept-name {
  font-size: 12px;
  color: #64748b;
}

.funnel-bar-wrap,
.dept-bar-wrap {
  height: 10px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}

.funnel-bar {
  height: 100%;
  border-radius: 999px;
  min-width: 6%;
}

.dept-bar {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #93c5fd, #2563eb);
  min-width: 8%;
}

.funnel-count,
.dept-count {
  font-size: 12px;
  font-weight: 700;
  color: #0f172a;
  text-align: right;
}

.conversion-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed #e2e8f0;
}

.conversion-item {
  display: flex;
  gap: 10px;
  padding: 10px 12px;
  background: #f8fafc;
  border-radius: 10px;
  border: 1px solid #f1f5f9;
}

.conversion-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.conversion-label {
  font-size: 12px;
  color: #64748b;
  margin-bottom: 2px;
}

.conversion-rate {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1.2;
}

.conversion-formula {
  margin-top: 2px;
  font-size: 11px;
  color: #94a3b8;
}
</style>
