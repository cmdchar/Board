import { normalizeConnectorDefaultStyle } from "../../lib/geometry/connectors/model";

const CONNECTOR_DEFAULT_STORAGE_KEY = "pd.board.connector.defaultStyle.v1";
const CONNECTOR_REMEMBER_LAST_STORAGE_KEY = "pd.board.connector.rememberLast.v1";

export function loadStoredConnectorDefaultStyle() {
  try {
    const raw = localStorage.getItem(CONNECTOR_DEFAULT_STORAGE_KEY);
    if (!raw) return normalizeConnectorDefaultStyle({});
    return normalizeConnectorDefaultStyle(JSON.parse(raw));
  } catch {
    return normalizeConnectorDefaultStyle({});
  }
}

export function saveStoredConnectorDefaultStyle(preset) {
  try {
    localStorage.setItem(CONNECTOR_DEFAULT_STORAGE_KEY, JSON.stringify(normalizeConnectorDefaultStyle(preset)));
  } catch {
    // ignore storage quota errors
  }
}

export function loadStoredRememberLastConnectorStyle() {
  try {
    const raw = localStorage.getItem(CONNECTOR_REMEMBER_LAST_STORAGE_KEY);
    if (raw === null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

export function saveStoredRememberLastConnectorStyle(value) {
  try {
    localStorage.setItem(CONNECTOR_REMEMBER_LAST_STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore storage quota errors
  }
}
