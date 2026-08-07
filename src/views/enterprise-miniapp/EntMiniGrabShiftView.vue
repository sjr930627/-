<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()
const tab = ref<'slots' | 'apps'>('slots')

const enterpriseTeams = computed(() => {
  const empIds = new Set(
    store.employees
      .filter((e) => e.enterpriseId === enterpriseId.value)
      .map((e) => e.id),
  )
  return store.teams.filter((t) => t.memberIds.some((id) => empIds.has(id)))
})

const form = ref({
  date: '2026-07-29',
  shiftId: store.shifts.find((s) => s.id !== 'shift_rest')?.id || '',
  teamId: '',
  requiredCount: 2,
  hourlySubsidy: 5,
  positionRequirement: '现场服务与安全作业，需持健康证',
})

if (!form.value.teamId) {
  form.value.teamId = enterpriseTeams.value[0]?.id || store.teams[0]?.id || ''
}

const slots = computed(() =>
  [...store.grabShiftSlots].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30),
)

const apps = computed(() =>
  store.grabShiftApplications
    .filter((a) => a.status === 'pending')
    .map((a) => {
      const slot = store.grabShiftSlots.find((s) => s.id === a.slotId)
      return {
        ...a,
        employeeName: store.employees.find((e) => e.id === a.employeeId)?.name || a.employeeId,
        shiftName: slot?.shiftName || '-',
        date: slot?.date || '-',
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function publish() {
  const shift = store.shifts.find((s) => s.id === form.value.shiftId)
  const team = store.teams.find((t) => t.id === form.value.teamId)
  if (!shift || !team) {
    ElMessage.warning('请选择班次和班组')
    return
  }
  if (!form.value.positionRequirement.trim()) {
    ElMessage.warning('请填写岗位要求')
    return
  }
  try {
    const base = team.hourlyRate || 38
    store.createGrabShiftSlot({
      attendanceGroupId: team.attendanceGroupId || 'ag_factory',
      scope: 'department',
      departmentId: team.departmentId,
      departmentName: store.departments.find((d) => d.id === team.departmentId)?.name || '',
      teamId: team.id,
      teamName: team.name,
      shiftSource: 'template',
      shiftId: shift.id,
      shiftName: shift.name,
      date: form.value.date,
      startTime: shift.startTime,
      endTime: shift.endTime,
      requiredCount: form.value.requiredCount,
      hourlySubsidy: form.value.hourlySubsidy,
      baseHourlyRate: base,
      effectiveHourlyRate: base + form.value.hourlySubsidy,
      positionRequirement: form.value.positionRequirement.trim(),
      requirements: ['健康证'],
    })
    ElMessage.success('抢班已发布')
    tab.value = 'slots'
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}

function review(id: string, approved: boolean) {
  try {
    store.reviewGrabShiftApplication(
      id,
      approved,
      approved ? '企业小程序通过' : '名额已满/不符要求',
      '企业小程序',
    )
    ElMessage.success(approved ? '已通过并写入排班' : '已驳回')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '审批失败')
  }
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="发布抢班" back-to="/enterprise-miniapp/schedule" />

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'slots' }" @click="tab = 'slots'">班次</button>
      <button type="button" :class="{ active: tab === 'apps' }" @click="tab = 'apps'">
        待审 {{ apps.length }}
      </button>
    </div>

    <section v-if="tab === 'slots'" class="panel">
      <div class="form">
        <label>日期</label>
        <input v-model="form.date" type="date">
        <label>班次</label>
        <select v-model="form.shiftId">
          <option v-for="s in store.shifts" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <label>班组</label>
        <select v-model="form.teamId">
          <option v-for="t in enterpriseTeams.length ? enterpriseTeams : store.teams" :key="t.id" :value="t.id">
            {{ t.name }}
          </option>
        </select>
        <label>需要人数</label>
        <input v-model.number="form.requiredCount" type="number" min="1">
        <label>岗位要求</label>
        <textarea v-model="form.positionRequirement" rows="2" />
        <button type="button" class="mini-btn-primary" @click="publish">发布抢班</button>
      </div>
      <h3>已发布</h3>
      <article v-for="s in slots" :key="s.id" class="card">
        <strong>{{ s.date }} {{ s.shiftName }}</strong>
        <p>{{ s.teamName }} · {{ s.grabbedCount }}/{{ s.requiredCount }} · {{ s.status }}</p>
      </article>
    </section>

    <section v-else class="panel">
      <div v-if="!apps.length" class="mini-empty">暂无待审批报名</div>
      <article v-for="a in apps" :key="a.id" class="card">
        <strong>{{ a.employeeName }}</strong>
        <p>{{ a.date }} · {{ a.shiftName }}</p>
        <div class="btns">
          <button type="button" class="ghost" @click="review(a.id, false)">驳回</button>
          <button type="button" class="mini-btn-primary sm" @click="review(a.id, true)">通过</button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 8px 16px;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 3px;
}
.tabs button {
  border: none;
  background: transparent;
  height: 34px;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
}
.tabs button.active {
  background: #fff;
  color: #4338ca;
  font-weight: 600;
}
.panel {
  padding: 0 16px 24px;
}
.form {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 14px;
}
label {
  font-size: 12px;
  color: #6b7280;
}
input,
select,
textarea {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
}
h3 {
  margin: 0 0 8px;
  font-size: 14px;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: var(--mini-shadow);
}
.card p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.ghost {
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
  border-radius: 8px;
  height: 30px;
  padding: 0 10px;
}
.sm {
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
}
.mini-btn-primary {
  height: 42px;
  border: none;
  border-radius: 10px;
  background: #5b4fdb;
  color: #fff;
  font-weight: 600;
}
.mini-empty {
  padding: 40px 0;
  text-align: center;
  color: #9ca3af;
}
</style>
