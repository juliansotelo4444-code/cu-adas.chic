// ==============================================================================
// MOTOR DE GRÁFICOS SVG INTERACTIVOS - CUÑADAS CHIC
// Paleta Rosa Intenso y Dorado Metálico sin librerías externas
// ==============================================================================

const ChicCharts = {
  // Formateador de moneda
  formatCurrency(val) {
    return '$' + Number(val || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  },

  // 1. GRÁFICO DE BARRAS: VENTAS VS COSTOS VS GANANCIA EN EL TIEMPO
  renderSalesTimeline(containerId, timeline) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!timeline || timeline.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 3rem 1.5rem; color: var(--text-muted);">
          <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">🌸</div>
          <h4 style="font-weight: 800; color: var(--pink-deep); font-size: 1.05rem; margin-bottom: 0.35rem;">¡Lista para tus primeras ventas!</h4>
          <p style="font-size: 0.88rem; color: var(--text-secondary); max-width: 360px; margin: 0 auto;">
            Cuando registres tus primeras ventas en el mostrador, aquí verás el gráfico interactivo de ingresos y margen de ganancia.
          </p>
        </div>
      `;
      return;
    }

    const width = container.clientWidth || 600;
    const height = 260;
    const padding = { top: 30, right: 20, bottom: 40, left: 55 };

    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    // Calcular máximos para la escala Y
    const maxVal = Math.max(...timeline.map(d => Math.max(d.revenue, d.cost, d.profit, 10)));
    const yMax = Math.ceil(maxVal * 1.15);

    const barGroupWidth = chartW / timeline.length;
    const barWidth = Math.min(22, (barGroupWidth - 12) / 3);

    // Eje Y y líneas horizontales de cuadrícula
    const gridLines = 4;
    let gridSvg = '';
    for (let i = 0; i <= gridLines; i++) {
      const yVal = (yMax / gridLines) * i;
      const yPos = padding.top + chartH - (i / gridLines) * chartH;
      gridSvg += `
        <line x1="${padding.left}" y1="${yPos}" x2="${width - padding.right}" y2="${yPos}" stroke="#fadbe5" stroke-dasharray="3,3" />
        <text x="${padding.left - 8}" y="${yPos + 4}" font-size="11" fill="#9c5c76" text-anchor="end">$${Math.round(yVal)}</text>
      `;
    }

    // Dibujar barras para cada fecha
    let barsSvg = '';
    timeline.forEach((item, index) => {
      const groupX = padding.left + index * barGroupWidth + (barGroupWidth - (barWidth * 3 + 4)) / 2;
      const dateLabel = item.date ? item.date.slice(5) : `Día ${index + 1}`;

      const hRev = (item.revenue / yMax) * chartH;
      const yRev = padding.top + chartH - hRev;

      const hCost = (item.cost / yMax) * chartH;
      const yCost = padding.top + chartH - hCost;

      const hProfit = (Math.max(0, item.profit) / yMax) * chartH;
      const yProfit = padding.top + chartH - hProfit;

      barsSvg += `
        <!-- Barra Ventas (Rosa Fucsia) -->
        <rect x="${groupX}" y="${yRev}" width="${barWidth}" height="${hRev}" rx="4" fill="url(#pinkGrad)">
          <title>Fecha: ${item.date}\nVentas: ${this.formatCurrency(item.revenue)}</title>
        </rect>
        
        <!-- Barra Costo (Rosa Pastel Opaco) -->
        <rect x="${groupX + barWidth + 2}" y="${yCost}" width="${barWidth}" height="${hCost}" rx="4" fill="#fbcfe8">
          <title>Fecha: ${item.date}\nCosto: ${this.formatCurrency(item.cost)}</title>
        </rect>

        <!-- Barra Ganancia (Dorado Metálico) -->
        <rect x="${groupX + (barWidth + 2) * 2}" y="${yProfit}" width="${barWidth}" height="${hProfit}" rx="4" fill="url(#goldGrad)">
          <title>Fecha: ${item.date}\nGanancia Neta: ${this.formatCurrency(item.profit)}</title>
        </rect>

        <!-- Etiqueta Fecha -->
        <text x="${groupX + barWidth * 1.5}" y="${height - 12}" font-size="11" fill="#702e48" font-weight="700" text-anchor="middle">${dateLabel}</text>
      `;
    });

    container.innerHTML = `
      <div style="display:flex; justify-content:flex-end; gap:1.25rem; font-size:0.82rem; margin-bottom:0.75rem; font-weight:700;">
        <span style="display:flex; align-items:center; gap:0.45rem;"><span style="width:12px; height:12px; border-radius:3px; background:#f43f68; display:inline-block;"></span> Ingreso Ventas</span>
        <span style="display:flex; align-items:center; gap:0.45rem;"><span style="width:12px; height:12px; border-radius:3px; background:#fbcfe8; display:inline-block;"></span> Costo Mercadería</span>
        <span style="display:flex; align-items:center; gap:0.45rem;"><span style="width:12px; height:12px; border-radius:3px; background:#d97706; display:inline-block;"></span> Ganancia Neta</span>
      </div>
      <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow:visible;">
        <defs>
          <linearGradient id="pinkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f43f68"/>
            <stop offset="100%" stop-color="#ec4899"/>
          </linearGradient>
          <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#f59e0b"/>
            <stop offset="100%" stop-color="#d97706"/>
          </linearGradient>
        </defs>
        ${gridSvg}
        ${barsSvg}
      </svg>
    `;
  },

  // 2. GRÁFICO DE DONA: DESGLOSE DE COSTOS Y GASTOS DE FARDOS
  renderCostDonut(containerId, breakdown) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const data = [
      { label: 'Costo Compra', value: breakdown.purchase || 0, color: '#f43f68' },
      { label: 'Fletes / Envío', value: breakdown.shipping || 0, color: '#f59e0b' },
      { label: 'Aduana / Impuestos', value: breakdown.customs || 0, color: '#c026d3' },
      { label: 'Lavado & Acondicionamiento', value: breakdown.conditioning || 0, color: '#fb718e' },
      { label: 'Gastos Operativos', value: breakdown.operating_expenses || 0, color: '#d97706' }
    ].filter(d => d.value > 0);

    const total = data.reduce((acc, d) => acc + d.value, 0);

    if (total === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🍩</div>
          <h4 style="font-weight: 800; color: var(--pink-deep); font-size: 1rem; margin-bottom: 0.3rem;">Estructura de costos vacía</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            Registra tu primer fardo para ver la distribución de compra, flete y acondicionamiento.
          </p>
        </div>
      `;
      return;
    }

    const size = 220;
    const center = size / 2;
    const radius = 80;
    const strokeWidth = 28;

    let cumulativeAngle = 0;
    let pathsSvg = '';

    data.forEach(item => {
      const percentage = (item.value / total);
      const angle = percentage * 360;

      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;
      cumulativeAngle += angle;

      const x1 = center + radius * Math.cos((Math.PI / 180) * (startAngle - 90));
      const y1 = center + radius * Math.sin((Math.PI / 180) * (startAngle - 90));
      const x2 = center + radius * Math.cos((Math.PI / 180) * (endAngle - 90));
      const y2 = center + radius * Math.sin((Math.PI / 180) * (endAngle - 90));

      const largeArc = angle > 180 ? 1 : 0;
      const pathData = `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;

      pathsSvg += `
        <path d="${pathData}" fill="none" stroke="${item.color}" stroke-width="${strokeWidth}" stroke-linecap="round">
          <title>${item.label}: ${this.formatCurrency(item.value)} (${Math.round(percentage * 100)}%)</title>
        </path>
      `;
    });

    let legendHtml = data.map(d => `
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.45rem; font-size:0.84rem;">
        <span style="display:flex; align-items:center; gap:0.45rem;">
          <span style="width:11px; height:11px; border-radius:50%; background:${d.color}; display:inline-block;"></span>
          ${d.label}
        </span>
        <span style="font-weight:800; color:var(--text-primary);">${this.formatCurrency(d.value)} <span style="font-weight:500; color:var(--text-muted); font-size:0.75rem;">(${Math.round((d.value/total)*100)}%)</span></span>
      </div>
    `).join('');

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; gap:1.25rem; width:100%;">
        <div style="position:relative; width:${size}px; height:${size}px;">
          <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
            ${pathsSvg}
          </svg>
          <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
            <div style="font-size:0.75rem; color:var(--text-secondary); font-weight:700; text-transform:uppercase;">Inversión Total</div>
            <div style="font-size:1.3rem; font-weight:900; color:var(--primary-pink);">${this.formatCurrency(total)}</div>
          </div>
        </div>
        <div style="width:100%; max-width:320px; background:#fff0f5; padding:0.95rem; border-radius:14px; border:1.5px solid #fbcfe8;">
          ${legendHtml}
        </div>
      </div>
    `;
  },

  // 3. COMPARATIVA DE RENTABILIDAD Y RECUPERACIÓN POR FARDO (ROI)
  renderBaleRoiBars(containerId, bales) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!bales || bales.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📦</div>
          <h4 style="font-weight: 800; color: var(--pink-deep); font-size: 1rem; margin-bottom: 0.3rem;">Sin fardos registrados</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            Haz clic en <strong>+ Nuevo Fardo</strong> arriba para registrar tu primer fardo de ropa.
          </p>
        </div>
      `;
      return;
    }

    let rowsHtml = bales.map(b => {
      const invested = b.invested_cost || 1;
      const recovered = b.recovered_revenue || 0;
      const progress = Math.min(100, Math.round((recovered / invested) * 100));
      const isProfitable = recovered >= invested;
      const roiBadge = isProfitable 
        ? `<span class="badge badge-green">✓ Recuperado (${b.roiPercentage > 0 ? '+' + b.roiPercentage + '%' : '100%'})</span>`
        : `<span class="badge badge-amber">${progress}% recuperado</span>`;

      return `
        <div style="margin-bottom:1.25rem;">
          <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:0.4rem;">
            <div>
              <span class="sku-chip" style="margin-right:0.45rem;">${b.code}</span>
              <strong style="font-size:0.95rem; color:var(--text-primary);">${b.name}</strong>
            </div>
            <div>
              ${roiBadge}
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.82rem; color:var(--text-secondary); margin-bottom:0.4rem;">
            <span>Invertido: <strong>${this.formatCurrency(invested)}</strong></span>
            <span>Recaudado: <strong style="color:${isProfitable ? '#15803d' : 'var(--primary-pink)'};">${this.formatCurrency(recovered)}</strong></span>
            <span>Prendas vendidas: <strong>${b.sold_pieces || 0} / ${b.total_pieces || 0}</strong></span>
          </div>
          <div style="width:100%; height:12px; background:#fce7f3; border-radius:999px; overflow:hidden; position:relative;">
            <div style="width:${progress}%; height:100%; border-radius:999px; background:${isProfitable ? 'var(--gold-gradient)' : 'var(--pink-gradient)'}; transition:width 0.8s ease;"></div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:0.25rem;">
        ${rowsHtml}
      </div>
    `;
  },

  // 4. VENTAS POR CATEGORÍA
  renderCategorySales(containerId, categories) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!categories || categories.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">👗</div>
          <h4 style="font-weight: 800; color: var(--pink-deep); font-size: 1rem; margin-bottom: 0.3rem;">Sin prendas vendidas aún</h4>
          <p style="font-size: 0.85rem; color: var(--text-secondary);">
            A medida que concretes ventas, aquí verás las categorías más demandadas.
          </p>
        </div>
      `;
      return;
    }

    const maxRevenue = Math.max(...categories.map(c => c.revenue), 10);

    let html = categories.map(c => {
      const pct = Math.round((c.revenue / maxRevenue) * 100);
      return `
        <div style="margin-bottom:0.95rem;">
          <div style="display:flex; justify-content:space-between; font-size:0.86rem; margin-bottom:0.3rem;">
            <span style="font-weight:700; color:var(--text-primary);">${c.category}</span>
            <span><strong>${this.formatCurrency(c.revenue)}</strong> (${c.count} prendas)</span>
          </div>
          <div style="width:100%; height:9px; background:#fce7f3; border-radius:999px; overflow:hidden;">
            <div style="width:${pct}%; height:100%; background:var(--pink-gradient); border-radius:999px;"></div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `<div>${html}</div>`;
  }
};
