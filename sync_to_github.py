#!/usr/bin/env python3
"""Push project web files to GitHub. Usage: python sync_to_github.py \"commit message\""""

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# ملفات تُرفع على GitHub Pages — بدون secrets
TRACKED = [
    "login.html",
    "index.html",
    "results.html",
    "dashboard.html",
    "worker.html",
    "tool.html",
    "damage.html",
    "config.js",
    "parser.js",
    "app.css",
    "ui.js",
    "scan.js",
    "manifest.json",
    "sw.js",
    "icons/icon.svg",
    ".gitignore",
    "Code.gs.example",
    "TODO.md",
]


def run(cmd, check=True):
    print("+", " ".join(cmd))
    return subprocess.run(cmd, cwd=ROOT, check=check)


def main():
    if not (ROOT / ".git").exists():
        print("Initializing git repo...")
        run(["git", "init"])

    run(["git", "add", *TRACKED])

    msg = " ".join(sys.argv[1:]).strip() if len(sys.argv) > 1 else "Update Store QR Scanning"
    commit = run(["git", "commit", "-m", msg], check=False)
    if commit.returncode != 0:
        print("Nothing to commit (or commit failed).")
    else:
        print("Committed:", msg)

    push = run(["git", "push"], check=False)
    if push.returncode != 0:
        print("\nPush failed. First time? Run:")
        print('  git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git')
        print('  git branch -M main')
        print('  git push -u origin main')
        sys.exit(1)

    print("Done — GitHub updated.")


if __name__ == "__main__":
    main()
