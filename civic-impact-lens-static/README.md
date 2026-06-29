# Civic Impact Lens

A browser-based environmental screening tool for residents and local leaders evaluating a proposed data center. It translates early project inputs into transparent water-demand estimates, a screening priority, a public-record checklist, and an AI-generated plain-language community brief.

## What it does
- Calculates annual water demand from a supplied gallons-per-day estimate.
- Shows an illustrative household-year comparison (300 gallons/day/household).
- Applies a transparent, non-engineering screening score based on water volume, cooling, water-stress context, source, and wastewater plan.
- Uses OpenAI Chat Completions to produce a cautious citizen-facing summary, environmental considerations, and questions to request from the developer or public agencies.
- Saves up to 12 scenarios in `localStorage` on the user’s device.

## Files
- `index.html` — page structure and accessible form controls.
- `style.css` — responsive styling and print rules.
- `script.js` — validation, calculations, UI rendering, local storage, and OpenAI API call.

## Run locally
No npm setup is required for this static version.

1. Open `index.html` in a browser, or use VS Code Live Server.
2. Enter an OpenAI API key at runtime.
3. Enter project details and select **Create environmental brief**.

## API key handling
The key is entered at runtime, is not included in source files, and is not saved by the app. For production deployment, replace the direct client-side OpenAI call with a server-side proxy or serverless function so the browser never receives the key.

## Important limitation
This app is a discussion and screening aid, not a hydrology model, environmental impact statement, permit analysis, or legal advice. It uses user-provided inputs and intentionally asks the AI not to invent local facts.
