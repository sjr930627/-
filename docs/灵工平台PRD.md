# 灵工平台产品需求文档（PRD）

**版本号：** V2.0（基于源码实现梳理，覆盖运营后台 / 企业端 / 灵工小程序三端）
**状态：** 评审中
**创建日期：** 2026-08-05
**作者：** 产品（基于 shift-attendance-admin 代码逆向梳理）
**审核人：** —
**文档重点：** 产品背景与目标、三端架构与权限模型、功能模块说明、核心业务流程、状态机、风险与边界

---

## 1. 文档概览

| 项目 | 内容 |
|------|------|
| 产品名称 | 灵工平台（灵活用工管理后台 + 灵工小程序） |
| 产品形态 | Web 管理后台（双门户）+ 移动端 H5 小程序 |
| 技术栈 | Vue 3 + TypeScript + Vite + Pinia + Vue Router 4 + Element Plus + ECharts；演示数据本地 localStorage 持久化 |
| 三端入口 | 运营后台 `/`、企业端 `/enterprise`、灵工小程序 `/miniapp` |
| 文档目标 | 对齐三端功能边界、实体关系、状态流转、校验规则与权限模型 |

---

## 2. 修订记录

| 版本 | 日期 | 修改人 | 修改内容 |
|------|------|--------|----------|
| V1.0 | 2026-04-10 | — | 初版（字段约束与操作说明为主） |
| V2.0 | 2026-08-05 | 产品 | 重写为完整 PRD：补充产品目标、用户画像、价值主张、三端权限模型、核心业务流程、状态机与风险评估 |

---

## 3. 背景与目标

### 3.1 业务背景

灵活用工已成为制造业、服务业、新零售等行业的重要用工形态。平台运营方（灵工平台）需要同时服务两类 B 端客户——**企业客户**（用工方）与**服务商**（劳务派遣/灵工供应商），并向海量的**灵工人员**（劳动者）提供移动端自助能力。

当前系统要解决的核心痛点：

- **排班低效**：依靠 Excel 手工排班，工时不均衡、合规风险（超时/连班）难以管控。
- **考勤数据散乱**：打卡、异常、补卡分散，审批链不透明。
- **结算财税割裂**：工时/任务量到薪酬的计算靠人工，账单、发票、个税、资金流各自为政，对账困难。
- **灵工体验差**：报名、抢班、打卡、培训、领薪缺乏统一入口。
- **跨端协同断层**：平台、企业、灵工三方信息不互通，状态无法闭环。

### 3.2 产品目标（SMART）

| 目标 | 量化指标 | 时限 |
|------|----------|------|
| 排班自动化 | 智能排班一键生成，工时均衡度（方差）下降 ≥ 40% | 上线 3 个月内 |
| 考勤闭环 | 异常自动识别率 ≥ 90%，审批平均时长 ≤ 24h | 上线 3 个月内 |
| 结算效率 | 考勤/任务 → 结算单自动生成覆盖率 100%，人工对账工时下降 ≥ 70% | 上线 6 个月内 |
| 灵工活跃 | 小程序日活 / 注册灵工 ≥ 35% | 上线 6 个月内 |
| 合规保障 | 排班/考勤违反工时合规规则 0 放行（系统拦截） | 持续 |

### 3.3 用户画像与角色矩阵

| 角色 | 端 | 核心诉求 | 痛点 |
|------|---|----------|------|
| 平台运营管理员 | 运营后台 | 全局企业/服务商/合同/结算管控 | 多企业数据割裂、对账困难 |
| 平台财务 | 运营后台 | 账单、发票、个税、资金流闭环 | 手工算薪、开票滞后 |
| 平台审核/运营专员 | 运营后台 | 任务类型审批、招聘进度、数据看板 | 审批无统一入口 |
| 企业 HR / 排班管理员 | 企业端 | 本企业招聘、考勤、排班、任务、账单确认 | 排班与考勤脱节 |
| 灵工人员（劳动者） | 小程序 | 打卡、抢班、领任务、培训、领薪 | 多 App 切换、收入不透明 |
| 服务商管理员 | 运营后台 | 关联企业、合同费率、资金账户 | 费率/结算规则复杂 |

### 3.4 核心价值主张

- **对平台**：一套系统打通「用工方—服务商—灵工」三方，沉淀组织/排班/考勤/任务/结算全量数据，支撑财税合规与规模化管理。
- **对企业**：可视化排班、自动化考勤、清晰的任务与账单，降低管理成本。
- **对灵工**：一个 App 完成打卡、抢活、培训、领薪全流程，收入透明可查。

---

## 4. 范围定义

### 4.1 包含范围（In Scope）

| 域 | 模块 |
|----|------|
| 组织 | 部门/团队/人员/考勤组/班次/节假日 |
| 排班 | 排班管理、智能排班、抢班、排班发布（含版本回滚）、排班模板/周期规则 |
| 考勤 | 打卡、考勤记录、考勤规则、月度汇总、异常与审批（补卡/请假/换班/取消班次/加班） |
| 任务 | 任务工作流配置、任务类型审批、任务发布与管理、实例执行 |
| 招聘 | 需求管理、招聘进度（11 态状态机）、面试日程、人才库 |
| 培训 | 培训资料、课程、考核、学习进度、考核结果、课程门禁 |
| 财税 | 计薪规则、账单、结算管理、资金管理、个税、发票 |
| 保险 | 保险产品、打卡自动投保（保单） |
| 统计 | 概览、招聘/考勤/任务/结算统计、灵工人员数据监控中心 |
| 系统 | 账号管理、角色权限、操作日志 |
| 灵工端 | 登录/注册/档案、工作台、打卡、排班/抢班、任务大厅、招聘报名、培训考核、收入、协议、消息、保险、信用、核验 |

### 4.2 不包含范围（Out of Scope）

- 真实后端 REST API 与数据库（当前为 Pinia + localStorage 演示）。
- 移动端原生 App（当前为 H5 小程序，路由 `/miniapp`）。
- 与金蝶/SAP 等 ERP 的实时对接（仅预留导出能力）。
- 智能排班优化算法生产化（遗传/线性规划，当前为启发式评分）。
- 真实支付/打款通道（资金流为演示状态）。
- 公文/合同电子签第三方真实签署（仅有模板占位）。

### 4.3 MVP 边界（MoSCoW）

| 优先级 | 内容 |
|--------|------|
| **Must** | 组织/班次/考勤组、排班管理、打卡与考勤记录、异常审批、账单与结算、灵工小程序打卡+排班查看+收入领取、账号角色权限 |
| **Should** | 智能排班、抢班、任务工作流与灵工领任务、培训考核门禁、发票/个税、数据统计看板 |
| **Could** | 招聘线索状态机、保险自动投保、灵工人员数据监控中心、服务商合同费率 |
| **Won't（本期）** | 真实支付打款、ERP 实时对接、原生 App、AI 排班生产化算法 |

---

## 5. 三端架构与权限模型

### 5.1 三端架构

| 端 | 入口路径 | 布局组件 | 主要使用者 | 核心职责 |
|---|---|---|---|---|
| 运营后台 | `/portals` → `/dashboard` | `PlatformLayout` | 平台运营/财务/审核 | 全局配置、审批、账单/结算/发票/资金、数据统计、系统设置 |
| 企业端 | `/enterprise/dashboard` | `EnterpriseLayout` | 企业 HR、排班管理员 | 本企业招聘、考勤、任务、账单确认、合作管理 |
| 灵工小程序 | `/miniapp/workbench` | `MiniAppLayout` | 灵工人员 | 打卡、抢班、领任务、培训考核、收入领取 |

**企业端差异要点：**
- 顶部含**企业切换器**，绑定 `currentEnterpriseId`；切换企业即重挂载视图（`<RouterView :key="currentEnterpriseId">`）。
- 顶部展示「企业名称 + 企业号（code）」，无平台专属的「企业管理/服务商管理/数据统计/系统设置」全局项，新增「合作管理」。
- 平台端列表强依赖单一企业上下文（`useEnterpriseScope('switch')`），企业端强制限定当前租户（`useEnterpriseScope('filter')` + `matchesEnterprise`）。

### 5.2 角色与权限矩阵

权限模型由 `SystemRole` 与 `SystemAccount` 构成：

- **账号（SystemAccount）**：`roleIds[]`（权限取并集）、`accountPortal`（可登入平台/企业端）。
- **角色（SystemRole）**：菜单权限 `menuPermissions`（view/edit）、功能权限 `permissionIds`、数据范围 `dataScope`、平台数据范围 `platformDataScope`/`partialEnterpriseIds`。

| 维度 | 取值 |
|------|------|
| 菜单权限 | `platformMenuPermissionDefs`（14 项）/ `enterpriseMenuPermissionDefs`（11 项），含 dashboard/enterprise/recruitment/training/attendance/task/provider/payroll/statistics/system |
| 功能权限树 | `permissionCatalog`（工作台/招聘/培训/考勤/任务/合作/财税/统计/系统），menu/action 两级 |
| 数据范围 | `self` / `department` / `department_and_sub` / `all` / `custom` |
| 平台数据范围 | `all`（全部企业）/ `partial`（部分企业） |

**种子角色：** 平台端「超级管理员」「人事管理员」「招聘专员」「运营专员」「只读访客」；企业端按企业模板生成。

> **落地说明（重要）：** 权限模型（menuPermissions / permissionIds / dataScope）已完整定义并可解算（`resolveAccountMenuPermissions` / `resolveAccountPermissionIds`），但当前演示版仅小程序端有路由级 `beforeEach` 鉴权；平台/企业端菜单为静态硬编码，路由级强制隐藏未完全落地。正式环境应实现「前端菜单隐藏 + 路由守卫 + 接口级 dataScope 三重校验」。

### 5.3 数据范围（Data Scope）落地

- `useEnterpriseScope(mode)`：`switch` 模式（平台端强绑定单一企业，如排班、考勤数据），`filter` 模式（可按「全部企业」列表过滤）。
- `matchesEnterprise(entityEnterpriseId)`：列表视图逐行过滤，企业端只放行当前租户。

---

## 6. 用户故事地图（核心旅程）

**旅程一 · 灵工上岗到领薪**
> 灵工注册 → 完善档案（实名/人脸/技能）→ 平台派排班/抢班 → 小程序打卡（自动投保）→ 考勤异常申请 → 平台结算 → 灵工领取收入（绑定收款）→ 资金流水。

**旅程二 · 企业发布任务到验收**
> 企业创建任务类型 → 平台审批 → 企业发布任务 → 灵工从大厅领取 → 工作流逐节点推进 → 企业节点确认/驳回 → 结算 → 收入领取。

**旅程三 · 平台排班到算薪**
> 配置考勤组/班次/合规规则 → 智能排班或手工排班 → 发布（版本快照）→ 灵工打卡 → 考勤异常审批 → 月度汇总 → 计薪规则算薪 → 结算单 → 发票/个税/资金。

| 角色 | 动作 | 价值 | 验收标准 |
|------|------|------|----------|
| 排班管理员 | 一键智能排班 | 工时均衡、合规放行 | 生成排班无合规冲突，工时方差下降 |
| 灵工 | 移动端打卡 | 便捷、自动投保 | 打卡成功并生成保单，异常可申诉 |
| 平台财务 | 确认结算单并开票 | 财税闭环 | 账单状态正确流转，发票可导出 |
| 企业 HR | 发布招聘需求 | 快速补充人力 | 需求→线索→入职状态机贯通 |

---

## 7. 详细功能说明

### 7.1 运营后台

#### 7.1.1 工作台 `/dashboard`
- **功能描述**：只读待办聚合页。
- **主流程**：展示待审批、考勤异常、结算等待办统计（`pendingApprovalCount` / `openExceptionCount` / `pendingAttendanceApprovalCount`）。
- **前置条件**：已登录运营后台。

#### 7.1.2 企业管理
**企业列表 `/enterprises`**

| 字段 | 类型/枚举 | 限制 | 必填 |
|---|---|---|---|
| 企业名称 name | 文本 | — | 是 |
| 统一社会信用代码 creditCode | 文本 | 18 位，全局唯一 | 是 |
| 联系人/电话 | 文本 | 电话最长 11 位 | 是 |
| 服务模块 serviceModules | 枚举数组 | recruitment/attendance/task/payroll/training | 是 |
| 开票类目 invoiceCategories | 数组 | ≥1 项，不可重复 | 是 |

- **操作**：新增（自动生成 code，状态 active）/ 编辑 / 终止合作（二次确认→terminated）。
- **结算价管理 `/settlement-prices`**：企业默认工时价（白班/夜班/加班/周末/节假日倍数）、任务默认价；支持按考勤组 override（`useEnterpriseDefault`、日结 `dailySettlement`）。
- **合同管理 `/contracts`**：平台↔企业服务合同，支持工时/任务计费（`ContractBillingRule` 分档费率）、结算周期（weekly/monthly/quarterly/project）、续签/终止。

#### 7.1.3 服务商管理 `/service-providers`
- 名称/联系人/业务范围必填；电话正则 `^1\d{10}$`；状态 cooperating/suspended/terminated。
- 灵工待领取金额按服务商关联企业汇总。

#### 7.1.4 招聘管理 `/recruitment/*`
- **需求管理**：`headcount` 1~999；`salaryMin≥1000`；状态 draft→active→closed。
- **招聘进度**：线索 `RecruitmentLead` 11 态状态机（screening→interview_pending→feedback_pending→onboarded→…→closed），7 步进度可视化。
- **面试日程 / 人才库**：人才库 available→in_process→hired→archived，可转线索。

#### 7.1.5 培训与考核 `/training/*`
- 资料（video/pdf/article，引用计数 >0 禁止删）；课程（materialIds≥1，sequential/free，draft→published）；考核（courseId 必填，≥1 题，passScore 0~100）。
- **课程门禁**：未通过考核则阻塞排班/抢班/接任务（`getBlockingCoursesForEmployee('schedule'|'task')`）。

#### 7.1.6 人员考勤管理
- **考勤组 `/attendance-groups`**：中枢实体。考勤类型 shift/free/none；班次模板（shift 时 ≥1）；合规（日/周/月最大工时，默认 12/60/260）；计价（白/夜/加班/周末/节假日）；**版本化管理**（`currentVersion` / `versions[]`）。
- **排班管理 `/schedule-manage`**：按企业/团队排班，支持进入编辑态、保存快照、发布版本回滚（`restoreSchedulePublishVersion`）。
- **智能排班 `/smart-schedule`**：`generateSmartSchedule` + `recommendEmployeesForShift` 启发式评分（偏好班次 +15、不可用 -50、合规冲突 -20/项、工时均衡、技能匹配 +20/+10/-15），输出 assignments/冲突数/工时均衡度。
- **抢班管理 `/grab-shifts`**：池槽位 `GrabShiftSlot`（scope global/department、需求人数 1~50、岗位/技能要求、base+effective 时薪=base+补贴）；白名单 `GrabShiftWhitelistEntry`；报名/审批。
- **考勤记录 `/attendance-data`**：日聚合状态 normal/late/early_leave/missing_punch/absent/rest/leave；支持工时修正、手动覆盖。
- **考勤审批处理 `/attendance-exceptions`**：异常类型 late/early_leave/missing_punch/absent/location/schedule_conflict；四类单据（请假/换班/取消班次/补卡）及加班申请（overtimeType weekday/weekend/holiday）审批；支持申诉→解决/驳回。

#### 7.1.7 任务管理（平台）`/task-*`
- **任务工作流配置 `/task-workflows`**：1 start + ≥1 end 节点；节点含角色（worker/enterprise/operator/system）、动作（submit/confirm/approve/reject/accept/cancel/punch/transfer）、动态字段、超时、触发结算。
- **任务类型审批 `/task-type-approval`**：企业提交的类型 pending→published/rejected。
- **任务管理 `/task-manage`**：总览+明细；实例节点跳转/取消/验收（`forceTransferTaskInstance` / `forceCancelTaskInstance`）。

#### 7.1.8 财税管理 `/payroll/*`
- **计薪规则 `/billing-rules`**：名称/编码/公式必填；`buildPayrollPreview` 计算（regularPay、overtimePay 按倍率、deductions=缺勤+迟到）。
- **账单管理 `/bills`**：状态 pending_submit→pending_confirm→pending_payment→paid/void；服务费 `DEFAULT_SERVICE_FEE_RATE=0.0682`；支持 Excel 导入模板。
- **结算管理 `/settlement`**：hourly/task；批量生成结算单 `SettlementSlip`；灵工结算明细 `PendingSettlementItem` / `SettlementManageOrder`。
- **资金管理 `/funds`**：平台付款账户（alipay/cmb）、服务商资金账户与流水 `FundTransaction`；灵工待领取汇总（claimable 求和）。
- **个税管理 `/tax`**：按服务商+月份生成 `TaxDeclaration`（generated→submitted→filed），渠道 alipay/bank_card。
- **发票管理 `/invoices`**：`InvoiceApplication`（电子专票/电子普票），draft→pending_review→issued/rejected；支持申请开票。

#### 7.1.9 数据统计 `/statistics/*` + `/bi/monitor`
- 概览看板、招聘统计、考勤统计、任务统计、结算统计；灵工人员数据监控中心（`/bi/monitor`，只读）。

#### 7.1.10 系统设置 `/system/*`
- **账号管理**：username/displayName/roleId/departmentId 必填；角色权限取并集。
- **角色权限**：`permissionIds` 树 + `dataScope`；支持「全部可见/全部可编辑/重置」。
- **操作日志**：`operationLog` 记录关键操作。

### 7.2 企业端 `/enterprise/*`

| 模块 | 企业端能力 | 与后台差异 |
|---|---|---|
| 任务类型 `/task/types` | 创建→提交平台审批 | 后台审批后 published |
| 任务发布 `/task/publish` | 全功能（地点/内容/数量必填） | 派单方式 hall/assign；限领 1~99 |
| 任务进度 `/task/progress` | 实例确认/驳回 | — |
| 合作管理 `/partnership` | 服务商合作、合同费率查看 | 只读 |
| 账单 `/payroll/bills` | 确认+付款+申请发票 | 不可创建账单 |
| 发票 `/payroll/invoices` | 申请/查看 | — |

- 任务类型流转：draft→pending→published/rejected/disabled；任务发布：draft→active→ended/cancelled。

### 7.3 灵工小程序 `/miniapp/*`

**Tab：** 工作台 | 推荐 | 消息 | 我的

- **登录与档案**：注册→完善档案（实名、常住地址、兼职能段偏好、技能证书）→人脸核验（`completeWorkerFaceVerify`）；档案含排班偏好、岗位偏好、信用分。
- **工作台 `/workbench`**：今日排班、实时工时、连续打卡天数、未读消息、待确认排班、可领收入、待签协议、面试提醒、进行中任务。
- **排班与打卡**：打卡方式 GPS（≤半径）/WiFi（SSID 匹配）/外勤（备注≥4字）/扫码；休息日不可打卡；**打卡即自动投保**（`shouldAutoInsure`/`createPolicyFromPunch`）；补卡（每月次数上限）、取消班次（原因必填）。
- **推荐 / 抢班**：岗位报名（active、不可重复）、抢班（`GrabShiftSlot` 白名单校验、报名）、任务领取（数量 1~min(配额,剩余,99)，阶梯计价 `calcTaskClaimAmount`）。
- **任务大厅 / 实例**：领取任务→工作流节点推进（`submitTaskInstanceWorkflow`）→企业验收；步骤视图 `buildTaskWorkflowSteps`。
- **招聘报名**：岗位详情→投递（`applyForJob`），我的投递状态查看。
- **培训考核**：资料学习（视频满 30s / PDF 滚到底）、考核（课程 100% 解锁后作答，AI 出题 `generateAiExamQuestions`、自动判卷）。
- **我的收入 / 收款 / 协议 / 消息 / 保险 / 信用**：待结算/待领取/已领取（须绑定支付宝或银行卡）；协议签署；消息含排班确认（pending→accepted/rejected）；保单详情；信用分展示。

### 7.4 审批中心（通用）`/approvals`
- 统一待办入口，聚合考勤异常、任务类型、账单等审批事项。

---

## 8. 核心业务流程（跨端）

### 8.1 任务全流程
企业创建类型 → 平台审批 → 企业发布 → 灵工领取 → 工作流推进 → 企业验收 → 结算 → 灵工收入领取。

### 8.2 考勤 + 日结
考勤组配置结算价与日结 → 灵工打卡工时 → 结算单 → claimable → 灵工领取 → 资金 payout 流水。

### 8.3 企业财税
平台生成账单 → 企业确认付款 → 申请发票 → 平台结算灵工 → 资金管理监控。

### 8.4 招聘入职
发布需求 → 线索 → 面试 → 入职 → 分配部门 → 排班/培训。

### 8.5 合规校验
排班/考勤受 `ScheduleRule` 与 `AttendanceGroupCompliance` 约束（连班天数、日/周/月工时、班次间隔、女工夜班限制等），冲突由 `detectConflicts`/`detectComplianceConflicts` 识别。

---

## 9. 非功能需求

| 维度 | 要求 |
|------|------|
| 性能 | 列表页首屏 ≤ 1s（本地数据）；图表渲染 ≤ 500ms；批量结算千级明细 ≤ 3s |
| 安全 | 账号密码 ≥8 位；敏感操作记录操作日志；权限三重校验（菜单/路由/接口）；数据范围隔离租户 |
| 兼容 | Chrome/Edge/Safari 最新版；小程序 H5 适配 iOS 14+ / Android 10+ |
| 可靠 | 排班发布版本快照可回滚；关键单据状态机不可逆操作二次确认 |
| 合规 | 工时合规规则可配置且系统拦截；个税/发票流程可审计 |
| 可维护 | 单 Store + 服务层分层；类型集中定义；演示数据可 `localStorage.clear()` 重置 |

---

## 10. 数据埋点（建议）

| 埋点位置 | 事件ID | 触发条件 | 上报字段 |
|----------|--------|----------|----------|
| 小程序打卡 | mini_punch | 打卡成功 | employeeId, type, source, method, inRange |
| 抢班报名 | grab_apply | 提交报名 | slotId, employeeId, whitelisted |
| 任务领取 | task_claim | 领取任务 | taskId, quantity, amount |
| 智能排班 | smart_generate | 一键生成 | scope, conflictCount, balancedScore |
| 结算单确认 | bill_confirm | 企业确认 | billId, totalPayable |
| 收入领取 | income_claim | 灵工领取 | recordIds, channel, amount |
| 审批操作 | approval_action | 通过/驳回 | type, targetId, action |

---

## 11. 状态机速查

| 对象 | 状态 | 终态 |
|---|---|---|
| 企业 | active/expiring/terminated | terminated |
| 任务类型 | draft/pending/published/rejected/disabled | disabled |
| 任务发布 | draft/active/ended/cancelled | ended/cancelled |
| 账单 | pending_submit→pending_confirm→pending_payment→paid/void | paid/void |
| 发票 | draft→pending_review→issued/rejected | issued/rejected |
| 个税 | generated→submitted→filed | filed |
| 灵工收入 | pending_settlement/claimable/claimed | claimed |
| 抢班/岗位报名 | pending/approved/rejected | approved/rejected |
| 招聘线索 | screening→…→closed（11 态） | closed |
| 保险保单 | active→expired | expired |

---

## 12. 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| 路由级权限未强制（越权访问） | 高 | 高 | 上线前补齐 beforeEach 鉴权 + 接口级 dataScope |
| 单 Store 体量过大（~4700 行） | 中 | 中 | 正式环境拆分为领域 Store + 真实 API 层 |
| 智能排班为启发式（非最优解） | 中 | 低 | 标注为辅助建议，保留人工调整通道 |
| 结算/支付为演示态 | 高 | 高 | 对接真实支付与 ERP 前限制生产使用 |
| 数据范围依赖前端过滤 | 中 | 高 | 服务端按 dataScope 强制过滤 |
| 培训门禁阻断正常用工 | 低 | 中 | 提供豁免/临时放行审批 |

---

## 13. 待完善项 / 路线图建议

1. **权限强化**：补齐平台/企业端路由守卫与接口级 dataScope（发布阻断级）。
2. **架构升级**：拆分巨型 Store，接入真实 REST API + 数据库。
3. **算法生产化**：智能排班接入线性规划/遗传算法求最优解。
4. **支付与财税打通**：对接真实打款通道、金蝶/SAP ERP 实时同步。
5. **灵工档案增删改接通**、任务附件真实上传、Dashboard 快捷链统一。
6. **移动端原生化**：评估从 H5 小程序到原生 App 的演进路径。

---

*文档结束 · V2.0*
