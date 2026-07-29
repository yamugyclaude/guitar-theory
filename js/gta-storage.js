const DATA_KEYS = ['gta_chart_drafts', 'gta_setlists', 'gta_sheet_meta'];

export function gtaSetItem(key, value) {
  localStorage.setItem(key, value);
  if (DATA_KEYS.includes(key) && !window.__gtaApplyingRemote) {
    window.dispatchEvent(new CustomEvent('gta:storage', { detail: key }));
  }
}
