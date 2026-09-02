<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import type { ElTree } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildDepartmentTree,
  getDepartmentDescendantIds,
  getDepartmentName,
} from '@/utils'
import { attendanceGroupTypeMap, formatShiftPeriod } from '@/constants/attendanceGroup'
import type { Department, DepartmentNodeType, DepartmentOrgType, Employee } from '@/types'

const props = defineProps<{
  department: Department | null
  departments: Department[]
  employees: Employee[]
  locked?: boolean
}>()

const emit = defineEmits<{
  saved: []
  remove: []
}>()

const store = useAppStore()
const authTreeRef = ref<InstanceType<typeof ElTree>>()
const authFilterKeyword = ref('')
const saving = ref(false)

const form = ref({
  name: '',
  parentId: null as string | null,
  orgType: 'department' as DepartmentOrgType,
  sort: 1,
  nodeType: 'branch' as DepartmentNodeType,
  description: '',
  managerEmployeeId: null as string | null,
  attendanceGroupId: null as string | null,
  imageUrl: '',
  authorizedDepartmentIds: [] as string[],
})

async function syncAuthTreeKeys(keys: string[]) {
  form.value.authorizedDepartmentIds = [...keys]
  await nextTick()
  authTreeRef.value?.setCheckedKeys(keys)
}

watch(
  () => props.department,
  async (dept) => {
    authFilterKeyword.value = ''
    if (!dept) return
    form.value = {
      name: dept.name,
      parentId: dept.parentId,
      orgType: dept.orgType ?? 'department',
      sort: dept.sort,
      nodeType: dept.nodeType ?? 'branch',
      description: dept.description ?? '',
      managerEmployeeId: dept.managerEmployeeId ?? null,
      attendanceGroupId: dept.attendanceGroupId ?? null,
      imageUrl: dept.imageUrl ?? '',
      authorizedDepartmentIds: [...(dept.authorizedDepartmentIds ?? [])],
    }
    await syncAuthTreeKeys(form.value.authorizedDepartmentIds)
  },
  { immediate: true },
)

const parentOptions = computed(() => {
  if (!props.department) return props.departments
  const blocked = getDepartmentDescendantIds(props.departments, props.department.id)
  return props.departments.filter(
    (d) => d.id !== props.department!.id && !blocked.has(d.id),
  )
})

const managerOptions = computed(() =>
  props.employees
    .filter((e) => e.status === 'active')
    .map((emp) => ({
      value: emp.id,
      label: `${getDepartmentName(props.departments, emp.departmentId)} - ${emp.name}`,
    })),
)

const attendanceGroupOptions = computed(() =>
  store.attendanceGroups.filter((g) => g.status === 'enabled'),
)

const selectedAttendanceGroup = computed(() =>
  store.attendanceGroups.find((g) => g.id === form.value.attendanceGroupId),
)

const attendancePreview = computed(() => {
  const group = selectedAttendanceGroup.value
  if (!group) return null
  return {
    type: attendanceGroupTypeMap[group.attendanceType],
    period: formatShiftPeriod(group),
    monthlyLimit:
      group.minMonthlyOnlineHours && group.minMonthlyOnlineHours > 0
        ? `${group.minMonthlyOnlineHours} 小时`
        : '无限制',
    area: group.attendanceArea || group.punchLocations[0]?.name || '—',
  }
})

const authTreeData = computed(() => buildDepartmentTree(store.departments))

const authorizedNames = computed(() =>
  form.value.authorizedDepartmentIds
    .map((id) => getDepartmentName(store.departments, id))
    .filter((n) => n && n !== '-'),
)

const authorizedAccountCount = computed(() => {
  const ids = new Set(form.value.authorizedDepartmentIds)
  if (!ids.size) return 0
  return store.systemAccounts.filter(
    (a) =>
      a.status === 'enabled' &&
      (a.accountPortal === 'platform' || !a.accountPortal) &&
      ids.has(a.departmentId),
  ).length
})

function filterAuthNode(value: string, data: { label?: string; name?: string }) {
  if (!value) return true
  const label = data.label || data.name || ''
  return label.includes(value)
}

watch(authFilterKeyword, (val) => {
  authTreeRef.value?.filter(val)
})

function onAuthCheck() {
  form.value.authorizedDepartmentIds =
    (authTreeRef.value?.getCheckedKeys(false) as string[]) ?? []
}

function selectAllAuth() {
  void syncAuthTreeKeys(store.departments.map((d) => d.id))
}

function clearAllAuth() {
  void syncAuthTreeKeys([])
}

function onDeptImageChange(uploadFile: UploadFile) {
  const raw = uploadFile.raw
  if (!raw) return
  if (!raw.type.startsWith('image/')) {
    ElMessage.warning('请上传图片文件')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    form.value.imageUrl = String(reader.result || '')
  }
  reader.readAsDataURL(raw)
}

function submit() {
  if (!props.department || props.locked) return
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写部门名称')
    return
  }
  if (!form.value.parentId && form.value.orgType !== 'enterprise') {
    ElMessage.warning('请选择父级部门')
    return
  }
  if (!form.value.managerEmployeeId) {
    ElMessage.warning('请选择负责人')
    return
  }
  if (!form.value.attendanceGroupId) {
    ElMessage.warning('请选择关联考勤组')
    return
  }

  saving.value = true
  try {
    store.updateDepartment(props.department.id, {
      name: form.value.name.trim(),
      parentId: form.value.parentId,
      orgType: form.value.orgType,
      sort: form.value.sort,
      nodeType: form.value.nodeType,
      description: form.value.description.trim() || undefined,
      managerEmployeeId: form.value.managerEmployeeId,
      attendanceGroupId: form.value.attendanceGroupId,
      imageUrl: form.value.imageUrl || undefined,
      authorizedDepartmentIds: [...new Set(form.value.authorizedDepartmentIds)],
    })
    ElMessage.success('部门已更新')
    emit('saved')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <aside v-if="department" class="dept-edit-panel">
    <header class="panel-head">
      <div>
        <h3>{{ department.name }} · 编辑部门</h3>
        <p>填写部门基本信息、指定负责人，并配置数据授权</p>
      </div>
      <el-tag v-if="locked" size="small" type="info">系统节点</el-tag>
    </header>

    <div class="panel-scroll" :class="{ 'is-locked': locked }">
      <div class="form-section">
        <div class="section-head">
          <span class="section-dot" />
          <span>部门基本信息</span>
        </div>
        <div class="section-card">
          <el-form label-position="top" class="panel-form" :disabled="locked">
            <el-form-item label="部门名称" required>
              <el-input v-model="form.name" placeholder="请输入部门名称" />
            </el-form-item>

            <el-form-item label="父级部门" required>
              <el-select v-model="form.parentId" placeholder="请选择父级部门" style="width: 100%">
                <el-option
                  v-for="d in parentOptions"
                  :key="d.id"
                  :label="d.name"
                  :value="d.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="组织类型">
              <el-select v-model="form.orgType" style="width: 100%">
                <el-option label="部门/企业" value="department" />
                <el-option label="企业主体" value="enterprise" />
              </el-select>
            </el-form-item>

            <el-form-item label="排序">
              <el-input-number v-model="form.sort" :min="1" :max="999" style="width: 100%" />
            </el-form-item>

            <el-form-item label="节点类型">
              <div class="node-type-group">
                <button
                  type="button"
                  class="node-type-card"
                  :class="{ active: form.nodeType === 'branch' }"
                  :disabled="locked"
                  @click="form.nodeType = 'branch'"
                >
                  <strong>非叶节点</strong>
                  <span>可创建子部门</span>
                </button>
                <button
                  type="button"
                  class="node-type-card"
                  :class="{ active: form.nodeType === 'leaf' }"
                  :disabled="locked"
                  @click="form.nodeType = 'leaf'"
                >
                  <strong>叶节点</strong>
                  <span>不可创建子部门</span>
                </button>
              </div>
            </el-form-item>

            <el-form-item label="部门描述">
              <el-input
                v-model="form.description"
                type="textarea"
                :rows="3"
                placeholder="请输入部门职能与业务范围"
              />
            </el-form-item>

            <el-form-item label="部门图片">
              <div class="dept-image-row">
                <el-upload
                  :show-file-list="false"
                  :auto-upload="false"
                  accept="image/*"
                  :disabled="locked"
                  @change="onDeptImageChange"
                >
                  <el-button plain :disabled="locked">上传图片</el-button>
                </el-upload>
                <el-button
                  v-if="form.imageUrl"
                  link
                  type="danger"
                  :disabled="locked"
                  @click="form.imageUrl = ''"
                >
                  清除
                </el-button>
              </div>
              <div class="field-hint">非必填；统一 16:9 横版展示，推荐尺寸 960×540px / 1280×720px</div>
              <img v-if="form.imageUrl" :src="form.imageUrl" alt="部门图片" class="dept-image-preview" />
            </el-form-item>
          </el-form>
        </div>
      </div>

      <div class="form-section">
        <div class="section-head">
          <span class="section-dot" />
          <span>负责人信息</span>
        </div>
        <div class="section-card">
          <el-form label-position="top" :disabled="locked">
            <el-form-item label="负责人姓名" required>
              <el-select
                v-model="form.managerEmployeeId"
                filterable
                placeholder="部门-姓名"
                style="width: 100%"
              >
                <el-option
                  v-for="opt in managerOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <div class="form-section">
        <div class="section-head">
          <span class="section-dot" />
          <span>考勤组配置</span>
        </div>
        <div class="section-card">
          <el-form label-position="top" :disabled="locked">
            <el-form-item label="关联考勤组" required>
              <el-select
                v-model="form.attendanceGroupId"
                placeholder="考勤组名称"
                style="width: 100%"
              >
                <el-option
                  v-for="g in attendanceGroupOptions"
                  :key="g.id"
                  :label="g.name"
                  :value="g.id"
                />
              </el-select>
            </el-form-item>

            <div v-if="attendancePreview" class="attendance-preview">
              <div class="preview-title">考勤规则</div>
              <div class="preview-grid">
                <div><span>考勤类型</span><strong>{{ attendancePreview.type }}</strong></div>
                <div><span>考勤时段</span><strong>{{ attendancePreview.period }}</strong></div>
                <div><span>月最低在线</span><strong>{{ attendancePreview.monthlyLimit }}</strong></div>
                <div><span>考勤区域</span><strong>{{ attendancePreview.area }}</strong></div>
              </div>
            </div>
          </el-form>
        </div>
      </div>

      <div class="form-section">
        <div class="section-head">
          <span class="section-dot" />
          <span>部门授权</span>
        </div>
        <div class="section-card auth-card">
          <p class="auth-desc">
            将本部门数据授权给对应组织部门，被授权部门下的平台账号可访问该部门相关数据。
          </p>
          <div class="auth-meta">
            <span>已选部门 {{ form.authorizedDepartmentIds.length }} 个</span>
            <span>可覆盖账号约 {{ authorizedAccountCount }} 个</span>
          </div>
          <div class="auth-toolbar">
            <el-input
              v-model="authFilterKeyword"
              clearable
              placeholder="搜索部门"
              prefix-icon="Search"
              :disabled="locked"
            />
            <div class="auth-actions">
              <el-button text type="primary" :disabled="locked" @click="selectAllAuth">全选</el-button>
              <el-button text :disabled="locked" @click="clearAllAuth">清空</el-button>
            </div>
          </div>
          <el-tree
            ref="authTreeRef"
            class="auth-tree"
            :data="authTreeData"
            node-key="id"
            show-checkbox
            default-expand-all
            :default-checked-keys="form.authorizedDepartmentIds"
            :props="{ label: 'name', children: 'children' }"
            :filter-node-method="filterAuthNode"
            :disabled="locked"
            @check="onAuthCheck"
          />
          <div v-if="authorizedNames.length" class="auth-tags">
            <el-tag
              v-for="name in authorizedNames"
              :key="name"
              size="small"
              class="auth-tag"
            >
              {{ name }}
            </el-tag>
          </div>
          <p v-else class="auth-empty">尚未选择授权部门（可选）</p>
        </div>
      </div>
    </div>

    <div v-if="!locked" class="panel-footer">
      <el-button type="danger" plain @click="emit('remove')">删除部门</el-button>
      <el-button type="primary" :loading="saving" @click="submit">确认保存</el-button>
    </div>
  </aside>
  <aside v-else class="dept-edit-panel dept-edit-panel--empty">
    <el-empty description="请选择组织节点进行编辑" :image-size="72" />
  </aside>
</template>

<style scoped>
.dept-edit-panel {
  background: #fff;
  border: 1px solid #e8edf5;
  border-radius: 14px;
  padding: 16px 16px 12px;
  display: flex;
  flex-direction: column;
  min-height: 520px;
  max-height: min(72vh, 720px);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.04);
}

.dept-edit-panel--empty {
  align-items: center;
  justify-content: center;
}

.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.panel-head h3 {
  margin: 0 0 4px;
  font-size: 15px;
}

.panel-head p {
  margin: 0;
  font-size: 12px;
  color: #94a3b8;
}

.panel-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding-right: 4px;
}

.panel-scroll.is-locked {
  opacity: 0.72;
  pointer-events: none;
}

.form-section + .form-section {
  margin-top: 14px;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.section-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #5b4fdb;
}

.section-card {
  background: #f8fafc;
  border: 1px solid #e8ebf0;
  border-radius: 12px;
  padding: 12px;
}

.node-type-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  width: 100%;
}

.node-type-card {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 10px;
  padding: 8px 10px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.node-type-card:disabled {
  cursor: not-allowed;
}

.node-type-card strong {
  display: block;
  font-size: 12px;
  color: #1f2329;
  margin-bottom: 2px;
}

.node-type-card span {
  font-size: 11px;
  color: #94a3b8;
}

.node-type-card.active {
  border-color: #5b4fdb;
  background: #f5f3ff;
  box-shadow: inset 0 0 0 1px rgba(91, 79, 219, 0.15);
}

.attendance-preview {
  background: #fff;
  border: 1px dashed #dbe1ea;
  border-radius: 10px;
  padding: 10px 12px;
}

.preview-title {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 8px;
}

.preview-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.preview-grid span {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 2px;
}

.preview-grid strong {
  font-size: 12px;
  color: #334155;
  font-weight: 500;
}

.dept-image-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.dept-image-preview {
  margin-top: 8px;
  width: 100%;
  max-width: 320px;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  object-fit: cover;
  object-position: center;
  border: 1px solid #e2e8f0;
  display: block;
  background: #f8fafc;
}

.auth-card {
  background: #fff;
}

.auth-desc {
  margin: 0 0 8px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}

.auth-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 8px;
  font-size: 12px;
  color: #475569;
}

.auth-toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 8px;
}

.auth-actions {
  display: flex;
  gap: 4px;
}

.auth-tree {
  max-height: 180px;
  overflow: auto;
  border: 1px solid #e8ebf0;
  border-radius: 10px;
  padding: 8px 10px;
  background: #f8fafc;
}

.auth-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.auth-tag {
  max-width: 100%;
}

.auth-empty {
  margin: 8px 0 0;
  font-size: 12px;
  color: #94a3b8;
}

.panel-footer {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed #e2e8f0;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
}
</style>
