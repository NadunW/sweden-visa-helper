# Sweden Visa Helper

A single-page web app that guides a family through a **Schengen visit visa for Sweden from Sri Lanka**: it collects the host's and travellers' details once, then generates personalised checklists, cover letters, an itinerary, a document index for each applicant, a timeline and the fees.

Since 1 June 2026, applications from Sri Lanka are submitted at **VFS Global Sweden, Colombo** and decided by the **Embassy of Sweden in New Delhi** (Norway no longer handles Swedish visas there).

## Features

- **Trip & host:** dates, flights, who pays, the host's details for form 241011
- **Travellers:** one card per applicant (passport, NIC, work status, ties to Sri Lanka)
- **Checklists:** the host's list plus one per traveller, built from the Embassy's official Visiting Family/Friends checklist, with progress tracking
- **Letters:** host invitation cover letter, applicant cover letters, travel itinerary and document index, with Copy and Download as Word (.doc)
- **Plan & fees:** milestones worked back from the arrival date, plus fees in LKR per traveller
- **Checks:** warns about stays over 90 days, passports expiring too soon or older than 10 years, and late applications
- **Privacy:** all data stays in the browser's localStorage, with export and import as JSON

## Run locally

Open `app/index.html` in a browser. There is no build step.

## Development

```bash
npm ci
npm run lint   # html-validate
npm test       # jsdom tests with node:test
```

CI (GitHub Actions) runs lint and tests on every push and pull request to `main`, and uploads the app as a build artifact.

## Official sources (checked 27 Nov 2026)

- [VFS Global – Sweden in Sri Lanka](https://visa.vfsglobal.com/lka/en/swe)
- [Embassy of Sweden – Visiting Family/Friends checklist (PDF)](https://assets.ctfassets.net/xxg4p8gt3sg6/4t6pINDUK6VbiEThiQgoTJ/1388464ec236abd28beea855a18f7212/Visiting_Relatives_And_Friends_Visa.pdf)
- [Migrationsverket – Visiting Sweden for up to 90 days](https://www.migrationsverket.se/en/you-want-to-apply/visiting-sweden/visiting-sweden-for-up-to-90-days-entry-visa/flikar/important-to-know.html)
- [Migrationsverket – Invite family, friends or partners](https://www.migrationsverket.se/en/you-want-to-apply/visiting-sweden/invite-family-friends-or-partners.html)
- [Skatteverket – Personbevis "Inbjudan"](https://www.skatteverket.se/privat/folkbokforing/personbevis/personbevisen/invitationinbjudan.5.361dc8c15312eff6fd15ea3.html)

Fees and rules change; always confirm on the official pages before applying. This tool organises documents and does not guarantee a visa.
