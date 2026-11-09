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
import subprocess
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

# Read-only: the Mac calls its established private Gmail and Workspace connector endpoints.
GMAIL_ENV=ROOT / "secrets/gmail.env"
WORKSPACE_TOKEN=ROOT / "secrets/google-workspace-connector.token"

GHL_BROWSER_READONLY=ROOT / "bin/ai-boss-ghl-chrome-readonly.py"
GHL_LAST_ACK=ROOT / "reports/ai-boss-ghl-readonly-last-ack.json"

GHL_API_READER=ROOT / "bin/ai-boss-ghl-api-readonly.py"
GHL_API_TOKEN=HOME / ".config/papa-life-os/ai-boss-ghl-readonly.token"
GHL_API_LAST_ACK=ROOT / "reports/ai-boss-ghl-api-last-ack.json"

def ghl_api_daily(site_token):
    """When a proper user-installed private credential exists, send only API counts."""
    now=dt.datetime.now(PACIFIC)
    today=now.date().isoformat()
    if not GHL_API_TOKEN.is_file():
        return {"status":"awaiting_private_credential"}
    if not GHL_API_READER.is_file():
        return {"status":"api_reader_unavailable"}
    try:
        cmd=["/usr/bin/python3",str(GHL_API_READER),"--read-only"]
        result=subprocess.run(cmd,capture_output=True,text=True,timeout=135)
        if result.returncode: return {"status":"api_read_unavailable"}
        body=json.loads(result.stdout or "{}")
        totals=body.get("summary")
        if not body.get("ok") or not isinstance(totals,dict):
            return {"status":"api_read_unavailable"}
        fields={"location_id","scope","contacts_count","opportunities_count","conversations_count"}
        if set(totals)!=fields or totals.get("scope")!="subaccount_readonly" or totals.get("location_id")!="qJ83IIaK5y2ZPHzLfGG1":
            return {"status":"api_response_unverified"}
        event={
            "brand":"ai_boss_mobility","kind":"ghl_api_snapshot",
            "source_ref":"ghl-api:"+today,
            "observed_at":now.isoformat(),"date":today,
            **totals
        }
        receipt=send(event,site_token)
        if not (receipt.get("accepted") or receipt.get("duplicate")):
            return {"status":"api_delivery_unconfirmed"}
        GHL_API_LAST_ACK.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        GHL_API_LAST_ACK.write_text(json.dumps({"date":today,"acknowledged":True})+"\n")
        GHL_API_LAST_ACK.chmod(0o600)
        return {"status":"verified","metrics_available":sum(isinstance(totals[k],int)
            for k in ("contacts_count","opportunities_count","conversations_count"))}
    except Exception:
        # No API endpoint data, token or contact details in logs.
        return {"status":"api_read_unavailable"}

def ghl_browser_daily(token,force=False):
    today=dt.datetime.now(PACIFIC).date().isoformat()
    if not force and GHL_LAST_ACK.is_file():
        try:
            last=json.loads(GHL_LAST_ACK.read_text())
            if last.get("date")==today:
                return {"status":"already_verified_today"}
        except (ValueError,OSError):
            pass
    if not GHL_BROWSER_READONLY.is_file():
        return {"status":"reader_unavailable"}
    try:
        result=subprocess.run(
            ["/usr/bin/python3",str(GHL_BROWSER_READONLY),"--run" if force else "--idle"],
            capture_output=True,text=True,timeout=65
        )
        obj=json.loads(result.stdout or "{}")
        if obj.get("status")=="skipped_mac_active":
            return {"status":"waiting_until_mac_idle"}
        if result.returncode or obj.get("crm_scope")!="read_only_chrome_ui":
            return {"status":"crm_ui_not_verified"}
        timestamp=dt.datetime.now(PACIFIC)
        event={
            "brand":"ai_boss_mobility","kind":"ghl_ui_snapshot",
            "source_ref":"ghl-ui:"+today,
            "observed_at":timestamp.isoformat(),"date":today,
            **obj
        }
        receipt=send(event,token)
        if not (receipt.get("accepted") or receipt.get("duplicate")):
            raise RuntimeError("Read-only CRM report not acknowledged")
        GHL_LAST_ACK.parent.mkdir(mode=0o700,parents=True,exist_ok=True)
        GHL_LAST_ACK.write_text(json.dumps({"date":today,"received_ack":True})+"\n")
        GHL_LAST_ACK.chmod(0o600)
        return {"status":"verified","contacts_visible":obj["contacts_visible_count"],
                "opportunities_filtered":obj["opportunities_filtered_count"]}
    except Exception:
        # Never log contact names, CRM page contents or browser credentials.
        return {"status":"crm_ui_not_verified"}

def local_json(url, token, data):
    request=urllib.request.Request(
        url, method="POST",
        headers={"Content-Type":"application/json","Authorization":"Bearer "+token},
        data=json.dumps(data).encode("utf8")
    )
    with urllib.request.urlopen(request, timeout=19) as res:
        if res.status!=200: raise RuntimeError("Local connector rejected read")
        obj=json.load(res)
    if not isinstance(obj,dict) or obj.get("error"): raise RuntimeError("Local connector returned an error")
    return obj

def local_secret_env(path,key):
    # Never log or transfer the secret to the website.
    for line in path.read_text().splitlines():
        if line.startswith(key+"="):
            value=line.split("=",1)[1].strip().strip('"').strip("'")
            if len(value)<16: raise RuntimeError("Local Gmail authorization is unavailable")
            return value
    raise RuntimeError("Local Gmail authorization not configured")

def google_daily_counts(day):
    day_obj=dt.date.fromisoformat(day)
    next_day=(day_obj+dt.timedelta(days=1)).isoformat()
    services={
        "gmail":{"status":"unavailable","count":None,"scan_limit":50,"truncated":False},
        "google_calendar":{"status":"unavailable","count":None,"scan_limit":100,"truncated":False}
    }
    try:
        token=local_secret_env(GMAIL_ENV,"AI_BOSS_GMAIL_CONNECTOR_TOKEN")
        q=f"after:{day.replace('-','/')} before:{next_day.replace('-','/')} {{to:brian@bossmobility.net to:info@bossmobility.net}} -in:spam -in:trash"
        result=local_json("http://127.0.0.1:8788/gmail",token,{
            "operation":"search","target_ref":"query:"+q
        })
        ids=result.get("messages",[])
        if not isinstance(ids,list): raise ValueError("Malformed Gmail metadata response")
        count_=len(ids)
        services["gmail"]={
            "status":"connected","count":count_,"scan_limit":50,
            "truncated":bool(result.get("nextPageToken") or count_>=50 or result.get("resultSizeEstimate",0)>50)
        }
    except Exception:
        # Unavailable is never misreported as zero messages.
        print("Gmail matching count unavailable; no private content logged",file=sys.stderr)

    try:
        token=WORKSPACE_TOKEN.read_text().strip()
        start=dt.datetime.combine(day_obj,dt.time.min,PACIFIC)
        end=dt.datetime.combine(day_obj+dt.timedelta(days=1),dt.time.min,PACIFIC)
        result=local_json("http://127.0.0.1:8790/workspace",token,{
            "system":"calendar","operation":"search","target_ref":"query:",
            "start_at":start.isoformat(),"end_at":end.isoformat(),"max_results":100
        })
        events=result.get("items",[])
        if not isinstance(events,list): raise ValueError("Malformed Calendar metadata response")
        matched=sum(1 for item in events
            if isinstance(item,dict) and any(word in str(item.get("summary","")).lower()
            for word in ("ai boss","boss mobility","bossmobile")))
        services["google_calendar"]={
            "status":"connected","count":matched,"scan_limit":100,
            "truncated":bool(result.get("nextPageToken") or len(events)>=100)
        }
    except Exception:
        print("Dated AI Boss Calendar count unavailable; no attendee data logged",file=sys.stderr)
    return services

def send_google_counts(day,token):
    now=dt.datetime.now(PACIFIC)
    payload={
        "brand":"ai_boss_mobility","kind":"integration_rollup",
        "source_ref":"mac-google:"+day,
        "observed_at":now.isoformat(),"date":day,
        "services":google_daily_counts(day)
    }
    return send(payload,token)

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
    if sys.argv[1:] not in (["--activate"],["--activate","--backfill"],["--activate","--ghl-now"]):
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
    # Only current-day Google data is called verified. Past calendar/mail activity is
    # not synthesized from future-only event searches or unbounded message queries.
    google_ok=False
    try:
        receipt=send_google_counts(now.isoformat(),token)
        google_ok=bool(receipt.get("accepted") or receipt.get("duplicate"))
    except Exception:
        print("Mac Google daily report could not be delivered",file=sys.stderr)
    crm_api_result=ghl_api_daily(token)
    crm_result={"status":"superseded_by_verified_api"} if crm_api_result["status"]=="verified" else ghl_browser_daily(token,force="--ghl-now" in sys.argv)
    voice_ok,voice_bad=voice_recaps(token)
    print(json.dumps({
        "connector":"mac-mini-desktop-commander","brand":"ai_boss_mobility",
        "worker_days_acknowledged":sent,"worker_days_needing_attention":blocked,
        "approved_voice_recaps_acknowledged":voice_ok,
        "voice_recaps_needing_attention":voice_bad,"google_daily_report_acknowledged":google_ok,"crm_ui_status":crm_result["status"],"crm_api_status":crm_api_result["status"],"customer_messages_sent":0
    }))
    if blocked or voice_bad or not google_ok:
        sys.exit(1)

if __name__=="__main__":
    try:
        main()
    except Exception:
        print("AI Boss Mac relay unavailable; no private details logged", file=sys.stderr)
        sys.exit(1)
