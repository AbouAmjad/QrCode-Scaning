# BACKUP_IMPLEMENTATION_PLAN.md

> **Backup System — plan only. Not implemented.**  
> Status: **Awaiting owner approval before any scripts, cron, or VPS changes.**  
> Created: 2026-08-05  
> Related (official VPS knowledge): `/opt/toolcustody-docs/BACKUP_SYSTEM.md`, `AI_MEMORY.md`  
> Related (workspace when present): `docs/BACKUP_SYSTEM.md`, `docs/AI_MEMORY.md`

**Priority:** Data safety first. No production restarts or file changes until this plan is approved and a later “execute” order is given.

---

## 0. Current VPS snapshot (read-only analysis)

Analyzed **2026-08-05** on host `vmi3449429` (Ubuntu, kernel 6.8). **No VPS files were modified.**

| Item | Observed |
|------|----------|
| Disk `/` | 96G total · ~4.7G used · **~92G free** (~5% used); inodes ~2% used |
| Frontend | `/var/www/toolcustody` ≈ **13M** (uploads ≈ **1.5M**) |
| Backend | `/opt/toolcustody-api` ≈ **26M** (includes `node_modules`) |
| Docs | `/opt/toolcustody-docs` ≈ **536K** |
| PostgreSQL | **16.14** · DB `toolcustody` ≈ **14 MB** · data dir `/var/lib/postgresql/16/main` · ~36 public tables · `pg_dump`/`pg_restore` present |
| Nginx | `/etc/nginx/sites-available/toolcustody` **and** `sites-enabled/toolcustody` are **two different files** (not a symlink; contents differ) — **both must be backed up** |
| SSL | Let's Encrypt `aics.iskndr.com`: `live/` is **symlinks** into `archive/` · full `/etc/letsencrypt` ≈ **120K** |
| Service | `/etc/systemd/system/toolcustody-api.service` · active · `User=root` · `EnvironmentFile=/opt/toolcustody-api/.env` · `ExecStart=node …/src/server.js` |
| Env secrets | `/opt/toolcustody-api/.env` mode **600**, owner root |
| Existing backups | `/root/backups/toolcustody-docs/` only (Phase C docs tarball). **No** `/root/backups/toolcustody/` or `/opt/toolcustody-backup/` yet |
| Cron today | No ToolCustody backup cron (system: certbot, sysstat, e2scrub, staticroute). Empty root crontab |

Conclusion: Disk headroom is large; dataset is small. Retention policy below is easy to satisfy.

---

## 1. Backup architecture

```
                    ┌─────────────────────────────┐
                    │   toolcustody-backup tools   │
                    │   /opt/toolcustody-backup/   │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
   hourly-db job            daily-full job            manual/pre-change
   (DB only)                (all assets)              (on demand)
          │                        │                        │
          └────────────────────────┼────────────────────────┘
                                   ▼
                    /root/backups/toolcustody/
                    ├── hourly-db/
                    ├── daily-full/
                    ├── manual/
                    ├── logs/
                    └── LAST_GOOD_* markers
```

### Design principles

1. **Atomic success:** a backup is “good” only after verification passes; then retention may delete older sets.  
2. **Secrets stay root-only:** any archive containing `.env` or private keys → mode `600`, owner `root:root`.  
3. **No GitHub / no off-box requirement** for v1 (VPS-local). Offsite copy can be a later approved add-on.  
4. **Do not restart services** during backup.  
5. **Never truncate DB** as part of backup/restore experimentation.

---

## 2. Storage location

**Root:** `/root/backups/toolcustody/`

| Subdir | Contents |
|--------|----------|
| `hourly-db/` | Compressed DB dumps only |
| `daily-full/` | Full snapshot directories (or single dated archive + manifest) |
| `manual/` | Pre-change / rollback snapshots |
| `logs/` | Job stdout/stderr + status |

Optional mirror later (not in v1): second disk / operator pull — out of scope until approved.

---

## 3. Backup scope (what each job includes)

### A. Hourly database backup

| Asset | Method |
|-------|--------|
| PostgreSQL `toolcustody` | `pg_dump -Fc` (custom format) **or** `pg_dump \| gzip` → `.sql.gz` |

**Recommended:** `pg_dump -Fc -f …/toolcustody-YYYYMMDD-HHMM.dump` (supports selective restore via `pg_restore`).

### B. Daily full backup

One dated directory:  
`/root/backups/toolcustody/daily-full/YYYY-MM-DD/` containing:

| Component | Source | Archive name (example) |
|-----------|--------|------------------------|
| Frontend | `/var/www/toolcustody` | `ui.tgz` |
| Backend | `/opt/toolcustody-api` | `api.tgz` (include `.env`, `src`, `package*.json`; include `node_modules` for fastest restore **or** exclude and document `npm ci` — **recommend include** for small size ~26M) |
| Docs | `/opt/toolcustody-docs` | `docs.tgz` |
| Database | `pg_dump -Fc` | `db.dump` |
| Nginx | **Both** `sites-available/toolcustody` and `sites-enabled/toolcustody` (they differ on this VPS), plus `nginx.conf` if customized | `nginx.tgz` |
| Systemd unit | `/etc/systemd/system/toolcustody-api.service` | inside `config.tgz` |
| Environment | `/opt/toolcustody-api/.env` | inside `api.tgz` (mode 600 on parent daily dir) |
| Cron | `/etc/cron.d/toolcustody-backup` (once installed) + dump of root crontab if any | `cron.tgz` |
| SSL | Prefer full `/etc/letsencrypt` (~120K) so `live/` symlinks + `archive/` + `renewal/` stay consistent | `ssl.tgz` (**600**) |

### C. Manual / pre-change rollback backup

Same as daily-full, stored under `manual/prechange-YYYY-MM-DD-HHMM/` with reason note in manifest (`reason` field).

---

## 4. Scripts / services required (to be created only after approval)

Proposed install path: **`/opt/toolcustody-backup/`** (outside app/web trees)

```
/opt/toolcustody-backup/
├── bin/
│   ├── backup-db-hourly.sh
│   ├── backup-full-daily.sh
│   ├── backup-manual.sh
│   ├── verify-backup.sh
│   └── prune-retention.sh
├── lib/
│   └── common.sh          # paths, logging, lockfile, sha256 helpers
└── README.md              # operator notes (copy of this plan summary)
```

| Script | Role |
|--------|------|
| `backup-db-hourly.sh` | Dump DB → verify → write manifest → prune hourly (keep 6 good) |
| `backup-full-daily.sh` | Full set → verify → manifest → prune daily (keep 7 good) |
| `backup-manual.sh` | Args: `--reason "…"` → full set under `manual/` (no auto-prune of manuals except optional age policy later) |
| `verify-backup.sh` | Validate one backup set (checksums, archive test, optional `pg_restore -l`) |
| `prune-retention.sh` | Called only at end of successful job |

**Locking:** `flock` on `/var/lock/toolcustody-backup.lock` so hourly/daily never overlap destructively.

**No systemd service required** for v1 — cron is enough. Optional timer units later.

---

## 5. Cron schedule

File to install later: **`/etc/cron.d/toolcustody-backup`**

| Schedule | Job |
|----------|-----|
| `5 * * * *` | Hourly DB (`backup-db-hourly.sh`) — minute 5 past each hour |
| `15 2 * * *` | Daily full (`backup-full-daily.sh`) — 02:15 local server time |
| (none) | Manual — operator runs `backup-manual.sh` |

Logging: append to `/root/backups/toolcustody/logs/backup-YYYYMMDD.log`.

---

## 6. Permissions

| Path | Owner | Mode |
|------|-------|------|
| `/opt/toolcustody-backup/` | `root:root` | dirs `755`, scripts `750` |
| `/root/backups/toolcustody/` | `root:root` | `700` |
| Hourly/daily/manual sets containing secrets | `root:root` | dir `700`, archives `600` |
| Logs | `root:root` | `640` |

Backup jobs run as **root** (needed for `.env`, Let's Encrypt, and consistent ownership).  
Node app does **not** get write access to backup dirs.

---

## 7. Compression method

| Asset | Format |
|-------|--------|
| File trees (ui/api/docs/nginx/ssl/config) | `tar` + **gzip** (`tar czf`) — portable, already used on this VPS |
| Database | Prefer **`pg_dump -Fc`** (compressed custom); alternative `.sql.gz` |

Optional later: `pigz` if CPU allows; not required at current sizes.

---

## 8. Verification method (must pass before “success”)

For each produced artifact:

1. **Exists & non-empty** (min size thresholds, e.g. DB dump > 1KB).  
2. **Checksum:** `sha256sum` recorded in manifest.  
3. **Archive integrity:** `gzip -t` / `tar tzf … >/dev/null` for each `.tgz`.  
4. **DB dump:** `pg_restore -l backup.dump >/dev/null` (list TOC) for `-Fc` format.  
5. **Count check:** file count inside `ui.tgz` / `docs.tgz` within expected band (warn if 0).  
6. Write `STATUS=OK` only if all checks pass; else `STATUS=FAIL`, **do not prune**, alert via log exit code ≠ 0.

---

## 9. Backup manifest format

Per backup set: `MANIFEST.json` (and optional `MANIFEST.sha256` of the json).

Example shape:

```json
{
  "schema_version": 1,
  "backup_type": "daily-full|hourly-db|manual",
  "created_at_utc": "2026-08-05T02:15:01Z",
  "hostname": "vmi3449429",
  "reason": null,
  "status": "OK",
  "retention_class": "daily|hourly|manual",
  "components": [
    {
      "name": "db",
      "path": "db.dump",
      "bytes": 1234567,
      "sha256": "…",
      "method": "pg_dump -Fc"
    },
    {
      "name": "ui",
      "path": "ui.tgz",
      "bytes": 13631488,
      "sha256": "…",
      "source": "/var/www/toolcustody"
    }
  ],
  "disk_free_bytes_after": 98765432100,
  "verify": {
    "tar_tests": "passed",
    "pg_restore_list": "passed"
  }
}
```

Also write marker files:

* `/root/backups/toolcustody/LAST_GOOD_HOURLY` → path to last good hourly set  
* `/root/backups/toolcustody/LAST_GOOD_DAILY` → path to last good daily set  

---

## 10. Restore procedure (high level)

**Always:** take a fresh manual backup of *current* live state before restoring, if disk allows.

### Database only

```bash
# example — exact flags finalized at implementation time
sudo -u postgres pg_restore --clean --if-exists -d toolcustody /path/to/db.dump
```

Requires owner approval; may briefly lock tables — schedule maintenance window.

### Frontend

```bash
# stop nothing required for static files; optional brief maintenance
tar xzf ui.tgz -C /var/www
# ensure ownership www-data as currently used
```

### Backend

```bash
tar xzf api.tgz -C /opt
# then ONLY if approved: systemctl restart toolcustody-api
```

### Docs

```bash
tar xzf docs.tgz -C /opt
```

### Nginx / SSL / systemd / cron

Restore files to original paths; then (only if approved) `nginx -t && systemctl reload nginx`, `systemctl daemon-reload`, etc.

---

## 11. Rollback procedure (after a bad change)

1. Identify last good set: `LAST_GOOD_DAILY` or a `manual/prechange-*` set.  
2. Prefer restoring **only the component that broke** (UI vs API vs DB).  
3. Verify app health: `/health`, login, one read action.  
4. If DB restore needed: maintenance window + owner approval.  
5. Document outcome in `/opt/toolcustody-docs/SESSION_LOGS/` and `CHANGELOG.md` after the fact.

---

## 12. Retention policy (as requested)

| Class | Keep | Prune rule |
|-------|------|------------|
| Hourly DB | **Latest 6 successful** | Delete older hourly only after new hourly `STATUS=OK` |
| Daily full | **Latest 7 successful** | Delete older daily only after new daily `STATUS=OK` |
| Manual / pre-change | Keep until operator deletes (v1); optional “keep 10 manuals” later | **No auto-delete** in v1 unless approved |

Failed backups are **kept for diagnosis** (cap optional: last 3 fails) and **never** counted as “successful” for pruning.

---

## 13. Disk space estimation

| Item | Approx size each | Worst-case retained |
|------|------------------|---------------------|
| Hourly DB | ~5–20 MB compressed | 6 × ~20 MB ≈ **120 MB** |
| Daily full | UI 13M + API 26M + docs 0.5M + DB 15M + config/ssl <5M ≈ **~60 MB** compressed (gzip) | 7 × ~60 MB ≈ **420 MB** |
| Manual (assume 3) | ~60 MB each | ~180 MB |
| **Total ballpark** | | **≪ 1 GB** |

Vs **~92 GB free** → negligible risk. Still check `df` before each job; abort if free < **2 GB** (safety floor).

---

## 14. Failure handling

| Failure | Behavior |
|---------|----------|
| `pg_dump` fails | Exit non-zero; no prune; log error; leave previous LAST_GOOD_* unchanged |
| Disk below floor | Abort before writing |
| Corrupt tarball on verify | Mark FAIL; move set to `…/failed/` or leave with `STATUS=FAIL`; no prune |
| Overlapping jobs | `flock` — second job exits 0/1 with “locked” message |
| Partial write | Write to `*.tmp` directory, rename to final name only after verify OK |

No email/Slack in v1 unless owner requests; rely on cron exit codes + log files. Optional later: write `/opt/toolcustody-docs/BACKUP_STATUS.md` snapshot for humans.

---

## 15. Implementation phases (after this plan is approved)

| Step | Work | Risk |
|------|------|------|
| B1 | Create dirs + install scripts under `/opt/toolcustody-backup` (no cron yet) | Low |
| B2 | Dry-run manual full backup + verify + restore drill on a **copy** path (not overwriting live) | Low–medium |
| B3 | Enable hourly cron only | Low |
| B4 | Enable daily cron | Low |
| B5 | Update `/opt/toolcustody-docs` (`BACKUP_SYSTEM.md`, CHANGELOG, SESSION_LOG) + resync knowledge | Docs only |

Each step needs explicit “go” if you want gated execution.

---

## 16. Explicit non-goals (this document)

* Creating scripts now  
* Installing cron now  
* Modifying production app/DB/nginx  
* Restarting services  
* Offsite replication  

---

## 17. Approval gate

Reply example to proceed with **script creation only (B1)** or **full B1–B4**:

* «وافق على B1 فقط»  
* or «وافق على تنفيذ نظام الـ Backup حسب BACKUP_IMPLEMENTATION_PLAN.md»

Until then: **no implementation.**
