#!/usr/bin/env python3
"""Private Mac mini -> AI Boss Mobility OS daily evidence / approved voice recap sync.

Primary controller: Brian's Mac mini + Desktop Commander. No audio is uploaded.
No message, calendar event, GHL record, payment, or other customer action occurs.
Requires an explicit --activate; --backfill includes up to 90 days of Mac proof.
"""
from __future__ import annotations
import datetime as dt
import json
import os
from pathlib import Path
import re
import shutil
import sqlite3
import stat
import sys
import urllib.error
import urllib.request
from zoneinfo import ZoneInfo

HOME = Path.home()
ROOT = HOME / ".ai-boss-os"
SOURCE = ROOT / "research/worker-proof-sync/worker-proof-outbox.db"
TOKEN = HOME / ".config/papa-life-os/ai-boss-mac-relay.token"
PENDING = ROOT / "ai-boss-voice-outreach/pending"
DELIVERED = ROOT / "ai-boss-voice-outreach/delivered"
ENDPOINT = "https://ai.bossmobilelifecoach.com/api/ai-boss-os/mac-event"
PACIFIC = ZoneInfo("America/Los_Angeles")
MAX_AGE_DAYS = 89

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        return None

def credential():
    meta = TOKEN.lstat()
    if not stat.S_ISREG(meta.st_mode) or (meta.st_mode & 0o077) or meta.st_uid != os.getuid():
        raise RuntimeError("Mac credential must be an owner-only regular file (0600)")
    value = TOKEN.read_text().strip()
    if not 48 <= len(value) <= 256 or any(c.isspace() for c in value):
        raise RuntimeError("Mac credential not configured")
    return value

def send(payload, token):
    request = urllib.request.Request(
        ENDPOINT, method="POST",
        headers={"Authorization": "Bearer " + token, "Content-Type": "application/json", "User-Agent": "AI-Boss-Mac-Relay/1.0"},
        data=json.dumps(payload, separators=(",", ":")).encode(),
    )
    opener = urllib.request.build_opener(NoRedirect)
    with opener.open(request, timeout=15) as response:
        if response.status != 200:
            raise RuntimeError("AI Boss Mac intake did not acknowledge")
        result = json.load(response)
    if not result.get("ok") or not (result.get("accepted") or result.get("duplicate")):
        raise RuntimeError("AI Boss Mac intake returned an unconfirmed result")
    return result

def read_proof():
    if not SOURCE.is_file():
        raise RuntimeError("Existing Mac worker proof outbox is unavailable")
    conn = sqlite3.connect("file:" + str(SOURCE) + "?mode=ro", uri=True)
    try:
        rows = conn.execute("SELECT payload,state FROM outbox").fetchall()
    finally:
        conn.close()
    grouped = {}
    now = dt.datetime.now(PACIFIC).date()
    oldest = now - dt.timedelta(days=MAX_AGE_DAYS)
    for raw, state in rows:
        if state != "accepted":
            continue
        try:
            obj = json.loads(raw)
        except (TypeError, ValueError):
            continue
        if (obj.get("business") != "AI Boss Mobility" or
            obj.get("visibility") != "Internal evidence" or
            obj.get("cost_usd") != 0):
            continue
        try:
            date = dt.date.fromisoformat(str(obj.get("completed_date", ""))[:10])
        except ValueError:
            continue
        if not oldest <= date <= now:
            continue
        item = grouped.setdefault(date.isoformat(), {
            "proof_records": 0, "qa_passed": 0, "qa_pending": 0, "failed": 0
        })
        item["proof_records"] += 1
        status = str(obj.get("status", "")).strip().lower()
        qa = str(obj.get("qa", "")).strip().lower()
        if status == "failed":
            item["failed"] += 1
        elif status == "completed locally" and qa == "passed":
            item["qa_passed"] += 1
        elif status == "completed locally":
            item["qa_pending"] += 1
    grouped.setdefault(now.isoformat(),{
        "proof_records": 0, "qa_passed": 0, "qa_pending": 0, "failed": 0
    })
    return grouped

def report_rollup(day, counts, token):
    date = dt.date.fromisoformat(day)
    now = dt.datetime.now(PACIFIC)
    at = now if date == now.date() else dt.datetime.combine(date, dt.time(12, 0), PACIFIC)
    return send({
        "brand": "ai_boss_mobility", "kind": "worker_rollup",
        "source_ref": "mac-proof:" + day,
        "observed_at": at.isoformat(), "date": day, "metrics": counts,
    }, token)

def voice_recaps(token):
    PENDING.mkdir(mode=0o700, parents=True, exist_ok=True)
    DELIVERED.mkdir(mode=0o700, parents=True, exist_ok=True)
    delivered = 0
    blocked = 0
    for source in sorted(PENDING.iterdir())[:100]:
        if not source.name.endswith(".json") or not re.fullmatch(r"[A-Za-z0-9_.-]{8,128}\.json", source.name):
            blocked += 1
            continue
        try:
            meta = source.lstat()
            if (not stat.S_ISREG(meta.st_mode) or meta.st_uid != os.getuid()
                    or meta.st_size > 13000 or (meta.st_mode & 0o077)):
                raise ValueError("Untrusted recap file")
            item = json.loads(source.read_text())
            if (set(item) != {"source_ref","observed_at","date","note","authorized_to_store"} or
                item.get("authorized_to_store") is not True):
                raise ValueError("Recap not approved for storage")
            body = {"brand": "ai_boss_mobility", "kind": "voice_recap", **item}
            send(body, token)
            source.replace(DELIVERED / source.name)
            delivered += 1
        except Exception:
            # Never print private recap, passwords, contact information, or auth tokens.
            blocked += 1
            print("Mac AI Boss voice recap needs attention (redacted)", file=sys.stderr)
    return delivered, blocked

def main():
    if sys.argv[1:] not in (["--activate"],["--activate","--backfill"]):
        raise RuntimeError("Mac relay disabled without explicit --activate")
    if sys.platform != "darwin":
        raise RuntimeError("Run only on Brian's authorized Mac mini")
    token=credential()
    records=read_proof()
    now=dt.datetime.now(PACIFIC).date()
    dates = sorted(records) if "--backfill" in sys.argv else [
        day for day in sorted(records) if dt.date.fromisoformat(day) >= now-dt.timedelta(days=1)
    ]
    sent=0
    blocked=0
    for day in dates:
        try:
            report_rollup(day, records[day], token)
            sent+=1
        except Exception:
            blocked+=1
            print("Mac worker-proof daily aggregate needs attention (redacted)", file=sys.stderr)
    voice_ok,voice_bad=voice_recaps(token)
    print(json.dumps({
        "connector":"mac-mini-desktop-commander","brand":"ai_boss_mobility",
        "worker_days_acknowledged":sent,"worker_days_needing_attention":blocked,
        "approved_voice_recaps_acknowledged":voice_ok,
        "voice_recaps_needing_attention":voice_bad,"customer_messages_sent":0
    }))
    if blocked or voice_bad:
        sys.exit(1)

if __name__=="__main__":
    try:
        main()
    except Exception:
        print("AI Boss Mac relay unavailable; no private details logged", file=sys.stderr)
        sys.exit(1)
