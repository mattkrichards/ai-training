// MeetingRunner settings (Microsoft 365). Edit this file on GitHub; the app picks up
// changes on the next page load, no rebuild needed. Setup steps: README → "MeetingRunner".
window.MEETING_RUNNER_CONFIG = {
  // Microsoft Entra ID → App registrations → MeetingRunner → Overview
  tenantId: "",   // "Directory (tenant) ID"
  clientId: "",   // "Application (client) ID"

  // SharePoint site that stores the agendas. Everyone who uses the app needs
  // edit access to this site's document library.
  siteUrl: "",    // e.g. "https://richardssupply.sharepoint.com/sites/Leadership"
  library: "",    // blank = the site's default "Documents" library
  folder: "MeetingRunner", // agendas are saved as <folder>/agendas/<id>.json
};
