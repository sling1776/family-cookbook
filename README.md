# Family Recipe Archive

A static website for a family recipe collection, hosted on GitHub Pages.

## Features

- Home page for quick browsing
- Searchable recipe archive
- Filters by category, family member, and recipe tags
- Family index grouped by who shared each recipe
- GitHub Pages-friendly static setup

## Files

- `index.html` — home landing page
- `recipes.html` — recipe search and filter page
- `family.html` — browse recipes by family member
- `about.html` — site overview
- `assets/styles.css` — styling
- `assets/site.js` — search/filter functionality
- `recipes.md` — original recipe source text
- `data/recipes.json` — generated recipe data used by the site
- `scripts/build-recipes.js` — builds the JSON from markdown

## Run locally

```bash
python -m http.server 8000
```

Then open http://localhost:8000.

## Publish to GitHub Pages

Use the repository root as the Pages source. The static site files in this repo are ready to publish directly.

## Refresh recipe data

```bash
node scripts/build-recipes.js
```
