const FUSBALL_CONTENT = {
  heroKicker: "KOLEKSI FANTASY FOOTBALL",
  heroTitle: "Kenakan jersey yang punya cerita.",
  heroDescription: "Jersey fantasy original Fusball.id untuk kamu yang melihat sepak bola sebagai budaya, identitas, dan cara berekspresi."
};

let savedContent = null;
try { savedContent = JSON.parse(localStorage.getItem("fusballContent") || "null"); } catch { localStorage.removeItem("fusballContent"); }
const siteContent = savedContent && typeof savedContent === "object" ? { ...FUSBALL_CONTENT, ...savedContent } : FUSBALL_CONTENT;
