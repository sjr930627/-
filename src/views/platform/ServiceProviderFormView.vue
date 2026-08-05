<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  esignPlatformMap,
  providerSignContractTypeMap,
  providerStatusMap,
} from '@/constants/partnership'
import type {
  ESignPlatform,
  ProviderSignContractTemplate,
  ProviderSignContractType,
} from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const providerId = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => Boolean(providerId.value) && route.path.endsWith('/edit'))
const isDetail = computed(() => Boolean(providerId.value) && !isEdit.value)

const existing = computed(() =>
  providerId.value ? store.serviceProviders.find((p) => p.id === providerId.value) : null,
)

const form = ref({
  name: '',
  shortName: '',
  contact: '',
  phone: '',
  email: '',
  address: '',
  businessScope: '',
  cooperationStartDate: new Date().toISOString().slice(0, 10),
  rating: 4.5,
  remark: '',
  esignPlatform: 'fadada' as ESignPlatform,
  esignAppId: '',
})

const signTemplates = ref<ProviderSignContractTemplate[]>([])

const templateDialogVisible = ref(false)
const editingTemplateId = ref<string | null>(null)
const templateForm = ref({
  name: '',
  contractType: 'platform_cooperation' as ProviderSignContractType,
  templateId: '',
  required: true,
  description: '',
})

const esignPlatformOptions = Object.entries(esignPlatformMap).map(([value, label]) => ({
  value,
  label,
}))

const contractTypeOptions = Object.entries(providerSignContractTypeMap).map(([value, meta]) => ({
  value,
  label: meta.label,
  desc: meta.desc,
}))

function loadForm() {
  if ((isEdit.value || isDetail.value) && existing.value) {
    const p = existing.value
    form.value = {
      name: p.name,
      shortName: p.shortName ?? '',
      contact: p.contact,
      phone: p.phone,
      email: p.email ?? '',
      address: p.address ?? '',
      businessScope: p.businessScope,
      cooperationStartDate: p.cooperationStartDate,
      rating: p.rating ?? 4.5,
      remark: p.remark ?? '',
      esignPlatform: p.esignPlatform ?? 'fadada',
      esignAppId: p.esignAppId ?? '',
    }
    signTemplates.value = [...(p.signContractTemplates ?? [])]
    return
  }
  form.value.cooperationStartDate = new Date().toISOString().slice(0, 10)
  signTemplates.value = []
}

watch([providerId, () => store.serviceProviders.length], loadForm, { immediate: true })

function cancel() {
  router.push('/service-providers')
}

function goEdit() {
  router.push(`/service-providers/${providerId.value}/edit`)
}

function validate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写服务商名称')
    return false
  }
  if (!form.value.contact.trim()) {
    ElMessage.warning('请填写联系人')
    return false
  }
  if (!/^1\d{10}$/.test(form.value.phone.trim())) {
    ElMessage.warning('请填写正确的 11 位联系电话')
    return false
  }
  if (!form.value.businessScope.trim()) {
    ElMessage.warning('请填写业务范围')
    return false
  }
  for (const tpl of signTemplates.value) {
    if (!tpl.templateId.trim()) {
      ElMessage.warning(`请填写「${tpl.name}」的合同模板 ID`)
      return false
    }
  }
  return true
}

function buildPayload() {
  return {
    name: form.value.name.trim(),
    shortName: form.value.shortName.trim() || undefined,
    contact: form.value.contact.trim(),
    phone: form.value.phone.trim(),
    email: form.value.email.trim() || undefined,
    address: form.value.address.trim() || undefined,
    businessScope: form.value.businessScope.trim(),
    cooperationStartDate: form.value.cooperationStartDate,
    rating: form.value.rating,
    remark: form.value.remark.trim() || undefined,
    esignPlatform: form.value.esignPlatform,
    esignAppId: form.value.esignAppId.trim() || undefined,
    signContractTemplates: signTemplates.value.map((t) => ({
      ...t,
      templateId: t.templateId.trim(),
      updatedAt: new Date().toISOString(),
    })),
  }
}

function save() {
  if (!validate()) return
  const payload = buildPayload()
  if (isEdit.value && providerId.value) {
    store.updateServiceProvider(providerId.value, payload)
    ElMessage.success('服务商信息已更新')
    router.push(`/service-providers/${providerId.value}`)
    return
  }
  const item = store.addServiceProvider(payload)
  ElMessage.success('服务商创建成功')
  router.push(`/service-providers/${item.id}`)
}

function openAddTemplate() {
  editingTemplateId.value = null
  templateForm.value = {
    name: '',
    contractType: 'platform_cooperation',
    templateId: '',
    required: true,
    description: '',
  }
  templateDialogVisible.value = true
}

function openEditTemplate(row: ProviderSignContractTemplate) {
  editingTemplateId.value = row.id
  templateForm.value = {
    name: row.name,
    contractType: row.contractType,
    templateId: row.templateId,
    required: row.required,
    description: row.description ?? '',
  }
  templateDialogVisible.value = true
}

function saveTemplate() {
  if (!templateForm.value.name.trim()) {
    ElMessage.warning('请填写合同名称')
    return
  }
  if (!templateForm.value.templateId.trim()) {
    ElMessage.warning('请填写电子签平台合同模板 ID')
    return
  }
  const now = new Date().toISOString()
  if (editingTemplateId.value) {
    const idx = signTemplates.value.findIndex((t) => t.id === editingTemplateId.value)
    if (idx >= 0) {
      signTemplates.value[idx] = {
        ...signTemplates.value[idx],
        name: templateForm.value.name.trim(),
        contractType: templateForm.value.contractType,
        templateId: templateForm.value.templateId.trim(),
        required: templateForm.value.required,
        description: templateForm.value.description.trim() || undefined,
        updatedAt: now,
      }
    }
  } else {
    signTemplates.value.push({
      id: `sct_${Date.now()}`,
      name: templateForm.value.name.trim(),
      contractType: templateForm.value.contractType,
      templateId: templateForm.value.templateId.trim(),
      required: templateForm.value.required,
      description: templateForm.value.description.trim() || undefined,
      updatedAt: now,
    })
  }
  templateDialogVisible.value = false
  ElMessage.success(editingTemplateId.value ? '模板已更新' : '模板已添加')
}

async function removeTemplate(row: ProviderSignContractTemplate) {
  try {
    await ElMessageBox.confirm(`确定删除合同模板「${row.name}」？`, '删除确认', { type: 'warning' })
    signTemplates.value = signTemplates.value.filter((t) => t.id !== row.id)
    ElMessage.success('已删除')
  } catch {
    // cancelled
  }
}

const linkedEnterprises = computed(() =>
  (existing.value?.linkedEnterpriseIds ?? [])
    .map((id) => store.enterprises.find((e) => e.id === id))
    .filter(Boolean),
)

const contractCount = computed(() =>
  existing.value ? store.getContractsByProvider(existing.value.id).length : 0,
)

const requiredTemplateCount = computed(() => signTemplates.value.filter((t) => t.required).length)

function contractTypeLabel(type: ProviderSignContractType) {
  return providerSignContractTypeMap[type].label
}
</script>

<template>
  <div class="provider-form-page">
    <div class="page-header-row">
      <div class="header-actions">
        <template v-if="isDetail">
          <el-button @click="cancel">返回列表</el-button>
          <el-button type="primary" @click="goEdit">编辑</el-button>
        </template>
        <template v-else>
          <el-button @click="cancel">取消</el-button>
          <el-button type="primary" @click="save">
            <el-icon><CircleCheck /></el-icon>
            {{ isEdit ? '保存修改' : '保存并创建' }}
          </el-button>
        </template>
      </div>
    </div>

    <div class="form-layout">
      <div class="form-main">
        <section class="page-card form-section">
          <div class="section-head">
            <div class="section-icon">服</div>
            <div>
              <h3>服务商基础信息</h3>
              <p>填写服务商主体信息与联系方式，用于平台合作签约</p>
            </div>
          </div>

          <el-form label-position="top" class="section-form">
            <el-form-item label="服务商名称" required>
              <el-input
                v-model="form.name"
                :disabled="isDetail"
                placeholder="请输入工商注册全称"
              />
            </el-form-item>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="服务商简称">
                  <el-input
                    v-model="form.shortName"
                    :disabled="isDetail"
                    placeholder="用于系统内展示"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="合作开始日期" required>
                  <el-date-picker
                    v-model="form.cooperationStartDate"
                    type="date"
                    value-format="YYYY-MM-DD"
                    :disabled="isDetail"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="联系人" required>
              <el-row :gutter="12">
                <el-col :span="12">
                  <el-input v-model="form.contact" :disabled="isDetail" placeholder="联系人姓名" />
                </el-col>
                <el-col :span="12">
                  <el-input
                    v-model="form.phone"
                    :disabled="isDetail"
                    maxlength="11"
                    placeholder="联系人手机号"
                  />
                </el-col>
              </el-row>
            </el-form-item>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="联系邮箱">
                  <el-input v-model="form.email" :disabled="isDetail" placeholder="service@example.com" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="服务评分">
                  <el-input-number
                    v-model="form.rating"
                    :disabled="isDetail"
                    :min="1"
                    :max="5"
                    :step="0.1"
                    :precision="1"
                    style="width: 100%"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="联系地址">
              <el-input v-model="form.address" :disabled="isDetail" placeholder="请输入联系地址" />
            </el-form-item>

            <el-form-item label="业务范围" required>
              <el-input
                v-model="form.businessScope"
                :disabled="isDetail"
                type="textarea"
                :rows="3"
                placeholder="描述服务商可提供的服务类型，如灵活用工、物流仓储等"
              />
            </el-form-item>

            <el-form-item label="备注说明">
              <el-input
                v-model="form.remark"
                :disabled="isDetail"
                type="textarea"
                :rows="2"
                placeholder="补充说明（选填）"
              />
            </el-form-item>

            <el-row v-if="existing" :gutter="16">
              <el-col :span="8">
                <el-form-item label="服务商编号">
                  <el-input :model-value="existing.code" disabled />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="合作状态">
                  <el-tag :type="providerStatusMap[existing.status].type">
                    {{ providerStatusMap[existing.status].label }}
                  </el-tag>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="创建日期">
                  <el-input :model-value="existing.createdAt.slice(0, 10)" disabled />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>
        </section>

        <section class="page-card form-section">
          <div class="section-head">
            <div class="section-icon contract-icon">签</div>
            <div>
              <h3>签署合同配置</h3>
              <p>配置该服务商需关联的电子签平台及合同模板 ID，用于企业/灵工签约</p>
            </div>
          </div>

          <el-form label-position="top" class="section-form">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="电子签平台">
                  <el-select
                    v-model="form.esignPlatform"
                    :disabled="isDetail"
                    placeholder="选择电子签平台"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="opt in esignPlatformOptions"
                      :key="opt.value"
                      :label="opt.label"
                      :value="opt.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="电子签应用 ID">
                  <el-input
                    v-model="form.esignAppId"
                    :disabled="isDetail"
                    placeholder="如 APP-ZQ-20240101"
                  />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>

          <div class="template-toolbar">
            <div class="template-summary">
              已配置 <strong>{{ signTemplates.length }}</strong> 个模板
              · 必签 <strong>{{ requiredTemplateCount }}</strong> 个
            </div>
            <el-button v-if="!isDetail" type="primary" plain @click="openAddTemplate">
              <el-icon><Plus /></el-icon>
              添加合同模板
            </el-button>
          </div>

          <el-table :data="signTemplates" border stripe empty-text="暂未配置签署合同模板">
            <el-table-column prop="name" label="合同名称" min-width="180" />
            <el-table-column label="合同类型" width="140">
              <template #default="{ row }">
                {{ contractTypeLabel(row.contractType) }}
              </template>
            </el-table-column>
            <el-table-column prop="templateId" label="模板 ID" min-width="200">
              <template #default="{ row }">
                <code class="template-id">{{ row.templateId }}</code>
              </template>
            </el-table-column>
            <el-table-column label="必签" width="72" align="center">
              <template #default="{ row }">
                <el-tag :type="row.required ? 'danger' : 'info'" size="small">
                  {{ row.required ? '是' : '否' }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="description" label="说明" min-width="160" show-overflow-tooltip />
            <el-table-column v-if="!isDetail" label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="openEditTemplate(row)">编辑</el-button>
                <el-button link type="danger" @click="removeTemplate(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </section>
      </div>

      <aside v-if="existing" class="form-side">
        <section class="page-card side-card">
          <h3 class="side-title">合作概览</h3>
          <div class="stat-grid">
            <div class="stat-item">
              <div class="stat-value">{{ linkedEnterprises.length }}</div>
              <div class="stat-label">关联企业</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ contractCount }}</div>
              <div class="stat-label">合约数量</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ signTemplates.length }}</div>
              <div class="stat-label">签署模板</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ requiredTemplateCount }}</div>
              <div class="stat-label">必签模板</div>
            </div>
          </div>
          <div v-if="form.esignPlatform" class="esign-info">
            <div class="esign-label">电子签平台</div>
            <div>{{ esignPlatformMap[form.esignPlatform] }}</div>
            <div v-if="form.esignAppId" class="esign-app">App ID: {{ form.esignAppId }}</div>
          </div>
          <div v-if="linkedEnterprises.length" class="linked-list">
            <div class="linked-title">已关联企业</div>
            <el-tag v-for="ent in linkedEnterprises" :key="ent!.id" size="small" class="linked-tag">
              {{ ent!.name }}
            </el-tag>
          </div>
          <el-empty v-else description="暂未关联企业" :image-size="56" />
        </section>
      </aside>
    </div>

    <el-dialog
      v-model="templateDialogVisible"
      :title="editingTemplateId ? '编辑合同模板' : '添加合同模板'"
      width="520px"
      destroy-on-close
    >
      <el-form label-position="top">
        <el-form-item label="合同名称" required>
          <el-input v-model="templateForm.name" placeholder="如：灵工平台服务商合作协议" />
        </el-form-item>
        <el-form-item label="合同类型" required>
          <el-select v-model="templateForm.contractType" style="width: 100%">
            <el-option
              v-for="opt in contractTypeOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            >
              <div>{{ opt.label }}</div>
              <div class="option-desc">{{ opt.desc }}</div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="电子签模板 ID" required>
          <el-input
            v-model="templateForm.templateId"
            placeholder="如：FDD-TPL-20240101-001"
          />
          <div class="field-tip">从 {{ esignPlatformMap[form.esignPlatform] }} 后台复制模板 ID 并粘贴</div>
        </el-form-item>
        <el-form-item label="是否必签">
          <el-switch v-model="templateForm.required" active-text="必签" inactive-text="可选" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input
            v-model="templateForm.description"
            type="textarea"
            :rows="2"
            placeholder="补充说明使用场景（选填）"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="templateDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.provider-form-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-header-row {
  display: flex;
  justify-content: flex-end;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.form-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 12px;
  align-items: start;
}

.form-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-section {
  padding: 20px 24px;
}

.section-head {
  display: flex;
  gap: 14px;
  margin-bottom: 16px;
}

.section-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.section-icon.contract-icon {
  background: linear-gradient(135deg, #059669, #10b981);
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

.template-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.template-summary {
  font-size: 13px;
  color: #606266;
}

.template-id {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  color: #2563eb;
  background: #eff6ff;
  padding: 2px 6px;
  border-radius: 4px;
}

.field-tip {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}

.option-desc {
  font-size: 12px;
  color: #909399;
}

.side-card {
  padding: 16px 18px;
}

.side-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.stat-item {
  padding: 12px;
  border-radius: 10px;
  background: #eff6ff;
  text-align: center;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: #2563eb;
}

.stat-label {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.esign-info {
  margin-bottom: 14px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f0fdf4;
  font-size: 13px;
}

.esign-label {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.esign-app {
  margin-top: 4px;
  font-size: 12px;
  color: #606266;
  font-family: ui-monospace, monospace;
}

.linked-title {
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.linked-tag {
  margin: 0 6px 6px 0;
}

@media (max-width: 1100px) {
  .form-layout {
    grid-template-columns: 1fr;
  }
}
</style>
