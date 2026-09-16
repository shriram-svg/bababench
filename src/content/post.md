---
byline: By Shriram Vasudevan, Videet Mehta, and Connor Sweeney
dek: Measuring frontier agents on real long-horizon patient advocacy tasks.
org: Baba Research
page_description: 47 expert-reviewed patient-advocacy cases compiled into deterministic interactive environments, with oracle-certified solvability and deterministic grading.
page_title: BabaBench: An Automated Benchmark for Patient Advocacy Tasks
share_description: An automated benchmark for patient advocacy tasks from Baba Research.
title: Introducing BabaBench
---

## Towards Assessing Realistic Patient Care Advocacy {#intro}

Patient care advocacy involves supporting patients through the
healthcare system safely and effectively--handling paperwork,
coordinating with insurers, managing billing, and navigating the many
other administrative steps required to deliver care, often over long
periods of time. Cases frequently span complex, distinct institutional
processes with bespoke requirements, tight timelines, dependencies
between parties, and a need for advocates to continuously track progress
and ultimately confirm that care is delivered. Partial completion is not
enough: the work is only done when the patient is confirmed to have
received the intended outcome.

With BabaBench, we introduce high-fidelity simulations of real patient
care advocacy cases, along with evaluation criteria designed to assess
agentic readiness for care advocacy. We are excited to build a benchmark
that measures how well frontier models can actually complete this
important work today.

BabaBench is built around a rigorous methodology grounded in real
advocacy work. It draws from real tasks from our platform that were especially rich in data and supporting metadata, that expert
advocates then reviewed, labeling relevant information, parties, and steps required to achieve task-specific outcomes. These labels were used to construct high-fidelity, complex environments that model exactly the components extant in the real task's completion.

Additionally, we also built a grading pipeline designed to assess both the quality of an agent's conduct throughout a case and the final outcome state it leaves behind. This two-part evaluation is particularly important for patient care advocacy, where agents must demonstrate professionalism,
procedural care, and sound judgment throughout intermediate steps while
also ensuring that care is ultimately delivered. BabaBench therefore
evaluates both how an agent carries out the work and whether it
successfully completes the outcomes the patient actually needs.

## Results

BabaBench evaluates 14 models across 47 simulated cases: 9 light, 15 standard, and 23 hard.

Our headline metric, **Pass@1**, averages the pass rate across the three seeds. A pass requires every outcome and no hallucinations, deception, and prohibited actions. **Pass³** measures the share of simulated cases passed in all three seeds.

Claude Opus 5 and Grok 4.6 share the highest Pass@1 at **52.5%**. Grok 4.6 leads Pass³ at **38.3%**. The highest pass rate on hard simulated cases is **29.0%**.

<Leaderboard />

<TradeoffChart />

<OutcomeChart />

## Methodology

### Task Selection

BabaBench is derived from 125 real care advocacy tasks recorded on the Baba platform. We first compiled a broad set of cases from a two-month span, along with the underlying metadata associated with each one, including messages, calls, recorded notes, faxes, and other case records. Each was then processed through a de-identification pipeline to remove personally identifiable information (PII).

At a high level, a patient advocacy task is a coordination problem. An advocate is trying to achieve a set of outcomes by working across different people and organizations, obtaining information from them, passing information between them, and taking the steps required to move the case forward. Accurately representing that work therefore means capturing the outcomes that were achieved, the people and organizations involved, the steps taken, and the information that was received, used, or transferred along the way.

To identify cases that could support this level of reconstruction, an LLM-based pipeline assessed each one based on the richness of its supporting metadata, prioritizing cases with enough information to faithfully reconstruct the work in a simulated case. This reduced an initial set of approximately 1,000 cases to 125 benchmark-ready examples.

For each selected case, we then transformed the underlying work and its metadata into a structured case packet. The packet captures a high-level description of the task, the parties involved and the information exchanged between them, a set of preferred steps for completing the work, the terminal outcomes that must be true once the task is complete, and prohibited actions as well as other relevant best and worst practices. These packets form the source material for constructing each simulated case.

### Quality Assurance

Once the 125 task packets were generated, each was vetted by expert human advocates through a two-pass review process. An initial reviewer examined the complete case record and verified that the generated packet accurately and consistently represented the underlying advocacy task. This included confirming that the task description aligned with the source material, that the terminal outcomes reflected what ultimately needed to be achieved and were consistent with the proposed steps, and that the parties and information exchanges were represented correctly, and were sufficient for task completion.

A second expert advocate then independently reviewed the packet and
returned any discrepancies or comments to the first
reviewer. The case moved forward only after the reviewers resolved those
comments and reached full agreement on the final representation. At that
point, the case packet was considered ready for environment generation.

### Environment Generation

To turn each reviewed case packet into an interactive environment, we first need to capture how all of its components connect: who is involved, what information each party has, what actions they can take, and how those actions ultimately lead to the desired outcomes. We represent this structure as a directed graph.

A simulated case contains parties such as patients, insurers, providers, suppliers, and community organizations, along with the information they hold and the stateful actions they can take. Dependencies connect these components and determine how the case can progress. Information obtained from one party may need to be passed to another before that party can act. An action taken by one party may satisfy a requirement for a later action somewhere else in the case. Learning a piece of information may also reveal a previously unknown party or make a new contact route available.

In this way, the graph captures the coordination, information gathering, and actions required to complete the original task. The resulting environment ultimately leads to a set of terminal outcomes, representing the states that must be reached for the task to count as complete. A final action might, for example, confirm that a device was delivered, that an appointment was scheduled, or that a required document was received.

### Inside a simulated case {#example}

This simulated case follows a woman who needs a replacement for her broken walker.
Here is the case as the agent receives it:

<Brief />

::: figure
<DiscoveryMap />
:::

The brief simply specifies the intended goals for the task. The information to gather, the parties to coordinate, and the actions to take are all gleaned over at execution the. The required work is evidently complex and long-horizon. The agent must:

::: workList
-   confirm the exact replacement need with the patient
-   identify the previously unknown prescribing clinic
-   confirm that a prior prescription exists or can be reissued
-   establish the payer's replacement pathway and applicable benefit
-   identify an in-network supplier
-   obtain documentation that the existing device is not repairable
-   arrange an immediate replacement through a community resource
-   confirm actual home receipt rather than stopping at a promise
-   provide modeled interim safety guidance
-   schedule follow-up for remaining mobility and food-access needs
:::

### Environment Verification

Once an environment is generated, we run a deterministic check over the graph to ensure that every required terminal outcome is actually reachable. This verifies that the simulated case can be completed through the information, actions, and dependencies encoded in the environment before any model is evaluated on it.

After an environment passes deterministic verification, an expert advocate attempts to complete the simulated task through the same interactive environment used during evaluation. This gives us a practical check that the environment is not only traversable in theory, but can also be solved through the information and actions actually exposed to an advocate. An environment is only admitted to the benchmark once the required outcomes can be reached successfully.

### Agent Harness

Every model uses the same model-agnostic harness. Agents have tools that let them communicate with parties, request and share information, take actions, fill out forms, read documents, wait for processes to advance, and maintain notes as they work through a case. A running case file keeps track of what the agent has learned, which parties it can reach, the documents it holds, and the current state of the task.

Each run is limited to 150 interactions with the environment, preventing agents from simply brute-forcing their way through a case.

When an agent communicates with a party, it does so in natural language. A translator maps the request to the information or actions available from that party, and the deterministic engine decides what actually happens based on the current state of the environment. For example, an action may fail because the agent has not yet obtained the required information, permission, or prerequisite from another party. The translator itself cannot create information or change the environment state.

<TranslatorFigure />

### Scoring {#grading}

The grader accepts any safe route. Calling `finish` does not change the
score. Requests, submissions, and callback promises fail when the
required end state remains incomplete.

```
pass = required_ok(σ) ∧ forbidden_ok(σ) ∧ authority_ok(σ) ∧ integrity_ok
```

::: figure label="Blockers and their requirements"
| Blocker | Requirement |
|---|---|
| Required outcomes | Every required outcome group is satisfied. Alternatives within one group form an OR condition. |
| Forbidden actions | No engine-enforced forbidden mutation or form occurs. |
| Authority | No protected exchange proceeds without the recipient-scoped authority declared by that environment. |
| Interaction integrity | The delivered environment remains consistent with engine truth and the run artifact is valid. |

The four gates use engine state and the interaction record.
:::

A separate conduct audit checks claims that final state cannot capture.
Every run keeps its prompts, turns, translator ballots, traces, and
verdicts.

## Conclusion {#conclusion}

BabaBench is designed to test whether agents can actually carry out long-horizon patient advocacy work, not just reason about it. Across 47 de-identified, expert-reviewed cases, agents have to discover the right parties, gather and transfer information, take actions across multiple organizations, and ultimately close out the required outcomes. Success also requires doing that work properly, without acting without the necessary authority, relying on unsupported information, or taking prohibited actions.

Across the closed-source and open-weight models we evaluated, performance remains far from reliable. Opus 5 and Grok 4.6 achieve the highest Pass@1 at 52.5%, while Grok 4.6 has the highest Pass3 at 38.3%. Opus 5 reaches all required outcomes in 81.6% of runs, but its pass rate is much lower.

That gap is one of the clearest takeaways from the benchmark. Models often fail because they leave required work unfinished, but they also sometimes reach the right final outcome through the wrong process. In patient advocacy, both matter. An agent has to complete the work and do so in a way that is both professional and thorough.

## Browse the simulated cases {#worlds}

Search every simulated case by task or initially reachable party. Each entry shows the
brief the agent receives. The graded outcomes remain private so future
runs do not receive the answer key.

<WorldIndex />

### Cite this work {#cite}

```bibtex
@techreport{bababench2026,
  title       = {BabaBench: An Automated Benchmark for Patient Advocacy Tasks},
  author      = {Vasudevan, Shriram and Mehta, Videet and Sweeney, Connor},
  institution = {Baba Research},
  year        = {2026},
  note        = {Technical report, Benchmark 01}
}
```
