# Who decides? Decision allocation between agents and humans — evidence and cost model

Date: 2026-10-28 · Triggered by: #12 condition conflict (issue said CONTROL, conditions.json said cbad) · Feeds: ADR-0004, H21, H22, W3

## 1. What the evidence says

| # | Finding | Source | Consequence for CBAD |
|---|---|---|---|
| E1 | Agents are poor at knowing when *not* to act: best paired act/abstain accuracy 59.5 % (Gemini 3.1 Pro), Claude Opus 4.7 59.4 %, mean 45.7 % over 17 models. Conflicting constraints are the hardest trigger (≈ 33 %). 2.6 % of abstain runs take the irreversible action and then claim refusal. | Liu et al., *AgentAbstain*, arXiv 2607.10059 (2026) | Do not leave cross-source conflicts to the agent's judgment. Resolve them with a fixed precedence rule (ADR-0004); audit tool traces, not the final message. |
| E2 | Ask only when the expected value of the answer exceeds the user's cost of answering; this matches or beats hand-tuned confidence thresholds, by up to 1.36 utility points in high-cost settings. | Dong et al., *Value of Information: A Framework for Human–Agent Communication*, ACL 2026 | Escalation is a cost decision, not a politeness rule (§2). |
| E3 | Calibrated ask-for-help: with conformal prediction a robot planner reaches a user-chosen success level and needs 10–24 % fewer human interventions than baselines. | Ren et al., *Robots That Ask For Help* (KnowNo), CoRL 2023, arXiv 2307.01928 | For P2 (embodied): "ask" thresholds should be calibrated with a statistical guarantee, not hand-set. |
| E4 | Human intervention is reserved for high-risk actions and repeated failure; guardrails are layered. | OpenAI, *A Practical Guide to Building Agents* (2025), as summarised by Maginative | Matches CBAD's stop list (contract change, merge, force-push, deletion) and the "second REQUEST CHANGES stops" rule. |
| E5 | Automation is chosen per stage (information acquisition, analysis, decision, action), each with its own level. | Parasuraman, Sheridan & Wickens, IEEE TSMC-A 30(3), 2000 | CBAD automates acquisition and analysis fully (graph, impact), decision by rule, action under gates; humans keep irreversible actions. |
| E6 | Approval fatigue: frequent approvals decay into rubber stamps; remedies are gating by blast radius, reviewing policy rather than every action, random audits and injected should-reject cases. (Secondary source; primary figures not verified here.) | tianpan.co, *Approval Fatigue…* (2026-06-25) and sources it lists | Fewer, larger, meaningful asks; measure them (H22); later add canary PRs that must be rejected. |

## 2. Cost model (to be filled with measured numbers)

Ask the human when `p_wrong × cost_wrong > cost_ask`.

- `cost_ask` ≈ human minutes × hourly rate + waiting time of the pipeline. With 3 minutes at €40/h this is ≈ €2 per question, about four times the full token cost of a control task in this pilot ($0.43–$0.64, #10–#15). **Human attention is the most expensive resource in the pipeline.**
- `cost_wrong` depends on reversibility: reversible inside the PR ≈ one dev re-run (≈ task cost); reaches `main` ≈ revert + re-run + review; irreversible (contract published, data deleted) ≈ unbounded → always ask.
- `p_wrong` for the agent's own judgment on conflicts is high (E1, ≈ 2/3 miss rate on conflicting constraints); for a mechanical precedence lookup it is the error rate of the higher source, which is reviewed once.

Hence the allocation in ADR-0004: cross-rank conflicts → rule, logged; same-rank or silent → ask; irreversible → always ask.

## 3. How this is measured
- H21: blind audit of every `conflict:` ledger line at the end of Phase 1.
- H22: `human_asks` per task, cbad vs control, with escaped defects as the counter-metric.
- Cost: `human_asks × 3 min` is reported next to token cost in every Phase 1 summary.

## 4. Open
- Calibrated (conformal) thresholds for "ask" in the robot extension (P2), following E3.
- Canary PRs that should be rejected, to measure reviewer attention (E6).
