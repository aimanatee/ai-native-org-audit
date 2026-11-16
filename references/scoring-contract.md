# AI-Native 组织审计评分契约

新评估使用 `ai-native-org-audit/v2`。历史 `ai-native-org-audit/v1` 输入仍可原样复算。跨期比较使用同一版本和适用范围。

| id | 名称 | v1 | v2 |
| --- | --- | ---: | ---: |
| `intent` | 方向与意图 | 15 | 13 |
| `spec_plan` | 可执行规格与计划 | 15 | 13 |
| `evidence` | 可复核证据链 | 25 | 21 |
| `review_safety` | 独立审查与安全边界 | 15 | 13 |
| `deterministic_learning` | 确定性验证与回归学习 | 20 | 17 |
| `feedback_loop` | 运行反馈与改进闭环 | 10 | 8 |
| `collaboration` | 团队协作 | — | 15 |

对应版本的维度必须全部出现且只能出现一次。每维包含 `indicators` 数组，指标 `weight` 默认是 1。指标状态为：

- `proven`：有直接、可复核的执行回执、验证产物或受控观察；系数 1。
- `established`：有已合入/已建立的控制与可追溯产物，但当前运行覆盖不完整；系数 0.75。
- `stated`：只有政策、文档或声明，尚未有足够的执行证据；系数 0.4。
- `unknown`：范围内没有可靠证据；系数 0。它不是失败结论。
- `not_applicable`：经审计者说明后明确不适用；系数为 excluded，从该维度分母移除。

每个 `proven`、`established`、`stated` 指标至少有一个 `evidence`。`not_applicable` 必须有非空 `rationale`。证据对象只能有 `kind`、`summary`、可选 `locator`、可选 `observed_on` 四个键。`kind` 只能是：

`execution_receipt`、`verified_artifact`、`controlled_observation`、`merged_control`、`declared_policy`。

`locator` 仅作输入核验，报告永不显示；不得放 URL、绝对路径、邮箱、凭据或个人身份。所有报告文字会再做 HTML 转义与敏感串脱敏。

## 团队协作怎么评

- **信息同步**：任务、负责人、状态和关键决定在哪里更新。抽样看参与者能否找到最新口径；归档聊天内容时只记录必要结论。
- **交接与阻塞**：任务交给谁、交付哪些证据、如何确认接手，卡住后谁处理。团队成员之间与 Agent 之间的交接范围分别记录。
- **流程自动化**：抽一条业务或协作流程，检查触发条件、执行权限、结果回执、异常通知和人工接手路径。本地执行和定期任务均可取证。配置、回执和接手记录分别对应各自证据强度，CI/CD 不计分。
- **实际采用**：用已授权、脱敏的真实任务记录核对以上做法。一条工作流样本仅覆盖该样本。样本不可见时记待补证。

## 计算

对一个维度，先移除 `not_applicable` 指标。若没有剩余指标，该维度为 excluded，不进入可评分满分。否则：

```text
dimensionRatio = Σ(indicatorWeight × statusCoefficient) / Σ(indicatorWeight)
dimensionEarned = dimensionWeight × dimensionRatio
dimensionPossible = dimensionWeight
```

总分为各维 `dimensionEarned` 之和；可评分满分为各有效维度权重之和。百分比为 `earned / possible × 100`。所有计算保持原始精度，只有展示时四舍五入到一位小数。

证据覆盖率不是分数：

```text
(proven + established) 指标数 / applicable 指标总数
```

覆盖率分母不含 `not_applicable`，`stated` 和 `unknown` 不计入覆盖分子。

## 输入骨架

下面展示一个维度的字段。完整七维输入见 [sample/audit.json](../sample/audit.json)。

```json
{
  "schemaVersion": "ai-native-org-audit/v2",
  "organization": "示例组织",
  "assessmentDate": "2026-11-17",
  "auditor": "只读自评",
  "scope": "已授权的工作方式与交付证据",
  "dimensions": [
    {
      "id": "intent",
      "indicators": [
        {
          "id": "intent-brief",
          "label": "任务有明确目标与停止条件",
          "weight": 1,
          "status": "proven",
          "evidence": [
            {"kind": "controlled_observation", "summary": "可复核的目标—停止条件记录", "observed_on": "2026-11-17"}
          ],
          "next_step": "保持每次任务都能追溯到停止条件"
        }
      ]
    }
  ]
}
```
