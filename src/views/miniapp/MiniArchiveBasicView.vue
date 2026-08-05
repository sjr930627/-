<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const store = useAppStore()
const { employeeId, employee, profileExt } = useMiniAppWorker()

const name = ref(employee.value?.name ?? profileExt.value?.realName ?? '')
const address = ref(profileExt.value?.permanentAddress ?? employee.value?.address ?? '')
const phone = ref(employee.value?.phone ?? '')

function save() {
  if (!name.value.trim()) {
    ElMessage.warning('请输入姓名')
    return
  }
  if (!address.value.trim()) {
    ElMessage.warning('请填写常住地址')
    return
  }
  const emp = store.employees.find((e) => e.id === employeeId.value)
  if (emp) {
    emp.name = name.value.trim()
    if (phone.value.trim()) emp.phone = phone.value.trim()
    store.persist('employees')
  }
  store.updateWorkerPermanentAddress(employeeId.value, address.value)
  ElMessage.success('基本信息已保存')
  router.back()
}
</script>

<template>
  <div class="edit-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/worker-archive" />
      <div class="mini-nav-title">基本信息</div>
    </div>
    <div class="mini-page">
      <div class="mini-card">
        <div class="field">
          <label>姓名</label>
          <input v-model="name" placeholder="真实姓名">
        </div>
        <div class="field">
          <label>手机号</label>
          <input v-model="phone" type="tel" maxlength="11" placeholder="登录手机号">
        </div>
        <div class="field">
          <label>常住地址</label>
          <textarea v-model="address" rows="3" placeholder="省市区 + 详细地址" />
        </div>
        <button class="mini-btn-primary save-btn" type="button" @click="save">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-page {
  min-height: 100%;
  background: var(--mini-bg);
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #64748b;
}

.field input,
.field textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 15px;
}

.save-btn {
  width: 100%;
}
</style>
