# Problem Statement

## The Challenge

Large open-source repositories and organizations face a **duplicate PR problem**:

- Contributors submit PRs for bugs/features that have already been addressed
- Maintainers waste time reviewing and rejecting duplicates
- Original authors lose credit when similar work is merged independently
- **Siloed Repositories**: Duplicates across microservices (e.g. config updates) go unnoticed
- No automated system exists to detect semantic duplicates (not just textual diffs)

## Real-World Impact

### For Maintainers
- **Time waste**: Reviewing duplicate PRs takes hours per week
- **Contributor frustration**: Rejecting PRs after review damages community relations
- **Credit disputes**: Hard to prove who implemented a fix first

### For Contributors
- **Wasted effort**: Implementing features that already exist
- **Delayed feedback**: Finding out a PR is duplicate after days of review
- **Lost credit**: Similar PRs merged without attribution

## Current Solutions (and why they fail)

| Approach | Limitation |
|----------|------------|
| Manual review | Doesn't scale, requires maintainer expertise |
| Text search | Misses semantic similarity (different wording, same intent) |
| Commit diff comparison | Fails when implementation differs but solves same problem |
| Issue tracking | Contributors don't always check existing issues |
| Generic AI | **Black box decisions** destroy detailed trust (why is this a duplicate?) |

## What PRSense Solves

✅ **Semantic duplicate detection** — Matches intent, not just text  
✅ **Attribution preservation** — Tracks original authorship via graph  
✅ **Scalable** — Bloom filter + ANN avoids O(n²) comparisons  
✅ **Trustworthy** — Conservative thresholds prevent false positives  
✅ **Explainable** — "Why" breakdown builds trust (unlike black-box AI)
✅ **Cross-Boundary** — Detects duplicates across multiple repositories  

---

## Target Users

1. **Large OSS Projects** (Linux, Kubernetes, React, etc.)
2. **Enterprise Mono-repos** (Google, Meta internal repos)
3. **GitHub Bot Maintainers** (automation teams)
4. **Code Review Platforms** (Gerrit, Phabricator integrations)

---

## Success Metrics

- **Precision**: % of flagged duplicates that are actually duplicates (target: >90%)
- **Recall**: % of actual duplicates that are detected (target: >75%)
- **Latency**: Detection time per PR (target: <500ms)
- **Maintainer time saved**: Hours per week (measured via surveys)
