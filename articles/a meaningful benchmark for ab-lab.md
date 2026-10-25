## ADD A MEANINGFUL BENCHMARK

I've added a new benchmark to [ab-lab](https://github.com/Fi3/ab-lab) that reflects my personal experience: regular tasks, even with frontier models, often need an external reviewer who doesn't have the author's context.

The benchmark is DEMAND CLI SRI migration v2. The task is to migrate the DEMAND client from the old SRI libraries to `roles_logic_sv2` from the `dmnd-pool/new-sri` repository, using a pinned revision. This is a breaking migration, with similar APIs but some differences in behavior. Existing functionality must be preserved and performance regressions avoided. [Benchmark definition](https://github.com/Fi3/ab-lab/blob/5a5094ac7c66450d6f7ec190260b3c43b2fb4580/benchmarks/dmnd-new-sri.json#L2) (`benchmarks/dmnd-new-sri.json:2`).

I consider this a task of medium complexity. For a developer who knows the code and the domain very well, I estimate about two person-days without AI, including a good review. That's with the environment and tests already set up. This is my estimate: I haven't measured the same work being done without AI.

To create the benchmark, I first put together a suite with 17 end-to-end scenarios covering the main mining flows, plus a test for pool support. I reserved these tests for the final evaluation, forbidding agents from reading, modifying, or running them during the task. Version 2 also includes a public example of the transport interface that both the author and the reviewer can compile. This makes the requirements explicit without exposing the evaluation scenarios. [Suite description and limitations](https://github.com/Fi3/ab-lab/blob/5a5094ac7c66450d6f7ec190260b3c43b2fb4580/README.md#demand-cli-sri-migration).

The result is that the baseline with Codex in `native` mode doesn't pass all the tests. The configuration using the ab-lab conditions, but without external review, also stops at 16/18. The configuration with a separate reviewer reaches 18/18.

The baseline was run with `multiAgentMode: "explicitRequestOnly"`, which is ab-lab's default when calling Codex. This obviously needs fixing, since in normal use you usually let the agent create subagents. Anyway, I ran the same test myself using Codex directly (without ab-lab), with the ability to create subagents (which Codex did), and it still didn't pass all the tests. (But I'll fix this in ab-lab anyway and rerun the test through ab-lab, then publish the result.)

All three runs use Codex with `gpt-6.1-sol`, `xhigh` reasoning, and a limit of 50 million tokens:

| Configuration | Tests passed | Total tokens | Uncached tokens |
| :--- | ---: | ---: | ---: |
| Native baseline | 16/18 | 15,060,240 | 764,048 |
| ab-lab conditions, without external review | 16/18 | 16,420,295 | 722,119 |
| Same conditions, with external review | 18/18 | 19,055,413 | 1,013,941 |

Both ab-lab configurations use `all` except `C08`, `C16`, and `C17`. The one with review allows up to three cycles and requires P0 and P1 issues to be fixed. It actually ran two reviews, with one fix by the author. These are three separate runs, one per configuration. [SRI v2 results](https://github.com/Fi3/ab-lab/blob/5a5094ac7c66450d6f7ec190260b3c43b2fb4580/results.md#demand-cli-sri-migration-v2-50m-token-limit) (`results.md:127`).

The reviewer found a concrete issue: when converting a message, the code dropped the block reward value. The miner and the pool ended up using different data. The reviewer reproduced the issue, the runner passed the review to the author, and after the fix, all tests in the suite passed.

## FIX REVIEW ISSUE DESCRIPTION

I've also fixed an issue: the reviewer was getting too much context. Now, by default, it receives neither the original task request nor the author's report. It works on a separate copy of the repository, with two neutral commits and no access to the original history or run results. The `--review-issue-description` option lets you include the request and report again. So "without context" means without the author's context: the reviewer still sees the code, changes, and instructions in the repository. [Review behavior](https://github.com/Fi3/ab-lab/blob/5a5094ac7c66450d6f7ec190260b3c43b2fb4580/README.md#L36) (`README.md:36`).

## WHAT'S NEXT

I'm happy with this benchmark because it reflects my real experience with coding agents: for me, this happens on about 90% of non-trivial tasks. It doesn't prove that a separate review is always necessary. But I finally have a case that reproduces the problem I wanted to observe.

I don't care much about optimizing token usage on trivial tasks, since they're already cheap. Now I'll use this benchmark to find a suitable setup for work-leaf, which I'll talk about over the next few weeks.

I know that using just one benchmark risks overfitting the configuration to that specific task. But I don't get tokens for free, and I also need them for the work that puts food on the table. I'm looking for gains big enough to matter to me: for example, reducing the final cost of completing a task at the same level of quality by 20%, including review and fixes.

I haven't demonstrated that saving yet. The SRI run that passes all the tests uses more tokens than the two that fail. Also, the uncached tokens reported in the tables include uncached input tokens and output tokens: they aren't a direct measure of monetary cost.

I've decided not to add an argument for setting the temperature. It adds complexity for something I'm not interested in right now.

For now, I won't add any new features to ab-lab. I want to focus on finding a setup I'm happy with for the tasks I normally do, and on developing work-leaf.

## AB-LAB FOR CUSTOM BENCHMARKS

I've also tried ab-lab the way I'd like others to use it: define a custom local benchmark and run it. In my experience, it was very simple: one prompt and I had a working benchmark.

In this case, I used a local variant of SWE-Milestone scikit-learn-light, with the three tasks M06, M11, and M12.1, to compare Codex with and without Spec Kit. I also added support for `repository_additions`: it lets you add tools and instructions to the initial repository without changing the existing files or evaluation tests. [Local benchmark support](https://github.com/Fi3/ab-lab/blob/5a5094ac7c66450d6f7ec190260b3c43b2fb4580/README.md#L495) (`README.md:495`).

The comparison also uses Codex with `gpt-6.1-sol`, `xhigh` reasoning, `native` mode, and no external review from the runner:

| Configuration | Required outcomes satisfied by the final code | Total tokens | Uncached tokens |
| :--- | ---: | ---: | ---: |
| Standard Codex | 79,225/79,252 | 15,226,003 | 784,019 |
| Spec Kit installed, usage optional | 79,220/79,252 | 13,197,309 | 752,893 |
| Full Spec Kit workflow required | 78,267/79,252 | 20,577,442 | 1,356,066 |
| Explicit standard planning | 79,221/79,252 | 15,166,424 | 829,656 |

These numbers count required outcomes across the three milestones, not unique tests. The data comes from the four runs: standard Codex, Spec Kit available, full workflow, and standard planning.

Compared with standard planning, the full Spec Kit workflow used 35.7% more total tokens and 63.4% more uncached tokens. Both satisfied 652 of the 661 new required outcomes. The final code produced by the full workflow satisfied fewer outcomes overall.

This is consistent with my intuition about how useful skills' frameworks are, but it doesn't prove anything general. One run per configuration, on one benchmark, with one model: it could have gone any way!

A serious study would require much more. But that wasn't my goal. I mainly wanted to see how easy it
was to define custom benchmarks, including for local code that maybe isn't open source.

## OTHER UPDATES

I've added a wiki section to my personal website. I'm starting to experiment with the LLM wiki approach, and I thought it would be nice to make the wikis easily accessible from the site, without having to go to GitHub.
So far, I've only published one wiki in the "Sloppy" category, nothing particularly interesting. I mainly created it to check that the content displayed properly on the site.
Basically, the frontend queries the GitHub API to find my public repositories whose names start with `wiki-curated-` or `wiki-sloppy-`. It then loads the Markdown pages from the `wiki/` folder and renders them directly in the browser.

I've also added the `old` section, which contains my old (VERY OLD) website. Pretty tacky, but I'm attached to it and wanted to put it back online.
