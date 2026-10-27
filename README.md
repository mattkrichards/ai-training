# Richards Supply — AI Training Site

Static site (plain HTML/CSS/JS, no build step) for the two required AI trainings:

| Page | What it is |
| --- | --- |
| `ai/index.html` | Home: learning path, pre-flight checklist |
| `ai/training-1.html` | Training 1 · AI at Richards Supply (8 modules, ~20 min) |
| `ai/training-2.html` | Training 2 · AI & Your Data (5 modules, ~20 min, with a practice sorter) |
| `ai/reference.html` | One-page quick reference (prints cleanly) |
| `ai/assets/config.js` | **Quiz links and contacts — edit this file only** |

## Add the quiz links

1. Import the two quiz files into Microsoft Forms (Quick Import → Quiz) and set answers from the answer key.
2. In each form, choose **Collect responses** and copy the link.
3. Paste the links into `ai/assets/config.js`:

```js
quizzes: {
  training1: "https://forms.office.com/r/XXXXXXXX",
  training2: "https://forms.office.com/r/YYYYYYYY"
}
```

Until a link is set, the button shows "Quiz link coming soon".

## Publishing

Live at **https://hub.richardssupply.com/ai/** via GitHub Pages (Settings → Pages → `main` / root, custom domain in `CNAME`). The root `index.html` redirects to `/ai/`. Every push to `main` republishes it.

**Visibility note:** GitHub Pages sites are public on the internet, even when the repo is private (private-repo Pages needs a paid plan). The pages are tagged `noindex`, so search engines won't list them, but anyone with the link can read them. If the trainings should be employees-only, host the same files on Azure Static Web Apps with Microsoft Entra sign-in, or embed the live site in a SharePoint page with the Embed web part (SharePoint won't display uploaded HTML files).

## Editing content

Each training module is one `<article class="slide">` block in the page. Edit text in place; the slide count, dots, and progress bar update automatically. Link to a specific slide with `#slide-N`, e.g. `training-1.html#slide-5`.
