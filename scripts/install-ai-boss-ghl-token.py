#!/usr/bin/env python3
"""One-time local secret installation. The owner types/pastes the GHL PIT into the
Mac Terminal, not this chat, GitHub, Railway, a webpage, or a process argument.

Usage: python3 ~/.ai-boss-os/bin/install-ai-boss-ghl-token.py --install
"""
from __future__ import annotations
import getpass
import json
import os
from pathlib import Path
import stat
import sys

TARGET = Path.home() / ".config/papa-life-os/ai-boss-ghl-readonly.token"
def check_existing():
    if not TARGET.exists():
        return False
    s=TARGET.lstat()
    if not stat.S_ISREG(s.st_mode) or s.st_uid!=os.getuid() or s.st_mode & 0o077:
        raise RuntimeError("Existing CRM credential has unsafe permissions. Refusing to overwrite.")
    return True

def main():
    if sys.platform!="darwin":
        raise RuntimeError("Only available on the owner's Mac mini.")
    if sys.argv[1:] == ["--status"]:
        print(json.dumps({"installed":check_existing(),"path":"private local Mac file","value_disclosed":False}))
        return
    if sys.argv[1:] != ["--install"]:
        raise RuntimeError("Run with --install on the Mac to enter the token privately.")
    if check_existing():
        raise RuntimeError("Read-only CRM credential already exists. Refusing to replace.")
    print("GoHighLevel AI Boss sub-account only. Confirm the integration has exactly")
    print("contacts.readonly, opportunities.readonly, conversations.readonly before proceeding.")
    print("The secret is not shown, sent, logged, or copied from your clipboard.")
    value=getpass.getpass("Paste the Private Integration Token (input hidden): ").strip()
    if not 40<=len(value)<=4096 or any(c.isspace() for c in value):
        raise RuntimeError("Invalid token format. Nothing was saved.")
    TARGET.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
    old=os.umask(0o077)
    try:
        fd=os.open(str(TARGET), os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
        with os.fdopen(fd,"w") as out:
            out.write(value+"\n")
    finally:
        os.umask(old)
    print(json.dumps({"installed":True,"permissions":"0600","token_disclosed":False,
                      "scope":"AI Boss Mobility sub-account only","api_read_not_yet_verified":True}))

if __name__=="__main__":
    try:main()
    except (EOFError,KeyboardInterrupt):
        print("No credential installed.",file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Do not print arbitrary exception content that might include a credential.
        print("Secure installation could not be completed. No token value was printed.",file=sys.stderr)
        sys.exit(1)
