// Theme preference: "light", "dark" or "system", stored in this browser (localStorage). The resolved theme
// is written to <html data-theme> before first paint by THEME_SCRIPT, so a page never flashes the wrong theme.
export type ThemePref = "light" | "dark" | "system";
export const THEME_KEY = "munfix-theme";

/** Inlined in <head> by app/layout.tsx. Plain ES5, no dependencies; any failure leaves the light theme. */
export const THEME_SCRIPT = `(function(){try{var r=document.documentElement,q=matchMedia("(prefers-color-scheme: dark)"),p=localStorage.getItem("${THEME_KEY}");if(p!=="light"&&p!=="dark")p="system";r.dataset.themePref=p;r.dataset.theme=p==="dark"||(p==="system"&&q.matches)?"dark":"light";q.addEventListener("change",function(e){if(r.dataset.themePref==="system")r.dataset.theme=e.matches?"dark":"light"})}catch(e){}})();`;

/** Applies and remembers a preference. Returns the theme now shown. */
export function applyThemePref(pref: ThemePref): "light" | "dark" {
  const root = document.documentElement;
  const dark = pref === "dark" || (pref === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  root.dataset.themePref = pref;
  root.dataset.theme = dark ? "dark" : "light";
  try {
    if (pref === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Private mode or blocked storage: the choice lasts for this page only.
  }
  return dark ? "dark" : "light";
}
