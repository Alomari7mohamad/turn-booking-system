const DEFAULT_FAVICON = "/favicon.svg";
const ADMIN_FAVICON = "/oh-tech-logo2-transparent.png?v=3";

export function setFavicon(href = DEFAULT_FAVICON) {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = href.includes(".svg") ? "image/svg+xml" : "image/png";
  link.href = href;
}

export function resetFavicon() {
  setFavicon(DEFAULT_FAVICON);
}

export function adminFavicon() {
  setFavicon(ADMIN_FAVICON);
}
