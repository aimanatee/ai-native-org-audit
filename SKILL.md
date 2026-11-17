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

1. 第一次使用时，请用户提供**团队人数**、**项目地址或本地路径**，并确认报告显示名、审计时间段和范围。按[取证权限表](references/evidence-access.md) 确认允许读取哪些资料，用户可改用脱敏导出。初始化不会连接项目。对已有 `audit.json` 从现有文件继续。

   ```bash
   node scripts/audit.mjs init --organization "团队显示名" --team-size 8 \
     --project "https://example.org/team/project" --scope "近 30 天的项目交付" --output audit.json
   ```

2. 按[评分契约](references/scoring-contract.md)填写七维证据。记录实际抽样范围及无法确认的来源。团队协作核对信息同步、交接和自动化的实际回执。历史失败案例要可追溯、可复测。对值得优先推进的指标写 `next_step` 和 `success_check`，给出具体动作及可复核的验收结果。
3. 用无依赖脚本计算并生成 HTML：

   ```bash
   node scripts/audit-report.mjs --input audit.json --output report.html
   node scripts/audit-report.mjs --input audit.json --validate
   ```

   脚本会严格校验状态、证据键、`not_applicable` 理由和脱敏边界；计算只由契约中的常量驱动。
4. 交付报告时说明审计范围、证据覆盖率、待补证项和实际验证层级。HTML 为离线单文件。初始化生成的本地输入含项目地址及人数，分享时只交付审阅后的 HTML。

## 产出约定

- 共享版只交付 HTML、输入样例和使用说明；不附带原始仓库路径、内部链接或凭据。
- 改进项必须标记为“改进机会”，不能把 `unknown` 或 `stated` 夸大成失败事实。
- 首屏显示总分、覆盖率和范围。随后用横向得分条总览各维度，明细以“展开证据”和“收起证据”控制。末尾集中显示优先优化动作和验收方式。
- 检查桌面与手机首屏、图表标签和数值，实际展开、收起一个维度并确认窄屏没有横向溢出。

详细字段和权重只以 [references/scoring-contract.md](references/scoring-contract.md) 为准；不要在其他文件复制另一套评分规则。

© 2026 NodeCity（nodecity.ai）。MIT 许可见 [LICENSE](LICENSE)。
