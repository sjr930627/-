<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { calcShiftHours } from '@/utils'
import type { Shift } from '@/types'

const store = useAppStore()
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const colorPresets = ['#409EFF', '#67C23A', '#909399', '#E6A23C', '#F56C6C', '#F2F6FC']

const form = ref({
  name: '',
  code: '',
  startTime: '08:00',
  endTime: '16:00',
  breakMinutes: 60,
  color: '#409EFF',
  isSpecial: false,
  description: '',
})

function openCreate() {
  editingId.value = null
  form.value = {
    name: '',
    code: '',
    startTime: '08:00',
    endTime: '16:00',
    breakMinutes: 60,
    color: '#409EFF',
    isSpecial: false,
    description: '',
  }
  dialogVisible.value = true
}

function openEdit(shift: Shift) {
  editingId.value = shift.id
  form.value = {
    name: shift.name,
    code: shift.code,
    startTime: shift.startTime,
    endTime: shift.endTime,
    breakMinutes: shift.breakMinutes,
    color: shift.color,
    isSpecial: shift.isSpecial,
    description: shift.description ?? '',
  }
  dialogVisible.value = true
}

function submit() {
  if (!form.value.name.trim() || !form.value.code.trim()) {
    ElMessage.warning('请填写班次名称和编码')
    return
  }
  if (editingId.value) {
    store.updateShift(editingId.value, form.value)
    ElMessage.success('更新成功')
  } else {
    store.addShift(form.value)
    ElMessage.success('创建成功')
  }
  dialogVisible.value = false
}

async function remove(shift: Shift) {
  try {
    await ElMessageBox.confirm(`确定删除班次「${shift.name}」？`, '提示', { type: 'warning' })
    store.removeShift(shift.id)
    ElMessage.success('删除成功')
  } catch (e) {
    if ((e as Error).message) ElMessage.error((e as Error).message)
  }
}

function getBarStyle(start: string, end: string) {
  const toPercent = (time: string) => {
    const [h, m] = time.split(':').map(Number)
    return ((h * 60 + m) / (24 * 60)) * 100
  }
  let left = toPercent(start)
  let right = toPercent(end)
  if (right <= left) right += 100
  return { left: `${left}%`, width: `${right - left}%` }
}
</script>

<template>
  <div>
    <div class="page-card">
      <div class="page-header">
        <div>
          <h2 class="page-title">班次管理</h2>
          <p class="text-muted">定义上下班时间，支持标准班次与特殊班次</p>
        </div>
        <el-button type="primary" @click="openCreate">新增班次</el-button>
      </div>

      <el-table :data="store.shifts" border stripe>
        <el-table-column label="班次" min-width="120">
          <template #default="{ row }">
            <span
              class="shift-tag"
              :style="{ background: row.color, borderColor: row.color }"
            >
              {{ row.name }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="code" label="编码" width="120" />
        <el-table-column label="时间" min-width="160">
          <template #default="{ row }">{{ row.startTime }} - {{ row.endTime }}</template>
        </el-table-column>
        <el-table-column prop="breakMinutes" label="午休(分)" width="100" />
        <el-table-column label="工时" width="80">
          <template #default="{ row }">{{ calcShiftHours(row).toFixed(1) }}h</template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.isSpecial ? 'warning' : 'primary'" size="small">
              {{ row.isSpecial ? '特殊' : '标准' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="description" label="说明" min-width="160" show-overflow-tooltip />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="remove(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="page-card" style="margin-top: 16px">
      <h3 class="section-title">班次日历预览</h3>
      <p class="text-muted">24 小时时间轴展示各班次分布</p>
      <div class="timeline">
        <div v-for="shift in store.shifts.filter((s) => s.code !== 'REST')" :key="shift.id" class="timeline-row">
          <div class="timeline-label">{{ shift.name }}</div>
          <div class="timeline-bar-wrap">
            <div
              class="timeline-bar"
              :style="{
                background: shift.color,
                left: getBarStyle(shift.startTime, shift.endTime).left,
                width: getBarStyle(shift.startTime, shift.endTime).width,
              }"
            >
              {{ shift.startTime }}-{{ shift.endTime }}
            </div>
          </div>
        </div>
        <div class="timeline-scale">
          <span v-for="h in 25" :key="h">{{ h === 25 ? '' : h - 1 }}</span>
        </div>
      </div>
    </div>

    <el-dialog v-model="dialogVisible" :title="editingId ? '编辑班次' : '新增班次'" width="520px">
      <el-form label-width="90px">
        <el-form-item label="班次名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="编码" required>
          <el-input v-model="form.code" placeholder="如 MORNING" />
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="上班时间">
              <el-time-select
                v-model="form.startTime"
                start="00:00"
                step="00:30"
                end="23:30"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="下班时间">
              <el-time-select
                v-model="form.endTime"
                start="00:00"
                step="00:30"
                end="23:30"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="午休时长">
          <el-input-number v-model="form.breakMinutes" :min="0" :max="180" /> 分钟
        </el-form-item>
        <el-form-item label="标识颜色">
          <el-color-picker v-model="form.color" :predefine="colorPresets" />
        </el-form-item>
        <el-form-item label="特殊班次">
          <el-switch v-model="form.isSpecial" />
        </el-form-item>
        <el-form-item label="说明">
          <el-input v-model="form.description" type="textarea" :rows="2" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submit">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0 0 4px;
  font-size: 16px;
}

.timeline {
  margin-top: 16px;
}

.timeline-row {
  display: flex;
  align-items: center;
  margin-bottom: 12px;
}

.timeline-label {
  width: 80px;
  font-size: 13px;
}

.timeline-bar-wrap {
  flex: 1;
  height: 28px;
  background: #f5f7fa;
  border-radius: 4px;
  position: relative;
}

.timeline-bar {
  position: absolute;
  top: 0;
  height: 100%;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 60px;
}

.timeline-scale {
  display: flex;
  justify-content: space-between;
  margin-left: 80px;
  font-size: 11px;
  color: #909399;
}
</style>
