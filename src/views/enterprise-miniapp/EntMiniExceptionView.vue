<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const enterpriseEmployeeIds = computed(
  () =>
    new Set(
      store.employees
        .filter((e) => e.enterpriseId === enterpriseId.value)
        .map((e) => e.id),
    ),
)

const makeupPending = computed(() =>
  store.makeupRequests
    .filter((r) => r.status === 'pending' && enterpriseEmployeeIds.value.has(r.employeeId))
    .map((r) => ({
      ...r,
      employeeName: store.employees.find((e) => e.id === r.employeeId)?.name || r.employeeId,
    })),
)

const exceptions = computed(() =>
  store.exceptions
    .filter(
      (e) =>
        (e.status === 'open' || e.status === 'appealed') &&
        enterpriseEmployeeIds.value.has(e.employeeId),
    )
    .map((e) => ({
      ...e,
      employeeName: store.employees.find((x) => x.id === e.employeeId)?.name || e.employeeId,
    }))
    .slice(0, 40),
)

async function reviewMakeup(id: string, approved: boolean) {
  let note = ''
  if (!approved) {
    const { value } = await ElMessageBox.prompt('请填写驳回原因', '考勤异常处理', {
      inputPlaceholder: '如：证据不足 / 时间不符',
    })
    note = String(value || '').trim()
    if (!note) {
      ElMessage.warning('驳回须填写原因')
      return
    }
  }
  try {
    store.reviewMakeupRequest(id, approved, note || '企业小程序通过', '企业小程序')
    ElMessage.success(approved ? '补卡已通过' : '补卡已驳回')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '处理失败')
  }
}

async function resolveExc(id: string) {
  const { value } = await ElMessageBox.prompt('请填写处理说明', '考勤异常处理', {
    inputPlaceholder: '如：已联系本人确认，按正常出勤处理',
  })
  const note = String(value || '').trim()
  if (!note) {
    ElMessage.warning('须填写处理说明')
    return
  }
  try {
    store.resolveException(id, note, '企业小程序')
    ElMessage.success('异常已处理')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '处理失败')
  }
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="考勤异常处理" back-to="/enterprise-miniapp/schedule" />

    <section class="panel">
      <h3>补卡申请</h3>
      <div v-if="!makeupPending.length" class="mini-empty">暂无待审补卡</div>
      <article v-for="r in makeupPending" :key="r.id" class="card">
        <strong>{{ r.employeeName }}</strong>
        <p>{{ r.date }} {{ r.time }} · {{ r.punchType === 'clock_in' ? '上班' : '下班' }}补卡</p>
        <p class="reason">原因：{{ r.reason || '-' }}</p>
        <div class="btns">
          <button type="button" class="ghost" @click="reviewMakeup(r.id, false)">驳回</button>
          <button type="button" class="mini-btn-primary sm" @click="reviewMakeup(r.id, true)">通过</button>
        </div>
      </article>
    </section>

    <section class="panel">
      <h3>出勤异常</h3>
      <div v-if="!exceptions.length" class="mini-empty">暂无待处理异常</div>
      <article v-for="e in exceptions" :key="e.id" class="card">
        <strong>{{ e.employeeName }}</strong>
        <p>{{ e.date }} · {{ e.type }}</p>
        <p class="reason">{{ e.message }}</p>
        <div class="btns">
          <button type="button" class="mini-btn-primary sm" @click="resolveExc(e.id)">处理</button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.panel {
  padding: 12px 16px 8px;
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
.reason {
  color: #9ca3af !important;
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
  border: none;
  border-radius: 8px;
  background: #5b4fdb;
  color: #fff;
}
.mini-empty {
  padding: 16px 0 20px;
  text-align: center;
  color: #9ca3af;
  font-size: 12px;
}
</style>
