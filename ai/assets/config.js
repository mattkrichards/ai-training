// Site settings — edit these, no code changes needed elsewhere.
window.RS_CONFIG = {
  // Paste the Microsoft Forms share links here once the quizzes are imported.
  // Leave blank to show "Quiz link coming soon".
  quizzes: {
    training1: "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=BEhP0OK6tk-F7kQstwCdxg2uTa57P49PjpVNhL0qmtdUNDFBTjkwODNXV1U2NlRCU1c3SElCSDRCSS4u",
    training2: "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=BEhP0OK6tk-F7kQstwCdxg2uTa57P49PjpVNhL0qmtdUNUg5QjQ3UURTMDNWSk9RS1c4NU0zR1gxUS4u"
  },
  // "Disclose an unapproved tool" buttons. Paste the Microsoft Forms link here.
  // Until it's set, the buttons open a pre-filled email to contacts.email instead.
  disclosureForm: "",
  contacts: {
    policyOwner: "Matt Kuehl, VP of Technology",
    email: "mattk@richardssupply.com",
    helpDesk: "IT Help Desk"
  },
  // Home page banner photo (free Unsplash License photo; artwork shows if it can't load).
  heroImage: "https://images.unsplash.com/photo-1702047094974-a3475a6e37f5",
  // "Skills you'll build" on the home page: course ID + lesson number.
  skills: [
    { label: "The five ground rules", course: "training-1", lesson: 4 },
    { label: "Approved AI tools", course: "training-1", lesson: 5 },
    { label: "Red, Yellow, Green data", course: "training-2", lesson: 3 },
    { label: "Data in the systems you use", course: "training-2", lesson: 2 },
    { label: "Reporting a mistake", course: "training-1", lesson: 7 },
    { label: "Good habits with AI", course: "training-2", lesson: 4 }
  ],
  // Training creator (admin.html): where course content is saved.
  admin: {
    owner: "mattkrichards",
    repo: "ai-training",
    branch: "main",
    contentPath: "ai/content/trainings.json",
    imageDir: "ai/content/images"
  },
  policyVersion: "AI Usage Policy v3 (draft, Nov 2026)"
};
