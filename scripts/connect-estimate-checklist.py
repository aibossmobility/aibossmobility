from pathlib import Path
import re,html,json
root=Path(__file__).resolve().parent.parent/"public"
offers=json.loads((root/"estimate-offers.json").read_text())["offers"]
projects=[x for x in offers if x["kind"]=="project"]
course=[x for x in offers if x["kind"]=="course"]
catalog={x["id"]:x for x in offers}
p=root/"consulting-services.html"
t=p.read_text()
changes=[]
def change_card(m):
    card=m.group(0)
    num=re.search(r"Service (\d{2}) / 12",card)
    if not num:return card
    id="service-"+num.group(1)
    offer=catalog[id]
    newurl="/estimate-checklist?offer="+id
    card,n=re.subn(r'<a class="cta"[^>]*>.*?</a>',
                   f'<a class="cta" href="{newurl}">Start my estimate checklist</a>',card,count=1,flags=re.S)
    if n!=1:raise RuntimeError(f"Missing CTA in {id}")
    if id=="service-01":
        card=re.sub(r'<p class="checkout-note">.*?</p>','',card,count=1,flags=re.S)
    cents=offer["priceCents"]
    deposit=(cents+1)//2;balance=cents-deposit
    def money(n):return "$"+f"{n/100:,.2f}"
    note=f'<p class="checkout-note"><strong>Estimate first:</strong> Signed agreement, then {money(deposit)} (50% deposit). The {money(balance)} balance is invoiced after agreed completion and acceptance. This page does not charge you.</p>'
    card=card.replace("</article>",note+"</article>",1)
    changes.append(id)
    return card
t=re.sub(r'<article class="package".*?</article>',change_card,t,flags=re.S)
assert len(changes)==12,changes
t=t.replace('Five fixed-price, defined-scope packages. Choose what you need, see the included deliverables, and save your project brief directly.','Five defined-scope packages. Every request starts with the estimate checklist and a signed agreement. Pay only 50% upfront after signing; the other 50% is invoiced after agreed completion and acceptance.')
t=t.replace('<section class="notice process"><h2>How your project moves forward</h2>', '<section class="notice process"><h2>How your project moves forward</h2><p><strong>Every service 01–12:</strong> Choose the project, complete the estimate checklist, sign the written agreement, pay the 50% deposit, review the finished deliverables, and then pay the final 50% invoice. No charge occurs from a website inquiry.</p>')
p.write_text(t)
# Audience pages have three links each and must preselect the same service in the canonical checklist.
codes={"ai.feasibility.readiness":"service-08","ai.strategy.planning":"service-09",
       "ai.workflow.automation":"service-10","ai.cost.benefit.roi":"service-11",
       "ai.leadership.education":"service-12"}
for name in ["for-business-owners.html","for-churches-and-nonprofits.html","for-educators-and-workforce.html"]:
 p=root/name;t=p.read_text()
 for code,id in codes.items():
    t=t.replace("/start-project?service="+code,"/estimate-checklist?offer="+id)
 t=t.replace("Select service and save my brief","Start estimate checklist")
 t=t.replace("save your project brief","complete the estimate checklist")
 t=t.replace("save your organization's project brief","complete your organization's estimate checklist")
 p.write_text(t)
# Digital courses: ten prelaunch course tiles and four bundles + academy. No payments launched.
p=root/"digital-courses.html";t=p.read_text()
numbers=[]
def course_card(m):
 card=m.group(0)
 number=re.search(r"Course (\d{2}) ·",card)
 if not number:return card
 id=f"course-{number.group(1)}-complete"
 assert id in catalog
 numbers.append(number.group(1))
 label=f'<p><a class="button" href="/estimate-checklist?offer={id}">Request this course estimate (no payment yet)</a></p>'
 return card.replace("</article>",label+"</article>",1)
t=re.sub(r'<article class="card".*?</article>',course_card,t,flags=re.S)
assert len(numbers)==10,numbers
bundle_ids=["bundle-ai-essentials","bundle-practical-operations","bundle-community-leadership","bundle-service-launch","academy-bundle"]
k=0
def bundle_card(m):
 global k
 card=m.group(0)
 if "<h3>" not in card:return card
 if k>=len(bundle_ids):return card
 id=bundle_ids[k];k+=1
 return card.replace("</article>",f'<p><a class="button" href="/estimate-checklist?offer={id}">Request bundle estimate (no payment yet)</a></p></article>',1)
t=re.sub(r'<article class="bundle-card[^"]*".*?</article>',bundle_card,t,flags=re.S)
assert k==5,k
t=t.replace("Preview only: purchases and enrollment are not available yet.","Pre-launch: enrollment and payment are not available yet. You can complete the estimate checklist to express interest; signing/payment follow only when the required course materials and access are ready.")
t=t.replace("Pre-launch preview: Courses are listed below but enrollment is not open.","Pre-launch preview: choose a course and complete its estimate checklist. Enrollment and payment remain closed until files and access have been verified.")
p.write_text(t)
# Existing project URL remains usable for legacy private status links; all new customers start the estimate checklist.
p=root/"start-project.html";t=p.read_text()
head='''<script>
(function(){
 if(location.hash.startsWith("#track="))return;
 const old=new URLSearchParams(location.search).get("service");
 const mapped={"ai.feasibility.readiness":"service-08","ai.strategy.planning":"service-09","ai.workflow.automation":"service-10","ai.cost.benefit.roi":"service-11","ai.leadership.education":"service-12"};
 location.replace("/estimate-checklist"+(mapped[old]?"?offer="+encodeURIComponent(mapped[old]):""));
})();
</script>
'''
assert '</head>' in t
t=t.replace('</head>',head+'</head>',1)
p.write_text(t)
# New guided intake visible in the main navigation and directory.
for name in ["index.html","site-directory.html"]:
 p=root/name;t=p.read_text()
 if name=="index.html":
    t=t.replace('href="/explore#estimate"','href="/estimate-checklist"')
    t=t.replace('<a href="#choose">Your Journey</a>','<a href="/estimate-checklist">Request Estimate</a><a href="#choose">Your Journey</a>')
 else:
    t=t.replace('<div class="card"><h2>Services & Guidance</h2>', '<div class="card"><h2>Estimate Checklist</h2><p><a href="/estimate-checklist">Projects and courses: signed agreement, 50% deposit, 50% final invoice</a></p></div>\n<div class="card"><h2>Services & Guidance</h2>')
 p.write_text(t)
p=root/"llms.txt";t=p.read_text()
if "/estimate-checklist" not in t:
 t=t.replace("Key public pages:\n","Key public pages:\n- https://ai.bossmobilelifecoach.com/estimate-checklist\n")
 p.write_text(t)
p=root/"sitemap.xml";t=p.read_text()
if "/estimate-checklist" not in t:
 t=t.replace("</urlset>",'  <url><loc>https://ai.bossmobilelifecoach.com/estimate-checklist</loc><changefreq>monthly</changefreq><priority>0.95</priority></url>\n</urlset>')
 p.write_text(t)
print("Routed",len(changes),"services,",len(numbers),"courses,",k,"bundles through the estimate checklist.")
