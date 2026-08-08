# ToolCustody Documentation

**Product:** ToolCustody — Abu Amjad / AbouAmjad Store System (AICS)  
**Type:** QR-based Tool Custody Management System  
**Status:** Production operational (**Node.js + PostgreSQL** on VPS)

## AI / agent entry point (read first)

| Document | Description |
|----------|-------------|
| [../AI_PROJECT_MEMORY.md](../AI_PROJECT_MEMORY.md) | Permanent rules — **mandatory** before any change |
| [../PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md) | Live production snapshot |
| [../ARCHITECTURE.md](../ARCHITECTURE.md) | Current architecture (Node + Postgres) |
| [../TASKS.md](../TASKS.md) | Live task board |
| [../DECISIONS.md](../DECISIONS.md) | Decision log |
| [../CHANGELOG.md](../CHANGELOG.md) | Live changelog |

If anything in `/docs` conflicts with the root memory files about the **live** stack, the **root files win**.

## Purpose of this folder

This `/docs` tree holds expanded technical documentation.  
Some older files still describe the Google Apps Script / Sheets era — treat those as **historical** unless revived by an approved plan.

## Quick links

| Document | Description |
|----------|-------------|
| [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) | Product & runtime overview |
| [SOFTWARE_ARCHITECTURE_DOCUMENT.md](./SOFTWARE_ARCHITECTURE_DOCUMENT.md) | Architecture (may lag live stack) |
| [VPS_DEPLOY.md](./VPS_DEPLOY.md) | VPS deploy notes |
| [SECURITY_POLICY.md](./SECURITY_POLICY.md) | Security posture |
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | Known defects & risks |
| [MASTER_PROMPT.md](./MASTER_PROMPT.md) | AI / engineer constitution (also see root memory) |
| [DECISIONS/](./DECISIONS/) | Older ADRs |

## Documentation map

```
docs/
├── README.md                          ← you are here
├── MASTER_PROMPT.md
├── … (workflows, features, test cases)
└── DECISIONS/                         ← older Architecture Decision Records

(repo root)
├── AI_PROJECT_MEMORY.md               ← agent constitution (live)
├── PROJECT_CONTEXT.md
├── ARCHITECTURE.md
├── TASKS.md
├── DECISIONS.md
└── CHANGELOG.md
```

## Technology stack (LIVE)

| Layer | Technology |
|-------|------------|
| Frontend | HTML, CSS, JavaScript (vanilla), multi-page |
| Hosting | nginx on VPS (`aics.iskndr.com`) |
| Offline | SW present but **no API cache** (ledger freshness) |
| Backend | Node.js Express action dispatcher (`server/src/`) |
| Storage | PostgreSQL + disk uploads |

## Core workflow (immutable unless explicitly changed)

```
Person (P…)  →  Direction (OUT | IN)  →  Tools (I / E / C / B…)
```

Custody state is rebuilt from the **`scans`** tape (server `custody.js`; client `parser.js` for some legacy views).

## Source of truth (code)

| Concern | Module / file |
|---------|----------------|
| Scan session rules | `scan.js` (`ScanEngine`) |
| Client custody math | `parser.js` (`CustodyParser`) |
| Server custody math | `server/src/custody.js` |
| Stock snapshot | `server/src/lib/stock.js` |
| API / auth helpers | `config.js` |
| UI chrome / auth gate | `ui.js` (`TCUI`) |
| Backend | `server/src/server.js` + `handlers/*` |

## Live endpoints

- **GitHub:** https://github.com/AbouAmjad/QrCode-Scaning  
- **Production site:** https://aics.iskndr.com  

## How to use these docs

1. **AI agents:** root `AI_PROJECT_MEMORY.md` → `PROJECT_CONTEXT.md` → `ARCHITECTURE.md` → `TASKS.md` before any code change.  
2. New engineers: same, then Workflows under `/docs`.  
3. Operators: VPS deploy + Known Issues.

## Status legend used in feature docs

| Label | Meaning |
|-------|---------|
| **AS-BUILT** | Implemented in current codebase |
| **PARTIAL** | Partially implemented |
| **PLANNED** | Not implemented; roadmap only |

---

*Last documentation update: 2026-08-05 — live stack is Node + PostgreSQL; root memory files are authoritative for agents.*
