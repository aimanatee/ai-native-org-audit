# AI-Native 组织只读审计

这是一个可安装的 Codex Skill。它以结构化证据计算七维评分（含团队协作），生成离线、默认脱敏的 HTML 报告。旧版六维输入仍可复算。

## 快速开始

先打开 [示例报告](https://nodecity.ai/cases/ai-native-org-audit/example.html)，看看总分、七维图和证据是什么样。示例使用虚构团队。

1. 从 [GitHub Releases](https://github.com/aimanatee/ai-native-org-audit/releases/latest) 下载 `ai-native-org-audit.zip` 并解压。
2. Codex 项目内使用时，把整个 `ai-native-org-audit` 目录放进项目的 `.agents/skills/`，在项目中开启一个新对话。WorkBuddy 可在「技能 → 添加技能 → 上传技能」中导入 ZIP。
3. 对助手说「使用 `ai-native-org-audit` 给我的团队做一次只读评分。范围是我提供的任务、验收和交接记录，请输出脱敏 HTML 报告。」按提示提供你同意用作审计的材料。

## 无需安装也能试跑

安装 Node.js 20 或更新版本，在解压后的 Skill 目录运行：

```bash
node scripts/audit-report.mjs --input sample/audit.json --output my-report.html
```

打开 `my-report.html` 查看结果。为自己团队打分时，复制示例 JSON 并换成自己的信息、证据和状态，再用新文件重跑。解释及字段格式见评分契约。报告生成器本地读取指定 JSON 并写出指定 HTML，证据原件由使用者保存。

字段、维度权重和不适用处理见 `references/scoring-contract.md`。报告隐藏 `locator`，并对常见敏感字段做校验和脱敏。

## 使用边界

- 这是只读审计，不是发布器、代码修改器或 CI 替代品。
- 没有 CI/CD 不扣分；本地可重复验证可以作为证据。
- `unknown` 是证据缺口，不是失败；HTML 中会显示为改进机会。
- 分享前仍应由人确认组织名、范围和证据摘要不包含客户机密。

© 2026 NodeCity，采用 [MIT 许可](LICENSE)。报告来源为 [nodecity.ai](https://nodecity.ai/)，为中小团队赋能的 AI 社群。
