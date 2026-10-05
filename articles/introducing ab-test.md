I just released [ab-lab](https://github.com/Fi3/ab-lab). It is a Python tool that lets you run benches with a specific
model/harness/setting configuration.

For example, you can do:
```sh
python3 -m lab run ./benchmarks/swe-milestone-scikit-learn-light.json \
                --out runs/bench33 \
                --harness codex \
                --model gpt-6-luna \
                --effort xhigh \
                --preset all --off C08,C16,C17  \
                --review-priorities P0,P1 \
                --seconds 14400 \
                --max-raw 50000000 \
                --max-turns 100 \
                --max-review-loops 3 \
                --parallel 4
```

The above command will run the scikitlight bench using codex with gpt-6-luna xhigh. It
will allow a max of 3 review loops, and only P0 and P1 issues will be fixed. It adds a safety net, so
after either 4 hours of running, 50M total tokens used, or 100 turns, the runner will stop. The run
result will be saved in `./runs/bench33`. The last option tells the runner that we want to run 4
instances of the same bench.
The above command also instructs the runner to run the bench with specific conditions, in
particular all conditions but C08,C16,C17.

For now, I support codex and pi (1.0). I plan to add support for other harnesses. Benches are defined in
`https://github.com/Fi3/ab-lab/benchmarks` and are composed of a repo URL, a commit, a set of prompts for the agent, and a set of
tests to evaluate the output.

This tool can be used as a benchmark for any repo that you own. You need to define a
specific set of tests over a specific commit of that repo, then you can run this tool every time you change
the harness or you want to try new SKILLS or a different model, etc.

I'm randomly testing different configurations to see if I can find any big token difference that can't be explained only by variance. For now, the results are not very interesting.
The first bench that I added was slope bench, but it was too easy. Then I tried swe-milestone-scikit-learn,
and it seemed to be a little bit more challenging for the agents, but it was using too many tokens,
so I ended up running most of the experiments on a reduced version of swe-milestone-scikit-learn
that I called swe-milestone-scikit-learn-light.
You can find the results of all these experiments in `results.md`.
The output, other than with the specific bench evaluator, is also rated with the scb-check.

For now, from the bench data, we can't see any improvement in solving a bench using an "author/reviewer"
loop vs using only one agent. (We don't let the agent spawn sub-agents unless in native mode, so if you set
`--max-review-loops=0`, this is exactly what you get.)
This is in disagreement with my experience working with agents on real-world issues. Most of the
time, if the issue is not super-simple, doing a review with a new agent that does not have the issue
description / requirements in the context improves the output a lot. Right now the tool send 
feature requested to the reviewer but I will fix it soon removing that or making it optional.
The next step would be to find a bench where I can observe it.
