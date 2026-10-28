# Take Roll

A compact attendance app for rosters, events and subevents, linked people, reports, custom statuses, keyboard entry, mobile swipe entry, and shared workspaces. Live app: https://takeroll.online/.

This repository contains the same current source files used for the Sites deployment. Historical private source commits are not published. For signed-in users, application records, authentication account mappings, preferences, and attendance history are stored in the database. Optional guest workspaces stay in the visitor's browser. Neither kind of saved workspace is part of this repository.

## Development

Use Node.js 22.13 or later and the pnpm version in package.json. Run `pnpm install --frozen-lockfile`, then `pnpm dev`. Run `pnpm test` for unit and integration tests and `pnpm build` for a production build. Tests create disposable local databases.

Runtime authentication configuration belongs in your host's environment; .env.example contains blank examples. New accounts start with empty workspaces. Synthetic roster fixtures live in tests/fixtures.mjs and are never loaded by the application.

## Database and deployment

Keep the schema migrations in drizzle/. The native-account alias migration preserves existing account keys and permissions using values already in the database; it contains no account-specific identity. Completed historical repairs remain in saved records and are not rerun by the application.

.openai/hosting.json identifies the Sites project and its database binding. The project ID and public hostnames are deployment identifiers, not credentials. Configure your own project and authentication before deploying a separate installation. Never point an unrelated deployment at an existing production database.

## Publishing source updates

Run `node scripts/check-public-source.mjs` before publishing. Use `node scripts/sync-github-source.mjs <github-checkout>` from the Sites checkout to copy the exact tracked tree into the GitHub checkout. The tool checks privacy constraints, verifies the destination, and preserves its Git history and untracked files. It does not copy production records or the private source history. Review, commit, and push the resulting source update.

Copyright and third-party license notices are preserved. Public visibility does not change the proprietary license in LICENSE.
