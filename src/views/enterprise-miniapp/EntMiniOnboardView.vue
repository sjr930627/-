<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  buildDepartmentJoinQrPayload,
  departmentJoinQrImageUrl,
  enterpriseUnassignedDepartmentId,
  isEnterpriseRootDepartment,
  isUnassignedDepartment,
} from '@/constants/department'
import { getDepartmentName } from '@/utils'
import type { Employee, EmployeeOnboardingStage } from '@/types'

type OnboardTab = 'apps' | 'qr'

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const tab = ref<OnboardTab>('apps')
const stageFilter = ref<'all' | EmployeeOnboardingStage>('applied')

const approveOpen = ref(false)
const approveTarget = ref<Employee | null>(null)
const approveForm = ref({
  departmentId: '',
  positionId: '',
  employeeNo: '',
})

const enterprisePositions = computed(() => store.getEnterprisePositions(enterpriseId.value))

const selectedApprovePositionName = computed(() => {
  const pos = store.getEnterprisePosition(approveForm.value.positionId)
  return pos?.profile.positionName || pos?.name || ''
})

const qrDeptId = ref('')

const departments = computed(() => store.getDepartmentsByEnterprise(enterpriseId.value))

const businessDepartments = computed(() =>
  departments.value.filter(
    (d) => !isUnassignedDepartment(d.id) && !isEnterpriseRootDepartment(d),
  ),
)

const unassignedId = computed(() => enterpriseUnassignedDepartmentId(enterpriseId.value))

const pendingEmployees = computed(() => {
  const list = store
    .getEmployeesByEnterprise(enterpriseId.value)
    .filter((e) => e.status === 'pending')
    .map((e) => {
      const stage = (e.onboardingStage ?? 'awaiting_apply') as EmployeeOnboardingStage
      return {
        ...e,
        stage,
        stageLabel: stage === 'applied' ? '已申请' : '待申请',
        applyDeptName: e.applyDepartmentId
          ? getDepartmentName(departments.value, e.applyDepartmentId)
          : '—',
      }
    })
    .sort((a, b) => {
      if (a.stage !== b.stage) return a.stage === 'applied' ? -1 : 1
      return (b.hireDate || '').localeCompare(a.hireDate || '')
    })
  if (stageFilter.value === 'all') return list
  return list.filter((e) => e.stage === stageFilter.value)
})

const appliedCount = computed(
  () =>
    store
      .getEmployeesByEnterprise(enterpriseId.value)
      .filter((e) => e.status === 'pending' && e.onboardingStage === 'applied').length,
)

const qrDept = computed(() => businessDepartments.value.find((d) => d.id === qrDeptId.value))

const qrUrl = computed(() => {
  if (!qrDept.value || !enterpriseId.value) return ''
  return departmentJoinQrImageUrl(enterpriseId.value, qrDept.value.id, 200)
})

const qrPayload = computed(() => {
  if (!qrDept.value || !enterpriseId.value) return ''
  return buildDepartmentJoinQrPayload(enterpriseId.value, qrDept.value.id)
})

watch(
  businessDepartments,
  (depts) => {
    if (!qrDeptId.value && depts[0]) qrDeptId.value = depts[0].id
  },
  { immediate: true },
)

function openApprove(emp: Employee) {
  const preferred =
    emp.applyDepartmentId &&
    businessDepartments.value.some((d) => d.id === emp.applyDepartmentId)
      ? emp.applyDepartmentId
      : businessDepartments.value[0]?.id || ''
  approveTarget.value = emp
  approveForm.value = {
    departmentId: preferred,
    positionId: emp.positionId || '',
    employeeNo: emp.employeeNo || '',
  }
  approveOpen.value = true
}

function closeApprove() {
  approveOpen.value = false
  approveTarget.value = null
}

function submitApprove() {
  if (!approveTarget.value) return
  if (!approveForm.value.departmentId) {
    ElMessage.warning('请选择入驻部门')
    return
  }
  if (!approveForm.value.positionId || !selectedApprovePositionName.value) {
    ElMessage.warning('请选择岗位')
    return
  }
  if (!approveForm.value.employeeNo.trim()) {
    ElMessage.warning('请填写人员 ID')
    return
  }
  try {
    const isApplied = approveTarget.value.onboardingStage === 'applied'
    const payload = {
      departmentId: approveForm.value.departmentId,
      position: selectedApprovePositionName.value,
      employeeNo: approveForm.value.employeeNo.trim(),
      positionId: approveForm.value.positionId,
    }
    if (isApplied) {
      store.approveOnboardApplication(approveTarget.value.id, payload)
    } else {
      store.assignPendingOnboardEmployee(approveTarget.value.id, payload)
    }
    ElMessage.success(isApplied ? '已审批入驻并分配岗位' : '已分配岗位及人员 ID')
    closeApprove()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function copyPayload() {
  if (!qrPayload.value) return
  try {
    await navigator.clipboard.writeText(qrPayload.value)
    ElMessage.success('二维码内容已复制')
  } catch {
    ElMessage.info(qrPayload.value)
  }
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="入驻管理" back-to="/enterprise-miniapp/attendance" />

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'apps' }" @click="tab = 'apps'">
        入驻申请
        <i v-if="appliedCount">{{ appliedCount }}</i>
      </button>
      <button type="button" :class="{ active: tab === 'qr' }" @click="tab = 'qr'">
        入驻二维码
      </button>
    </div>

    <section v-if="tab === 'apps'" class="panel">
      <div class="filters">
        <button
          type="button"
          :class="{ active: stageFilter === 'applied' }"
          @click="stageFilter = 'applied'"
        >
          待审批
        </button>
        <button
          type="button"
          :class="{ active: stageFilter === 'awaiting_apply' }"
          @click="stageFilter = 'awaiting_apply'"
        >
          待申请
        </button>
        <button
          type="button"
          :class="{ active: stageFilter === 'all' }"
          @click="stageFilter = 'all'"
        >
          全部
        </button>
      </div>
      <p class="hint">
        待入驻池：{{ unassignedId ? '系统待入驻部门' : '' }}已申请需审批并分配部门 / 岗位 / 人员 ID
      </p>

      <article v-for="e in pendingEmployees" :key="e.id" class="card">
        <div class="card-top">
          <div class="avatar">{{ e.name.slice(0, 1) }}</div>
          <div class="meta">
            <div class="row">
              <strong>{{ e.name }}</strong>
              <span class="stage" :class="e.stage">{{ e.stageLabel }}</span>
            </div>
            <p>{{ e.phone || '未留手机' }} · {{ e.employeeNo }}</p>
            <p class="sub">
              申请部门：{{ e.applyDeptName }}
              <template v-if="e.hireDate"> · {{ e.hireDate }}</template>
            </p>
          </div>
        </div>
        <button
          type="button"
          class="action"
          @click="openApprove(e)"
        >
          {{ e.stage === 'applied' ? '审批入驻' : '直接分配' }}
        </button>
      </article>
      <div v-if="!pendingEmployees.length" class="empty">暂无入驻申请</div>
    </section>

    <section v-else class="panel">
      <p class="hint">选择业务部门生成入驻二维码，灵工扫码后可申请入驻该部门</p>
      <label>入驻部门</label>
      <select v-model="qrDeptId">
        <option v-for="d in businessDepartments" :key="d.id" :value="d.id">
          {{ d.name }}
        </option>
      </select>

      <div v-if="qrDept" class="qr-box">
        <img v-if="qrUrl" :src="qrUrl" alt="入驻二维码" class="qr-img">
        <strong>{{ qrDept.name }}</strong>
        <p class="payload">{{ qrPayload }}</p>
        <button type="button" class="copy" @click="copyPayload">复制二维码内容</button>
      </div>
      <div v-else class="empty">暂无可生成二维码的业务部门</div>
    </section>

    <div v-if="approveOpen && approveTarget" class="sheet-mask" @click.self="closeApprove">
      <div class="sheet">
        <header>
          <strong>
            {{ approveTarget.onboardingStage === 'applied' ? '审批入驻并分配' : '直接分配岗位' }}
          </strong>
          <button type="button" class="close" @click="closeApprove">×</button>
        </header>
        <p class="sheet-meta">{{ approveTarget.name }} · {{ approveTarget.phone || '无手机号' }}</p>
        <label>入驻部门</label>
        <select v-model="approveForm.departmentId">
          <option v-for="d in businessDepartments" :key="d.id" :value="d.id">
            {{ d.name }}
          </option>
        </select>
        <label>岗位</label>
        <select v-model="approveForm.positionId">
          <option value="" disabled>请选择企业岗位</option>
          <option v-for="p in enterprisePositions" :key="p.id" :value="p.id">
            {{ p.profile.positionName || p.name }}
          </option>
        </select>
        <label>人员 ID（必填）</label>
        <input v-model="approveForm.employeeNo" placeholder="如 E1008">
        <button type="button" class="submit" @click="submitApprove">确认通过</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 10px 16px 0;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 3px;
}
.tabs button {
  position: relative;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
}
.tabs button.active {
  background: #fff;
  color: #228BFF;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}
.tabs i {
  position: absolute;
  top: 2px;
  right: 8px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.panel {
  padding: 12px 16px 28px;
}
.filters {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.filters button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font-size: 12px;
}
.filters button.active {
  border-color: #228BFF;
  color: #fff;
  background: #228BFF;
}
.hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.5;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: var(--mini-shadow);
}
.card-top {
  display: flex;
  gap: 10px;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: #228BFF;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}
.meta {
  flex: 1;
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.row strong {
  font-size: 14px;
  color: #111827;
}
.stage {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
}
.stage.applied {
  background: #fffbeb;
  color: #d97706;
}
.meta p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.meta .sub {
  color: #9ca3af;
}
.action {
  margin-top: 10px;
  width: 100%;
  height: 32px;
  border: 1px solid #228BFF;
  border-radius: 999px;
  background: #fff;
  color: #228BFF;
  font-size: 13px;
  font-weight: 600;
}
label {
  display: block;
  margin: 8px 0 4px;
  font-size: 12px;
  color: #6b7280;
}
select,
input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  background: #fff;
}
.qr-box {
  margin-top: 14px;
  background: #fff;
  border-radius: 14px;
  padding: 18px 16px;
  text-align: center;
  box-shadow: var(--mini-shadow);
}
.qr-img {
  width: 200px;
  height: 200px;
  object-fit: contain;
  border-radius: 8px;
  background: #fff;
}
.qr-box strong {
  display: block;
  margin-top: 10px;
  font-size: 15px;
  color: #111827;
}
.payload {
  margin: 8px 0 0;
  font-size: 11px;
  color: #9ca3af;
  word-break: break-all;
}
.copy {
  margin-top: 12px;
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 999px;
  background: #228BFF;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: min(420px, 100%);
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.sheet header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet .close {
  border: none;
  background: none;
  font-size: 22px;
  color: #9ca3af;
}
.sheet-meta {
  margin: 0 0 6px;
  font-size: 12px;
  color: #6b7280;
}
.submit {
  margin-top: 12px;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
</style>
