#!/usr/bin/env python3
from pathlib import Path

p = Path("/opt/toolcustody-api/src/server.js")
s = p.read_text()
changed = False

if 'require("./handlers/wedding")' not in s:
    needle = 'const timesheetFeatures = require("./handlers/timesheet_features");'
    if needle not in s:
        raise SystemExit("require needle missing")
    s = s.replace(
        needle,
        needle + '\nconst wedding = require("./handlers/wedding");',
        1,
    )
    changed = True

if "weddingRsvpStats" not in s:
    needle = "  timesheetNotificationsMarkRead: timesheetFeatures.timesheetNotificationsMarkRead,\n};"
    if needle not in s:
        raise SystemExit("ACTIONS needle missing")
    s = s.replace(
        needle,
        "  timesheetNotificationsMarkRead: timesheetFeatures.timesheetNotificationsMarkRead,\n"
        "  /* wedding invite demo (public) */\n"
        "  weddingRsvpStats: wedding.weddingRsvpStats,\n"
        "  weddingRsvpSubmit: wedding.weddingRsvpSubmit,\n"
        "};",
        1,
    )
    changed = True

old_pub = 'const PUBLIC_ACTIONS = new Set(["login", "registerUser", "options"]);'
new_pub = 'const PUBLIC_ACTIONS = new Set(["login", "registerUser", "options", "weddingRsvpStats", "weddingRsvpSubmit"]);'
if old_pub in s:
    s = s.replace(old_pub, new_pub, 1)
    changed = True
elif "weddingRsvpSubmit" not in s:
    raise SystemExit("PUBLIC_ACTIONS patch failed")

backup = Path("/opt/toolcustody-api/src/server.js.bak-wedding")
if not backup.exists():
    backup.write_text(Path("/opt/toolcustody-api/src/server.js").read_text())

if changed:
    p.write_text(s)
    print("patched server.js")
else:
    print("already patched")

store = Path("/var/www/toolcustody/assets/wedding/rsvp.json")
if not store.exists():
    store.write_text('{\n  "responses": []\n}\n')
    print("created rsvp.json")
print("done")
