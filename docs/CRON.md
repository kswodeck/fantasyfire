# External scheduling (cron-job.org)

The provided-lines ingest is scheduled by **cron-job.org**, not by GitHub. GitHub still
runs the job — only the *trigger* moved. This document is the setup, the schedule, and
the measurements that justify it.

## Why

GitHub's scheduled-workflow queue is best-effort. It delays and silently **drops** runs,
and it does so badly enough at high frequency to break the product.

Measured on `ingest-providedlines.yml` over 2026-08-29..31 (26 runs sampled, run numbers
consecutive — so nothing was hidden by cancellation or pagination; GitHub simply never
created the missing runs):

| | Declared | Actual |
|---|---|---|
| Runs on 2026-08-30 (a complete day) | 30 | **9** — a 70% drop rate |
| Lateness vs the scheduled slot | 0 | median **26 min**, worst **120 min** |
| Gap between consecutive runs | 20–30 min at peak | median **144 min**, worst **403 min** |

The board was going hours stale behind a completely green pipeline. No alert fired
because nothing failed — the runs just never happened.

## Architecture, and why it is this one

```
cron-job.org  ──HTTP POST──>  GitHub workflow_dispatch API  ──>  Actions runs the job
```

cron-job.org **must not do the work.** Its free tier closes the connection after
**30 seconds**, and this job's measured median runtime is **3.2 minutes**. Anything that
tries to do real work inside that request gets cut off mid-scrape.

`workflow_dispatch` sidesteps that completely: GitHub returns `204 No Content`
immediately, so the HTTP request is over in well under a second regardless of how long
the job then takes. The compute, the secrets, the 10-minute timeout and the Production
environment all stay exactly where they already work.

Two alternatives were considered and rejected:

- **Vercel Cron** — Hobby fires *once per day* with timing guaranteed only within the
  hour, which cannot express this schedule at all. Pro ($20/mo) does per-minute cadence
  but bills cron invocations against the function quota, and function duration caps at
  300s by default (800s with fluid compute) — thin headroom for a 192s job and not
  enough for the daily multi-sport ingest. It also would have put critical scheduling on
  an account that was blocked at the time of writing.
- **A VPS running real cron** — no duration ceiling and the most control, at $4–6/mo.
  Worth revisiting if the long-running daily ingest ever needs to move too. Rejected for
  now because it introduces a server to maintain for a problem that is purely scheduling.

## Setup

### 1. Create a fine-grained GitHub PAT

github.com → Settings → Developer settings → **Fine-grained tokens** → Generate new.

- **Repository access:** Only select repositories → `kswodeck/fantasyfire`
- **Permissions:** Repository permissions → **Actions: Read and write**. Nothing else.
- **Expiration:** set one, and calendar the rotation.

That permission set can start and cancel workflow runs. It **cannot** read repository
contents, read secrets, or push code — so the blast radius of the token living on a
third-party service is "can trigger a job that was already scheduled to run anyway".
Do not reuse the `GH_PAT` that `weekly.yml` uses for secret rotation; that one is far
more powerful.

### 2. Create the cron-job.org job

Create **one job per row of the schedule table below** (two on the free plan). Each row
is a cross-product of hours x minutes, which is exactly what cron-job.org's schedule
editor expresses. The free tier allows unlimited jobs at up to 1-minute resolution, so
splitting the cadence across a few jobs costs nothing.

Every job uses the identical request — only the schedule differs:

| Field | Value |
|---|---|
| URL | `https://api.github.com/repos/kswodeck/fantasyfire/actions/workflows/ingest-providedlines.yml/dispatches` |
| Method | `POST` |
| Header | `Authorization: Bearer <the PAT>` |
| Header | `Accept: application/vnd.github+json` |
| Header | `X-GitHub-Api-Version: 2022-11-28` |
| Header | `Content-Type: application/json` |
| Body | `{"ref":"main"}` |

`"ref":"main"` is required and must be `main` — scheduled and dispatched runs only fire
from the default branch.

The URL identifies the workflow **by filename**, which is readable but breaks silently
(as a `404`) if the file is ever renamed. The numeric workflow ID is stable across
renames and can be substituted directly:

```
.../actions/workflows/302506280/dispatches
```

Verified 2026-09-01: both forms resolve to this workflow (`state: active`), and a real
dispatch against `ref: main` returned **204** and produced run **#978** with trigger
`workflow_dispatch`. The request path in this table is known-good end to end; the only
untested part of the chain is your token.

Enable **"Treat redirects as success: no"** and notification on failure, so an expired
token surfaces as an email rather than as a quietly dead pipeline.

### 3. Expected response

`204 No Content` on success. Anything else means the trigger did not fire:

| Status | Cause |
|---|---|
| `401` | Token wrong, expired, or missing the `Bearer ` prefix |
| `403` | Token lacks **Actions: write**, or is not scoped to this repo |
| `404` | Workflow filename wrong, or the token cannot see the repo (a fine-grained token scoped to the wrong repo returns 404, not 403) |
| `422` | `ref` missing or not a real branch |

## Schedule

All times **UTC**. When EST begins (early Nov 2026) shift every hour **+1** to keep the
same Eastern wall-clock — the job is US-evening shaped.

**cron-job.org's schedule editor is a cross-product**: you pick a set of hours and a set
of minutes, and it fires at every combination. A flat list of arbitrary times would
therefore need one job per time. The schedules below are expressed as cross-products so
the whole cadence is two jobs, not eleven.

Both deliberately avoid **05:00 and 13:00** — the in-repo fallback ticks. The workflow
sets `cancel-in-progress: true`, so a collision would let a fallback tick kill a healthy
external run.

### Free plan (2,000 min/mo) — 10 external ticks/day

| Job | Hours | Minutes | Ticks | Covers |
|---|---|---|---|---|
| **A — peak** | `23, 0, 1` | `0, 30` | 6 | 23:00–01:30 UTC, every 30 min (7:00–9:30pm ET) |
| **B — warm-up** | `15, 17, 19, 21` | `0` | 4 | afternoon into early evening |

### Pro plan (3,000 min/mo) — 18 external ticks/day

| Job | Hours | Minutes | Ticks | Covers |
|---|---|---|---|---|
| **A — peak** | `22, 23, 0, 1, 2` | `0, 30` | 10 | 22:00–02:30 UTC, every 30 min (6:00–10:30pm ET) |
| **B — warm-up** | `14, 15, 16, 17, 19, 21` | `0` | 6 | midday into evening |
| **C — keep-warm** | `7` | `0` | 1 | overnight |
| | | | *17 + 1 spare* | |

## Budget

Actions bills each **job** rounded **up** to the whole minute. Measured medians:

| Workflow | Runs/day | Billed min/run | Min/day |
|---|---|---|---|
| `ingest-providedlines` | *see schedule* | **4** (median 3.2 min) | *variable* |
| `social` | ~5.6 actual (13 declared) | ~1.5 | ~8 |
| `ingest` (daily) | 1 | ~4 | 4 |
| `weekly` | 1/week | ~2 | ~0.3 |
| CI on push/PR | ~0.5 | ~1.5 | ~0.8 |
| | | **fixed subtotal** | **~13** |

That leaves, for provided-lines:

| Plan | Allowance | Per day | Minus fixed | Ticks/day at 4 min |
|---|---|---|---|---|
| Free | 2,000 min/mo | 66.7 | 53.7 | **12** (10 external + 2 fallback) |
| Pro | 3,000 min/mo | 100 | 87 | **19** (17 external + 2 fallback) |

Linux is **$0.006/min** beyond the allowance (cut from $0.008 on 2026-01-01), so each
extra tick/day beyond the table costs roughly `4 × 30 × $0.006 ≈ $0.72/month`.

**Note the honest trade.** Today the pipeline gets ~9 runs/day *by accident*, with
6-hour holes. The free-plan schedule above buys 12 runs/day that actually land, evenly
spaced. That is a modest gain in count and a large gain in *distribution* — the point is
that a 30-minute peak ceiling becomes real instead of aspirational. Most of the headroom
for a genuinely tighter cadence is behind GitHub Pro, which at $4/mo is the cheapest
lever available here.

## Verifying it works

After creating the first job, check that dispatched runs are arriving:

- The Actions tab shows the run with trigger **`workflow_dispatch`** rather than
  `schedule`. That is the signal it came from cron-job.org.
- cron-job.org's own history tab shows `204` per execution.

To confirm the drop-rate problem is actually fixed, compare a complete day's
`workflow_dispatch` runs against the tick count above. It should match exactly — an
external scheduler that fires 10 times should produce 10 runs.

## Rolling back

Nothing in the repo depends on cron-job.org. To revert, restore a full `schedule:` block
in `.github/workflows/ingest-providedlines.yml` (git history has the previous 30-entry
version) and disable the cron-job.org jobs. The fallback ticks mean that even if the
external scheduler simply stops, the pipeline degrades to two runs a day rather than
stopping dead.

## Extending to other workflows

`social.yml` has the same disease — 13 declared runs/day, ~5.6 actual, a ~57% drop rate
— and posting on time matters for engagement. It already accepts `workflow_dispatch`, so
the same setup applies with the workflow filename swapped; budget for it first, since
the table above assumes social stays on its (under-firing) GitHub schedule.

`ingest.yml` (daily) and `weekly.yml` are low-frequency and tolerant of an hour's drift.
Leave them on GitHub's scheduler — a dropped run there costs a day's freshness on
already-daily data, which is not worth another token on a third-party service.
