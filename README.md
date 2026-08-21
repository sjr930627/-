# 智能排班管理系统 · 管理后台

Phase 1–3 完整演示：排班 → 考勤 → 审批 → 薪酬 → 分析。

## 技术栈

- Vue 3 + TypeScript + Vite
- Element Plus + Pinia
- localStorage 本地持久化（演示模式）

## 功能一览

| 阶段 | 模块 | 路径 |
|------|------|------|
| P1 | 组织/班次/排班表/发布 | `/departments` … `/schedule-publish` |
| P2 | 打卡/异常/审批/报表/自助 | `/attendance` … `/self-service` |
| P3 | 智能排班/薪酬/分析/加班 | `/smart-schedule` … `/analytics` |

### Phase 3 新增

- **智能排班** `/smart-schedule` — 一键生成、工时均衡、人员推荐（技能/偏好/规则）
- **加班管理** — 审批中心 + 员工自助，通过后联动排班
- **薪酬联动** `/payroll` — 考勤算薪、CSV 导出、ERP 数据包、集成日志
- **数据分析** `/analytics` — 部门出勤、排班模式、人力成本趋势

## 在线演示

GitHub Pages 演示地址：

**https://sjr930627.github.io/-/**

| 入口 | 链接 |
|------|------|
| 多端门户 | https://sjr930627.github.io/-/portals |
| 运营后台 | https://sjr930627.github.io/-/dashboard |
| 企业端 | https://sjr930627.github.io/-/enterprise/dashboard |
| 灵工小程序 | https://sjr930627.github.io/-/miniapp/login |
| 企业小程序 | https://sjr930627.github.io/-/enterprise-miniapp/recruitment |

详细演示脚本见 [`docs/DEMO.md`](docs/DEMO.md)。`main` 分支推送后自动重新部署。

## 快速开始

```bash
npm install
npm run dev
```

## 演示路径

1. **智能排班** → 选 2026-08 + 一车间早班组 → 一键生成 → 应用
2. **审批中心** → 审批刘洋周末加班申请
3. **薪酬联动** → 查看 2026-07 算薪 → 导出 CSV / 同步 ERP
4. **数据分析** → 部门统计与成本趋势

若数据为空：`localStorage.clear()` 后刷新。

## API 层

`src/api/client.ts` 预留后端对接抽象，当前读写 Pinia store。

## 后续

- 真实 REST API + 移动端
- 智能排班优化算法（线性规划/遗传算法）
- 与金蝶/SAP 等 ERP 实时对接
