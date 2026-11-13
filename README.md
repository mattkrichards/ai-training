# Richards Supply — AI Training Site

Static site (plain HTML/CSS/JS, no build step) for the two required AI trainings:

| Page | What it is |
| --- | --- |
| `ai/index.html` | My courses: core and tool courses with each employee's progress |
| `ai/course.html?id=…` | Course player: outline, lessons, quiz step (built from the content file) |
| `ai/admin.html` | **Training Creator**: create and edit courses, lessons, content blocks, and images |
| `ai/content/trainings.json` | All course content (edited through the Training Creator) |
| `ai/content/images/` | Images uploaded in the Training Creator |
| `ai/reference.html` | One-page quick reference (prints cleanly) |
| `ai/migration.html` | Migration plan: moving personal AI accounts into company accounts |
| `ai/training-1.html`, `training-2.html` | Old links; they forward to the course player |
| `ai/assets/config.js` | Disclosure form link, contacts, and Training Creator repo settings |
| `forms/` | Word file for Microsoft Forms Quick Import (disclosure form) |

## RX Training Library (`/rx/`)

Live at **https://hub.richardssupply.com/rx/**. Video library for the Inventory Agreements RX Scan and RX Builder trainings.

| File | What it is |
| --- | --- |
| `rx/index.html` | The page: search, course filter, video cards, player |
| `rx/videos.json` | **All content**: courses and videos |
| `rx/rx.js`, `rx/rx.css` | Behavior and styling ; `rx/base.css` is its own copy of the site styles, so changes to the AI site don't affect it |

**What it does**
- Live search across title, description, keywords, and course; matching words are highlighted. Press `/` to jump to the search box.
- Course filter chips, videos grouped by course in module order, and a match count.
- Cards show the YouTube thumbnail (red artwork if it can't load). Clicking a card plays the video in a popup with a "Next" button to the following module.
- "Watched" checkmarks and "X of Y watched" per course, saved in that browser.
- Shareable links: `?q=min%20max`, `?course=rx-builder`, or `#v=VIDEOID` to open a specific video.

**Editing**: edit `rx/videos.json` on GitHub.
- Add a video: copy a block in `videos`, set `id` (the part after `watch?v=` in the YouTube link), `course`, `order`, `title`, `description`, and `keywords` (extra search words).
- Add a course: add a block to `courses` with a new `id`, then use that `id` on its videos.

## RX Performance Diagnostic (`/rx-fit/`)

Live at **https://hub.richardssupply.com/rx-fit/**. A five-minute self-guided performance diagnostic that reps or customers can use: company, how inventory is managed today, pain points, categories, brands and monthly spend. Results show a performance score (tachometer gauge), the recommended service tier (Tier 1 Core RX Support, Tier 2 Managed Replenishment, Tier 3 Automated Vending) with the tier comparison, a starting scope and next steps.

| File | What it is |
| --- | --- |
| `rx-fit/index.html` | The page shell: utility bar, RX header navigation, action bar |
| `rx-fit/fit.js` | Questions, scoring, tier logic and results. **`CONFIG` at the top** holds the results email, branches, tier names/minimums, tier comparison rows and the "Richards Xpress difference" copy |
| `rx-fit/fit.css` | Styling (standalone; RX black/red livery, Montserrat headings, Cool Slate (#65737E) accent from the RX brand guideline) |
| `rx-fit/img/` | Photos used on the start screen and results |
| `rx-fit/brand/` | Web-sized RX logo and icon used by the page |
| `rx-fit/media/` | Background loop (`bg-track.mp4`, 13s, 720p, silent, ~1.7 MB) and its still frame. Made from the original `rx_video_background.mp4` (slowed 25%). Paused when the tab is hidden; reduced-motion users get the still. |

**Branding**: the RX bar uses `rx-fit/brand/rx-horizontal-dark.png` (red/white horizontal logo) and `rx-fit/brand/rx-icon.png` as the favicon. These are web-sized copies of the official files in `brand/rx-logos/`.

**Tier logic** (from the Sept 2026 sales rollout): $36K+/yr → Tier 2 (Tier 3 if they already use or want vending); $15K–$36K → Tier 1; below $15K → "find the right starting point". The spend ranges on step 4 break at $1,250 and $3,000 a month to line up with those minimums.

**Results** stay in the visitor's browser. They can email them (opens their mail app addressed to `CONFIG.contactEmail`), copy a summary, or print / save a PDF. Set `CONFIG.submitEndpoint` to a Retool Workflow webhook to log submissions instead.

## RX brand files (`/brand/rx-logos/`)

Official Richards Xpress logo PNGs from the Managers SharePoint (RX / Richards Xpress Artwork / Logo Files): `horizontal/`, `horizontal-no-spacing/` (tightly cropped), `vertical/`, `icon/` and `monochrome/`. In each set, odd numbers include the "Inventory Solutions" tagline and even numbers don't for horizontal/vertical; variants with white lettering are for dark backgrounds. Source files (AI, EPS, PSD, SVG) stay on SharePoint.

## Training Creator (admin)

Open **https://hub.richardssupply.com/ai/admin.html** (also linked as "Admin" in the site footer).

**Sign in once per computer** with a GitHub fine-grained token:
1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate new token.
2. Repository access: only `ai-training`. Permissions: **Contents: Read and write**. Nothing else.
3. Paste it into the sign-in screen. It's stored only in that browser. Revoke it on GitHub any time.

**What you can do**
- Courses: create (blank or copied from another), duplicate, delete, reorder; set **Core** or **Tool** type, **Draft** or **Published**, required, audience, summary, intro, and the Microsoft Forms quiz link.
- Lessons: add, rename, set minutes and page heading, reorder, duplicate, delete.
- Content blocks: paragraph, subheading, bullet/numbered list, card grid (2–4 columns, optional images), callout (red/blue/green), key message banner, table (with colored status labels), image upload, video (Loom, YouTube, Vimeo, Stream, MP4), Red/Yellow/Green data levels, practice check, button link, report buttons, divider, two/three columns, and custom HTML.
- Formatting in text fields: `**bold**`, `*italic*`, `[link text](https://…)`, `==highlight==`. Table labels: `{ok}Approved`, `{warn}Yellow`, `{no}Not approved`, `{dark}Prohibited`.
- Look: each course has a cover photo (pick from the free-photo gallery, upload your own, or paste an Unsplash link), an artwork icon, and a color. Each lesson has a banner with an icon and color (Auto picks one). If a photo can't load, the colored artwork shows instead.
- Live preview (desktop and phone) beside the editor.
- **Publish changes** commits the content file; the site updates in about a minute. Unpublished edits are kept in the browser if you close the tab.
- More menu: download or import the content file as a backup, discard unpublished changes.
- "Practice without signing in" lets anyone try the editor without publishing.

Images upload to `ai/content/images/` when added; large photos are resized to 1600px wide.

**Note:** the content file (including draft courses) is public, like the rest of the site. Don't put anything in a course you wouldn't post on the training site.

## Home page settings

In `ai/assets/config.js`:
- `heroImage`: the photo in the home page banner.
- `skills`: the numbered "Skills you'll build" links on the home page (and "Popular topics" in the left menu). Each one points at a course ID and lesson number.

Photos come from Unsplash and are free to use under the [Unsplash License](https://unsplash.com/license). They load from Unsplash's servers, so they need internet access, like the rest of the site.

## Quiz links

1. Import the two quiz files into Microsoft Forms (Quick Import → Quiz) and set answers from the answer key.
2. In each form, choose **Collect responses** and copy the link.
3. Paste the link into the course's **Quiz** section in the Training Creator.

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

Use the Training Creator. Link to a specific lesson with `#slide-N`, e.g. `course.html?id=training-1#slide-5`.

Progress (lessons viewed, quiz opened) is saved in the browser on that device and shows on the home page. The official completion record is the Microsoft Forms quiz.
