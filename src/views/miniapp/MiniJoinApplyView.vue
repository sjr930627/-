<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  isEnterpriseRootDepartment,
  isUnassignedDepartment,
  parseDepartmentJoinQrPayload,
} from '@/constants/department'
import { getDepartmentName } from '@/utils'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employee, employeeId } = useMiniAppWorker()

const submitting = ref(false)
const positionId = ref('')

const parsed = computed(() => {
  const qr = typeof route.query.qr === 'string' ? route.query.qr : ''
  if (qr) return parseDepartmentJoinQrPayload(qr)
  const enterpriseId =
    typeof route.query.e === 'string'
      ? route.query.e
      : typeof route.query.enterprise === 'string'
        ? route.query.enterprise
        : ''
  const departmentId =
    typeof route.query.d === 'string'
      ? route.query.d
      : typeof route.query.department === 'string'
        ? route.query.department
        : ''
  if (enterpriseId && departmentId) return { enterpriseId, departmentId }
  return null
})

const department = computed(() =>
  parsed.value ? store.departments.find((d) => d.id === parsed.value!.departmentId) : undefined,
)

const enterpriseId = computed(() => {
  if (!parsed.value || !department.value) return ''
  return (
    parsed.value.enterpriseId ||
    resolveEnterpriseIdByDepartment(department.value.id, store.departments) ||
    department.value.enterpriseId ||
    ''
  )
})

const enterpriseName = computed(
  () => store.enterprises.find((e) => e.id === enterpriseId.value)?.name || '—',
)

const departmentName = computed(() =>
  department.value ? getDepartmentName(store.departments, department.value.id) : '—',
)

const positions = computed(() =>
  enterpriseId.value ? store.getEnterprisePositions(enterpriseId.value) : [],
)

const invalidReason = computed(() => {
  if (!parsed.value) return '无效的入驻二维码，请重新扫码'
  if (!department.value) return '目标部门不存在'
  if (isUnassignedDepartment(department.value.id) || isEnterpriseRootDepartment(department.value)) {
    return '请扫描具体业务部门二维码'
  }
  if (department.value.nodeType !== 'leaf') {
    return '仅叶子部门支持扫码入驻'
  }
  if (!enterpriseId.value) return '无法识别企业'
  if (!positions.value.length) return '该企业暂无岗位库，请联系企业管理员配置岗位'
  return ''
})

watch(
  positions,
  (list) => {
    if (!list.length) {
      positionId.value = ''
      return
    }
    if (!list.some((p) => p.id === positionId.value)) {
      positionId.value = list[0].id
    }
  },
  { immediate: true },
)

function positionLabel(id: string) {
  const pos = store.getEnterprisePosition(id)
  return pos?.profile.positionName || pos?.name || '—'
}

async function submit() {
  if (invalidReason.value) {
    ElMessage.warning(invalidReason.value)
    return
  }
  if (!positionId.value) {
    ElMessage.warning('请选择岗位')
    return
  }
  submitting.value = true
  try {
    store.submitJoinApplication({
      enterpriseId: enterpriseId.value,
      departmentId: department.value!.id,
      positionId: positionId.value,
      positionName: positionLabel(positionId.value),
      applicant: {
        name: employee.value?.name || '灵工申请人',
        phone: employee.value?.phone,
        employeeId: employeeId.value,
      },
    })
    ElMessage.success('已提交入驻申请，请等待企业审批')
    router.replace({ path: '/miniapp/join-manage', query: { tab: 'apps' } })
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="apply-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/join-manage" />
      <div class="mini-nav-title">入驻申请</div>
    </div>

    <div class="mini-page">
      <div v-if="invalidReason" class="mini-card error-card">
        <p>{{ invalidReason }}</p>
        <button type="button" class="ghost-btn" @click="router.replace('/miniapp/join-manage')">
          返回入驻管理
        </button>
      </div>

      <template v-else>
        <div class="mini-card tip-card">
          请确认入驻信息后提交申请。企业与部门来自扫码结果，岗位默认取岗位库第一项，可修改。
        </div>

        <div class="mini-card form-card">
          <label class="field">
            <span class="label">企业</span>
            <div class="value readonly">{{ enterpriseName }}</div>
          </label>
          <label class="field">
            <span class="label">部门</span>
            <div class="value readonly">{{ departmentName }}</div>
          </label>
          <label class="field">
            <span class="label">岗位</span>
            <select v-model="positionId" class="value select">
              <option v-for="p in positions" :key="p.id" :value="p.id">
                {{ p.profile.positionName || p.name }}
              </option>
            </select>
          </label>
        </div>

        <button
          type="button"
          class="submit-btn"
          :disabled="submitting || !positionId"
          @click="submit"
        >
          {{ submitting ? '提交中…' : '提交入驻申请' }}
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.apply-page {
  min-height: 100%;
  background: #f5f6f8;
}

.tip-card {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.error-card p {
  margin: 0 0 12px;
  color: #b91c1c;
  font-size: 14px;
  line-height: 1.5;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.label {
  font-size: 12px;
  color: #94a3b8;
}

.value {
  font-size: 15px;
  color: #111827;
  font-weight: 600;
}

.value.readonly {
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  font-weight: 500;
}

.value.select {
  width: 100%;
  height: 44px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 0 12px;
  background: #fff;
  font-size: 15px;
  font-weight: 500;
  color: #111827;
}

.submit-btn,
.ghost-btn {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.submit-btn {
  margin-top: 8px;
  background: var(--mini-primary, #4fd1c5);
  color: #fff;
}

.submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.ghost-btn {
  background: #f1f5f9;
  color: #334155;
}
</style>
