# AI PROJECT MEMORY

## Purpose

This file is the permanent memory of this project.

Never rely on previous chat history.

Every new AI session must read this file completely before making any decision.

If chat history is unavailable, assume this file is the only reliable source of project knowledge.

**Also read before any work:**

1. [PROJECT_CONTEXT.md](./PROJECT_CONTEXT.md) — what the live system is
2. [ARCHITECTURE.md](./ARCHITECTURE.md) — how it is built
3. [TASKS.md](./TASKS.md) — open / done work
4. [DECISIONS.md](./DECISIONS.md) — architectural decisions
5. [CHANGELOG.md](./CHANGELOG.md) — notable changes

---

# Development Philosophy

This project is a **production system** (live at https://aics.iskndr.com).

Stability is more important than speed.

Never sacrifice existing functionality to implement a new feature.

Always preserve backward compatibility unless explicitly instructed otherwise.

---

# Before Doing Anything

Always:

* Read this file completely.
* Read PROJECT_CONTEXT.md.
* Read ARCHITECTURE.md.
* Read TASKS.md.
* Understand the current codebase.
* Analyze dependencies.
* Ask questions if anything is unclear.

Never guess.

---

# Coding Rules

Never:

* Rewrite working code.
* Refactor the entire project.
* Rename folders or files without approval.
* Delete existing functionality.
* Change project architecture without approval.

Always extend existing code whenever possible.

**Critical production warning:** Never deploy the minimal GitHub stub `server.js` over the live VPS API. Live production is larger than some historical GitHub snapshots. Prefer deploying modular files under `server/src/` only after verifying against production DB column names.

---

# Feature Development Process

For every major feature:

1. Analyze the project.
2. Create IMPLEMENTATION_PLAN.md.
3. Explain:

   * affected files
   * database changes
   * APIs
   * risks
   * rollback strategy
4. Wait for approval.
5. Implement in small steps.
6. Test each step.
7. Update documentation.

Never skip this workflow.

---

# Documentation

Always keep these files updated:

* PROJECT_CONTEXT.md
* ARCHITECTURE.md
* TASKS.md
* CHANGELOG.md
* DECISIONS.md

Documentation is part of the project.

It is never optional.

---

# Project Memory

Every important architectural decision must be written into DECISIONS.md.

Every completed task must be written into TASKS.md.

Every important change must be written into CHANGELOG.md.

Never depend on conversation history.

---

# Rollback Policy

Before any major modification:

Create a rollback point (git branch / commit / VPS file backup).

If something unexpected happens:

Stop immediately.

Explain the issue.

Do not continue until approved.

---

# Priority Order

1. Data Safety
2. Existing Features
3. Project Stability
4. Code Quality
5. New Features

Never violate this priority.

---

# Hard Constraints (learned from incidents)

1. **Database is source of truth** — scans, catalog, receiving, dispatches must never be wiped for a “quick fix”.
2. **Match production Postgres column names** — do not invent alternate schemas (`qty` vs `qty_sent`, `by_user` vs `issued_by`, `inventory_counts` vs `inventory_count_sheets`).
3. **Stock formulas:**
   * Product available = `received − damaged − locked` (`locked` = `out` tools / `issued` consumables).
   * Project on-site = rebuildable from dispatch ledger (`out` − `return` on `qty_sent`).
4. **Service Worker must not cache API** — always network for ledger freshness.
5. **Timesheet** — do not re-introduce until production is fully stable and approved.
6. Smoke tests: `DATABASE_URL=... UPLOAD_DIR=... node server/test/smoke.js` (expect all checks passed).
