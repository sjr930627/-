<script setup lang="ts">
import { ElMessage } from 'element-plus'
import {
  MINIAPP_SKILL_CERT_CATALOG,
  MINIAPP_SKILL_CERT_MAX,
  type MiniAppSkillCertOption,
} from '@/constants/miniappAuth'

const selectedIds = defineModel<string[]>({ required: true })

const catalog = MINIAPP_SKILL_CERT_CATALOG
const maxCount = MINIAPP_SKILL_CERT_MAX

function isSelected(id: string) {
  return selectedIds.value.includes(id)
}

function toggle(item: MiniAppSkillCertOption) {
  const set = new Set(selectedIds.value)
  if (set.has(item.id)) {
    set.delete(item.id)
  } else {
    if (set.size >= maxCount) {
      ElMessage.warning(`最多选择 ${maxCount} 项`)
      return
    }
    set.add(item.id)
  }
  selectedIds.value = [...set]
}
</script>

<template>
  <div class="cert-picker">
    <section v-for="category in catalog" :key="category.title" class="cert-section">
      <h3 class="cert-section-title">{{ category.title }}</h3>
      <div class="cert-grid">
        <button
          v-for="item in category.items"
          :key="item.id"
          type="button"
          class="cert-chip"
          :class="{ selected: isSelected(item.id) }"
          @click="toggle(item)"
        >
          <span class="cert-icon">{{ item.icon }}</span>
          <span class="cert-name">{{ item.name }}</span>
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.cert-picker {
  padding-bottom: 8px;
}

.cert-section {
  margin-bottom: 20px;
}

.cert-section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 700;
  color: #1f2937;
}

.cert-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.cert-chip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border: 1.5px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, background 0.15s;
}

.cert-chip.selected {
  border-color: var(--mini-primary);
  background: var(--mini-primary-light);
}

.cert-chip.selected .cert-name {
  color: var(--mini-primary-dark);
  font-weight: 600;
}

.cert-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.cert-name {
  font-size: 13px;
  color: #374151;
  line-height: 1.3;
}
</style>
