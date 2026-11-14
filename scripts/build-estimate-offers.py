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
offers=[]
for number,title,cents in services:
    offers.append({"id":"service-"+number,"kind":"project","number":number,"title":title,
                   "priceCents":cents,"deliveryReady":True,"priceType":"listed fixed scope",
                   "source":"/consulting-services"})
(root/"estimate-offers.json").write_text(json.dumps({"version":1,"brand":"AI Boss Mobility Consulting","scope":"custom consulting and project services only","policy":{"depositPercent":50,"finalInvoice":"Upon completion and customer acceptance of agreed deliverables","noPaymentUntilSigned":True},"offers":offers},indent=2)+"\n")
print("Wrote",len(offers),"approved catalog entries")
