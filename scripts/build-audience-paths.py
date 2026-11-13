import html
import json
from pathlib import Path
from urllib.parse import quote

root = Path(__file__).resolve().parent.parent / "public"
data = json.loads((Path(__file__).parent / "audience-paths.json").read_text())
host = "https://ai.bossmobilelifecoach.com"

def e(v):
    return html.escape(str(v), quote=True)

for page in data:
    url = "/" + page["slug"]
    qas = "\n".join(
        f'<article class="aud-qa"><h3>{e(q)}</h3><p>{e(a)}</p></article>'
        for q,a in page["faqs"]
    )
    cards = "\n".join(
        f'<article class="aud-card"><span class="aud-kicker">SERVICE {e(num)} / 12</span>'
        f'<h3>{e(name)}</h3><p>Defined scope and deliverables. Review details before submitting.</p>'
        f'<p class="aud-price">{e(price)} fixed-scope estimate</p>'
        f'<a class="aud-btn" href="/start-project?service={quote(code,safe="")}">'
        f'Select service and save my brief</a></article>'
        for num,name,price,code in page["services"]
    )
    other = " ".join(
        f'<a href="/{e(other["slug"])}">{e(other["audience"])} →</a>'
        for other in data if other["slug"] != page["slug"]
    )
    schema = {
        "@context":"https://schema.org","@type":"WebPage",
        "name":page["title"],"description":page["description"],
        "url":host+url,
        "publisher":{"@type":"Organization","name":"AI Boss Mobility Consulting","url":host}
    }
    json_ld = json.dumps(schema,ensure_ascii=False).replace("<","\\u003c")
    markup = f'''<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(page["title"])}</title>
<meta name="description" content="{e(page["description"])}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="{host}{e(url)}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(page["title"])}">
<meta property="og:description" content="{e(page["description"])}">
<link rel="stylesheet" href="/audience-paths.css"><link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script type="application/ld+json">{json_ld}</script>
</head><body class="audience-path">
<a class="aud-skip" href="#main">Skip to main content</a>
<header class="aud-header"><nav class="aud-nav" aria-label="Main navigation">
<a href="/" class="aud-brand"><img src="/images/ai-boss-journey-logo.webp" alt="" width="80" height="63">AI Boss Mobility Consulting</a>
<div class="aud-links"><a href="/">Home</a><a href="/consulting-services">All 12 services</a><a href="/ask-brian">Ask Brian's AI Twin</a></div>
</nav></header>
<main id="main">
<section class="aud-hero"><div class="aud-wrap">
<p class="aud-kicker">WHO WE HELP · {e(page["audience"])}</p>
<h1>{e(page["headline"])}</h1>
<p>{e(page["intro"])}</p>
</div></section>
<div class="aud-main"><div class="aud-wrap">
<div class="aud-note"><strong>Start with your needs:</strong> Explore practical questions and the existing services that may help. No new subscription or paid AI conversation is required to read this guidance.</div>
<section aria-labelledby="questions"><h2 id="questions">Common questions and practical starting points</h2>
{qas}
</section>
<section aria-labelledby="packages" style="margin-top:52px">
<p class="aud-kicker">EXISTING SERVICES</p><h2 id="packages">Choose the outcome you want to work toward</h2>
<p>Choose from the existing fixed-scope consulting services. The form displays verified catalog details before you submit.</p>
<div class="aud-grid">{cards}</div>
</section>
<section class="aud-cta"><h2>Ready to describe your project?</h2>
<p>Browse all twelve existing consulting services or save your project brief for one of packages 08–12. Payments for those five packages have not been activated; submitting a brief does not charge you or begin work.</p>
<a class="aud-btn alt" href="/consulting-services">Compare all consulting services</a>
<a class="aud-btn" href="/start-project" style="margin:8px">Open project brief form</a>
</section></div></div>
<section class="aud-other"><div class="aud-wrap">
<div><strong>Looking for a different kind of organization?</strong><p>Choose the one that fits your work.</p></div>
<div class="aud-other-links">{other}</div>
</div></section>
</main>
<footer class="aud-footer">AI Boss Mobility Consulting · People first. Technology when it helps. · <a href="/privacy">Privacy</a> · <a href="/purchase-help">Service help</a></footer>
</body></html>
'''
    (root / (page["slug"]+".html")).write_text(markup)
print("Generated",len(data),"public audience pages, all canonical to",host)
