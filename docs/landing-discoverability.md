# Landing discoverability audit and implementation

## Audit
- Existing stack: React 19 with Vinext (Next-style App Router), deployed as a Cloudflare Worker by Sites. No framework migration or new dependency.
- Before this change, app/page.tsx rendered RollCall, whose initial loading guard hid all marketing HTML until a browser-side account check completed.
- Organizer authentication remains the existing Google/Microsoft Supabase PKCE flow and Sites ChatGPT sign-in dispatcher. Protected record APIs verify identity and workspace access. GuestStore keeps guest records in browser storage.
- Records and public aggregate SQL use the existing Cloudflare D1 binding. Public statistics allowlist only numeric combined counts and exclude removed/deleted attendance and test-only events; that SQL is unchanged.
- Verified existing capabilities in model.ts, attendance settings, person-attendance/compare, report-builder, mobile swipe, and workspace collaboration code. No QR check-in, attendee self-registration, certifications, ratings, or perpetual-free promise is claimed.

## Smallest safe implementation
- The public root opts into the existing signed-out React landing view during server rendering. All marketing and all 12 FAQ answers are in initial HTML. Hydration retains provider links, theme controls, account restoration and the interactive synthetic attendance preview. Other routes keep their existing loading and access behavior.
- FAQ content and SoftwareApplication JSON-LD share lib/landing-content.ts. Native details/summary controls work without JavaScript and with keyboards. Header anchors link to features, use cases, activity, preview, FAQ and sign-in; reduced motion disables smooth scrolling.
- Root metadata has a unique title, description, canonical origin URL, Open Graph and Twitter image metadata. Vinext normalizes the root canonical to https://takeroll.online, equivalent to https://takeroll.online/.
- robots.txt allows public crawling, including OAI-SearchBot through the wildcard group, and excludes private/auth/API paths. sitemap.xml lists only the public landing page. App routes default to noindex; this does not replace authentication.
- No FAQ rich-result promise or FAQPage markup, invented ratings, testimonials or awards.

## Statistics
- /api/stats caches the existing aggregate-only response in the Worker Cache API for 300 seconds, plus existing browser/shared cache headers. The SQL runs on a cache miss. Cache failures fall back to the normal database response, and database errors remain noncached 503 responses with no internal detail.
- Root rendering reads only an already-warm aggregate cache, never performs an extra database query. When present, recent totals are serialized into initial HTML. On a cold/unavailable cache, the existing client fetch and dash placeholders remain; open pages refresh every 300 seconds. Existing count animation, rotating totals, thickness, typography and responsive presentation remain.
- HTML retains private/no-store security headers and CSP nonces. Authentication, credentials, private records, database schema and calculations are unchanged.

## Validation
- HTTP checks strip every script before checking product text and all 12 FAQ answers; verify one H1, canonical, structured data, robots and sitemap.
- Desktop and 390px mobile browser checks cover section links, keyboard FAQ activation, no horizontal page overflow, and hydrated preview. Guest entry reaches the existing terms step without accepting an agreement on a user's behalf.
- Public statistics SQL regression, cache expiration/allowlist tests, guest-storage/security tests, authentication integrations and demo integrations run locally. TypeScript, targeted lint and production build are checked for release.
- Live provider initiation redirects can be checked without completing provider sign-in. Actual Google/Microsoft/ChatGPT login, account selection and 2FA require the user; no user credentials or production records are changed by these checks.
- Crawler user-agent HTTP checks cannot prove access from every crawler IP or inspect provider-controlled firewall configuration. Crawlability does not guarantee indexing, rankings, citations or recommendations. No paid services or billing features added.

## FAQ questions
1. What is TakeRoll?
2. Who is TakeRoll designed for?
3. Is TakeRoll free?
4. Do organizers need an account, or can I use guest mode?
5. Do attendees need accounts?
6. How do rosters, events, and subevents work?
7. Can multiple users work in one organization?
8. Does TakeRoll work on mobile devices?
9. How does it compare with paper sign-in sheets or Google Forms?
10. What attendance statuses and reports are supported?
11. Can I review and compare individual attendance?
12. How is attendance information protected?

Two older UI test expectations were updated to match existing behavior: the removed browser-filter preference stays absent, and removed-roster restore/delete controls remain enabled even when local speech playback is unavailable. No roster or preference behavior was changed by these test adjustments.
