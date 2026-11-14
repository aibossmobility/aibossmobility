from pathlib import Path
import re
root=Path(__file__).resolve().parent.parent/"public"
p=root/"consulting-services.html";s=p.read_text()
old=re.search(r'<section class="notice approval">.*?</section>',s,re.S)
assert old
new='''<section class="notice approval">
<h2>One estimate process for all 12 consulting services</h2>
<p>Choose a service and submit its requirements through the estimate checklist. A written scope and full price must be accepted and signed before any deposit is requested. Only 50% is due upfront; the other 50% is invoiced when the agreed work is finished and accepted.</p>
<p><strong>Online full-price checkout is intentionally disabled.</strong> Payments are handled through the correct GoHighLevel invoice after the written agreement. A submitted checklist is not an authorization to charge. A separate Clarity Session is optional, not a prerequisite for services 08–12.</p>
<p><a class="cta" href="/estimate-checklist">Open the estimate checklist</a></p>
</section>'''
s=s[:old.start()]+new+s[old.end():]
old=re.search(r'<section class="notice process">.*?</section>',s,re.S)
assert old
new='''<section class="notice process">
<h2>How every project moves forward</h2>
<ol>
<li>Choose the consulting service and complete its <a href="/estimate-checklist">estimate checklist</a>.</li>
<li>Receive the written estimate and service agreement covering scope, timeline, acceptance tests, total amount, and outside fees.</li>
<li>Sign or approve the agreed documents. Then receive the secure GoHighLevel invoice for the 50% deposit.</li>
<li>Once the deposit is verified, the approved project may begin. We produce, test, and review the agreed deliverables.</li>
<li>After the agreed work is completed and accepted, the remaining 50% is invoiced. No repeat deposit or automatic full-price charge is permitted.</li>
</ol>
<p>A purchase is not complete merely because a form was submitted or a payment page opened. If you have a question, <a href="/purchase-help">contact service help</a>.</p>
<a class="cta" href="/estimate-checklist">Start my estimate checklist</a>
</section>'''
s=s[:old.start()]+new+s[old.end():]
p.write_text(s)
p=root/"explore.html";s=p.read_text()
old=re.search(r'<section id="estimate" class="compact-section" aria-labelledby="estimate-heading">.*?<div class="boundary"',s,re.S)
assert old
new='''<section id="estimate" class="compact-section" aria-labelledby="estimate-heading">
<div class="container"><div class="eyebrow">Your project begins with clarity</div>
<h2 id="estimate-heading">Start with your estimate checklist</h2>
<p>All consulting services and courses begin with the same checklist. You choose the offer, describe what you need, and review the full listed price. We prepare the written estimate and agreement. Once signed, you pay 50% upfront through the matching GoHighLevel invoice. The final 50% is invoiced only after agreed completion and acceptance.</p>
<p><a class="btn btn-primary" href="/estimate-checklist">Complete my estimate checklist</a></p>
<p>A Clarity Session is an optional $149 service, not a required purchase before choosing another project. Its deposit is $74.50 after signing, with $74.50 invoiced after the agreed session and recap are completed.</p>
<p><a href="/consulting-delivery-guide">See how projects are reviewed and delivered</a>.</p>
<div class="boundary"'''
s=s[:old.start()]+new+s[old.end():]
s=s.replace('aria-label="Request written estimate"','aria-label="General question about an offer"')
s=s.replace('<h2 id="estimate-heading">Tell us what you would love to create</h2>','<h2 id="estimate-heading">Start your estimate checklist</h2>')
# Legacy freeform questions remain available; no bypass to invoices.
p.write_text(s)
p=root/"consulting-delivery-guide.html";s=p.read_text()
s=s.replace('After you approve and sign the written agreement, 50% is due before work begins; the remaining 50% is due upon completion, before final delivery, unless the agreement says otherwise.',
            'After you accept and sign the written estimate and service agreement, the initial 50% deposit is due before work starts. Once the agreed work is completed and accepted, the remaining 50% is invoiced. Any outside costs or scope changes need separate written approval.')
s=s.replace('href="/explore#estimate"','href="/estimate-checklist"')
p.write_text(s)
p=root/"monthly-website-support.html";s=p.read_text()
needle='<p>Building the website is separate from hosting and monthly care.'
assert needle in s
s=s.replace(needle,'<p><a href="/estimate-checklist?offer=service-03"><strong>Request a website-project estimate using the standard checklist</strong></a>. The project deposit is 50% after the signed agreement; the remaining balance is invoiced after accepted completion. Monthly care is quoted and authorized separately as recurring support, not automatically treated as a two-installment project.</p>\n'+needle)
p.write_text(s)
for name in ["for-business-owners.html","for-churches-and-nonprofits.html","for-educators-and-workforce.html"]:
 p=root/name;s=p.read_text()
 needle='<h2>Ready to describe your project?</h2>'
 assert needle in s
 s=s.replace(needle,needle+'<p><strong>One standard estimate checklist:</strong> choose your service, sign the written scope, pay 50% upfront, then receive the final 50% invoice after completed and accepted work.</p>')
 p.write_text(s)
p=root/"start-project.html";s=p.read_text()
# The old status link is preserved; everyone else is redirected to the unified quote workflow.
s=s.replace('You can choose a predefined package, see what is included, and save the details of your project without waiting for Brian to approve your request.',
            'The estimate checklist now applies to every AI Boss Mobility service and course. Existing private status links are preserved here.')
p.write_text(s)
print("Aligned site copy and all project entry points to the written estimate, signed agreement, 50/50 invoicing policy.")
