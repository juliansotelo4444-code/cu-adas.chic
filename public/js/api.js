// ==============================================================================
// CLIENTE API REST
// Conecta la interfaz de usuario con el backend SQLite nativo de Node.js
// ==============================================================================

const API = {
  baseUrl: '/api',

  async request(endpoint, options = {}) {
    const defaultHeaders = {
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          ...defaultHeaders,
          ...options.headers
        }
      });

      const json = await response.json();

      if (!response.ok) {
        throw new Error(json.error || `Error ${response.status}: Error en la petición`);
      }

      return json;
    } catch (err) {
      console.error(`Error en API [${endpoint}]:`, err);
      throw err;
    }
  },

  // 1. MÉTRICAS FINANCIERAS
  async getMetrics() {
    return this.request('/metrics');
  },

  // 2. FARDOS
  async getBales() {
    return this.request('/bales');
  },

  async getBale(id) {
    return this.request(`/bales/${id}`);
  },

  async createBale(data) {
    return this.request('/bales', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateBale(id, data) {
    return this.request(`/bales/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteBale(id) {
    return this.request(`/bales/${id}`, {
      method: 'DELETE'
    });
  },

  async unpackBale(baleId, data) {
    return this.request(`/bales/${baleId}/unpack`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // 3. PRENDAS / INVENTARIO
  async getGarments(filters = {}) {
    const query = new URLSearchParams();
    if (filters.status) query.append('status', filters.status);
    if (filters.bale_id) query.append('bale_id', filters.bale_id);
    if (filters.category) query.append('category', filters.category);
    if (filters.search) query.append('search', filters.search);

    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/garments${qs}`);
  },

  async getGarment(id) {
    return this.request(`/garments/${id}`);
  },

  async createGarment(data) {
    return this.request('/garments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateGarment(id, data) {
    return this.request(`/garments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteGarment(id) {
    return this.request(`/garments/${id}`, {
      method: 'DELETE'
    });
  },

  // 4. CLIENTES
  async getCustomers() {
    return this.request('/customers');
  },

  async createCustomer(data) {
    return this.request('/customers', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCustomer(id, data) {
    return this.request(`/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteCustomer(id) {
    return this.request(`/customers/${id}`, {
      method: 'DELETE'
    });
  },

  // 5. VENTAS
  async getSales() {
    return this.request('/sales');
  },

  async getSale(id) {
    return this.request(`/sales/${id}`);
  },

  async createSale(data) {
    return this.request('/sales', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateSalePayment(id, status, amount) {
    return this.request(`/sales/${id}/payment`, {
      method: 'PUT',
      body: JSON.stringify({ payment_status: status, amount_paid: amount })
    });
  },

  // 6. GASTOS GENERALES
  async getExpenses() {
    return this.request('/expenses');
  },

  async createExpense(data) {
    return this.request('/expenses', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async deleteExpense(id) {
    return this.request(`/expenses/${id}`, {
      method: 'DELETE'
    });
  },

  // 7. EXPLORADOR SQL DIRECTO
  async executeSql(query) {
    return this.request('/sql', {
      method: 'POST',
      body: JSON.stringify({ query })
    });
  }
};
