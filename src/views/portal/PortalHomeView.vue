<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const portals = [
  {
    key: 'platform',
    title: '运营后台',
    desc: '企业管理、合同管理、任务流程配置、全企业数据汇总、发起账单与结算个税',
    path: '/dashboard',
    color: '#2563eb',
    icon: 'Monitor',
  },
  {
    key: 'enterprise',
    title: '企业端',
    desc: '本企业招聘考勤、发起任务类型审批与任务、确认账单、计薪规则',
    path: '/enterprise/dashboard',
    color: '#5b4fdb',
    icon: 'OfficeBuilding',
  },
  {
    key: 'miniapp',
    title: '灵工小程序',
    desc: '灵工打卡、抢班、任务领取、培训考核、收入查看',
    path: '/miniapp/workbench',
    color: '#059669',
    icon: 'Iphone',
  },
]
</script>

<template>
  <div class="portal-home">
    <div class="portal-hero">
      <h1>灵工平台 · 三端 Demo</h1>
      <p>请选择要进入的端侧环境（数据互通，角色权限不同）</p>
    </div>
    <div class="portal-grid">
      <button
        v-for="item in portals"
        :key="item.key"
        class="portal-card"
        :style="{ '--accent': item.color }"
        @click="router.push(item.path)"
      >
        <div class="portal-icon">
          <el-icon size="28"><component :is="item.icon" /></el-icon>
        </div>
        <h2>{{ item.title }}</h2>
        <p>{{ item.desc }}</p>
        <span class="portal-enter">进入 →</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.portal-home {
  min-height: 100vh;
  background: linear-gradient(160deg, #f8fafc 0%, #eef2ff 45%, #f0fdf4 100%);
  padding: 48px 24px;
}

.portal-hero {
  text-align: center;
  margin-bottom: 40px;
}

.portal-hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
  color: #0f172a;
}

.portal-hero p {
  margin: 0;
  color: #64748b;
}

.portal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  max-width: 1080px;
  margin: 0 auto;
}

.portal-card {
  text-align: left;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  background: #fff;
  padding: 24px;
  cursor: pointer;
  transition: transform 0.15s, box-shadow 0.15s, border-color 0.15s;
}

.portal-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.08);
  border-color: var(--accent);
}

.portal-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: color-mix(in srgb, var(--accent) 12%, white);
  color: var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
}

.portal-card h2 {
  margin: 0 0 8px;
  font-size: 20px;
  color: #0f172a;
}

.portal-card p {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #64748b;
  min-height: 66px;
}

.portal-enter {
  font-size: 14px;
  font-weight: 600;
  color: var(--accent);
}
</style>
