<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, type UploadFile } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { isUnassignedDepartment } from '@/constants/department'
import type { EmployeeGender, EmployeeSkillCertificate, EmployeeStatus } from '@/types'

export interface EmployeeFormModel {
  name: string
  phone: string
  gender: EmployeeGender
  employeeNo: string
  age: number | undefined
  email: string
  hireDate: string
  address: string
  position: string
  departmentId: string
  remark: string
  status: EmployeeStatus
  skillCertificates: EmployeeSkillCertificate[]
}

const props = defineProps<{
  visible: boolean
  editingId?: string | null
  defaultDepartmentId?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  saved: [employeeId: string]
}>()

const store = useAppStore()

const positionOptions = [
  '加油站营业员',
  '班组长',
  '操作工',
  '质检员',
  '设备维护',
  '装卸工',
  '调度员',
  '营销专员',
  '安全员',
]

const createCertificate = (): EmployeeSkillCertificate => ({
  id: `cert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  name: '',
  certificateNo: '',
  issueDate: '',
  expiryDate: '',
})

const emptyForm = (): EmployeeFormModel => ({
  name: '',
  phone: '',
  gender: 'male',
  employeeNo: '',
  age: undefined,
  email: '',
  hireDate: new Date().toISOString().slice(0, 10),
  address: '',
  position: '',
  departmentId: props.defaultDepartmentId ?? '',
  remark: '',
  status: isUnassignedDepartment(props.defaultDepartmentId) ? 'pending' : 'active',
  skillCertificates: [],
})

const form = ref<EmployeeFormModel>(emptyForm())

const isEdit = computed(() => !!props.editingId)

const editingEmployee = computed(() =>
  props.editingId ? store.employees.find((e) => e.id === props.editingId) : undefined,
)

const isRealNameVerified = computed(() => !!editingEmployee.value?.realNameVerified)

watch(
  () => props.visible,
  (open) => {
    if (!open) return
    if (props.editingId) {
      const emp = store.employees.find((e) => e.id === props.editingId)
      if (!emp) return
      form.value = {
        name: emp.name,
        phone: emp.phone ?? '',
        gender: emp.gender ?? 'male',
        employeeNo: emp.employeeNo,
        age: emp.age,
        email: emp.email ?? '',
        hireDate: emp.hireDate,
        address: emp.address ?? '',
        position: emp.position,
        departmentId: emp.departmentId,
        remark: emp.remark ?? '',
        status: emp.status,
        skillCertificates:
          emp.skillCertificates?.length
            ? emp.skillCertificates.map((c) => ({ ...c }))
            : emp.skills.length
              ? emp.skills.map((name) => ({ ...createCertificate(), name }))
              : [],
      }
      return
    }
    form.value = emptyForm()
  },
  { immediate: true },
)

function close() {
  emit('update:visible', false)
}

function addCertificate() {
  form.value.skillCertificates.push(createCertificate())
}

function removeCertificate(id: string) {
  form.value.skillCertificates = form.value.skillCertificates.filter((c) => c.id !== id)
}

function handlePhotoChange(cert: EmployeeSkillCertificate, file: UploadFile) {
  if (!file.raw) return
  if (file.raw.size > 5 * 1024 * 1024) {
    ElMessage.warning('图片大小不能超过 5MB')
    return
  }
  cert.photoName = file.name
  const reader = new FileReader()
  reader.onload = () => {
    cert.photoUrl = String(reader.result ?? '')
  }
  reader.readAsDataURL(file.raw)
}

function submit() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写姓名')
    return
  }
  if (!form.value.phone.trim()) {
    ElMessage.warning('请填写手机号')
    return
  }
  if (!form.value.employeeNo.trim()) {
    ElMessage.warning('请填写工号')
    return
  }
  if (!form.value.hireDate) {
    ElMessage.warning('请选择入职日期')
    return
  }
  if (!form.value.position.trim()) {
    ElMessage.warning('请选择岗位')
    return
  }
  if (!form.value.departmentId) {
    ElMessage.warning('请选择部门')
    return
  }

  const certificates = form.value.skillCertificates.filter((c) => c.name.trim())
  for (const cert of certificates) {
    if (!cert.photoUrl && !cert.photoName) {
      ElMessage.warning(`请上传「${cert.name}」的技能证照片`)
      return
    }
  }

  let status = form.value.status
  if (status !== 'resigned') {
    if (isUnassignedDepartment(form.value.departmentId)) status = 'pending'
    else if (status === 'pending') status = 'active'
  }

  const payload = {
    name: form.value.name.trim(),
    phone: form.value.phone.trim(),
    gender: form.value.gender,
    employeeNo: form.value.employeeNo.trim(),
    age: form.value.age,
    email: form.value.email.trim(),
    hireDate: form.value.hireDate,
    address: form.value.address.trim(),
    position: form.value.position.trim(),
    departmentId: form.value.departmentId,
    remark: form.value.remark.trim(),
    status,
    skills: certificates.map((c) => c.name.trim()),
    skillCertificates: certificates,
    preferredShiftIds: [] as string[],
    unavailableDates: [] as string[],
  }

  if (isEdit.value && props.editingId) {
    const existing = store.employees.find((e) => e.id === props.editingId)
    store.updateEmployee(props.editingId, {
      ...payload,
      ...(existing?.realNameVerified
        ? { name: existing.name, phone: existing.phone }
        : {}),
      realNameVerified: existing?.realNameVerified,
      preferredShiftIds: existing?.preferredShiftIds ?? [],
      unavailableDates: existing?.unavailableDates ?? [],
    })
    ElMessage.success('人员信息已保存')
    emit('saved', props.editingId)
  } else {
    const emp = store.addEmployee(payload)
    ElMessage.success('人员已添加')
    emit('saved', emp.id)
  }
  close()
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    :with-header="false"
    size="min(1120px, 96vw)"
    destroy-on-close
    class="employee-form-drawer"
    @update:model-value="emit('update:visible', $event)"
  >
    <div class="form-layout">
      <div class="form-main">
        <section class="form-section">
          <div class="section-head section-head--blue">
            <span class="section-icon"><el-icon><User /></el-icon></span>
            <span>基本信息</span>
            <el-tag
              v-if="isEdit"
              size="small"
              :type="isRealNameVerified ? 'success' : 'warning'"
              class="real-name-tag"
            >
              {{ isRealNameVerified ? '已实名' : '未实名' }}
            </el-tag>
            <span class="required-tip">* 为必填项</span>
          </div>
          <div class="section-card">
            <el-row :gutter="16">
              <el-col :span="8">
                <el-form-item label="姓名" required>
                  <el-input
                    v-model="form.name"
                    placeholder="请输入姓名"
                    :disabled="isRealNameVerified"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="手机号" required>
                  <el-input
                    v-model="form.phone"
                    placeholder="请输入手机号"
                    :disabled="isRealNameVerified"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="性别">
                  <el-select v-model="form.gender" style="width: 100%">
                    <el-option label="男" value="male" />
                    <el-option label="女" value="female" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="24">
                <el-form-item label="工号" required>
                  <el-input v-model="form.employeeNo" placeholder="请输入工号" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="年龄">
                  <el-input-number v-model="form.age" :min="16" :max="70" style="width: 100%" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="邮箱">
                  <el-input v-model="form.email" placeholder="请输入邮箱" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-row :gutter="16">
              <el-col :span="24">
                <el-form-item label="入职日期" required>
                  <el-date-picker
                    v-model="form.hireDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="默认当天"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="居住地址">
              <el-input v-model="form.address" placeholder="请输入居住地址" />
            </el-form-item>
          </div>
        </section>

        <section class="form-section">
          <div class="section-head section-head--orange">
            <span class="section-icon"><el-icon><Briefcase /></el-icon></span>
            <span>岗位信息</span>
          </div>
          <div class="section-card">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="岗位" required>
                  <el-select
                    v-model="form.position"
                    filterable
                    allow-create
                    default-first-option
                    placeholder="请选择岗位"
                    style="width: 100%"
                  >
                    <el-option v-for="p in positionOptions" :key="p" :label="p" :value="p" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="部门" required>
                  <el-select v-model="form.departmentId" placeholder="请选择部门" style="width: 100%">
                    <el-option
                      v-for="d in store.departments"
                      :key="d.id"
                      :label="d.name"
                      :value="d.id"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="备注">
              <el-input
                v-model="form.remark"
                type="textarea"
                :rows="4"
                placeholder="请输入备注信息"
              />
            </el-form-item>
          </div>
        </section>
      </div>

      <div class="form-side">
        <section class="form-section">
          <div class="section-head section-head--green">
            <span class="section-icon"><el-icon><Document /></el-icon></span>
            <span>技能证书信息</span>
            <el-button type="primary" size="small" class="add-skill-btn" @click="addCertificate">
              + 新增技能
            </el-button>
          </div>

          <div v-if="!form.skillCertificates.length" class="cert-empty">
            暂无技能证书，点击「+ 新增技能」添加
          </div>

          <div
            v-for="cert in form.skillCertificates"
            :key="cert.id"
            class="section-card cert-card"
          >
            <button type="button" class="cert-delete" @click="removeCertificate(cert.id)">
              <el-icon><Delete /></el-icon>
            </button>
            <el-form-item label="技能证书名称" required>
              <el-input v-model="cert.name" placeholder="请输入证书名称" />
            </el-form-item>
            <el-form-item label="技能证书编号">
              <el-input v-model="cert.certificateNo" placeholder="请输入证书编号" />
            </el-form-item>
            <el-row :gutter="12">
              <el-col :span="12">
                <el-form-item label="发证日期">
                  <el-date-picker
                    v-model="cert.issueDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="选择日期"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="有效期至">
                  <el-date-picker
                    v-model="cert.expiryDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    placeholder="选择日期"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="技能证照片" required>
              <el-upload
                class="cert-upload"
                drag
                :auto-upload="false"
                accept=".jpg,.jpeg,.png"
                :show-file-list="false"
                @change="(file: UploadFile) => handlePhotoChange(cert, file)"
              >
                <img v-if="cert.photoUrl" :src="cert.photoUrl" class="cert-preview" alt="证书预览" />
                <template v-else>
                  <el-icon class="upload-icon"><UploadFilled /></el-icon>
                  <div class="upload-text">点击或拖拽上传技能证照片</div>
                  <div class="upload-hint">支持 JPG、PNG 格式，大小不超过 5MB</div>
                </template>
              </el-upload>
              <div v-if="cert.photoName" class="upload-name">{{ cert.photoName }}</div>
            </el-form-item>
          </div>
        </section>

        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="form-tip"
        >
          <template #title>填写提示</template>
          <ol class="tip-list">
            <li>带 * 号为必填项，请确保信息准确无误。</li>
            <li>手机号将用于实名认证，请仔细核对。</li>
            <li>提交后可在灵工档案列表中进行管理。</li>
          </ol>
        </el-alert>
      </div>
    </div>

    <template #footer>
      <div class="drawer-footer">
        <el-button @click="close">取消</el-button>
        <el-button type="primary" @click="submit">
          <el-icon><CircleCheck /></el-icon>
          保存
        </el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.employee-form-drawer :deep(.el-drawer__body) {
  padding: 16px 20px;
  background: #f5f6fa;
}

.drawer-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.form-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.45fr) minmax(300px, 1fr);
  gap: 16px;
  align-items: start;
}

.form-section + .form-section {
  margin-top: 16px;
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

.section-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.section-head--blue .section-icon {
  background: #3b82f6;
}

.section-head--orange .section-icon {
  background: #f59e0b;
}

.section-head--green .section-icon {
  background: #22c55e;
}

.required-tip {
  margin-left: auto;
  font-size: 12px;
  font-weight: 400;
  color: #ef4444;
}

.real-name-tag {
  margin-left: 4px;
}

.add-skill-btn {
  margin-left: auto;
}

.section-card {
  background: #fff;
  border: 1px solid #e8ebf0;
  border-radius: 12px;
  padding: 16px;
}

.cert-card {
  position: relative;
  margin-bottom: 12px;
}

.cert-empty {
  background: #fff;
  border: 1px dashed #e2e8f0;
  border-radius: 12px;
  padding: 24px 16px;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
  margin-bottom: 12px;
}

.cert-delete {
  position: absolute;
  top: 12px;
  right: 12px;
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
}

.cert-delete:hover {
  color: #ef4444;
}

.cert-upload :deep(.el-upload-dragger) {
  padding: 18px 12px;
  border-radius: 10px;
}

.upload-icon {
  font-size: 28px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 13px;
  color: #475569;
}

.upload-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.cert-preview {
  max-width: 100%;
  max-height: 120px;
  object-fit: contain;
  border-radius: 8px;
}

.upload-name {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
}

.form-tip {
  margin-top: 12px;
}

.tip-list {
  margin: 8px 0 0;
  padding-left: 18px;
  color: #64748b;
  font-size: 13px;
  line-height: 1.7;
}

:deep(.el-form-item__label) {
  font-size: 13px;
  color: #475569;
}

@media (max-width: 960px) {
  .form-layout {
    grid-template-columns: 1fr;
  }
}
</style>
