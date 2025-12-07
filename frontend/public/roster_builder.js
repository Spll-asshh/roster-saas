(function () {
  const API_BASE = '/api';

  const params = new URLSearchParams(window.location.search);
  const tenantFromQuery = params.get('tenant');
  const storedTenant = localStorage.getItem('rosterTenantId');

  const tenantForm = document.getElementById('tenantForm');
  const tenantIdInput = document.getElementById('tenantId');
  const tenantStatus = document.getElementById('tenantStatus');
  const employeeForm = document.getElementById('employeeForm');
  const rosterForm = document.getElementById('rosterForm');
  const slotForm = document.getElementById('slotForm');
  const shiftTemplateForm = document.getElementById('shiftTemplateForm');
  const unitList = document.getElementById('unitList');
  const formNumber = document.getElementById('formNumber');
  const employeeList = document.getElementById('employeeList');
  const rosterList = document.getElementById('rosterList');
  const shiftTemplateList = document.getElementById('shiftTemplateList');
  const slotList = document.getElementById('slotList');
  const slotRoster = document.getElementById('slotRoster');
  const slotEmployee = document.getElementById('slotEmployee');
  const slotModeLabel = document.getElementById('slotModeLabel');
  const slotHelper = document.getElementById('slotHelper');
  const slotShiftCode = document.getElementById('slotShiftCode');
  const slotStart = document.getElementById('slotStart');
  const slotEnd = document.getElementById('slotEnd');

  const state = {
    employees: [],
    rosters: [],
    shiftTemplates: []
  };

  function getTenantId() {
    const value = (tenantIdInput.value || tenantFromQuery || storedTenant || '').trim();
    if (value) {
      localStorage.setItem('rosterTenantId', value);
    }
    return value;
  }

  async function fetchJson(path, options = {}) {
    const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});

    if (options.requireTenant !== false) {
      const tenantId = getTenantId();
      if (tenantId) {
        headers['x-tenant-id'] = tenantId;
      }
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers
    });

    const text = await response.text();
    let body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (error) {
      body = { error: text || error.message };
    }

    if (!response.ok) {
      const message = body && body.error ? body.error : response.statusText;
      throw new Error(message);
    }

    return body;
  }

  function renderUnits(metadata) {
    const units = metadata.units || [];
    formNumber.textContent = metadata.formNumber || '';

    if (!Array.isArray(units) || units.length === 0) {
      unitList.innerHTML = '<p class="muted">No roster unit definitions loaded.</p>';
      return;
    }

    unitList.innerHTML = units
      .map(
        (unit) => `
          <div class="metadata__item">
            <div>
              <strong>${unit.label}</strong>
              <p class="muted">${unit.category.replace('_', ' ')}${
          unit.ratingCodes?.length ? ` · Ratings: ${unit.ratingCodes.join(', ')}` : ''
        }</p>
            </div>
            <div class="pill pill--subtle">${unit.key}</div>
          </div>
        `
      )
      .join('');
  }

  function renderShiftTemplates() {
    if (!state.shiftTemplates.length) {
      shiftTemplateList.innerHTML = '<p class="muted">No templates yet. Time-bound rosters will require them.</p>';
      return;
    }

    shiftTemplateList.innerHTML = state.shiftTemplates
      .map(
        (template) => `
          <div class="list__item">
            <div>
              <strong>${template.code}${template.name ? ` · ${template.name}` : ''}</strong>
              <p class="muted">${template.start_time ? `${template.start_time} → ${template.end_time}` : 'Rotation-friendly'}${
          template.description ? ` · ${template.description}` : ''
        }</p>
            </div>
            <span class="pill pill--subtle">${template.id}</span>
          </div>
        `
      )
      .join('');
  }

  function renderEmployees() {
    if (!state.employees.length) {
      employeeList.innerHTML = '<p class="muted">No employees added yet.</p>';
      slotEmployee.innerHTML = '';
      return;
    }

    employeeList.innerHTML = state.employees
      .map(
        (emp) => `
          <div class="list__item">
            <div>
              <strong>${emp.name}</strong>
              <p class="muted">${emp.service_no}${emp.eg ? ` · ${emp.eg}` : ''}${
          emp.location ? ` · ${emp.location}` : ''
        }</p>
            </div>
            <span class="pill pill--subtle">${emp.id}</span>
          </div>
        `
      )
      .join('');

    slotEmployee.innerHTML = state.employees
      .map((emp) => `<option value="${emp.id}">${emp.name} (${emp.service_no})</option>`)
      .join('');
  }

  function renderRosters() {
    if (!state.rosters.length) {
      rosterList.innerHTML = '<p class="muted">No rosters yet.</p>';
      slotRoster.innerHTML = '';
      return;
    }

    rosterList.innerHTML = state.rosters
      .map(
        (roster) => `
          <div class="list__item">
            <div>
              <strong>${roster.name}</strong>
              <p class="muted">${roster.location} · ${roster.start_date} → ${roster.end_date}</p>
              <p class="muted">Shift mode: ${roster.shift_mode}</p>
            </div>
            <span class="pill pill--subtle">${roster.id}</span>
          </div>
        `
      )
      .join('');

    slotRoster.innerHTML = state.rosters
      .map((roster) => `<option value="${roster.id}" data-mode="${roster.shift_mode}">${roster.name}</option>`)
      .join('');

    const firstRoster = state.rosters[0];
    if (firstRoster) {
      updateSlotMode(firstRoster.shift_mode);
      refreshSlots(firstRoster.id);
    } else {
      renderSlots([]);
    }
  }

  function renderSlots(slots) {
    if (!slots || !slots.length) {
      slotList.innerHTML = '<p class="muted">Slots will appear here after you create one.</p>';
      return;
    }

    slotList.innerHTML = slots
      .map(
        (slot) => `
          <div class="list__item">
            <div>
              <strong>${slot.duty_date} — ${slot.shift_code}</strong>
              <p class="muted">${slot.name || 'Employee'}${slot.start_time ? ` · ${slot.start_time}` : ''}${
          slot.end_time ? ` → ${slot.end_time}` : ''
        }</p>
            </div>
            <span class="pill pill--subtle">${slot.id}</span>
          </div>
        `
      )
      .join('');
  }

  async function bootstrapMetadata() {
    try {
      const metadata = await fetchJson('/roster/metadata', { requireTenant: false });
      renderUnits(metadata || {});
    } catch (error) {
      unitList.innerHTML = `<p class="error">Failed to load metadata: ${error.message}</p>`;
    }
  }

  async function refreshEmployees() {
    try {
      state.employees = await fetchJson('/roster/employees');
      renderEmployees();
    } catch (error) {
      employeeList.innerHTML = `<p class="error">${error.message}</p>`;
    }
  }

  async function refreshRosters() {
    try {
      state.rosters = await fetchJson('/roster');
      renderRosters();
    } catch (error) {
      rosterList.innerHTML = `<p class="error">${error.message}</p>`;
    }
  }

  async function refreshShiftTemplates() {
    try {
      state.shiftTemplates = await fetchJson('/roster/shifts');
      renderShiftTemplates();
    } catch (error) {
      shiftTemplateList.innerHTML = `<p class="error">${error.message}</p>`;
    }
  }

  async function refreshSlots(rosterId) {
    if (!rosterId) {
      renderSlots([]);
      return;
    }
    try {
      const slots = await fetchJson(`/roster/${rosterId}/slots`);
      renderSlots(slots);
    } catch (error) {
      slotList.innerHTML = `<p class="error">${error.message}</p>`;
    }
  }

  function getSelectedRoster() {
    const rosterId = slotRoster.value;
    return state.rosters.find((r) => r.id === rosterId);
  }

  function updateSlotMode(mode) {
    const normalized = mode === 'timebound' ? 'timebound' : 'rotation';
    slotModeLabel.textContent = normalized === 'timebound' ? 'Time-bound' : 'Rotation';
    slotHelper.textContent =
      normalized === 'timebound'
        ? 'Time-bound mode: times required. Templates auto-fill when codes match.'
        : 'Rotation mode: times optional, codes rotate per period.';
  }

  function applyTemplateToSlotInputs(shiftCode) {
    const roster = getSelectedRoster();
    if (!roster || roster.shift_mode !== 'timebound') return;
    const template = state.shiftTemplates.find((t) => t.code === shiftCode);
    if (template) {
      if (template.start_time) slotStart.value = template.start_time;
      if (template.end_time) slotEnd.value = template.end_time;
    }
  }

  function bindEvents() {
    tenantForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(tenantForm).entries());

      try {
        const tenant = await fetchJson('/tenants', { method: 'POST', body: JSON.stringify(data) });
        tenantIdInput.value = tenant.id;
        localStorage.setItem('rosterTenantId', tenant.id);
        tenantStatus.textContent = `Created tenant ${tenant.name}`;
        await refreshShiftTemplates();
        await refreshEmployees();
        await refreshRosters();
      } catch (error) {
        tenantStatus.textContent = error.message;
      }
    });

    employeeForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(employeeForm).entries());

      try {
        await fetchJson('/roster/employees', { method: 'POST', body: JSON.stringify(data) });
        employeeForm.reset();
        await refreshEmployees();
      } catch (error) {
        employeeList.innerHTML = `<p class="error">${error.message}</p>`;
      }
    });

    rosterForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(rosterForm).entries());

      try {
        await fetchJson('/roster', { method: 'POST', body: JSON.stringify(data) });
        await refreshRosters();
      } catch (error) {
        rosterList.innerHTML = `<p class="error">${error.message}</p>`;
      }
    });

    shiftTemplateForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(shiftTemplateForm).entries());
      if (!data.code) return;

      try {
        await fetchJson('/roster/shifts', { method: 'POST', body: JSON.stringify(data) });
        shiftTemplateForm.reset();
        await refreshShiftTemplates();
      } catch (error) {
        shiftTemplateList.innerHTML = `<p class="error">${error.message}</p>`;
      }
    });

    slotForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(slotForm).entries());
      const rosterId = data.roster_id;

      try {
        await fetchJson(`/roster/${rosterId}/slots`, {
          method: 'POST',
          body: JSON.stringify(data)
        });
        await refreshSlots(rosterId);
      } catch (error) {
        slotList.innerHTML = `<p class="error">${error.message}</p>`;
      }
    });

    slotRoster.addEventListener('change', (event) => {
      const rosterId = event.target.value;
      const roster = state.rosters.find((r) => r.id === rosterId);
      updateSlotMode(roster?.shift_mode);
      slotStart.value = '';
      slotEnd.value = '';
      refreshSlots(rosterId);
    });

    slotShiftCode.addEventListener('input', (event) => {
      applyTemplateToSlotInputs(event.target.value);
    });
  }

  function hydrateDefaults() {
    if (!tenantIdInput.value) {
      const fallback = tenantFromQuery || storedTenant;
      if (fallback) {
        tenantIdInput.value = fallback;
      }
    }
  }

  hydrateDefaults();
  bindEvents();
  bootstrapMetadata();
  refreshShiftTemplates();
  refreshEmployees();
  refreshRosters();
})();
