---
name: ai-native-org-audit
description: 对 AI-Native 组织的工作方式做只读、可复算、证据分级的审计，并生成默认脱敏、适合截图分享的自包含 HTML 报告；不发布、不改动被审计系统。
license: MIT
---

# AI-Native 组织只读审计

这个 Skill 用于评估一个组织是否把意图、规格、证据、审查、确定性验证和运行反馈闭环成了可复核的工作系统。它不是代码质量扫描器，也不把某个平台、模型、CI/CD 或文件名当成能力本身。

## 不可变边界

- 默认只读。只读取用户明确放入审计范围的材料；不改仓库、Issue、MR、部署、账户、数据或 CI，也不自动发布报告。
- 报告默认是分享版。审计内容隐藏绝对路径、URL、邮箱、凭据、客户数据和个人身份。证据 `locator` 仅用于输入校验。末尾的 NodeCity 署名可链接到公开官网。
- CI/CD 不属于固定评分维度；没有 CI 不扣分。可用本地确定性脚本、可复现命令和保存的结果作为证据。
- 不把“存在一份文档”当成“已运行”。按证据等级区分 `proven`、`established`、`stated`、`unknown` 和 `not_applicable`。
- `unknown` 暂不得分，保留在适用分母，提示下一步补证。`not_applicable` 必须有理由，从该维度分母移除。

## 运行方式

1. 先收集只读材料，建立结构化 JSON；不要为了凑案例或固定数量而制造证据。历史失败案例只有在可追溯、可复测时才记为证据。
2. 按 [评分契约](references/scoring-contract.md) 的 v2 口径填写七个维度。团队协作核对信息同步、交接和自动化的实际回执。评估日期和组织名用真实值，`auditor` 用“只读自评”等不含个人身份的标签。
3. 用无依赖脚本计算并生成 HTML：

   ```bash
   node scripts/audit-report.mjs --input audit.json --output report.html
   node scripts/audit-report.mjs --input audit.json --validate
   ```

   脚本会严格校验状态、证据键、`not_applicable` 理由和脱敏边界；计算只由契约中的常量驱动。
4. 交付报告时说明审计范围、证据覆盖率、未知项及未做的外部验证。HTML 为离线单文件，首屏显示 `已得分 / 可评分满分`、百分比、组织名、日期和覆盖率。

## 产出约定

- 共享版只交付 HTML、输入样例和使用说明；不附带原始仓库路径、内部链接或凭据。
- 改进项必须标记为“改进机会”，不能把 `unknown` 或 `stated` 夸大成失败事实。
- 首屏显示总分、覆盖率和范围。随后用横向得分条总览各维度，展示最多三项优先补证。明细以可见的“展开证据”和“收起证据”入口控制。
- 检查桌面与手机首屏、图表标签和数值，实际展开、收起一个维度并确认窄屏没有横向溢出。

详细字段和权重只以 [references/scoring-contract.md](references/scoring-contract.md) 为准；不要在其他文件复制另一套评分规则。

© 2026 NodeCity（nodecity.ai）。MIT 许可见 [LICENSE](LICENSE)。
