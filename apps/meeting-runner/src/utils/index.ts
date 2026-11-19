// Pages live under the app's base path (/meeting-runner/). Each non-home page gets a
// real folder in the build (e.g. /meeting-runner/Timer/) so links work on GitHub Pages.
export function createPageUrl(pageName: string) {
    const base = import.meta.env.BASE_URL;
    if (pageName === "Home") return base;
    return base + pageName.replace(/ /g, '-') + '/';
}
