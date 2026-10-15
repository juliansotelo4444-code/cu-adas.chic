// ==============================================================================
// CUÑADAS CHIC - CONTROLADOR FÁCIL Y SENCILLO
// Lenguaje claro, cotidiano y sin palabras técnicas para un uso súper intuitivo
// ==============================================================================

const App = {
  currentTab: 'dashboard',
  cart: [],
  selectedCustomerId: null,
  allGarmentsCache: [],
  allBalesCache: [],
  allCustomersCache: [],

  // Iniciar la aplicación
  async init() {
    this.bindEvents();
    this.switchTab('dashboard');
  },

  // Escuchar clics en botones y menús
  bindEvents() {
    // Pestañas (tanto barra superior como barra inferior de celulares)
    document.querySelectorAll('.nav-tab-btn, .mobile-nav-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const tab = e.currentTarget.dataset.tab;
        if (tab) this.switchTab(tab);
      });
    });

    // Cerrar ventanas emergentes con la X o haciendo clic afuera
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', e => {
        if (e.target === modal || e.target.closest('.btn-close-modal') || e.target.closest('.btn-cancel-modal')) {
          this.closeAllModals();
        }
      });
    });

    // Cerrar con la tecla Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') this.closeAllModals();
    });
  },

  // Cambiar de pantalla
  async switchTab(tabName) {
    this.currentTab = tabName;

    // Marcar botón activo tanto arriba como en la barra de celulares
    document.querySelectorAll('.nav-tab-btn, .mobile-nav-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Mostrar la pantalla correspondiente
    document.querySelectorAll('.view-section').forEach(view => {
      view.classList.remove('active');
    });

    const activeView = document.getElementById(`view-${tabName}`);
    if (activeView) activeView.classList.add('active');

    // Desplazar suavemente hacia arriba en el celular
    if (window.innerWidth <= 768) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Gestionar barra flotante de carrito en celular
    const mobileCartBar = document.getElementById('pos-mobile-cart-bar');
    if (mobileCartBar) {
      mobileCartBar.style.display = (tabName === 'pos' && this.cart.length > 0) ? 'flex' : 'none';
    }

    // Cargar los datos de la pantalla
    switch (tabName) {
      case 'dashboard':
        await this.loadDashboard();
        break;
      case 'bales':
        await this.loadBales();
        break;
      case 'garments':
        await this.loadGarments();
        break;
      case 'pos':
        await this.loadPos();
        break;
      case 'sales':
        await this.loadSales();
        break;
      case 'customers':
        await this.loadCustomers();
        break;
    }
  },

  // Mensaje flotante rosa con aviso
  toast(message, type = 'success') {
    const existing = document.querySelector('.chic-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `chic-toast chic-toast-${type}`;
    const icon = type === 'success' ? '🌸' : '⚠️';
    toast.innerHTML = `<span style="font-size:1.2rem;">${icon}</span> <span>${message}</span>`;
    
    Object.assign(toast.style, {
      position: 'fixed',
      bottom: '24px',
      right: '24px',
      background: type === 'success' ? 'linear-gradient(135deg, #be185d, #f43f68)' : '#be123c',
      color: '#fff',
      padding: '0.85rem 1.4rem',
      borderRadius: '999px',
      boxShadow: '0 10px 25px rgba(244, 63, 104, 0.4)',
      fontWeight: '700',
      fontSize: '0.92rem',
      display: 'flex',
      alignItems: 'center',
      gap: '0.65rem',
      zIndex: '9999',
      animation: 'fadeIn 0.3s ease'
    });

    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'opacity 0.4s ease';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 400);
    }, 3200);
  },

  // Formato de plata en pesos ($)
  formatMoney(num) {
    return '$' + Number(num || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  // ----------------------------------------------------------------------------
  // 1. RESUMEN DEL NEGOCIO (Dashboard)
  // ----------------------------------------------------------------------------
  async loadDashboard() {
    try {
      const res = await API.getMetrics();
      const { summary, salesTimeline, balePerformance, salesByCategory, costBreakdown, recentSales } = res.data;

      // Números principales
      document.getElementById('kpi-total-revenue').textContent = this.formatMoney(summary.totalRevenue);
      document.getElementById('kpi-collected').textContent = `Ya cobrado: ${this.formatMoney(summary.totalCollected)}`;
      
      document.getElementById('kpi-net-profit').textContent = this.formatMoney(summary.netProfitOnSold);
      document.getElementById('kpi-margin-percent').textContent = `${summary.netMargin}% de ganancia limpia`;

      document.getElementById('kpi-bales-invested').textContent = this.formatMoney(summary.totalBalesInvested);
      document.getElementById('kpi-active-bales').textContent = `${summary.activeBalesCount || 0} fardos listos`;

      document.getElementById('kpi-stock-count').textContent = `${summary.availableCount || 0} prendas listas`;
      document.getElementById('kpi-potential-val').textContent = `Si vendes todo juntas: ${this.formatMoney(summary.potentialInventoryRevenue)}`;

      // Dibujar gráficos
      ChicCharts.renderSalesTimeline('chart-sales-timeline', salesTimeline);
      ChicCharts.renderCostDonut('chart-cost-breakdown', costBreakdown);
      ChicCharts.renderBaleRoiBars('chart-bale-roi', balePerformance);
      ChicCharts.renderCategorySales('chart-category-sales', salesByCategory);

      // Tabla de ventas de muestra
      this.renderRecentSalesTable(recentSales);
    } catch (err) {
      this.toast('No pudimos cargar el resumen: ' + err.message, 'error');
    }
  },

  renderRecentSalesTable(sales) {
    const tbody = document.getElementById('recent-sales-tbody');
    if (!tbody) return;

    if (!sales || sales.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2.5rem; color:var(--text-muted);">🌸 Todavía no hay ventas anotadas</td></tr>`;
      return;
    }

    tbody.innerHTML = sales.map(s => {
      let estadoTexto = '';
      if (s.payment_status === 'pagado') {
        estadoTexto = '<span class="badge badge-green">✓ Pagó todo</span>';
      } else if (s.payment_status === 'seña_anticipo') {
        estadoTexto = `<span class="badge badge-amber">Dejó seña: ${this.formatMoney(s.amount_paid)}</span>`;
      } else {
        estadoTexto = '<span class="badge badge-pink">Falta pagar</span>';
      }

      return `
        <tr>
          <td data-label="N° Ticket"><span class="sku-chip">${s.invoice_code}</span></td>
          <td data-label="Clienta">
            <div style="font-weight:700;">${s.customer_name || 'Clienta de Mostrador'}</div>
            <div style="font-size:0.75rem; color:var(--text-muted);">${s.customer_instagram || ''}</div>
          </td>
          <td data-label="Día y Hora">${s.sale_date}</td>
          <td data-label="¿Cómo pagó?">${estadoTexto}</td>
          <td data-label="Total" style="font-weight:800; color:var(--primary-pink); text-align:right;">${this.formatMoney(s.total_amount)}</td>
        </tr>
      `;
    }).join('');
  },

  // ----------------------------------------------------------------------------
  // 2. MIS FARDOS
  // ----------------------------------------------------------------------------
  async loadBales() {
    try {
      const res = await API.getBales();
      this.allBalesCache = res.data;
      const grid = document.getElementById('bales-grid-container');
      if (!grid) return;

      if (this.allBalesCache.length === 0) {
        grid.innerHTML = `
          <div style="grid-column: 1/-1; text-align:center; padding: 4rem 1.5rem; background:white; border-radius:20px; border:2px dashed #fbcfe8;">
            <div style="font-size:3rem; margin-bottom:0.75rem;">📦</div>
            <h3 style="color:var(--pink-deep); font-size:1.3rem; font-weight:800; margin-bottom:0.4rem;">Todavía no cargaste ningún fardo</h3>
            <p style="color:var(--text-secondary); font-size:0.95rem; margin-bottom:1.5rem; max-width:440px; margin-left:auto; margin-right:auto;">
              Anota lo que te costó el fardo, el envío y el lavado para que el sistema calcule el precio de cada prenda por ti.
            </p>
            <button class="btn btn-gold" onclick="App.openNewBaleModal()">✨ Cargar mi Primer Fardo</button>
          </div>
        `;
        return;
      }

      grid.innerHTML = this.allBalesCache.map(b => {
        const totalCost = b.calculated_total_cost || (b.purchase_cost + b.shipping_cost + b.customs_cost + b.other_expenses);
        const pieces = b.actual_pieces > 0 ? b.actual_pieces : (b.estimated_pieces || 1);
        const unitCost = (totalCost / pieces).toFixed(2);
        const recovered = b.total_recovered || 0;
        const progress = Math.min(100, Math.round((recovered / totalCost) * 100));

        let statusBadge = '<span class="badge badge-green">✓ Listo para vender</span>';
        if (b.status === 'recibido') statusBadge = '<span class="badge badge-pink">📦 Cerrado sin abrir</span>';
        if (b.status === 'clasificando') statusBadge = '<span class="badge badge-gold">⏳ Separando y lavando</span>';
        if (b.status === 'agotado') statusBadge = '<span class="badge badge-gray">✓ Se vendió todo</span>';

        return `
          <div class="bale-card">
            <div class="bale-card-header">
              <div class="bale-card-title">
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <span class="sku-chip">${b.code}</span>
                  <span style="font-size:0.82rem; color:var(--text-secondary); font-weight:600;">${b.origin_country || 'USA'}</span>
                </div>
                <h4>${b.name}</h4>
              </div>
              ${statusBadge}
            </div>

            <!-- Detalle de lo que gastaste en este fardo -->
            <div class="cost-breakdown-box">
              <div class="cost-item">
                <span class="cost-label">Precio del Fardo</span>
                <span class="cost-val">${this.formatMoney(b.purchase_cost)}</span>
              </div>
              <div class="cost-item">
                <span class="cost-label">Flete / Envío</span>
                <span class="cost-val">${this.formatMoney(b.shipping_cost)}</span>
              </div>
              <div class="cost-item">
                <span class="cost-label">Aduana e Impuestos</span>
                <span class="cost-val">${this.formatMoney(b.customs_cost)}</span>
              </div>
              <div class="cost-item">
                <span class="cost-label">Lavado y Arreglos</span>
                <span class="cost-val">${this.formatMoney(b.other_expenses)}</span>
              </div>
              <div class="cost-total-highlight">
                <div>
                  <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:800;">TOTAL GASTADO EN ESTE FARDO</div>
                  <div style="font-size:1.3rem; font-weight:900; color:var(--primary-pink);">${this.formatMoney(totalCost)}</div>
                </div>
                <div style="text-align:right;">
                  <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:800;">TE COSTÓ POR PRENDA</div>
                  <div style="font-size:1.2rem; font-weight:900; color:var(--gold-600);">${this.formatMoney(unitCost)}</div>
                </div>
              </div>
            </div>

            <!-- Progreso de plata recuperada -->
            <div class="progress-bar-wrapper">
              <div class="progress-info">
                <span>Plata recuperada: ${this.formatMoney(recovered)} (${progress}%)</span>
                <span>${b.garments_sold || 0} vendidas de ${b.garments_count || 0} prendas</span>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${progress >= 100 ? 'gold' : ''}" style="width: ${progress}%;"></div>
              </div>
            </div>

            <!-- Botones -->
            <div style="display:flex; gap:0.5rem; margin-top:auto; padding-top:0.5rem;">
              <button class="btn btn-sm btn-outline-pink" style="flex:1;" onclick="App.openUnpackModal(${b.id})">
                📦 Cargar ropa de este fardo
              </button>
              <button class="btn btn-sm btn-ghost" title="Modificar Fardo" onclick="App.openEditBaleModal(${b.id})">
                ✏️ Modificar
              </button>
              <button class="btn btn-sm btn-ghost" title="Borrar Fardo" style="color:#be123c;" onclick="App.deleteBale(${b.id})">
                🗑️ Borrar
              </button>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      this.toast('Error al mostrar los fardos: ' + err.message, 'error');
    }
  },

  openNewBaleModal() {
    document.getElementById('bale-modal-title').textContent = '✨ Cargar Nuevo Fardo';
    document.getElementById('form-bale').reset();
    document.getElementById('bale-id').value = '';
    document.getElementById('bale-code').value = `FARDO-${new Date().getFullYear()}-${String(Date.now()).slice(-3)}`;
    document.getElementById('bale-date').value = new Date().toISOString().slice(0, 10);
    this.openModal('modal-bale');
  },

  openEditBaleModal(id) {
    const bale = this.allBalesCache.find(b => b.id === id);
    if (!bale) return;

    document.getElementById('bale-modal-title').textContent = '✏️ Modificar Fardo';
    document.getElementById('bale-id').value = bale.id;
    document.getElementById('bale-code').value = bale.code;
    document.getElementById('bale-name').value = bale.name;
    document.getElementById('bale-category').value = bale.category;
    document.getElementById('bale-supplier').value = bale.supplier || '';
    document.getElementById('bale-country').value = bale.origin_country || 'Estados Unidos';
    document.getElementById('bale-purchase-cost').value = bale.purchase_cost;
    document.getElementById('bale-shipping-cost').value = bale.shipping_cost;
    document.getElementById('bale-customs-cost').value = bale.customs_cost;
    document.getElementById('bale-other-expenses').value = bale.other_expenses;
    document.getElementById('bale-weight').value = bale.weight_kg;
    document.getElementById('bale-est-pieces').value = bale.estimated_pieces;
    document.getElementById('bale-actual-pieces').value = bale.actual_pieces;
    document.getElementById('bale-date').value = bale.arrival_date;
    document.getElementById('bale-status').value = bale.status;
    document.getElementById('bale-notes').value = bale.notes || '';

    this.openModal('modal-bale');
  },

  async saveBale(e) {
    e.preventDefault();
    const id = document.getElementById('bale-id').value;
    const data = {
      code: document.getElementById('bale-code').value,
      name: document.getElementById('bale-name').value,
      category: document.getElementById('bale-category').value,
      supplier: document.getElementById('bale-supplier').value,
      origin_country: document.getElementById('bale-country').value,
      purchase_cost: parseFloat(document.getElementById('bale-purchase-cost').value) || 0,
      shipping_cost: parseFloat(document.getElementById('bale-shipping-cost').value) || 0,
      customs_cost: parseFloat(document.getElementById('bale-customs-cost').value) || 0,
      other_expenses: parseFloat(document.getElementById('bale-other-expenses').value) || 0,
      weight_kg: parseFloat(document.getElementById('bale-weight').value) || 0,
      estimated_pieces: parseInt(document.getElementById('bale-est-pieces').value) || 0,
      actual_pieces: parseInt(document.getElementById('bale-actual-pieces').value) || 0,
      arrival_date: document.getElementById('bale-date').value,
      status: document.getElementById('bale-status').value,
      notes: document.getElementById('bale-notes').value
    };

    try {
      if (id) {
        await API.updateBale(id, data);
        this.toast('Fardo modificado correctamente');
      } else {
        await API.createBale(data);
        this.toast('🌸 ¡Nuevo fardo guardado!');
      }
      this.closeAllModals();
      await this.loadBales();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async deleteBale(id) {
    if (!confirm('¿Segura que deseas borrar este fardo?')) return;
    try {
      await API.deleteBale(id);
      this.toast('Fardo borrado');
      await this.loadBales();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  openUnpackModal(baleId) {
    const bale = this.allBalesCache.find(b => b.id === baleId);
    if (!bale) return;

    document.getElementById('unpack-bale-id').value = bale.id;
    document.getElementById('unpack-bale-title').textContent = `${bale.code} - ${bale.name}`;
    document.getElementById('unpack-count').value = bale.actual_pieces || bale.estimated_pieces || 25;
    document.getElementById('unpack-category').value = bale.category;
    document.getElementById('unpack-price').value = 35.00;

    this.openModal('modal-unpack');
  },

  async submitUnpack(e) {
    e.preventDefault();
    const baleId = document.getElementById('unpack-bale-id').value;
    const count = parseInt(document.getElementById('unpack-count').value) || 10;
    const category = document.getElementById('unpack-category').value;
    const defaultPrice = parseFloat(document.getElementById('unpack-price').value) || 0;

    try {
      const res = await API.unpackBale(baleId, { count, category, default_price: defaultPrice });
      this.toast(res.data.message);
      this.closeAllModals();
      await this.loadBales();
      this.switchTab('garments');
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // ----------------------------------------------------------------------------
  // 3. MI ROPA (Inventario)
  // ----------------------------------------------------------------------------
  async loadGarments() {
    try {
      const status = document.getElementById('filter-garment-status')?.value || '';
      const baleId = document.getElementById('filter-garment-bale')?.value || '';
      const search = document.getElementById('search-garment')?.value || '';

      const res = await API.getGarments({ status, bale_id: baleId, search });
      this.allGarmentsCache = res.data;

      this.populateBaleSelectors();

      const tbody = document.getElementById('garments-tbody');
      if (!tbody) return;

      if (this.allGarmentsCache.length === 0) {
        tbody.innerHTML = `
          <tr><td colspan="8" style="text-align:center; padding:3.5rem; color:var(--text-muted);">
            <div style="font-size:2.5rem; margin-bottom:0.5rem;">👗</div>
            <strong style="color:var(--pink-deep); font-size:1.05rem;">No hay ropa para mostrar</strong>
            <p style="font-size:0.85rem; margin-top:0.3rem;">Prueba cambiando el buscador o haz clic en <strong>+ Cargar Ropa</strong> para agregar prendas.</p>
          </td></tr>
        `;
        return;
      }

      tbody.innerHTML = this.allGarmentsCache.map(g => {
        let statusBadge = '';
        if (g.status === 'disponible') statusBadge = '<span class="badge badge-green">Lista para vender</span>';
        else if (g.status === 'vendido') statusBadge = '<span class="badge badge-purple">Ya vendida</span>';
        else if (g.status === 'reservado') statusBadge = '<span class="badge badge-amber">Apartada con seña</span>';
        else statusBadge = '<span class="badge badge-pink">Prenda fallada</span>';

        return `
          <tr>
            <td data-label="Código"><span class="sku-chip">${g.sku}</span></td>
            <td data-label="Prenda y Marca">
              <div style="font-weight:700; color:var(--text-primary);">${g.name}</div>
              <div style="font-size:0.75rem; color:var(--text-muted);">${g.brand || 'Vintage'} • ${g.color || 'Varios'}</div>
            </td>
            <td data-label="Tipo"><span class="badge badge-pink">${g.category}</span></td>
            <td data-label="Talle"><strong style="color:var(--text-secondary);">${g.size || 'M'}</strong></td>
            <td data-label="Te Costó"><span style="font-size:0.85rem; color:var(--text-secondary);">${this.formatMoney(g.cost_price)}</span></td>
            <td data-label="Precio Venta"><strong style="font-size:1rem; color:var(--primary-pink);">${this.formatMoney(g.sale_price)}</strong></td>
            <td data-label="Estado">${statusBadge}</td>
            <td data-label="Opciones" style="text-align:right;">
              <div style="display:inline-flex; gap:0.3rem;">
                <button class="btn btn-sm btn-outline-gold" title="Ver etiqueta para colgar" onclick="App.openTagModal(${g.id})">
                  🏷️ Etiqueta
                </button>
                <button class="btn btn-sm btn-ghost" title="Modificar prenda" onclick="App.openEditGarmentModal(${g.id})">
                  ✏️ Modificar
                </button>
                <button class="btn btn-sm btn-ghost" title="Borrar prenda" style="color:#be123c;" onclick="App.deleteGarment(${g.id})">
                  🗑️ Borrar
                </button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      this.toast('Error cargando las prendas: ' + err.message, 'error');
    }
  },

  populateBaleSelectors() {
    if (!this.allBalesCache || this.allBalesCache.length === 0) return;
    
    const filterSelect = document.getElementById('filter-garment-bale');
    if (filterSelect && filterSelect.options.length <= 1) {
      this.allBalesCache.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.code} - ${b.name}`;
        filterSelect.appendChild(opt);
      });
    }

    const modalSelect = document.getElementById('garment-bale-id');
    if (modalSelect && modalSelect.options.length <= 1) {
      this.allBalesCache.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = `${b.code} - ${b.name}`;
        modalSelect.appendChild(opt);
      });
    }
  },

  openNewGarmentModal() {
    document.getElementById('garment-modal-title').textContent = '✨ Cargar Nueva Prenda';
    document.getElementById('form-garment').reset();
    document.getElementById('garment-id').value = '';
    document.getElementById('garment-sku').value = `CHIC-${String(Date.now()).slice(-4)}`;
    document.getElementById('garment-barcode').value = `779${String(Date.now()).slice(-9)}`;
    this.populateBaleSelectors();
    this.openModal('modal-garment');
  },

  openEditGarmentModal(id) {
    const garment = this.allGarmentsCache.find(g => g.id === id);
    if (!garment) return;

    this.populateBaleSelectors();
    document.getElementById('garment-modal-title').textContent = '✏️ Modificar Prenda';
    document.getElementById('garment-id').value = garment.id;
    document.getElementById('garment-bale-id').value = garment.bale_id || '';
    document.getElementById('garment-sku').value = garment.sku;
    document.getElementById('garment-name').value = garment.name;
    document.getElementById('garment-category').value = garment.category;
    document.getElementById('garment-brand').value = garment.brand || '';
    document.getElementById('garment-size').value = garment.size || 'M';
    document.getElementById('garment-color').value = garment.color || '';
    document.getElementById('garment-condition').value = garment.condition || 'Excelente';
    document.getElementById('garment-cost-price').value = garment.cost_price;
    document.getElementById('garment-sale-price').value = garment.sale_price;
    document.getElementById('garment-status').value = garment.status;
    document.getElementById('garment-barcode').value = garment.barcode || '';
    document.getElementById('garment-notes').value = garment.notes || '';

    this.openModal('modal-garment');
  },

  async saveGarment(e) {
    e.preventDefault();
    const id = document.getElementById('garment-id').value;
    const data = {
      bale_id: document.getElementById('garment-bale-id').value || null,
      sku: document.getElementById('garment-sku').value,
      name: document.getElementById('garment-name').value,
      category: document.getElementById('garment-category').value,
      brand: document.getElementById('garment-brand').value,
      size: document.getElementById('garment-size').value,
      color: document.getElementById('garment-color').value,
      condition: document.getElementById('garment-condition').value,
      cost_price: parseFloat(document.getElementById('garment-cost-price').value) || 0,
      sale_price: parseFloat(document.getElementById('garment-sale-price').value) || 0,
      status: document.getElementById('garment-status').value,
      barcode: document.getElementById('garment-barcode').value,
      notes: document.getElementById('garment-notes').value
    };

    try {
      if (id) {
        await API.updateGarment(id, data);
        this.toast('Prenda modificada correctamente');
      } else {
        await API.createGarment(data);
        this.toast('🌸 Prenda guardada en la lista');
      }
      this.closeAllModals();
      await this.loadGarments();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async deleteGarment(id) {
    if (!confirm('¿Segura que deseas borrar esta prenda?')) return;
    try {
      await API.deleteGarment(id);
      this.toast('Prenda borrada');
      await this.loadGarments();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  openTagModal(id) {
    const garment = this.allGarmentsCache.find(g => g.id === id);
    if (!garment) return;

    document.getElementById('tag-name').textContent = garment.name;
    document.getElementById('tag-sku').textContent = garment.sku;
    document.getElementById('tag-brand').textContent = 'CUÑADAS CHIC';
    document.getElementById('tag-size').textContent = `Talle: ${garment.size || 'M'}`;
    document.getElementById('tag-condition').textContent = garment.condition || 'Impecable';
    document.getElementById('tag-price').textContent = this.formatMoney(garment.sale_price);
    document.getElementById('tag-barcode-text').textContent = garment.barcode || garment.sku;

    this.openModal('modal-tag');
  },

  printTag() {
    window.print();
  },

  // ----------------------------------------------------------------------------
  // 4. COBRAR / VENDER
  // ----------------------------------------------------------------------------
  async loadPos() {
    try {
      const custRes = await API.getCustomers();
      this.allCustomersCache = custRes.data;
      const select = document.getElementById('pos-customer-select');
      if (select) {
        select.innerHTML = '<option value="">-- Clienta del mostrador (Ocasional) --</option>';
        this.allCustomersCache.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.id;
          opt.textContent = `${c.name} (${c.instagram || c.phone || 'Sin red'})`;
          select.appendChild(opt);
        });
      }

      const gRes = await API.getGarments({ status: 'disponible' });
      this.renderPosGarmentCatalog(gRes.data);
      this.updateCartUI();
    } catch (err) {
      this.toast('Error en el módulo de ventas: ' + err.message, 'error');
    }
  },

  renderPosGarmentCatalog(garments) {
    const container = document.getElementById('pos-garments-catalog');
    if (!container) return;

    if (!garments || garments.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; text-align:center; padding:3rem; color:var(--text-muted);">
          <div style="font-size:2.5rem; margin-bottom:0.5rem;">🌸</div>
          <strong>No hay ropa lista para vender</strong>
          <p style="font-size:0.85rem; margin-top:0.25rem;">Carga prendas en "Mi Ropa" para poder venderlas aquí.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = garments.map(g => `
      <div style="background:white; border-radius:14px; border:1.5px solid #fbcfe8; padding:0.95rem; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 3px 8px rgba(244,63,104,0.05); transition:all 0.2s;" onmouseover="this.style.borderColor='var(--primary-pink)'" onmouseout="this.style.borderColor='#fbcfe8'">
        <div>
          <div style="display:flex; justify-content:space-between; margin-bottom:0.35rem;">
            <span class="sku-chip">${g.sku}</span>
            <span style="font-size:0.78rem; font-weight:800; color:var(--text-secondary);">Talle ${g.size}</span>
          </div>
          <h5 style="font-size:0.92rem; font-weight:800; margin-bottom:0.25rem; color:var(--text-primary);">${g.name}</h5>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:0.6rem;">${g.brand || 'Vintage'} • ${g.category}</div>
        </div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-top:0.65rem; border-top:1.5px dashed #fce7f3; padding-top:0.55rem;">
          <strong style="font-size:1.15rem; color:var(--primary-pink);">${this.formatMoney(g.sale_price)}</strong>
          <button class="btn btn-sm btn-gold" onclick="App.addToCart(${g.id})">
            + Agregar
          </button>
        </div>
      </div>
    `).join('');
  },

  addToCart(garmentId) {
    const exists = this.cart.find(item => item.id === garmentId);
    if (exists) {
      this.toast('Esta prenda ya la habías puesto en la orden', 'error');
      return;
    }

    const g = this.allGarmentsCache.find(item => item.id === garmentId);
    if (!g) return;

    this.cart.push(g);
    this.toast(`Prenda "${g.name}" agregada`);
    this.updateCartUI();
  },

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.updateCartUI();
  },

  updateCartUI() {
    const list = document.getElementById('pos-cart-list');
    const emptyMsg = document.getElementById('pos-cart-empty');
    if (!list) return;

    if (this.cart.length === 0) {
      list.innerHTML = '';
      if (emptyMsg) emptyMsg.style.display = 'block';
      document.getElementById('pos-items-count').textContent = '0 prendas';
    } else {
      if (emptyMsg) emptyMsg.style.display = 'none';
      document.getElementById('pos-items-count').textContent = `${this.cart.length} prendas`;
      list.innerHTML = this.cart.map((item, idx) => `
        <div class="cart-item">
          <div class="cart-item-info">
            <span class="sku-chip" style="font-size:0.75rem;">${item.sku}</span>
            <div style="font-weight:800; font-size:0.88rem; margin-top:0.2rem;">${item.name}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary);">${item.size} • ${item.brand || 'Vintage'}</div>
          </div>
          <div style="display:flex; align-items:center; gap:0.6rem;">
            <strong style="color:var(--primary-pink); font-size:1rem;">${this.formatMoney(item.sale_price)}</strong>
            <button style="background:none; border:none; color:#be123c; cursor:pointer; font-size:1.1rem; font-weight:bold;" title="Sacar de la orden" onclick="App.removeFromCart(${idx})">✕</button>
          </div>
        </div>
      `).join('');
    }

    // Totales
    const subtotal = this.cart.reduce((sum, item) => sum + item.sale_price, 0);
    const discount = parseFloat(document.getElementById('pos-discount')?.value) || 0;
    const total = Math.max(0, subtotal - discount);

    document.getElementById('pos-subtotal').textContent = this.formatMoney(subtotal);
    document.getElementById('pos-total').textContent = this.formatMoney(total);

    const paymentStatus = document.getElementById('pos-payment-status')?.value;
    const señaRow = document.getElementById('pos-seña-row');
    if (señaRow) {
      señaRow.style.display = paymentStatus === 'seña_anticipo' ? 'flex' : 'none';
      if (paymentStatus === 'seña_anticipo' && !document.getElementById('pos-amount-paid').value) {
        document.getElementById('pos-amount-paid').value = (total / 2).toFixed(2);
      }
    }

    // Actualizar indicador y barra flotante en celulares
    const mobileBadge = document.getElementById('mobile-badge-cart-count');
    const mobileCartBar = document.getElementById('pos-mobile-cart-bar');
    const mobileCartCount = document.getElementById('pos-mobile-cart-count');
    const mobileCartTotal = document.getElementById('pos-mobile-cart-total');

    if (this.cart.length > 0) {
      if (mobileBadge) {
        mobileBadge.style.display = 'inline-flex';
        mobileBadge.textContent = this.cart.length;
      }
      if (mobileCartBar && this.currentTab === 'pos') {
        mobileCartBar.style.display = 'flex';
        if (mobileCartCount) {
          mobileCartCount.textContent = `${this.cart.length} ${this.cart.length === 1 ? 'prenda lista' : 'prendas listas'}`;
        }
        if (mobileCartTotal) {
          mobileCartTotal.textContent = this.formatMoney(total);
        }
      }
    } else {
      if (mobileBadge) mobileBadge.style.display = 'none';
      if (mobileCartBar) mobileCartBar.style.display = 'none';
    }
  },

  // Desplazar la pantalla directo al cobro/carrito en celular
  scrollToCart() {
    const cartPanel = document.querySelector('.pos-cart-panel');
    if (cartPanel) {
      cartPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  },

  // Buscador rápido de ropa dentro de Cobrar/Vender
  filterPosCatalog() {
    const query = (document.getElementById('pos-search-garment')?.value || '').toLowerCase().trim();
    const items = document.querySelectorAll('#pos-garments-catalog > div');
    items.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = (!query || text.includes(query)) ? 'flex' : 'none';
    });
  },

  async submitSale(e) {
    e.preventDefault();
    if (this.cart.length === 0) {
      this.toast('Debes elegir al menos una prenda para cobrar', 'error');
      return;
    }

    const customerId = document.getElementById('pos-customer-select').value;
    const discount = parseFloat(document.getElementById('pos-discount').value) || 0;
    const paymentStatus = document.getElementById('pos-payment-status').value;
    const amountPaid = parseFloat(document.getElementById('pos-amount-paid').value) || 0;
    const paymentMethod = document.getElementById('pos-payment-method').value;
    const deliveryStatus = document.getElementById('pos-delivery-status').value;
    const notes = document.getElementById('pos-notes').value;

    const payload = {
      customer_id: customerId || null,
      items: this.cart.map(g => g.id),
      discount,
      payment_status: paymentStatus,
      amount_paid: amountPaid,
      payment_method: paymentMethod,
      delivery_status: deliveryStatus,
      notes
    };

    try {
      const res = await API.createSale(payload);
      this.toast('🌸 ¡Venta anotada con éxito!');
      
      this.cart = [];
      document.getElementById('pos-discount').value = 0;
      document.getElementById('pos-notes').value = '';
      this.updateCartUI();

      await this.loadPos();
      this.showReceiptModal(res.data.id);
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // ----------------------------------------------------------------------------
  // 5. VENTAS HECHAS & TICKETS
  // ----------------------------------------------------------------------------
  async loadSales() {
    try {
      const res = await API.getSales();
      const tbody = document.getElementById('sales-tbody');
      if (!tbody) return;

      if (res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:3.5rem; color:var(--text-muted);">🌸 Todavía no se hicieron ventas</td></tr>`;
        return;
      }

      tbody.innerHTML = res.data.map(s => {
        let statusBadge = '';
        if (s.payment_status === 'pagado') statusBadge = '<span class="badge badge-green">✓ Pagó todo</span>';
        else if (s.payment_status === 'seña_anticipo') statusBadge = `<span class="badge badge-amber">Dejó seña: ${this.formatMoney(s.amount_paid)}</span>`;
        else statusBadge = '<span class="badge badge-pink">Falta pagar</span>';

        return `
          <tr>
            <td data-label="N° Ticket"><span class="sku-chip">${s.invoice_code}</span></td>
            <td data-label="Clienta">
              <div style="font-weight:700;">${s.customer_name || 'Clienta de Mostrador'}</div>
              <div style="font-size:0.78rem; color:var(--text-secondary);">${s.customer_phone || ''} ${s.customer_instagram || ''}</div>
            </td>
            <td data-label="Día y Hora">${s.sale_date}</td>
            <td data-label="Prendas"><strong>${s.items_count} prendas</strong></td>
            <td data-label="Total"><strong style="color:var(--primary-pink); font-size:1.05rem;">${this.formatMoney(s.total_amount)}</strong></td>
            <td data-label="¿Pagó?">${statusBadge}</td>
            <td data-label="Ticket" style="text-align:right;">
              <button class="btn btn-sm btn-outline-gold" onclick="App.showReceiptModal(${s.id})">
                🧾 Ver Ticket
              </button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      this.toast('Error cargando las ventas: ' + err.message, 'error');
    }
  },

  async showReceiptModal(saleId) {
    try {
      const res = await API.getSale(saleId);
      const sale = res.data;

      document.getElementById('receipt-code').textContent = sale.invoice_code;
      document.getElementById('receipt-date').textContent = sale.sale_date;
      document.getElementById('receipt-customer').textContent = sale.customer_name || 'Clienta de Mostrador';
      document.getElementById('receipt-instagram').textContent = sale.customer_instagram || '-';
      document.getElementById('receipt-method').textContent = sale.payment_method || 'Efectivo';
      document.getElementById('receipt-delivery').textContent = sale.delivery_status || 'Se lo llevó en mano';

      const itemsTbody = document.getElementById('receipt-items-tbody');
      itemsTbody.innerHTML = sale.items.map(it => `
        <tr>
          <td>
            <div style="font-weight:700;">${it.garment_name}</div>
            <div style="font-size:0.74rem; color:var(--text-secondary);">Código: ${it.sku} | Talle: ${it.size}</div>
          </td>
          <td style="text-align:right; font-weight:800;">${this.formatMoney(it.unit_price)}</td>
        </tr>
      `).join('');

      document.getElementById('receipt-subtotal').textContent = this.formatMoney(sale.subtotal);
      document.getElementById('receipt-discount').textContent = `-${this.formatMoney(sale.discount)}`;
      document.getElementById('receipt-total').textContent = this.formatMoney(sale.total_amount);
      document.getElementById('receipt-paid').textContent = this.formatMoney(sale.amount_paid);

      const balance = Math.max(0, sale.total_amount - sale.amount_paid);
      const balanceRow = document.getElementById('receipt-balance-row');
      if (balanceRow) {
        balanceRow.style.display = balance > 0 ? 'flex' : 'none';
        document.getElementById('receipt-balance').textContent = this.formatMoney(balance);
      }

      this.openModal('modal-receipt');
    } catch (err) {
      this.toast('Error al abrir el ticket: ' + err.message, 'error');
    }
  },

  // ----------------------------------------------------------------------------
  // 6. CLIENTAS
  // ----------------------------------------------------------------------------
  async loadCustomers() {
    try {
      const res = await API.getCustomers();
      const tbody = document.getElementById('customers-tbody');
      if (!tbody) return;

      if (res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:3.5rem; color:var(--text-muted);">🌸 Todavía no cargaste clientas</td></tr>`;
        return;
      }

      tbody.innerHTML = res.data.map(c => {
        const debtBadge = c.debt_amount > 0 
          ? `<span class="badge badge-amber">Debe seña: ${this.formatMoney(c.debt_amount)}</span>` 
          : `<span class="badge badge-green">Al día (no debe nada)</span>`;

        return `
          <tr>
            <td data-label="Clienta">
              <div style="font-weight:800; color:var(--text-primary);">${c.name}</div>
              <div style="font-size:0.78rem; color:var(--text-secondary);">${c.notes || ''}</div>
            </td>
            <td data-label="Instagram">
              ${c.instagram ? `<span class="sku-chip" style="color:#d946ef; background:#fdf4ff; border-color:#f0abfc;">📸 ${c.instagram}</span>` : '-'}
            </td>
            <td data-label="WhatsApp">
              ${c.phone ? `<a href="https://wa.me/${c.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color:#15803d; font-weight:700; text-decoration:none;">💬 ${c.phone}</a>` : '-'}
            </td>
            <td data-label="Ciudad">${c.city || 'Sin ciudad'}</td>
            <td data-label="Compras y Deuda">
              <div><strong>${this.formatMoney(c.total_spent)}</strong> (${c.sales_count} compras)</div>
              <div style="margin-top:0.2rem;">${debtBadge}</div>
            </td>
            <td data-label="Opciones" style="text-align:right;">
              <button class="btn btn-sm btn-ghost" onclick="App.openEditCustomerModal(${c.id})">✏️ Modificar</button>
              <button class="btn btn-sm btn-ghost" style="color:#be123c;" onclick="App.deleteCustomer(${c.id})">🗑️ Borrar</button>
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      this.toast('Error al mostrar clientas: ' + err.message, 'error');
    }
  },

  openNewCustomerModal() {
    document.getElementById('customer-modal-title').textContent = '✨ Anotar Nueva Clienta';
    document.getElementById('form-customer').reset();
    document.getElementById('customer-id').value = '';
    this.openModal('modal-customer');
  },

  openEditCustomerModal(id) {
    const cust = this.allCustomersCache.find(c => c.id === id);
    if (!cust) return;

    document.getElementById('customer-modal-title').textContent = '✏️ Modificar Clienta';
    document.getElementById('customer-id').value = cust.id;
    document.getElementById('customer-name').value = cust.name;
    document.getElementById('customer-phone').value = cust.phone || '';
    document.getElementById('customer-email').value = cust.email || '';
    document.getElementById('customer-instagram').value = cust.instagram || '';
    document.getElementById('customer-city').value = cust.city || '';
    document.getElementById('customer-address').value = cust.address || '';
    document.getElementById('customer-notes').value = cust.notes || '';

    this.openModal('modal-customer');
  },

  async saveCustomer(e) {
    e.preventDefault();
    const id = document.getElementById('customer-id').value;
    const data = {
      name: document.getElementById('customer-name').value,
      phone: document.getElementById('customer-phone').value,
      email: document.getElementById('customer-email').value,
      instagram: document.getElementById('customer-instagram').value,
      city: document.getElementById('customer-city').value,
      address: document.getElementById('customer-address').value,
      notes: document.getElementById('customer-notes').value
    };

    try {
      if (id) {
        await API.updateCustomer(id, data);
        this.toast('Clienta modificada');
      } else {
        await API.createCustomer(data);
        this.toast('🌸 Clienta guardada correctamente');
      }
      this.closeAllModals();
      await this.loadCustomers();
      if (this.currentTab === 'pos') await this.loadPos();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  async deleteCustomer(id) {
    if (!confirm('¿Segura que deseas borrar a esta clienta?')) return;
    try {
      await API.deleteCustomer(id);
      this.toast('Clienta borrada');
      await this.loadCustomers();
    } catch (err) {
      this.toast(err.message, 'error');
    }
  },

  // Ventanas
  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  },

  closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
  }
};

// Arrancar cuando cargue la página
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
