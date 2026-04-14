const BASE = '/api';

const FORBIDDEN_CODE_MESSAGES = {
  role_priority_exceeded:
    "You can't manage a role at or above your own priority level",
  cannot_grant_unheld_permission:
    "You can't grant a permission you don't currently hold",
  policy_target_priority_exceeded:
    "You can't create a policy targeting a role or user at or above your priority level",
  policy_cannot_target_administrator:
    "Policies cannot target administrator accounts",
  permission_denied:
    "You don't have permission to perform this action",
  gstin_not_assigned:
    "This GSTIN isn't assigned to your account. Ask your admin to grant access.",
  missing_gstin:
    "Missing GSTIN parameter for this request.",
  not_authenticated:
    "Your session has expired. Please log in again.",
};

async function dispatchForbidden(res) {
  let code;
  let required;
  try {
    const clone = res.clone();
    const text = await clone.text();
    if (text) {
      const body = JSON.parse(text);
      if (typeof body?.error === 'string') code = body.error;
      if (typeof body?.required === 'string') required = body.required;
    }
  } catch {
    // non-JSON body, ignore
  }
  const message = (code && FORBIDDEN_CODE_MESSAGES[code])
    || (required ? `You don't have permission: ${required}` : FORBIDDEN_CODE_MESSAGES.permission_denied);
  window.dispatchEvent(new CustomEvent('auth:forbidden', { detail: { code, required, message } }));
  const err = new Error(message);
  err.status = 403;
  err.code = code;
  err.required = required;
  return err;
}

async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('Unauthorized');
  }
  if (res.status === 403) {
    throw await dispatchForbidden(res);
  }
  return res;
}

async function noContentRequest(url, options = {}) {
  const res = await request(url, options);
  if (!res.ok && res.status !== 204) {
    let message = `Request failed: ${res.status}`;
    try {
      const text = await res.text();
      if (text) message = text;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return res;
}

async function jsonRequest(url, options = {}) {
  const res = await request(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (res.status === 204) return null;
  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const text = await res.text();
      if (text) {
        try {
          const body = JSON.parse(text);
          message = body?.message || body?.error || text;
        } catch {
          message = text;
        }
      }
    } catch {
      // body unreadable; fall through with default message
    }
    throw new Error(message);
  }
  return res.json();
}

const api = {
  // --- Session ---
  login(email, password) {
    const body = new URLSearchParams();
    body.append('email', email);
    body.append('password', password);
    return request(`${BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }).then((r) => {
      if (!r.ok) throw new Error('Invalid credentials');
      return r.json();
    });
  },

  getSession() {
    return request(`${BASE}/session`).then((r) => {
      if (r.status === 404) return null;
      if (!r.ok) return null;
      return r.json();
    });
  },

  logout() {
    return noContentRequest(`${BASE}/session`, { method: 'DELETE' });
  },

  // --- Users ---
  getUsers(managerId) {
    const params = managerId ? `?userId=${managerId}` : '';
    return jsonRequest(`${BASE}/users${params}`);
  },

  createUser(user) {
    return jsonRequest(`${BASE}/users`, {
      method: 'POST',
      body: JSON.stringify(user),
    });
  },

  updateUser(user) {
    return jsonRequest(`${BASE}/users/${user.id}`, {
      method: 'PUT',
      body: JSON.stringify(user),
    });
  },

  deleteUser(id) {
    return noContentRequest(`${BASE}/users/${id}`, { method: 'DELETE' });
  },

  // --- Roles (ABAC) ---
  listRoles() {
    return jsonRequest(`${BASE}/roles`);
  },

  listRoleMembers(roleId) {
    return jsonRequest(`${BASE}/roles/${roleId}/members`);
  },

  assignRole(roleId, userId) {
    return noContentRequest(`${BASE}/roles/${roleId}/members/${userId}`, { method: 'POST' });
  },

  unassignRole(roleId, userId) {
    return noContentRequest(`${BASE}/roles/${roleId}/members/${userId}`, { method: 'DELETE' });
  },

  // --- eWay Authentication ---
  ewayAuthenticate(gstin, username, password) {
    return jsonRequest(
      `${BASE}/eway/authentication?gstin=${encodeURIComponent(gstin)}`,
      {
        method: 'POST',
        body: JSON.stringify({
          action: 'ACCESSTOKEN',
          username,
          password,
        }),
      },
    );
  },

  // --- eWay Transporter Bills ---
  getTransporterBills(date, stateCode, gstin) {
    const isoDate = date instanceof Date ? date.toISOString() : date;
    const params = new URLSearchParams({
      date: isoDate,
      stateCode: String(stateCode),
      gstin,
    });
    return jsonRequest(`${BASE}/eway/bills-transporter-date-state?${params}`);
  },

  // --- eWay Bill Details ---
  getBillDetails(ewbNos, gstin) {
    const params = new URLSearchParams({
      ewbNos: ewbNos.join(','),
      gstin,
    });
    return jsonRequest(`${BASE}/eway/details?${params}`);
  },

  // --- eWay Bill Extension ---
  extendEwayBill(gstin, body) {
    return jsonRequest(
      `${BASE}/eway/details/extend?gstin=${encodeURIComponent(gstin)}`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    );
  },

  // --- Shipment Excel Download ---
  downloadShipmentExcel(ewayNos, filename) {
    const params = new URLSearchParams();
    params.set('ewayNos', ewayNos.join(','));
    if (filename) params.set('filename', filename);
    return request(`${BASE}/eway/shipment/download/excel?${params}`).then(async (r) => {
      if (!r.ok) {
        const text = await r.text();
        throw new Error(text || `Download failed (${r.status})`);
      }
      return r.blob();
    });
  },
};

export default api;
