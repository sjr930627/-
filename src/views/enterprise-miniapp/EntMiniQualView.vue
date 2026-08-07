<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import type { RecruitmentQualStatus } from '@/types'

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const pending = computed(() =>
  store.recruitmentLeads
    .filter((l) => l.enterpriseId === enterpriseId.value)
    .filter(
      (l) =>
        l.ext?.criminalRecordStatus === 'pending' ||
        l.ext?.healthCertStatus === 'pending' ||
        l.status === 'background_check' ||
        l.status === 'medical_check',
    )
    .map((l) => ({
      ...l,
      criminal: (l.ext?.criminalRecordStatus ||
        (l.status === 'background_check' ? 'pending' : 'missing')) as RecruitmentQualStatus,
      health: (l.ext?.healthCertStatus ||
        (l.status === 'medical_check' ? 'pending' : 'missing')) as RecruitmentQualStatus,
    })),
)

async function review(
  leadId: string,
  kind: 'criminal' | 'health',
  approved: boolean,
) {
  let note = ''
  if (!approved) {
    const { value } = await ElMessageBox.prompt('请填写驳回原因', '资质审核', {
      inputPlaceholder: '如：证件模糊 / 已过期',
    })
    note = String(value || '').trim()
    if (!note) {
      ElMessage.warning('驳回须填写原因')
      return
    }
  }
  const lead = store.recruitmentLeads.find((l) => l.id === leadId)
  if (!lead) return
  const status: RecruitmentQualStatus = approved ? 'approved' : 'rejected'
  const ext = { ...(lead.ext || {}) }
  if (kind === 'criminal') {
    ext.criminalRecordStatus = status
    ext.criminalRecordNote = note || '审核通过'
  } else {
    ext.healthCertStatus = status
    ext.healthCertNote = note || '审核通过'
  }
  store.updateRecruitmentLead(leadId, { ext })
  ElMessage.success(approved ? '已通过' : '已驳回')
}

function label(s: RecruitmentQualStatus) {
  return (
    {
      pending: '待审',
      approved: '已通过',
      rejected: '已驳回',
      missing: '未提交',
    } as const
  )[s]
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="资质审核" back-to="/enterprise-miniapp/recruitment" />
    <p class="hint">审核无犯罪证明、健康证，驳回须写明原因</p>
    <div class="list">
      <div v-if="!pending.length" class="empty">暂无待审资质</div>
      <article v-for="l in pending" :key="l.id" class="card">
        <strong>{{ l.candidateName }}</strong>
        <p>{{ l.requirementTitle || l.position }} · {{ l.phone }}</p>

        <div class="qual">
          <div class="qual-row">
            <span>无犯罪证明 · {{ label(l.criminal) }}</span>
            <div v-if="l.criminal === 'pending'" class="btns">
              <button type="button" class="ghost" @click="review(l.id, 'criminal', false)">驳回</button>
              <button type="button" class="ok" @click="review(l.id, 'criminal', true)">通过</button>
            </div>
          </div>
          <div class="qual-row">
            <span>健康证 · {{ label(l.health) }}</span>
            <div v-if="l.health === 'pending'" class="btns">
              <button type="button" class="ghost" @click="review(l.id, 'health', false)">驳回</button>
              <button type="button" class="ok" @click="review(l.id, 'health', true)">通过</button>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.hint {
  margin: 0;
  padding: 0 16px 10px;
  font-size: 12px;
  color: #9ca3af;
}
.list {
  padding: 0 16px 24px;
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
.qual {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.qual-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  background: #f9fafb;
  border-radius: 10px;
  padding: 10px;
  font-size: 12px;
}
.btns {
  display: flex;
  gap: 6px;
}
.ghost,
.ok {
  height: 28px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
}
.ghost {
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
}
.ok {
  border: none;
  background: #5b4fdb;
  color: #fff;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: #9ca3af;
}
</style>
