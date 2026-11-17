# AI-Native 组织只读审计

这是一个可安装的 Codex Skill。它以结构化证据计算七维评分（含团队协作），生成离线、默认脱敏的 HTML 报告。旧版六维输入仍可复算。

## 快速开始

先下载[示例报告](https://github.com/aimanatee/ai-native-org-audit/releases/latest/download/sample-report.html)，用浏览器查看总分、七维图和优化建议。示例使用虚构团队。

1. 从 [GitHub Releases](https://github.com/aimanatee/ai-native-org-audit/releases/latest) 下载 `ai-native-org-audit.zip` 并解压。
2. Codex 项目内使用时，把整个 `ai-native-org-audit` 目录放进项目的 `.agents/skills/`，在项目中开启一个新对话。WorkBuddy 可在「技能 → 添加技能 → 上传技能」中导入 ZIP。
3. 对助手说「使用 `ai-native-org-audit` 初始化我的团队评估」。按提示填写团队人数、项目地址（或本地目录）、报告显示名和范围。确认可读资料后，助手会收集证据，生成评分和优化建议。

## 授权哪些资料

按实际需要授权只读访问指定项目的仓库、任务看板、PR/MR、测试和验收回执，以及经脱敏的交接、复盘或自动化记录。你可以只提供摘录。地址本身不会授予权限，无法读取的项目记为待补证。范围和抽样方法见[取证权限表](references/evidence-access.md)。

## 无需安装也能试跑

安装 Node.js 20 或更新版本，在解压后的 Skill 目录运行：

```bash
node scripts/audit-report.mjs --input sample/audit.json --output my-report.html
```

打开 `my-report.html` 查看结果。为自己的团队评估时，在当前目录创建独立的输入文件：

```bash
node scripts/audit.mjs init --organization "我的团队" --team-size 8 \
  --project "https://example.org/team/project" --scope "近 30 天的项目交付" --output audit.json
node scripts/audit-report.mjs --input audit.json --validate
node scripts/audit-report.mjs --input audit.json --output my-report.html
```

初始化只在本机创建 JSON，所有指标从待补证开始。取得授权后，再把证据摘要、状态、优化动作和验收方式写进 JSON 并重新生成报告。初始化不会覆盖同名文件，重新初始化时请选择新文件名。项目地址和人数只保存在本地输入，公开前只分享审阅后的 HTML。

字段、维度权重和不适用处理见 `references/scoring-contract.md`。报告隐藏 `locator`，并对常见敏感字段做校验和脱敏。

## 使用边界

- 这是只读审计，不是发布器、代码修改器或 CI 替代品。
- 没有 CI/CD 不扣分；本地可重复验证可以作为证据。
- `unknown` 是证据缺口，不是失败；HTML 中会显示为改进机会。
- 分享前仍应由人确认组织名、范围和证据摘要不包含客户机密。

© 2026 NodeCity，采用 [MIT 许可](LICENSE)。报告来源为 [nodecity.ai](https://nodecity.ai/)，为中小团队赋能的 AI 社群。
