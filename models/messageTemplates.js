import { fytBold } from "./TextStyle.js";

const formatBody = (body) => {
  return String(body)
    .split("\n")
    .map((line) => `┃ ${line}`)
    .join("\n");
};

const formatBlock = ({
  icon = "⚠️",
  header = "AURA REED",
  title = "",
  body = "",
  footer = "SYSTEM",
  footerIcon = "⚡",
}) => {
  const parts = [
    `╭〔 ${icon} ${fytBold(header)} 〕⬣`,
    title ? `┃ ${title}` : "",
    "╰━━━━━━━━━━━━⬣",
    body ? "" : "",
    body ? formatBody(body) : "",
    "",
    `╰〔 ${footerIcon} ${fytBold(footer)} 〕⬣`,
  ].filter(Boolean);
  return parts.join("\n");
};

export const errorMessage = (title, body, footer = "SYSTEM") =>
  formatBlock({
    icon: "❌",
    header: "AURA REED",
    title: `⚠️ ${fytBold(title)}`,
    body,
    footer,
  });
export const warningMessage = (title, body, footer = "SYSTEM") =>
  formatBlock({
    icon: "⚠️",
    header: "AURA REED",
    title: fytBold(title),
    body,
    footer,
  });
export const successMessage = (title, body, footer = "SYSTEM") =>
  formatBlock({
    icon: "✅",
    header: "AURA REED",
    title: fytBold(title),
    body,
    footer,
  });
export const infoMessage = (title, body, footer = "SYSTEM") =>
  formatBlock({
    icon: "ℹ️",
    header: "AURA REED",
    title: fytBold(title),
    body,
    footer,
  });
export const customMessage = (
  icon,
  header,
  title,
  body,
  footer = "SYSTEM",
  footerIcon = "⚡",
) => formatBlock({ icon, header, title, body, footer, footerIcon });
