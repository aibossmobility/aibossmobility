# AI Boss Mobility OS — Mac-only GHL read-only API activation

## Voice routing
- Primary computer/voice workflow: Brian's Mac mini through Desktop Commander / Papa Life OS.
- Owner-selected HeyGen instant voice: **Brian Keith Hill**, ID `1d5b92d8097541f881d1be4a061b6559`. Verified ACTIVE through connected HeyGen on November 9, 2026.
- The HeyGen selected voice **preview** is locally cached on Mac, and the reader has a corresponding preview button. Playing it does not generate a new response.
- Real speech recap: microphone transcription on reader → owner's explicit Save to AI Boss Mobility → Mac private queue → HTTPS relay → AI Boss owner-only dashboard. No sample / synthetic speech counts as an actual user conversation.
- ElevenLabs not primary and never auto-started. Dynamic HeyGen speech generation is **not enabled** without a documented authorized generation route and budget approval.

## GoHighLevel access
- AI Boss location: `qJ83IIaK5y2ZPHzLfGG1`. Never use Papa Life `BYx4g32AidgEkTBg7nLQ`.
- Private integration has exactly `contacts.readonly`, `opportunities.readonly`, `conversations.readonly` scopes. Browser-issued token must not be stored in chat, GitHub, Railway or browser documents.
- Local token file: `~/.config/papa-life-os/ai-boss-ghl-readonly.token`, owner-only mode `0600`. **Not yet installed** in source work.
- To securely enter the token in the Mac Terminal, the owner runs:
  `python3 ~/.ai-boss-os/bin/install-ai-boss-ghl-token.py --install`
  and pastes the token **into the hidden prompt**. Do not paste it into ChatGPT. Never overwrite a working credential automatically.
- Run a scoped read-only API test: `python3 ~/.ai-boss-os/bin/ai-boss-ghl-api-readonly.py --read-only`. It emits only numeric aggregate counts and unavailable metric codes; never records names or message text.
- Existing five-minute Mac job auto-detects a valid owner-installed token on its next run and submits a `ghl_api_snapshot` containing **only aggregate counts**. If no token is installed or a provider endpoint is unsupported, status remains pending and the proven read-only Chrome snapshot is preserved.
- Source of truth: GoHighLevel current v3 docs for `POST /contacts/search/count`, `GET /opportunities/search`, `GET /conversations/search`; all require sub-account Private Integration and their respective readonly scopes.
- The integration reports zero or a positive count only when read from the relevant endpoint; missing totals display a dash, never a fabricated zero.
- No API endpoint performs writes, calls, messages, financial transactions or contact actions.

## Report trust boundaries
- Contact counts do not establish revenue, customers, calls or appointments.
- GHL conversations are not verified phone conversations.
- Metricool's AI Boss-labeled workspace currently includes Papa Life social profiles; never mix these activities into AI Boss reports without verified accounts.
- Google Messages snapshot is SMS, not a telephone call log; no phone calls are inferred from it.
- Automated collections are separate from the existing Google Sheets reporting and the Papa Life website's database.
