# Legal Policy Maintenance

Before every release, review application changes against Privacy Policy, Terms & EULA, Cookies, and Data Processing Terms. The build checks a source fingerprint and stops when application, database, provider, dependency, or hosting configuration changes have not been reviewed. This is a review gate, not automated legal advice or a guarantee of compliance.

Update the affected documents in `lib/legal-documents.ts` whenever collection, purpose, storage, providers, sharing, membership, authentication, cookies, tracking, retention, deletion, exports, security promises, audience, user rights, or license terms change. Describe actual behavior, including new optional processing and required choices, before it is enabled. Preserve contact details and legally required notices. Review legal requirements periodically and when the owner learns of a legal change; source checks cannot detect changes in law or external provider practices.

For substantive Terms/EULA or Data Processing changes, advance LEGAL_VERSION to a new effective date. Never silently overwrite an accepted agreement version: acceptance digests are immutable, and the version gate must require fresh acceptance. Formatting-only presentation edits can preserve the existing version and digest. Update effective dates and provide advance or direct notice where required.

After review and any necessary policy updates, record a concrete summary:

`node scripts/check-legal-review.mjs --record "Reviewed changes; describe affected behavior and policy updates, or why none are needed."`

Commit `legal-review.json` with the reviewed changes. `node scripts/run-framework.mjs build` and the app test runner enforce this gate. Do not record a review just to bypass a failure. Public policy links must stay available while signed out. Test the agreement route, acceptance enforcement, current dates, and privacy choices after relevant changes.
