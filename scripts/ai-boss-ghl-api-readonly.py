#!/usr/bin/env python3
"""Read-only AI Boss Mobility GoHighLevel V3 aggregate totals.

Never prints, stores, or forwards contacts, conversations, message bodies, opportunity
records, private integration credentials, phone numbers, email addresses or tokens.
Requires a user-installed private integration credential on Brian's Mac mini.

Exactly one permitted GHL location:
    AI Boss Mobility — qJ83IIaK5y2ZPHzLfGG1
No GHL writes, text messages, customer notifications or cloud token exposure.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import stat
import sys
import urllib.error
import urllib.parse
import urllib.request

LOCATION = "qJ83IIaK5y2ZPHzLfGG1"
BASE = "https://services.leadconnectorhq.com"
TOKEN_FILE = Path.home()/".config/papa-life-os/ai-boss-ghl-readonly.token"
HEADERS = {"Accept":"application/json", "Content-Type":"application/json",
           "Version":"v3", "User-Agent":"AI-Boss-Mac-ReadOnly-Reporting/1.0"}
MAX_BODY = 100000

def private_token(file:Path=TOKEN_FILE):
    st=file.lstat()
    if not stat.S_ISREG(st.st_mode) or st.st_uid != os.getuid() or st.st_mode & 0o077:
        raise RuntimeError("AI Boss GHL credential must be a regular Mac-owner-only 0600 file")
    value=file.read_text().strip()
    if len(value)<40 or len(value)>4096 or any(ch.isspace() for ch in value):
        raise RuntimeError("AI Boss GHL credential has not been securely installed")
    return value

def get_json(path:str, token:str, method:str="GET", body:dict|None=None):
    if not path.startswith("/") or "://" in path or method not in ("GET","POST"):
        raise RuntimeError("Refusing unexpected CRM endpoint")
    allowed={"/contacts/search/count","/opportunities/search","/conversations/search"}
    if path.split("?")[0] not in allowed:
        raise RuntimeError("Endpoint is not in AI Boss CRM read-only allowlist")
    if method=="POST" and path!="/contacts/search/count":
        raise RuntimeError("Only read-only count query may use POST")
    data=json.dumps(body).encode() if body is not None else None
    headers={**HEADERS,"Authorization":"Bearer "+token}
    request=urllib.request.Request(BASE+path, data=data,headers=headers,method=method)
    # Do not silently follow a redirect to a different host with the credential.
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*_args):return None
    opener=urllib.request.build_opener(NoRedirect)
    with opener.open(request,timeout=42) as r:
        if r.status!=200:raise RuntimeError("CRM API returned non-success status")
        payload=r.read(MAX_BODY+1)
        if len(payload)>MAX_BODY:raise RuntimeError("CRM aggregate payload too large")
    obj=json.loads(payload)
    if not isinstance(obj,dict):raise RuntimeError("CRM API aggregate response not an object")
    return obj

def checked_count(value):
    if isinstance(value,bool) or not isinstance(value,int) or not 0<=value<=10000000:
        return None
    return value

def read_totals(token):
    output={"location_id":LOCATION,"scope":"subaccount_readonly",
            "contacts_count":None,"opportunities_count":None,"conversations_count":None}
    failures=[]
    try:
        obj=get_json("/contacts/search/count",token,"POST",{"locationId":LOCATION})
        output["contacts_count"]=checked_count(obj.get("count"))
        if output["contacts_count"] is None:failures.append("contacts_count_pending")
    except Exception as e:
        failures.append("contacts_count_unavailable_"+str(getattr(e,"code","")).strip())
    try:
        params=urllib.parse.urlencode({"locationId":LOCATION,"status":"all","limit":"1","page":"1"})
        obj=get_json("/opportunities/search?"+params,token)
        meta=obj.get("meta",{})
        if not isinstance(meta,dict):meta={}
        output["opportunities_count"]=next((x for x in
          [checked_count(meta.get("total")),checked_count(meta.get("totalCount")),
           checked_count(meta.get("totalRecords"))] if x is not None),None)
        if output["opportunities_count"] is None:failures.append("opportunities_total_unsupported")
    except Exception as e:
        failures.append("opportunities_count_unavailable_"+str(getattr(e,"code","")).strip())
    try:
        params=urllib.parse.urlencode({"locationId":LOCATION,"limit":"1"})
        obj=get_json("/conversations/search?"+params,token)
        output["conversations_count"]=checked_count(obj.get("total"))
        if output["conversations_count"] is None:failures.append("conversations_total_unsupported")
    except Exception as e:
        failures.append("conversations_count_unavailable_"+str(getattr(e,"code","")).strip())
    return output,failures

def main():
    if sys.platform!="darwin" or sys.argv[1:]!=["--read-only"]:
        raise RuntimeError("Only Mac mini --read-only reporting is permitted")
    token=private_token()
    summary,failures=read_totals(token)
    # Aggregate counts only. Never output token, raw response or customer records.
    print(json.dumps({"ok":any(summary[k] is not None for k in (
        "contacts_count","opportunities_count","conversations_count")),
        "summary":summary,"unavailable_metrics":failures},separators=(",",":")))

if __name__=="__main__":
    try:main()
    except FileNotFoundError:
        print(json.dumps({"ok":False,"status":"private_credential_not_installed"}))
        sys.exit(2)
    except Exception:
        print(json.dumps({"ok":False,"status":"read_only_crm_api_unavailable"}))
        sys.exit(1)
