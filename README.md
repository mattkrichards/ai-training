# Richards Supply — AI Training Site

Static site (plain HTML/CSS/JS, no build step) for the two required AI trainings:

| Page | What it is |
| --- | --- |
| `ai/index.html` | Home: learning path, pre-flight checklist |
| `ai/training-1.html` | Training 1 · AI at Richards Supply (8 modules, ~20 min) |
| `ai/training-2.html` | Training 2 · AI & Your Data (5 modules, ~20 min, with a practice sorter) |
| `ai/reference.html` | One-page quick reference (prints cleanly) |
| `ai/assets/config.js` | **Quiz links, disclosure form link, and contacts — edit this file only** |
| `forms/` | Word file for Microsoft Forms Quick Import (disclosure form) |

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

## Unapproved-tool disclosure form

"Disclose an unapproved tool" buttons appear in Training 1 (Module 5 and Module 7), on the quick reference, and as a flag icon in the left rail on every page. The form is the preferred way to disclose; email is also accepted.

1. Open `forms/AI Tool Use Disclosure - Forms import.docx`, then in Microsoft Forms choose **Quick Import** → upload it → **Form** (not Quiz).
2. Check the imported questions. Set questions 1–4, 6, 8–12 to **Required**. On question 8 (data level), leave it single-choice.
3. Settings: **Only people in my organization can respond** and **Record name** on (the form has no name question; it relies on this). Turn on email notification of new responses.
4. Choose **Collect responses**, copy the link, and paste it into `ai/assets/config.js`:

```js
disclosureForm: "https://forms.office.com/r/ZZZZZZZZ",
```

Until it's set, the buttons open a pre-filled email to `contacts.email`. Once it's set, the main button opens the form and an "Email instead" button appears beside it.

## Publishing

Live at **https://hub.richardssupply.com/ai/** via GitHub Pages (Settings → Pages → `main` / root, custom domain in `CNAME`). The root `index.html` redirects to `/ai/`. Every push to `main` republishes it.

**Visibility note:** GitHub Pages sites are public on the internet, even when the repo is private (private-repo Pages needs a paid plan). The pages are tagged `noindex`, so search engines won't list them, but anyone with the link can read them. If the trainings should be employees-only, host the same files on Azure Static Web Apps with Microsoft Entra sign-in, or embed the live site in a SharePoint page with the Embed web part (SharePoint won't display uploaded HTML files).

## Editing content

Each training module is one `<article class="slide">` block in the page. Edit text in place; the slide count, dots, and progress bar update automatically. Link to a specific slide with `#slide-N`, e.g. `training-1.html#slide-5`.
