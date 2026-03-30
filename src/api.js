const BASE = '/api';

async function request(url, options = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    throw new Error('Unauthorized');
  }
  return res;
}

async function jsonRequest(url, options = {}) {
  const res = await request(url, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (res.status === 204) return null;
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
    return request(`${BASE}/session`, { method: 'DELETE' });
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
    return request(`${BASE}/users/${id}`, { method: 'DELETE' });
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
