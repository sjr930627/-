<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  defaultEnterpriseModules,
  enterpriseModuleMap,
  enterpriseStatusMap,
  formatEnterpriseModules,
  generateRandomPassword,
  getEnterpriseOwnerIds,
  normalizeEnterpriseModules,
} from '@/constants/enterprise'
import type { EnterpriseServiceModule } from '@/types'
import EnterpriseOwnerPicker from '@/components/enterprise/EnterpriseOwnerPicker.vue'

const props = withDefaults(
  defineProps<{
    readonly?: boolean
  }>(),
  { readonly: false },
)

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const enterpriseId = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => Boolean(enterpriseId.value) && route.path.endsWith('/edit'))
const isDetail = computed(() => Boolean(enterpriseId.value) && !isEdit.value)
const pageTitle = computed(() => {
  if (props.readonly || isDetail.value) return '企业详情'
  return isEdit.value ? '编辑企业' : '新增企业'
})

const existing = computed(() =>
  enterpriseId.value ? store.enterprises.find((e) => e.id === enterpriseId.value) : null,
)

const createAdmin = ref(true)
const passwordMode = ref<'auto' | 'manual'>('auto')
const generatedPassword = ref(generateRandomPassword())

const moduleOptions: { key: EnterpriseServiceModule; label: string; disabled?: boolean }[] = [
  { key: 'attendance', label: enterpriseModuleMap.attendance, disabled: true },
  { key: 'payroll', label: enterpriseModuleMap.payroll, disabled: true },
  { key: 'recruitment', label: enterpriseModuleMap.recruitment },
  { key: 'task', label: enterpriseModuleMap.task },
  { key: 'training', label: enterpriseModuleMap.training },
]

const form = ref({
  name: '',
  shortName: '',
  creditCode: '',
  contactPerson: '',
  contactPhone: '',
  address: '',
  adminName: '',
  adminPhone: '',
  adminRole: '企业超级管理员',
  manualPassword: '',
  serviceModules: [...defaultEnterpriseModules] as EnterpriseServiceModule[],
  invoiceCategories: [] as string[],
  enterpriseOwnerIds: [] as string[],
})

const newCategoryInput = ref('')

function loadForm() {
  if ((isEdit.value || isDetail.value) && existing.value) {
    const e = existing.value
    form.value = {
      name: e.name,
      shortName: e.shortName,
      creditCode: e.creditCode,
      contactPerson: e.contactPerson,
      contactPhone: e.contactPhone,
      address: e.address ?? '',
      adminName: e.adminAccount?.name ?? '',
      adminPhone: e.adminAccount?.phone ?? '',
      adminRole: e.adminAccount?.role ?? '企业超级管理员',
      manualPassword: '',
      serviceModules: normalizeEnterpriseModules([...e.serviceModules]),
      invoiceCategories: [...(e.invoiceCategories ?? [])],
      enterpriseOwnerIds: [...getEnterpriseOwnerIds(e)],
    }
    createAdmin.value = Boolean(e.adminAccount)
    passwordMode.value = e.adminAccount?.passwordMode ?? 'auto'
    return
  }
  generatedPassword.value = generateRandomPassword()
}

watch([enterpriseId, () => store.enterprises.length], loadForm, { immediate: true })

function refreshPassword() {
  generatedPassword.value = generateRandomPassword()
}

function toggleModule(key: EnterpriseServiceModule) {
  if (props.readonly || isDetail.value) return
  if ((defaultEnterpriseModules as readonly string[]).includes(key)) return
  const list = form.value.serviceModules
  const idx = list.indexOf(key)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(key)
}

function hasModule(key: EnterpriseServiceModule) {
  return form.value.serviceModules.includes(key)
}

function addCategory() {
  const value = newCategoryInput.value.trim()
  if (!value) {
    ElMessage.warning('请输入发票类目')
    return
  }
  if (form.value.invoiceCategories.includes(value)) {
    ElMessage.warning('该类目已存在')
    return
  }
  form.value.invoiceCategories.push(value)
  newCategoryInput.value = ''
}

function removeCategory(index: number) {
  form.value.invoiceCategories.splice(index, 1)
}

function validate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入企业名称')
    return false
  }
  if (!form.value.creditCode.trim() || form.value.creditCode.trim().length !== 18) {
    ElMessage.warning('请输入 18 位统一社会信用代码')
    return false
  }
  if (!form.value.contactPerson.trim() || !form.value.contactPhone.trim()) {
    ElMessage.warning('请填写企业联系人信息')
    return false
  }
  if (form.value.serviceModules.length < defaultEnterpriseModules.length) {
    ElMessage.warning('至少开通两个模块')
    return false
  }
  const categories = form.value.invoiceCategories.map((item) => item.trim()).filter(Boolean)
  if (!categories.length) {
    ElMessage.warning('请至少维护一个可开发票类目')
    return false
  }
  if (new Set(categories).size !== categories.length) {
    ElMessage.warning('发票类目不能重复')
    return false
  }
  if (createAdmin.value) {
    if (!form.value.adminName.trim() || !form.value.adminPhone.trim()) {
      ElMessage.warning('请完善管理员账号信息')
      return false
    }
    if (passwordMode.value === 'manual' && form.value.manualPassword.length < 8) {
      ElMessage.warning('手动设置的初始密码至少 8 位')
      return false
    }
  }
  return true
}

function buildPayload() {
  const adminAccount = createAdmin.value
    ? {
        name: form.value.adminName.trim(),
        phone: form.value.adminPhone.trim(),
        role: form.value.adminRole,
        passwordMode: passwordMode.value,
        initialPassword:
          passwordMode.value === 'auto' ? generatedPassword.value : form.value.manualPassword,
      }
    : undefined

  return {
    name: form.value.name.trim(),
    shortName: form.value.shortName.trim() || form.value.name.trim().slice(0, 6),
    creditCode: form.value.creditCode.trim(),
    contactPerson: form.value.contactPerson.trim(),
    contactPhone: form.value.contactPhone.trim(),
    address: form.value.address.trim() || undefined,
    serviceModules: normalizeEnterpriseModules(form.value.serviceModules),
    invoiceCategories: form.value.invoiceCategories.map((item) => item.trim()).filter(Boolean),
    enterpriseOwnerIds: [...form.value.enterpriseOwnerIds],
    adminAccount,
  }
}

function save() {
  if (!validate()) return
  const payload = buildPayload()
  try {
    if (isEdit.value && enterpriseId.value) {
      store.updateEnterprise(enterpriseId.value, payload)
      ElMessage.success('企业信息已更新')
    } else {
      store.addEnterprise(payload)
      ElMessage.success('企业创建成功')
    }
    router.push('/enterprises')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function cancel() {
  router.push('/enterprises')
}

function goEdit() {
  router.push(`/enterprises/${enterpriseId.value}/edit`)
}
</script>

<template>
  <div class="enterprise-form-page">
    <div class="page-breadcrumb-row">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item>企业管理</el-breadcrumb-item>
        <el-breadcrumb-item>企业管理</el-breadcrumb-item>
        <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <template v-if="isDetail || readonly">
          <el-button @click="cancel">返回列表</el-button>
          <el-button type="primary" @click="goEdit">编辑</el-button>
        </template>
        <template v-else>
          <el-button @click="cancel">取消</el-button>
          <el-button type="primary" @click="save">
            <el-icon><CircleCheck /></el-icon>
            {{ isEdit ? '保存修改' : '保存并创建企业' }}
          </el-button>
        </template>
      </div>
    </div>

    <section class="form-section page-card">
      <div class="section-head">
        <div class="section-icon section-icon--blue">企</div>
        <div>
          <h3>企业基础信息</h3>
          <p>请填写企业工商注册信息，确保与签约主体一致</p>
        </div>
      </div>

      <el-form label-position="top" class="section-form">
        <el-form-item label="企业名称" required>
          <el-input
            v-model="form.name"
            :disabled="isDetail || readonly"
            placeholder="请输入工商注册全称"
          />
          <div class="field-hint">需与签约主体一致，如「杭州移动通信集团有限公司」</div>
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="企业简称">
              <el-input
                v-model="form.shortName"
                :disabled="isDetail || readonly"
                placeholder="用于系统内展示，如「杭州移动」"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item required>
              <template #label>
                <span>统一社会信用代码</span>
                <el-tooltip content="18 位，全局唯一，用于开票主体识别" placement="top">
                  <el-icon class="label-tip"><QuestionFilled /></el-icon>
                </el-tooltip>
              </template>
              <el-input
                v-model="form.creditCode"
                :disabled="isDetail || readonly"
                maxlength="18"
                placeholder="请输入 18 位统一社会信用代码"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="企业联系人" required>
          <el-row :gutter="12">
            <el-col :span="12">
              <el-input
                v-model="form.contactPerson"
                :disabled="isDetail || readonly"
                placeholder="联系人姓名"
              />
            </el-col>
            <el-col :span="12">
              <el-input
                v-model="form.contactPhone"
                :disabled="isDetail || readonly"
                maxlength="11"
                placeholder="联系人手机号（11 位）"
              />
            </el-col>
          </el-row>
        </el-form-item>

        <el-form-item label="联系地址">
          <el-input
            v-model="form.address"
            :disabled="isDetail || readonly"
            placeholder="请输入联系地址"
          />
        </el-form-item>

        <el-row v-if="existing" :gutter="16">
          <el-col :span="8">
            <el-form-item label="企业编号">
              <el-input :model-value="existing.code" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="创建日期">
              <el-input :model-value="existing.createdAt" disabled />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="合作状态">
              <el-tag :type="enterpriseStatusMap[existing.status].type">
                {{ enterpriseStatusMap[existing.status].label }}
              </el-tag>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </section>

    <section class="form-section page-card">
      <div class="section-head">
        <div class="section-icon section-icon--cyan">责</div>
        <div>
          <h3>企业负责人</h3>
          <p>按组织架构选择平台操作员，支持多选，作为该企业在系统中的对接负责人</p>
        </div>
      </div>

      <EnterpriseOwnerPicker
        v-model="form.enterpriseOwnerIds"
        :disabled="isDetail || readonly"
      />
    </section>

    <section class="form-section page-card">
      <div class="section-head">
        <div class="section-icon section-icon--purple">管</div>
        <div class="section-head-main">
          <div class="section-title-row">
            <h3>管理员账号创建</h3>
            <el-switch
              v-if="!isDetail && !readonly"
              v-model="createAdmin"
              inline-prompt
              active-text="开"
              inactive-text="关"
            />
          </div>
          <p>为企业创建首个超级管理员账号，用于登录企业 PC 端</p>
        </div>
      </div>

      <template v-if="createAdmin || (existing?.adminAccount && (isDetail || readonly))">
        <el-form label-position="top" class="section-form">
          <el-row :gutter="16">
            <el-col :span="12">
              <el-form-item label="管理员姓名" required>
                <el-input
                  v-model="form.adminName"
                  :disabled="isDetail || readonly || !createAdmin"
                  placeholder="请输入管理员真实姓名"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="手机号/账号" required>
                <el-input
                  v-model="form.adminPhone"
                  :disabled="isDetail || readonly || !createAdmin"
                  maxlength="11"
                  placeholder="请输入 11 位手机号"
                />
                <div class="field-hint">同时作为登录账号，创建成功后将发送短信通知</div>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="初始密码" required>
            <el-radio-group
              v-model="passwordMode"
              class="password-mode-group"
              :disabled="isDetail || readonly || !createAdmin"
            >
              <div class="password-mode-item">
                <el-radio value="auto">自动生成</el-radio>
                <div v-if="passwordMode === 'auto'" class="password-box">
                  <code>{{ existing?.adminAccount?.initialPassword ?? generatedPassword }}</code>
                  <el-button
                    v-if="!isDetail && !readonly"
                    text
                    type="primary"
                    @click="refreshPassword"
                  >
                    <el-icon><Refresh /></el-icon>
                  </el-button>
                </div>
              </div>
              <div class="password-mode-item">
                <el-radio value="manual">手动设置</el-radio>
                <el-input
                  v-if="passwordMode === 'manual'"
                  v-model="form.manualPassword"
                  :disabled="isDetail || readonly || !createAdmin"
                  type="password"
                  show-password
                  placeholder="请输入初始密码"
                  class="manual-password-input"
                />
              </div>
            </el-radio-group>
            <div class="field-hint">首次登录须强制修改密码</div>
          </el-form-item>

          <el-form-item label="角色" required>
            <el-select
              v-model="form.adminRole"
              :disabled="isDetail || readonly || !createAdmin"
              style="width: 320px"
            >
              <el-option label="企业超级管理员" value="企业超级管理员" />
            </el-select>
            <div class="field-hint">默认角色，拥有企业端全部功能权限</div>
          </el-form-item>
        </el-form>
      </template>
      <el-empty v-else description="未创建管理员账号" :image-size="64" />
    </section>

    <section class="form-section page-card">
      <div class="section-head">
        <div class="section-icon section-icon--green">模</div>
        <div>
          <h3>开通模块</h3>
          <p>考勤、财税模块默认开通；可按需额外开通招聘、任务、培训考核等模块</p>
        </div>
      </div>

      <div class="module-list">
        <div
          v-for="opt in moduleOptions"
          :key="opt.key"
          class="module-item"
          :class="{
            active: hasModule(opt.key),
            disabled: opt.disabled,
            readonly: isDetail || readonly,
          }"
          @click="!opt.disabled && toggleModule(opt.key)"
        >
          <span class="module-check">{{ hasModule(opt.key) ? '✓' : '' }}</span>
          <span>{{ opt.label }}模块</span>
          <el-tag v-if="opt.disabled" size="small" type="info">默认开通</el-tag>
        </div>
      </div>

      <div v-if="isDetail && existing" class="modules-summary">
        已开通：{{ formatEnterpriseModules(existing.serviceModules) }}
      </div>
    </section>

    <section class="form-section page-card">
      <div class="section-head">
        <div class="section-icon section-icon--orange">票</div>
        <div>
          <h3>可开发票类目</h3>
          <p>维护该企业可申请开具的发票类目，企业端开票申请时从中选择</p>
        </div>
      </div>

      <div
        v-if="form.invoiceCategories.length"
        class="category-list"
        :class="{ 'category-list--readonly': isDetail || readonly }"
      >
        <template v-if="isDetail || readonly">
          <el-tag
            v-for="(item, index) in form.invoiceCategories"
            :key="`${item}-${index}`"
            class="category-tag"
          >
            {{ item }}
          </el-tag>
        </template>
        <template v-else>
          <div
            v-for="(_, index) in form.invoiceCategories"
            :key="index"
            class="category-row"
          >
            <el-input
              v-model="form.invoiceCategories[index]"
              placeholder="如：生活服务*现代服务"
            />
            <el-button type="danger" plain @click="removeCategory(index)">
              删除
            </el-button>
          </div>
        </template>
      </div>
      <el-empty v-else description="暂未维护发票类目" :image-size="64" />

      <div v-if="!isDetail && !readonly" class="category-add">
        <el-input
          v-model="newCategoryInput"
          placeholder="输入类目名称，如：生活服务*现代服务"
          @keyup.enter="addCategory"
        />
        <el-button type="primary" @click="addCategory">新增类目</el-button>
      </div>

      <div v-if="isDetail && existing?.invoiceCategories?.length" class="modules-summary">
        共 {{ existing.invoiceCategories.length }} 个类目
      </div>
    </section>
  </div>
</template>

<style scoped>
.enterprise-form-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-breadcrumb-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.form-section {
  padding: 20px 24px;
}

.section-head {
  display: flex;
  gap: 14px;
  margin-bottom: 20px;
}

.section-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  flex-shrink: 0;
}

.section-icon--blue {
  background: linear-gradient(135deg, #409eff, #79bbff);
}

.section-icon--cyan {
  background: linear-gradient(135deg, #06b6d4, #22d3ee);
}

.section-icon--purple {
  background: linear-gradient(135deg, #5b4fdb, #7c6df0);
}

.section-icon--green {
  background: linear-gradient(135deg, #67c23a, #95d475);
}

.section-icon--orange {
  background: linear-gradient(135deg, #e6a23c, #f3d19e);
}

.section-head h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.section-head p {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.section-head-main {
  flex: 1;
}

.section-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-form {
  max-width: 920px;
}

.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.label-tip {
  margin-left: 4px;
  color: #909399;
  vertical-align: middle;
}

.password-mode-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.password-mode-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  width: 100%;
}

.manual-password-input {
  max-width: 320px;
  margin-left: 22px;
}

.password-box {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: 22px;
  padding: 10px 14px;
  border-radius: 8px;
  background: #f0f9eb;
  border: 1px solid #e1f3d8;
}

.password-box code {
  font-size: 15px;
  color: #67c23a;
  font-weight: 600;
}

.module-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(240px, 1fr));
  gap: 12px;
  max-width: 720px;
}

.module-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.15s;
}

.module-item.readonly {
  cursor: default;
}

.module-item.active {
  border-color: #67c23a;
  background: #f0f9eb;
}

.module-item.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.module-check {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #dcdfe6;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
}

.module-item.active .module-check {
  background: #67c23a;
  border-color: #67c23a;
}

.modules-summary {
  margin-top: 12px;
  font-size: 13px;
  color: #606266;
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-width: 720px;
}

.category-list--readonly {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 8px;
}

.category-tag {
  max-width: 100%;
  white-space: normal;
  height: auto;
  padding: 6px 10px;
  line-height: 1.4;
}

.category-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-row .el-input {
  flex: 1;
}

.category-add {
  display: flex;
  gap: 10px;
  margin-top: 14px;
  max-width: 720px;
}

.category-add .el-input {
  flex: 1;
}
</style>
