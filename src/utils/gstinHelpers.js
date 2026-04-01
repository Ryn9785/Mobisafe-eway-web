/**
 * Helpers for multi-GSTIN data model.
 *
 * New attribute shape (both admin and sub-users):
 *   ewayGstins: [{ gstin: string, stateCodes: number[] }, ...]
 *
 * Old (single-GSTIN) shape that may still exist in the DB:
 *   ewayGstin:      string          e.g. "24ABICS2160H1ZH"
 *   ewayStateCodes: string (CSV)    e.g. "24,27,36"
 */

/**
 * Read the GSTIN list from user attributes, transparently migrating
 * from the old single-GSTIN format when necessary.
 *
 * @param {object} attributes - user.attributes
 * @returns {{ gstin: string, stateCodes: number[] }[]}
 */
export function getGstinList(attributes) {
  if (!attributes) return [];

  // New format already present
  if (Array.isArray(attributes.ewayGstins)) {
    return attributes.ewayGstins;
  }

  // Migrate old single-GSTIN format
  if (attributes.ewayGstin) {
    const stateCodes = attributes.ewayStateCodes
      ? String(attributes.ewayStateCodes)
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => n > 0)
      : [];
    return [{ gstin: attributes.ewayGstin, stateCodes }];
  }

  return [];
}

/**
 * Build the attributes object to persist, writing the new format
 * while keeping the old fields for backward compatibility with any
 * backend or mobile client that still reads them.
 *
 * @param {object}  currentAttributes - existing user.attributes
 * @param {{ gstin: string, stateCodes: number[] }[]} gstinList
 * @returns {object} merged attributes
 */
export function buildGstinAttributes(currentAttributes, gstinList) {
  const attrs = { ...(currentAttributes || {}) };

  attrs.ewayGstins = gstinList;

  // Backward-compat: keep ewayGstin as the first entry (or clear it)
  if (gstinList.length > 0) {
    attrs.ewayGstin = gstinList[0].gstin;
    // Union of all state codes for backward compat
    const allCodes = [...new Set(gstinList.flatMap((g) => g.stateCodes))].sort((a, b) => a - b);
    attrs.ewayStateCodes = allCodes.join(',');
  } else {
    attrs.ewayGstin = '';
    attrs.ewayStateCodes = '';
  }

  return attrs;
}

/**
 * Flatten GSTIN list into a map of gstin → stateCodes for quick lookup.
 */
export function gstinStateMap(gstinList) {
  const map = {};
  for (const entry of gstinList) {
    map[entry.gstin] = entry.stateCodes;
  }
  return map;
}

/**
 * Validate GSTIN format (basic 15-char alphanumeric check).
 */
export function isValidGstin(gstin) {
  return /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}Z[A-Z0-9]{1}$/.test(gstin);
}
