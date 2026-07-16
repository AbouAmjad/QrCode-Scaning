# ToolCustody Documentation

**Product:** ToolCustody — Abu Amjad  
**Type:** QR-based Tool Custody Management System  
**Status:** Production operational / Enterprise hardening in progress  

## Purpose of this folder

This `/docs` tree is the authoritative technical documentation for ToolCustody.  
It describes the **as-built system** (what exists in the codebase today) and clearly labels **planned** capabilities.

## Quick links

| Document | Description |
|----------|-------------|
| [SYSTEM_OVERVIEW.md](./SYSTEM_OVERVIEW.md) | Product & runtime overview |
| [SOFTWARE_ARCHITECTURE_DOCUMENT.md](./SOFTWARE_ARCHITECTURE_DOCUMENT.md) | Architecture |
| [SOFTWARE_REQUIREMENTS_SPECIFICATION.md](./SOFTWARE_REQUIREMENTS_SPECIFICATION.md) | Requirements |
| [DATABASE_DESIGN.md](./DATABASE_DESIGN.md) | Google Sheets data model |
| [API_REFERENCE.md](./API_REFERENCE.md) | Apps Script API |
| [SECURITY_POLICY.md](./SECURITY_POLICY.md) | Security posture |
| [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) | Deploy Pages + GAS |
| [PROJECT_ROADMAP.md](./PROJECT_ROADMAP.md) | Phased roadmap |
| [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) | Known defects & risks |
| [MASTER_PROMPT.md](./MASTER_PROMPT.md) | AI / engineer constitution |
| [DOCUMENTATION_QUALITY_REVIEW.md](./DOCUMENTATION_QUALITY_REVIEW.md) | Docs quality ratings & fixes |
| [CODE_AUDIT_REPORT.md](./CODE_AUDIT_REPORT.md) | Enterprise code audit findings |
| [IMPLEMENTATION_PRIORITY.md](./IMPLEMENTATION_PRIORITY.md) | Remediation waves (no impl yet) |
| [GITHUB_ISSUES.md](./GITHUB_ISSUES.md) | One GitHub Issue per audit finding |

## Documentation map

```
docs/
├── README.md                          ← you are here
├── MASTER_PROMPT.md                   ← engineering rules for agents
├── SYSTEM_OVERVIEW.md
├── SOFTWARE_ARCHITECTURE_DOCUMENT.md
├── SOFTWARE_REQUIREMENTS_SPECIFICATION.md
├── DATABASE_DESIGN.md
├── API_REFERENCE.md
├── SECURITY_POLICY.md
├── DEPLOYMENT_GUIDE.md
├── DEVELOPMENT_RULES.md
├── CODING_STANDARDS.md
├── UI_UX_GUIDELINES.md
├── CONTRIBUTING.md
├── CHANGELOG.md
├── PROJECT_ROADMAP.md
├── RELEASE_PLAN.md
├── KNOWN_ISSUES.md
├── DOCUMENTATION_QUALITY_REVIEW.md
├── CODE_AUDIT_REPORT.md
├── IMPLEMENTATION_PRIORITY.md
├── GITHUB_ISSUES.md
├── TEST_PLAN.md
├── DECISIONS/                         ← Architecture Decision Records
├── WORKFLOWS/                         ← Operational workflows
├── FEATURES/                          ← Feature specs (as-built + planned)
└── TEST_CASES/                        ← Manual test cases
```

## Technology stack

| Layer | Technology |
|-------|------------|
| Frontend | HTML, CSS, JavaScript (vanilla) |
| Hosting | GitHub Pages |
| Offline | PWA (`manifest.json`, `sw.js`) |
| Backend | Google Apps Script |
| Storage | Google Sheets + Google Drive (damage photos) |

## Core workflow (immutable unless explicitly changed)

```
Person (P…)  →  Direction (OUT | IN)  →  Tools (I / E / C / B…)
```

Custody state is **rebuilt from scan history** by `parser.js`.  
It is not stored as a separate inventory table.

## Source of truth (code)

| Concern | Module / file |
|---------|----------------|
| Scan session rules | `scan.js` (`ScanEngine`) |
| Custody math | `parser.js` (`CustodyParser`) |
| API / auth helpers | `config.js` |
| UI chrome / auth gate | `ui.js` (`TCUI`) |
| Backend | `Code.gs.example` (template) / `Code.gs.txt` (local secrets, gitignored) |

## Live endpoints

- **GitHub:** https://github.com/AbouAmjad/QrCode-Scaning  
- **Site:** https://abouamjad.github.io/QrCode-Scaning/  

## How to use these docs

1. New engineers: start with System Overview → Architecture → Workflows.  
2. API integrators: API Reference + Database Design.  
3. Operators: Deployment Guide + Workflows + Known Issues.  
4. AI agents: Master Prompt **before** any code change.

## Status legend used in feature docs

| Label | Meaning |
|-------|---------|
| **AS-BUILT** | Implemented in current codebase |
| **PARTIAL** | Partially implemented |
| **PLANNED** | Not implemented; roadmap only |

---

*Last documentation generation: based on codebase audit of ToolCustody (static PWA + Apps Script + Sheets).*


## Documentation completion status

All markdown files under `/docs` are populated. Feature docs use status labels **AS-BUILT**, **PARTIAL**, or **PLANNED**. See [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) for defects that affect as-built accuracy.
