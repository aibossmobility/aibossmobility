#!/usr/bin/env python3
"""Read only visible GoHighLevel aggregate labels in Brian's Chrome 3 session.
This does not read contacts, phone numbers, opportunities, API tokens or cookies.
Automated mode opens a temporary window only if the Mac has been idle > 5 min.
"""
from __future__ import annotations
import json
import re
import subprocess
import sys
import time

LOCATION = "qJ83IIaK5y2ZPHzLfGG1"
BASE = "https://app.gohighlevel.com/v2/location/" + LOCATION + "/"

def idle_seconds():
    try:
        result=subprocess.run(["ioreg","-c","IOHIDSystem"],capture_output=True,text=True,timeout=7)
        found=re.search(r'"HIDIdleTime"\s*=\s*(\d+)',result.stdout)
        return int(found.group(1))/1000000000 if found else None
    except Exception:
        return None

def osa(script):
    result=subprocess.run(["osascript"],input=script,text=True,capture_output=True,timeout=17)
    if result.returncode:
        raise RuntimeError("Authorized Chrome 3 read-only UI unavailable")
    return result.stdout.strip()

def view_json(window_id):
    js='JSON.stringify({path:location.pathname,origin:location.origin,body:(document.body?.innerText||"").slice(0,18000)})'
    command='tell application "Google Chrome 3"\nset w to first window whose id is '+window_id+'\nreturn execute active tab of w javascript '+json.dumps(js)+'\nend tell\n'
    return json.loads(osa(command) or "{}")

def inspect(window_id,section):
    osa('tell application "Google Chrome 3"\nset w to first window whose id is '+window_id+
        '\nset URL of active tab of w to '+json.dumps(BASE+section)+'\nend tell\n')
    previous={}
    for _ in range(10):
        time.sleep(1.1)
        try: data=view_json(window_id)
        except (ValueError,RuntimeError):continue
        body=data.get("body","")
        if (data.get("origin")!="https://app.gohighlevel.com" or
            not str(data.get("path","")).lower().startswith("/v2/location/"+LOCATION.lower()+"/")):
            continue
        if re.search(r"sign in to your account|access denied|you do not have permission",body,re.I):
            raise RuntimeError("GoHighLevel session requires attention")
        previous=data
        if len(body)>450 and re.search(r"Contacts" if section.startswith("contacts") else r"Opportunities",body):
            return data
    if not previous:raise RuntimeError("GoHighLevel read-only view unavailable")
    return previous

def collect():
    window_id=osa('tell application "Google Chrome 3"\nset w to make new window\nreturn id of w\nend tell\n')
    if not re.fullmatch(r"\d+",window_id):
        raise RuntimeError("Temporary Chrome 3 UI window could not be created")
    try:
        contacts=inspect(window_id,"contacts/smart_list/All")
        opportunities=inspect(window_id,"opportunities/list")
        text1=contacts.get("body","")
        text2=opportunities.get("body","")
        match=re.search(r"\b(\d{1,7})\s+Contacts\b",text1,re.I)
        if not match:raise RuntimeError("Visible contacts count not available; no figure guessed")
        opportunities_match=re.search(r"\b(\d{1,7})\s+opportunities\b",text2,re.I)
        # The count is of the currently filtered opportunity list, never total CRM deals.
        filtered = bool(re.search(r"Advanced filters\s*\(\s*[1-9]\d*\s*\)|Clear filters|current filters",text2,re.I))
        return {
            "location_id":LOCATION,"crm_scope":"read_only_chrome_ui",
            "contacts_visible_count":int(match.group(1)),
            "opportunities_filtered_count":int(opportunities_match.group(1)) if opportunities_match else None,
            "opportunities_filter_applied":filtered,
            "pipeline_label":next((p for p in ["Marketing Pipeline","Client Estimates","AI Boss Mobility"]
                if p in text2),""),
        }
    finally:
        try:osa('tell application "Google Chrome 3"\nclose (first window whose id is '+window_id+')\nend tell\n')
        except Exception:pass

def main():
    if sys.platform != "darwin":raise RuntimeError("Mac mini only")
    if sys.argv[1:] == ["--idle"]:
        seconds=idle_seconds()
        if seconds is None or seconds < 300:
            print(json.dumps({"status":"skipped_mac_active"}))
            return
    elif sys.argv[1:] != ["--run"]:
        raise RuntimeError("Specify --run (explicit) or --idle (no-interruption scheduled)")
    report=collect()
    print(json.dumps(report,separators=(",",":")))

if __name__=="__main__":
    try:main()
    except Exception as e:
        print(json.dumps({"status":"unavailable","reason":str(e)[:95]}))
        sys.exit(1)
