# Sweden Visa Helper

A single-page web app that guides a family through a **Schengen visit visa for Sweden from Sri Lanka**: it collects the host's and travellers' details once, then generates personalised checklists, cover letters, an itinerary, a document index for each applicant, a timeline and the fees.

**Live site:** https://nadunw.github.io/sweden-visa-helper/ (after the one-time setup below)

Since 1 June 2026, applications from Sri Lanka are submitted at **VFS Global Sweden, Colombo** and decided by the **Embassy of Sweden in New Delhi** (Norway no longer handles Swedish visas there).

## Features

- **Trip & host:** dates, flights, who pays, the host's details for form 241011
- **Travellers:** one card per applicant (passport, NIC, work status, ties to Sri Lanka)
- **Checklists:** the host's list plus one per traveller, built from the Embassy's official Visiting Family/Friends checklist, with progress tracking
- **Official forms:** direct links on each item (form 241011, form 119031, Embassy checklist, Skatteverket personbevis, VFS booking, photo rules)
- **Uploads:** attach scans (PDF or images) to any checklist item
- **Google sign-in (optional):** saves details and uploads in a `Sweden Visa Helper` folder in the user's own Google Drive, so they can continue on any device
- **Complete package:** one ZIP with every upload in Embassy order, one folder per person, all letters as Word (.docx), and a README index of what's missing
- **Letters:** host invitation cover letter, applicant cover letters, travel itinerary and document index, with Copy and Download as Word (.docx)
- **Checks:** warns about stays over 90 days, passports expiring too soon or older than 10 years, and late applications

## Where data is stored

| Mode | Details | Uploads |
| --- | --- | --- |
| Not signed in | Browser `localStorage` | Browser IndexedDB |
| Signed in with Google | Your Google Drive (`Sweden Visa Helper/visa-helper-data.json`) plus a copy in the browser | Your Google Drive (`Sweden Visa Helper/`) |

There is no server. The app uses the `drive.file` scope, so it can only see files it created itself, never the rest of your Drive. When you sign in, uploads stored in the browser are moved into Drive. Removing an upload moves it to the Drive trash.

## One-time setup

### 1. Turn on GitHub Pages

Repository **Settings → Pages → Build and deployment → Source: GitHub Actions**. Then re-run the *CI and Pages* workflow (Actions tab), or push to `main`, to publish `app/` to the live site.

GitHub Pages is free for public repositories. A private repository needs GitHub Pro, Team or Enterprise, and the published site is public either way. No personal data is in the repo: the sample family in the app is fictional.

### 2. Create a Google OAuth client (for "Sign in with Google")

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project, e.g. *Sweden Visa Helper*.
2. **APIs & Services → Library:** enable **Google Drive API**.
3. **Google Auth Platform** (OAuth consent screen):
   - Branding: app name and support email.
   - Audience: **External**, leave the publishing status as **Testing**, and add **test users**: your Google account and any family members who will use it.
   - Data access: add the scopes `.../auth/drive.file`, `openid` and `email`.
4. **Clients → Create client → Web application:**
   - Authorized JavaScript origins: `https://nadunw.github.io` (add `http://localhost:8080` too for local testing).
   - No redirect URI is needed.
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`).

While the app is in Testing mode, only the test users you added can sign in, and Google shows an "app isn't verified" screen they can continue past.

### 3. Give the Client ID to the deploy

Repository **Settings → Secrets and variables → Actions → Variables → New repository variable**:

- Name: `GOOGLE_CLIENT_ID`
- Value: the Client ID from step 2

Then re-run the *CI and Pages* workflow. The deploy writes it into `app/config.js`; an OAuth client ID is public by design, so a variable (not a secret) is fine. Without it, the app works in browser-only mode and the Google button is hidden.

## Run locally

```bash
npx serve app -l 8080   # or any static server
```

Open http://localhost:8080. To test Google sign-in locally, put your Client ID in `app/config.js` (don't commit it) and add `http://localhost:8080` as an authorized origin.

## Development

```bash
npm ci
npm run lint   # html-validate
npm test       # jsdom tests with node:test (includes a simulated Google Drive)
```

## Versioning and releases

The app uses semantic versions (`X.Y.Z`) from `package.json`, shown in the app's footer.

1. Work on a branch and open a pull request to `main`. Direct pushes to `main` are blocked.
2. In the PR, bump the version:
   - `npm run bump:patch` for fixes (1.0.0 → 1.0.1)
   - `npm run bump:minor` for new features (1.0.0 → 1.1.0)
   - `npm run bump:major` for breaking changes (1.0.0 → 2.0.0)
3. The PR must pass two checks: **test** (lint and tests) and **version** (valid X.Y.Z, not lower than `main`, not already released).
4. Merging runs **CI and Release** on `main`: tests, then a `vX.Y.Z` tag and GitHub release (notes generated from merged PRs, app ZIP attached), then deployment of that version to GitHub Pages.

### Branch protection on `main`

A repository ruleset named **Protect main** enforces:

- a pull request for every change (no direct pushes, including admins)
- the **test** and **version** checks passing, with the branch up to date with `main`
- all review conversations resolved
- no force pushes and no branch deletion

No approving review is required, so a single maintainer can merge their own PRs. Raise `required_approving_review_count` in the ruleset once others contribute.

## Official sources (checked 27 Nov 2026)

- [VFS Global – Sweden in Sri Lanka](https://visa.vfsglobal.com/lka/en/swe)
- [Embassy of Sweden – Visiting Family/Friends checklist (PDF)](https://assets.ctfassets.net/xxg4p8gt3sg6/4t6pINDUK6VbiEThiQgoTJ/1388464ec236abd28beea855a18f7212/Visiting_Relatives_And_Friends_Visa.pdf)
- [Migrationsverket – Visiting Sweden for up to 90 days](https://www.migrationsverket.se/en/you-want-to-apply/visiting-sweden/visiting-sweden-for-up-to-90-days-entry-visa/flikar/important-to-know.html)
- [Migrationsverket – Invite family, friends or partners](https://www.migrationsverket.se/en/you-want-to-apply/visiting-sweden/invite-family-friends-or-partners.html)
- [Skatteverket – Personbevis "Inbjudan"](https://www.skatteverket.se/privat/folkbokforing/personbevis/personbevisen/invitationinbjudan.5.361dc8c15312eff6fd15ea3.html)
- [Google – Choose Drive API scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth)

Fees and rules change; always confirm on the official pages before applying. This tool organises documents and does not guarantee a visa.
