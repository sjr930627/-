<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import type { ElTree } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { buildDepartmentTree, getDepartmentName } from '@/utils'
import { attendanceGroupTypeMap, formatShiftPeriod } from '@/constants/attendanceGroup'
import type { DepartmentNodeType, DepartmentOrgType } from '@/types'

const DRAFT_KEY = 'deptFormDraft'

const props = defineProps<{
  visible: boolean
  editingId?: string | null
  defaultParentId?: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [deptId: string]
}>()

const store = useAppStore()

export interface DepartmentFormModel {
  name: string
  parentId: string | null
  orgType: DepartmentOrgType
  sort: number
  nodeType: DepartmentNodeType
  description: string
  managerEmployeeId: string | null
  attendanceGroupId: string | null
  imageUrl: string
  authorizedDepartmentIds: string[]
}

const emptyForm = (): DepartmentFormModel => ({
  name: '',
  parentId: props.defaultParentId ?? null,
  orgType: 'department',
  sort: 1,
  nodeType: 'branch',
  description: '',
  managerEmployeeId: null,
  attendanceGroupId: null,
  imageUrl: '',
  authorizedDepartmentIds: [],
})

const form = ref<DepartmentFormModel>(emptyForm())
const authTreeRef = ref<InstanceType<typeof ElTree>>()
const authFilterKeyword = ref('')

const isEdit = computed(() => !!props.editingId)

const parentOptions = computed(() =>
  store.departments.filter((d) => d.id !== props.editingId),
)

/** 授权树：与企业授权相同，选择平台组织部门 */
const authTreeData = computed(() => buildDepartmentTree(store.departments))

const authorizedNames = computed(() =>
  form.value.authorizedDepartmentIds
    .map((id) => getDepartmentName(store.departments, id))
    .filter((n) => n && n !== '-'),
)

/** 被授权部门下的平台账号数量（演示统计） */
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

async function syncAuthTreeKeys(keys: string[]) {
  form.value.authorizedDepartmentIds = [...keys]
  await nextTick()
  authTreeRef.value?.setCheckedKeys(keys)
}

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
  const ids = store.departments.map((d) => d.id)
  void syncAuthTreeKeys(ids)
}

function clearAllAuth() {
  void syncAuthTreeKeys([])
}

const managerOptions = computed(() =>
  store.employees.map((emp) => ({
    value: emp.id,
    label: `星辰通信集团 - ${getDepartmentName(store.departments, emp.departmentId)} - ${emp.name}`,
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

watch(
  () => props.visible,
  async (open) => {
    if (!open) return
    authFilterKeyword.value = ''
    if (props.editingId) {
      const dept = store.departments.find((d) => d.id === props.editingId)
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
      return
    }
    form.value = emptyForm()
    await syncAuthTreeKeys([])
  },
  { immediate: true },
)

function close() {
  emit('update:visible', false)
}

function saveDraft() {
  localStorage.setItem(DRAFT_KEY, JSON.stringify(form.value))
  ElMessage.success('草稿已保存')
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Partial<DepartmentFormModel>
    form.value = {
      ...emptyForm(),
      ...parsed,
      authorizedDepartmentIds: Array.isArray(parsed.authorizedDepartmentIds)
        ? parsed.authorizedDepartmentIds
        : [],
    }
    void syncAuthTreeKeys(form.value.authorizedDepartmentIds)
    ElMessage.info('已加载草稿')
  } catch {
    /* ignore */
  }
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

  const payload = {
    ...form.value,
    name: form.value.name.trim(),
    authorizedDepartmentIds: [...new Set(form.value.authorizedDepartmentIds)],
  }

  try {
    if (isEdit.value && props.editingId) {
      store.updateDepartment(props.editingId, payload)
      ElMessage.success('部门已更新')
      emit('saved', props.editingId)
    } else {
      const dept = store.addDepartment(payload)
      localStorage.removeItem(DRAFT_KEY)
      ElMessage.success('部门已创建')
      emit('saved', dept.id)
    }
    close()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

defineExpose({ loadDraft })
</script>

<template>
  <el-drawer
    :model-value="visible"
    :title="isEdit ? '编辑部门' : '新增部门'"
    size="720px"
    destroy-on-close
    class="dept-form-drawer"
    @update:model-value="emit('update:visible', $event)"
  >
    <template #header>
      <div class="drawer-header">
        <div>
          <h3 class="drawer-title">{{ isEdit ? '编辑部门' : '新增部门' }}</h3>
          <p class="drawer-subtitle">填写部门基本信息、指定负责人，并配置数据授权</p>
        </div>
      </div>
    </template>

    <div class="form-section">
      <div class="section-head">
        <span class="section-dot" />
        <span>部门基本信息</span>
      </div>
      <div class="section-card">
        <el-form label-position="top" class="dept-form">
          <el-form-item label="部门名称" required>
            <el-input v-model="form.name" placeholder="请输入部门名称">
              <template #prefix><el-icon><OfficeBuilding /></el-icon></template>
            </el-input>
          </el-form-item>

          <el-row :gutter="16">
            <el-col :span="12">
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
            </el-col>
            <el-col :span="12">
              <el-form-item label="组织类型">
                <el-select v-model="form.orgType" style="width: 100%">
                  <el-option label="部门/企业" value="department" />
                  <el-option label="企业主体" value="enterprise" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="排序">
                <el-input-number v-model="form.sort" :min="1" :max="999" style="width: 100%" />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="节点类型">
                <div class="node-type-group">
                  <button
                    type="button"
                    class="node-type-card"
                    :class="{ active: form.nodeType === 'branch' }"
                    @click="form.nodeType = 'branch'"
                  >
                    <strong>非叶节点</strong>
                    <span>可创建子部门</span>
                  </button>
                  <button
                    type="button"
                    class="node-type-card"
                    :class="{ active: form.nodeType === 'leaf' }"
                    @click="form.nodeType = 'leaf'"
                  >
                    <strong>叶节点</strong>
                    <span>不可创建子部门</span>
                  </button>
                </div>
              </el-form-item>
            </el-col>
          </el-row>

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
                @change="onDeptImageChange"
              >
                <el-button plain>上传图片</el-button>
              </el-upload>
              <el-button v-if="form.imageUrl" link type="danger" @click="form.imageUrl = ''">清除</el-button>
            </div>
            <div class="field-hint">非必填，用于部门展示</div>
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
        <el-form label-position="top">
          <el-form-item label="负责人姓名" required>
            <el-select
              v-model="form.managerEmployeeId"
              filterable
              placeholder="公司-部门-姓名"
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
        <el-form label-position="top">
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
          将本部门数据授权给对应组织部门，被授权部门下的平台账号可访问该部门相关数据（规则同企业授权）。
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
            style="width: 220px"
          />
          <div class="auth-actions">
            <el-button text type="primary" @click="selectAllAuth">全选</el-button>
            <el-button text @click="clearAllAuth">清空</el-button>
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

    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="温馨提示"
      description="带 * 号为必填项。部门创建后，可在组织架构树中拖拽调整层级顺序。"
      class="form-tip"
    />

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="close">取消</el-button>
        <el-button plain @click="saveDraft">
          <el-icon><EditPen /></el-icon>
          保存草稿
        </el-button>
        <el-button type="primary" @click="submit">
          <el-icon><CircleCheck /></el-icon>
          {{ isEdit ? '确认保存' : '确认创建' }}
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.drawer-header {
  padding-right: 24px;
}

.drawer-title {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #1f2329;
}

.drawer-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: #64748b;
}

.form-section + .form-section {
  margin-top: 18px;
}

.section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  font-size: 14px;
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
  padding: 16px;
}

.node-type-group {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  width: 100%;
}

.node-type-card {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 10px;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  transition: all 0.15s ease;
}

.node-type-card strong {
  display: block;
  font-size: 13px;
  color: #1f2329;
  margin-bottom: 4px;
}

.node-type-card span {
  font-size: 12px;
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
  padding: 12px 14px;
}

.preview-title {
  font-size: 13px;
  font-weight: 600;
  color: #475569;
  margin-bottom: 10px;
}

.preview-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 16px;
}

.preview-grid span {
  display: block;
  font-size: 12px;
  color: #94a3b8;
  margin-bottom: 2px;
}

.preview-grid strong {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
}

.form-tip {
  margin-top: 18px;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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
  margin-top: 10px;
  max-width: 200px;
  max-height: 120px;
  border-radius: 8px;
  object-fit: cover;
  border: 1px solid #e2e8f0;
}

.auth-card {
  background: #fff;
}

.auth-desc {
  margin: 0 0 10px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}

.auth-meta {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
  font-size: 12px;
  color: #475569;
}

.auth-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.auth-actions {
  display: flex;
  gap: 4px;
}

.auth-tree {
  max-height: 280px;
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
  margin-top: 10px;
}

.auth-tag {
  max-width: 100%;
}

.auth-empty {
  margin: 10px 0 0;
  font-size: 12px;
  color: #94a3b8;
}
</style>
