export const MARRIAGE_CONFIRM_MS = 5 * 60 * 1000; // 5 minutos

export function getMarriagePending(group) {
  const pending = group?.marriagePending;
  if (!pending) return null;
  if (Date.now() > pending.expiresAt) {
    delete group.marriagePending;
    return null;
  }
  return pending;
}

export function setMarriagePending(group, from, to, type) {
  group.marriagePending = {
    from,
    to,
    type,
    expiresAt: Date.now() + MARRIAGE_CONFIRM_MS,
  };
}

export function clearMarriagePending(group) {
  delete group.marriagePending;
}

export function formatTimeLeft(expiresAt) {
  const ms = Math.max(0, expiresAt - Date.now());
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}
