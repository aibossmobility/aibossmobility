from pathlib import Path
import json
root=Path(__file__).resolve().parent.parent / "public"
services=[
("01","AI Clarity Session",14900),("02","AI Quick Start",49500),
("03","Business Starter Launch",75000),("04","Professional Website Launch",125000),
("05","Website + Business Offer & Service Structure",200000),
("06","Website + CRM + Payments + Customer Journey",250000),
("07","Complete Digital Business Setup",350000),
("08","AI Feasibility & Readiness",35000),("09","AI Strategy & Planning",75000),
("10","AI Workflow Automation",125000),("11","AI Cost-Benefit & ROI",45000),
("12","AI Leadership Education",50000)
]
courses=[
"Make Your First B.I.G. IMPACT With AI",
"Ask Better Questions With ChatGPT",
"Make an AI Assistant Work for You",
"Simplify Repetitive Work With AI",
"Create Responsible AI Marketing",
"Serve Customers With AI and Humanity",
"Build a Clear Online Presence",
"Apply AI in Community Organizations",
"Lead With Purpose in the AI Era",
"Launch an AI-Supported Service Idea"]
offers=[]
for number,title,cents in services:
    offers.append({"id":"service-"+number,"kind":"project","number":number,"title":title,
                   "priceCents":cents,"deliveryReady":True,"priceType":"listed fixed scope",
                   "source":"/consulting-services"})
for n,title in enumerate(courses,1):
    for tier,cents,label in [("pdf",499,"Read & Work — PDF + workbook"),
                            ("audio",999,"Read & Listen — PDF + MP3"),
                            ("complete",1499,"Complete Course — PDF, audio + video")]:
        offers.append({"id":f"course-{n:02d}-{tier}","kind":"course","number":f"{n:02d}",
                       "title":title+" | "+label,"priceCents":cents,
                       "deliveryReady":False,"priceType":"pre-launch listed price",
                       "source":"/digital-courses"})
for slug,title in [("ai-essentials","AI Essentials — Courses 01, 02 & 03"),
                   ("practical-operations","Practical Operations — Courses 04, 05 & 06"),
                   ("community-leadership","Community Leadership — Courses 07, 08 & 09"),
                   ("service-launch","Service Launch — Courses 03, 07 & 10")]:
    offers.append({"id":"bundle-"+slug,"kind":"course","number":"BUNDLE","title":title,
                   "priceCents":3499,"deliveryReady":False,"priceType":"pre-launch listed price","source":"/digital-courses"})
offers.append({"id":"academy-bundle","kind":"course","number":"ALL","title":"B.I.G. IMPACT Full Academy Bundle",
               "priceCents":9900,"deliveryReady":False,"priceType":"pre-launch listed price","source":"/digital-courses"})
(root/"estimate-offers.json").write_text(json.dumps({"version":1,"brand":"AI Boss Mobility Consulting","policy":{"depositPercent":50,"finalInvoice":"Upon completion and customer acceptance of agreed deliverables","noPaymentUntilSigned":True},"offers":offers},indent=2)+"\n")
print("Wrote",len(offers),"approved catalog entries")
