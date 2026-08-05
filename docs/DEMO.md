# 灵工平台 · 演示手册

> 基于 `shift-attendance-admin` 代码与 PRD 整理，适用于产品演示、客户汇报、内部培训。

---

## 1. 环境准备

### 在线演示（GitHub Pages）

| 项 | 链接 |
|---|---|
| **演示首页** | https://sjr930627.github.io/-/ |
| 三端入口 | https://sjr930627.github.io/-/portals |
| 运营后台 | https://sjr930627.github.io/-/dashboard |
| 企业端 | https://sjr930627.github.io/-/enterprise/dashboard |
| 灵工小程序 | https://sjr930627.github.io/-/miniapp/login |

> 仓库开启 GitHub Pages（`main` 推送自动部署）。若深链首次打开为空白，可先打开首页再点菜单进入。

### 本地启动

```bash
cd shift-attendance-admin
npm install
npm run dev          # 本地 http://localhost:5173
# 或局域网演示
npm run build && npm run start   # http://0.0.0.0:4173
```

| 项 | 说明 |
|---|---|
| 三端入口 | `/portals` |
| 演示锚定日期 | **2026-07-27**（种子数据对齐此日） |
| 数据存储 | localStorage，前缀 `shift-attendance:` |
| 数据重置 | 浏览器控制台执行 `localStorage.clear()` 后刷新 |

---

## 2. 演示账号

### 2.1 灵工小程序

| 字段 | 值 |
|---|---|
| 手机号 | `13800001001` |
| 密码 | `123456` |
| 对应人员 | 张伟（emp_001），中石化朝阳站早班组 |
| 入口 | `/miniapp/login` 或门户 → 灵工小程序 |

> 2026-07-27 当天有早班排班且未打卡，适合演示打卡流程。

### 2.2 企业端

| 账号 | 密码 | 企业 |
|---|---|---|
| `sinopec_cy_admin` | `123456` | 中石化北京朝阳分公司 |
| `jd_hb_admin` | `123456` | 中石化浙江分公司 |

入口：`/enterprise/dashboard`

### 2.3 运营后台

运营后台 Demo 无独立登录页，从 `/portals` 进入即可。种子账号含：

| 用户名 | 角色 | 用途 |
|---|---|---|
| `admin` | 超级管理员 | 全局配置、财税、审批 |
| `hr_li` | 人事+招聘 | 招聘模块演示 |
| `hr_wang` | 排班管理员 | 排班/考勤演示 |
| `ops_chen` | 运营 | 任务/账单/结算 |

---

## 3. 产品架构（30 秒开场）

```
平台运营方 ──运营后台──► 企业管理 / 审批 / 账单结算 / 数据统计
     │
     ├──企业端──────► 招聘 / 排班 / 任务发布 / 账单确认
     │
     └──灵工小程序──► 打卡 / 抢班 / 领任务 / 培训 / 收入领取
```

**核心价值：** 三端数据互通，覆盖「招聘 → 培训 → 考勤 → 任务 → 结算 → 领取」全链路。

---

## 4. 推荐演示路径

### 路径 A：全链路 15 分钟（推荐）

适合首次对外演示，按业务顺序走通闭环。

| 步骤 | 端 | 路径 | 操作要点 | 预期效果 |
|:---:|---|---|---|---|
| 1 | 门户 | `/portals` | 介绍三端分工 | 建立产品全景 |
| 2 | 运营后台 | `/dashboard` | 展示待办、招聘进度、考勤异常 | 平台管控能力 |
| 3 | 企业端 | `/enterprise/dashboard` | 切换至「中石化朝阳」 | 企业视角隔离 |
| 4 | 企业端 | `/enterprise/recruitment/requirements` | 查看在招岗位 | 招聘发起 |
| 5 | 运营后台 | `/recruitment/progress` | 线索状态流转 | 平台协同 |
| 6 | 企业端 | `/enterprise/schedule-manage` | 查看排班表 | 排班管理 |
| 7 | 灵工小程序 | `/miniapp/workbench` | 登录张伟账号 | 今日早班待打卡 |
| 8 | 灵工小程序 | `/miniapp/punch` | GPS 打卡 | 考勤数据产生 |
| 9 | 运营后台 | `/attendance-data` | 查看打卡记录 | 三端数据同步 |
| 10 | 企业端 | `/enterprise/task/publish` | 查看/发布任务 | 任务众包 |
| 11 | 灵工小程序 | `/miniapp/recommend` | 领取任务 | 灵工侧接单 |
| 12 | 运营后台 | `/payroll/bills` | 账单列表 | 财税闭环 |
| 13 | 灵工小程序 | `/miniapp/income` | 待领取收入 | 灵工变现 |

### 路径 B：考勤 + 薪酬 8 分钟

| 步骤 | 路径 | 操作 |
|:---:|---|---|
| 1 | `/smart-schedule` | 选 2026-08 + 早班组 → 一键生成 → 应用 |
| 2 | `/approvals` | 审批 **刘洋** 周末加班申请 |
| 3 | `/miniapp/punch` | 灵工打卡（张伟） |
| 4 | `/attendance-exceptions` | 处理补卡/异常 |
| 5 | `/payroll/settlement` | 查看结算单 |
| 6 | `/statistics/attendance` | 出勤统计看板 |

### 路径 C：任务众包 8 分钟

| 步骤 | 端 | 路径 | 操作 |
|:---:|---|---|---|
| 1 | 企业端 | `/enterprise/task/types` | 创建任务类型 → 提交审批 |
| 2 | 运营后台 | `/task-type-approval` | 审批通过 |
| 3 | 企业端 | `/enterprise/task/publish` | 发布任务（任务大厅） |
| 4 | 灵工小程序 | `/miniapp/task-hall` | 领取任务 |
| 5 | 灵工小程序 | 任务实例页 | 填写工作流字段 |
| 6 | 企业端 | `/enterprise/task/progress` | 验收任务 |
| 7 | 运营后台 | `/payroll/settlement` | 生成结算 |

### 路径 D：招聘入职 6 分钟

| 步骤 | 路径 | 操作 |
|:---:|---|---|
| 1 | `/recruitment/requirements` | 发布招聘需求 |
| 2 | `/recruitment/progress` | 推进线索：筛选 → 待面试 → 待反馈 |
| 3 | `/recruitment/calendar` | 安排面试 |
| 4 | `/recruitment/talents` | 人才入库 |
| 5 | `/employees` | 分配部门 |
| 6 | `/training/courses` | 指派培训课程 |

---

## 5. 模块速查

### 5.1 运营后台

| 分组 | 核心页面 | 演示亮点 |
|---|---|---|
| 企业管理 | `/enterprises` `/contracts` `/settlement-prices` | 企业入驻、合同、结算价配置 |
| 招聘管理 | `/recruitment/*` | 需求→进度→日历→人才库 |
| 培训考核 | `/training/*` | 资料/课程/考核/结果 |
| 人员考勤 | `/attendance-groups` `/schedule-manage` `/grab-shifts` | 考勤规则、排班、抢班 |
| 任务管理 | `/task-workflows` `/task-manage` | 工作流配置、实例跟踪 |
| 财税管理 | `/payroll/bills` `/payroll/funds` `/payroll/tax` | 账单→结算→发票→资金 |
| 数据统计 | `/statistics/overview` `/bi/monitor` | 多维看板 |
| 系统设置 | `/system/accounts` `/system/roles` | RBAC 权限 |

### 5.2 企业端

| 模块 | 路径 | 与后台差异 |
|---|---|---|
| 工作台 | `/enterprise/dashboard` | 本企业数据 |
| 任务类型 | `/enterprise/task/types` | 创建后需平台审批 |
| 任务发布 | `/enterprise/task/publish` | 须填地点/内容 |
| 任务进度 | `/enterprise/task/progress` | 企业验收节点 |
| 账单 | `/enterprise/payroll/bills` | 确认+付款，不可创建 |

### 5.3 灵工小程序

| Tab | 路径 | 功能 |
|---|---|---|
| 工作台 | `/miniapp/workbench` | 今日排班、待办、进行中任务 |
| 推荐 | `/miniapp/recommend` | 岗位报名、抢班、任务领取 |
| 消息 | `/miniapp/messages` | 排班确认、系统通知 |
| 我的 | `/miniapp/profile` | 档案、收入、培训、设置 |

**子功能路径：**

- 打卡 `/miniapp/punch`
- 排班日历 `/miniapp/schedule`
- 任务大厅 `/miniapp/task-hall`
- 培训 `/miniapp/training`
- 收入 `/miniapp/income`
- 灵工档案 `/miniapp/worker-archive`

---

## 6. 关键业务流程

### 6.1 任务全流程

```mermaid
flowchart LR
  A[企业创建任务类型] --> B[平台审批]
  B --> C[企业发布任务]
  C --> D[灵工领取]
  D --> E[工作流执行]
  E --> F[企业验收]
  F --> G[平台结算]
  G --> H[灵工领取收入]
```

### 6.2 考勤 + 日结

```mermaid
flowchart LR
  A[考勤组配置结算价] --> B[排班/抢班]
  B --> C[灵工打卡]
  C --> D[工时汇总]
  D --> E[结算单]
  E --> F[待领取]
  F --> G[灵工提现]
```

### 6.3 企业财税

```mermaid
flowchart LR
  A[平台生成账单] --> B[企业确认]
  B --> C[企业付款]
  C --> D[申请发票]
  D --> E[平台结算灵工]
  E --> F[资金监控]
```

---

## 7. 演示话术参考

### 开场（1 分钟）

> 「灵工平台面向平台运营、企业客户、灵工人员三端协同。今天我们用一套 Demo 数据，走一遍从排班打卡到任务结算的完整链路。Demo 数据存在浏览器本地，三端实时互通。」

### 考勤模块

> 「企业配置考勤组和班次模板，管理员在排班表安排人员。灵工在小程序看到今日班次，支持 GPS/WiFi/外勤多种打卡方式。异常考勤可在审批中心一键处理，工时自动进入结算。」

### 任务模块

> 「企业创建任务类型并提交平台审批，通过后发布到任务大厅。灵工按工作流逐步提交字段，企业在验收节点确认，平台自动生成结算单。」

### 财税模块

> 「平台按合同和结算价生成企业账单，企业确认付款后可申请发票。灵工端看到待领取收入，绑定支付宝或银行卡后即可领取。」

---

## 8. 常见问题

| 问题 | 处理 |
|---|---|
| 页面数据为空 | `localStorage.clear()` 刷新，种子自动重建 |
| 小程序无法打卡 | 确认当天有排班且非休息日；演示日用 2026-07-27 |
| 企业端看不到数据 | 检查顶部企业切换器是否为「中石化朝阳」 |
| 任务领取失败 | 确认任务类型已 published，发布状态为 active |
| 收入无待领取 | 先完成任务验收或考勤结算生成结算单 |

---

## 9. Demo 占位说明

以下功能为演示占位，操作时会有「演示」提示：

- 招聘海报生成、批量导入
- 灵工档案部分增删改
- 任务附件真实上传
- 资金管理充值/提现/调账
- 部分 Dashboard 快捷链指向平台路径

---

## 10. 附录：种子数据摘要

| 实体 | 关键 ID / 名称 |
|---|---|
| 默认企业 | `ent_china_mobile_agent` · 中石化北京朝阳分公司 |
| 默认灵工 | `emp_001` · 张伟 · 13800001001 |
| 演示加班人 | `emp_005` · 刘洋 |
| 早班组 | `team_a` · 中石化朝阳站早班组 |
| 考勤组 | `ag_factory` |
| 演示锚定日 | 2026-07-27 |

---

*文档版本：V1.0 · 与 PRD V1.0 对齐*
