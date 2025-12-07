(function () {
  'use strict';

  const unitOptions = readJson('unit-options-data') || [];
  const officerOptions = readJson('officer-options-data') || [];
  const ftoOptions = readJson('fto-options-data') || [];
  const rfcOptions = readJson('rfc-options-data') || [];
  const approvalOptions = readJson('approval-options-data') || [];
  const builderMeta = readJson('roster-builder-meta') || {};
  const initialData = readJson('roster-initial-data');

  const ASYNC_PICKER_UNITS = new Set([
    'officers_on_course',
    'officers_on_leave',
    'mission_coordinator_rcc_rsc',
    'aocc_supervisor',
  ]);
  const officerSearchUrl = builderMeta.officerSearchUrl || null;
  const asyncSearchTimers = new Map();
  const asyncSearchControllers = new Map();
  const asyncSearchResults = new Map();

  const DEFAULT_NON_OPERATIONAL_PRIORITY = [
    'chief_operations_officer',
    'satco',
    'radar_facility_chief',
    'facility_training_officer',
    'oic_tower',
    'oic_ats_revenue',
    'aiso',
    'oic_rescue_coordination_center',
    'mission_coordinator_rcc_rsc',
    'oic_rescue_sub_center',
    'oic_simulator',
    'safety_manager_ans',
    'investigation_officer',
    'officers_on_course',
    'officers_on_leave',
  ];
  const NON_OPERATIONAL_PRIORITY = Array.isArray(builderMeta.nonOperationalPriority)
    ? builderMeta.nonOperationalPriority
    : DEFAULT_NON_OPERATIONAL_PRIORITY;

  const unitMap = new Map(unitOptions.map((unit) => [unit.key, unit]));
  const operationalUnits = unitOptions.filter((unit) => unit.category !== 'non_operational');
  const nonOperationalPriorityMap = new Map(
    NON_OPERATIONAL_PRIORITY.map((key, index) => [key, index]),
  );
  const nonOperationalUnits = unitOptions
    .filter((unit) => unit.category === 'non_operational')
    .sort((a, b) => {
      const priorityA = nonOperationalPriorityMap.has(a.key)
        ? nonOperationalPriorityMap.get(a.key)
        : NON_OPERATIONAL_PRIORITY.length;
      const priorityB = nonOperationalPriorityMap.has(b.key)
        ? nonOperationalPriorityMap.get(b.key)
        : NON_OPERATIONAL_PRIORITY.length;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return a.label.localeCompare(b.label);
    });
  const officerLookup = new Map(
    officerOptions.map((officer) => [`${officer.id}`, officer]),
  );
  const officerLabelLookup = new Map();
  officerOptions.forEach((officer) => {
    officer.ratings = Array.isArray(officer.ratings)
      ? officer.ratings.map((code) => `${code}`.trim().toUpperCase()).filter(Boolean)
      : [];
    const label = formatOfficerLabel(officer);
    officerLabelLookup.set(label, `${officer.id}`);
    officerLabelLookup.set(label.toLowerCase(), `${officer.id}`);
  });

  const OFFICER_SEARCH_LIST_ID = 'non-operational-officer-options';

  const OFFICER_CATEGORIES = [
    { key: 'RI', label: 'RI' },
    { key: 'RII', label: 'RII' },
    { key: 'RIII', label: 'RIII' },
    { key: 'RIV', label: 'RIV' },
    { key: 'RV', label: 'RV' },
    { key: 'NON_RATED', label: 'Non-Rated' },
  ];

  const LEADERSHIP_RATINGS = new Set(['RIV', 'RV']);

  const boardElements = {
    grid: null,
    panel: null,
    filterList: null,
    officerList: null,
    emptyState: null,
  };

  const boardCells = new Map();

  const boardState = {
    activeCategory: 'RI',
  };

  const dragState = {
    officerId: null,
    originType: null,
    originCellKey: null,
    duplicate: false,
  };

  const DEFAULT_SHIFT_CODES = ['A', 'B', 'C', 'D', 'E', 'F'];
  const DEFAULT_TIMING_LABELS = ['Morning', 'Afternoon', 'Night'];
  const ALLOWED_PERIODS_OF_DUTY = [2, 3];

  function slugifyForId(value) {
    const slug = `${value}`
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'item';
  }

  function createAssignmentFieldId(prefix, unitKey, shiftCode, daySequence) {
    const unitPart = slugifyForId(unitKey || 'unit');
    const shiftPart = slugifyForId(shiftCode || 'shift');
    const dayPart =
      daySequence === undefined || daySequence === null || daySequence === ''
        ? 'day-unspecified'
        : `day-${slugifyForId(daySequence)}`;
    return `${prefix}-${dayPart}-${shiftPart}-${unitPart}`;
  }

  const state = {
    config: {
      title: '',
      effectiveMonth: '',
      effectiveFrom: '',
      shiftCount: 0,
      shiftCycleLength: 0,
      durationDays: 0,
      timingCount: 0,
      periodsOfDuty: 0,
      developedBy: '',
      verifiedBy: '',
      approvedBy: '',
    },
    shifts: [],
    timings: [],
    cycle: [],
    units: [],
    nonOperationalAssignments: {},
    teamAssignments: {},
    days: [],
    templateDaysByShift: {},
    rotation: {},
    assignments: {},
    currentDay: null,
    isDraft: false,
  };

  const elements = {
    stepPills: document.querySelectorAll('.step-pill'),
    steps: document.querySelectorAll('.builder-step'),
    configForm: document.getElementById('rosterConfigForm'),
    rosterTitle: document.getElementById('rosterTitle'),
    effectiveMonth: document.getElementById('effectiveMonth'),
    effectiveFrom: document.getElementById('effectiveFrom'),
    rosterDuration: document.getElementById('rosterDuration'),
    shiftCount: document.getElementById('shiftCount'),
    shiftCycle: document.getElementById('shiftCycle'),
    timingCount: document.getElementById('timingCount'),
    timingCountDisplay: document.getElementById('timingCountDisplay'),
    periodsOfDuty: document.getElementById('periodsOfDuty'),
    shiftRows: document.getElementById('shiftRows'),
    timingRows: document.getElementById('timingRows'),
    cycleRows: document.getElementById('cycleRows'),
    unitChecklist: document.getElementById('unitChecklist'),
    nonOperationalList: document.getElementById('nonOperationalAssignments'),
    developedBy: document.getElementById('developedBy'),
    verifiedBy: document.getElementById('verifiedBy'),
    approvedBy: document.getElementById('approvedBy'),
    configNext: document.getElementById('configNext'),
    backToConfig: document.getElementById('backToConfig'),
    saveRoster: document.getElementById('saveRoster'),
    loadPreviousConfiguration: document.getElementById('loadPreviousConfiguration'),
    dayList: document.getElementById('dayList'),
    assignmentColumns: document.getElementById('assignmentColumns'),
    status: document.getElementById('builderStatus'),
    assignmentMonthLabel: document.getElementById('assignmentMonthLabel'),
    assignmentCycle: document.getElementById('assignmentCycle'),
    assignmentDuration: document.getElementById('assignmentDuration'),
    rosterCalendar: document.getElementById('rosterCalendar'),
    teamSetupList: document.getElementById('teamSetupList'),
    configStages: document.querySelectorAll('.config-stage'),
    configStage1Next: document.getElementById('configStage1Next'),
    configStage2Back: document.getElementById('configStage2Back'),
    configStage2Next: document.getElementById('configStage2Next'),
    configStage3Back: document.getElementById('configStage3Back'),
  };

  if (!elements.configForm) {
    return;
  }

  let currentConfigStage = 1;

  populatePersonaSelect(elements.developedBy, ftoOptions);
  populatePersonaSelect(elements.verifiedBy, rfcOptions);
  populatePersonaSelect(elements.approvedBy, approvalOptions);
  buildUnitChecklist();
  ensureOfficerSearchList();
  buildNonOperationalList();
  bindUnitEvents();
  bindNonOperationalEvents();
  bindTeamAssignmentEvents();
  bindShiftCycleSynchronizer();
  bindTimingCountWatcher();
  bindPeriodsOfDutyWatcher();
  bindConfigStageNavigation();
  elements.configNext.addEventListener('click', handleConfigNext);
  elements.backToConfig.addEventListener('click', () => setStep(1));
  if (elements.loadPreviousConfiguration) {
    elements.loadPreviousConfiguration.addEventListener('click', handleLoadPreviousConfiguration);
  }
  if (elements.saveRoster) {
    elements.saveRoster.addEventListener('click', () => submitRoster(false));
  }

  setConfigStage(1);
  updateSaveButtons();

  if (initialData) {
    hydrateFromInitialData(initialData);
  } else {
    const defaultShiftCount = parseInt(elements.shiftCount.value, 10) || DEFAULT_SHIFT_CODES.length;
    const timingFieldValue = parseInt(elements.timingCount.value, 10);
    const fallbackTimingCount = Number.isNaN(timingFieldValue)
      ? DEFAULT_TIMING_LABELS.length || ALLOWED_PERIODS_OF_DUTY[ALLOWED_PERIODS_OF_DUTY.length - 1]
      : timingFieldValue;
    const defaultPeriods = elements.periodsOfDuty
      ? normalizePeriodsOfDuty(elements.periodsOfDuty.value)
      : normalizePeriodsOfDuty(fallbackTimingCount);
    const defaultCycleLength = parseInt(elements.shiftCycle.value, 10)
      || Math.max(defaultPeriods + 2, 1);
    elements.timingCount.value = `${defaultPeriods}`;
    if (elements.periodsOfDuty) {
      elements.periodsOfDuty.value = `${defaultPeriods}`;
    }
    updateTimingCountDisplay(defaultPeriods);
    buildShiftRows(defaultShiftCount);
    buildTimingRows(defaultPeriods);
    buildCycleRows(defaultCycleLength);
    renderTeamSetup();
  }

  function handleConfigNext() {
    const result = captureConfiguration();
    if (!result) {
      return;
    }

    updateAssignmentSummary();
    renderDayList();
    if (state.days.length) {
      setActiveDay(state.days[0].sequence);
    }
    setStep(2);
  }

  function captureConfiguration() {
    const title = elements.rosterTitle.value.trim();
    const effectiveMonth = elements.effectiveMonth.value;
    const effectiveFrom = elements.effectiveFrom.value;
    const shiftCountValue = normalizeShiftValue(elements.shiftCount ? elements.shiftCount.value : null);
    const shiftCycleValue = normalizeShiftValue(elements.shiftCycle ? elements.shiftCycle.value : null);
    const timingCountRaw = parseInt(elements.timingCount.value, 10);
    const hasValidTimingCount = ALLOWED_PERIODS_OF_DUTY.includes(timingCountRaw);
    const timingCountValue = normalizePeriodsOfDuty(Number.isNaN(timingCountRaw) ? null : timingCountRaw);
    const durationValue = parseInt(elements.rosterDuration.value, 10);
    const periodsOfDutyRaw = elements.periodsOfDuty
      ? parseInt(elements.periodsOfDuty.value, 10)
      : NaN;
    const hasValidPeriods = ALLOWED_PERIODS_OF_DUTY.includes(periodsOfDutyRaw);
    const periodsOfDutyValue = hasValidPeriods
      ? periodsOfDutyRaw
      : normalizePeriodsOfDuty(periodsOfDutyRaw);

    const errors = [];
    let errorStage = null;
    const registerError = (message, stage) => {
      errors.push(message);
      if (errorStage === null || stage < errorStage) {
        errorStage = stage;
      }
    };
    if (!effectiveMonth) {
      registerError('Select the roster month.', 1);
    }
    if (!effectiveFrom) {
      registerError('Select the effective date.', 1);
    }
    if (!durationValue || durationValue < 1) {
      registerError('Provide the roster duration in days.', 1);
    }
    if (!shiftCountValue) {
      registerError('Provide the number of shifts (between 3 and 6).', 1);
    }
    if (!shiftCycleValue) {
      registerError('Provide the shift cycle length (between 3 and 6).', 1);
    }
    if (shiftCountValue && shiftCycleValue && shiftCountValue !== shiftCycleValue) {
      registerError('Shift cycle days and number of shifts must be the same.', 1);
    }
    if (!hasValidTimingCount) {
      registerError('Provide the number of duty timings (2 or 3).', 1);
    }
    if (!hasValidPeriods) {
      registerError('Periods of duty must be either 2 or 3.', 1);
    }
    if (timingCountValue !== periodsOfDutyValue) {
      registerError('Number of duty timings must match the periods of duty.', 1);
    }

    const shifts = collectShiftRows();
    if (shifts.length !== shiftCountValue) {
      registerError('Review the shift teams. Each row must include a sequence and unique code.', 2);
    }

    if (!shifts.every((shift) => shift.code)) {
      registerError('All shift rows need a code.', 2);
    }

    const codes = new Set(shifts.map((shift) => shift.code));
    if (codes.size !== shifts.length) {
      registerError('Shift codes must be unique.', 2);
    }

    const timings = collectTimingRows();
    if (timings.length !== timingCountValue) {
      const timingMessage = timingCountValue === 2
        ? 'Provide exactly two duty timings.'
        : 'Provide exactly three duty timings.';
      registerError(timingMessage, 2);
    }
    if (!timings.every((timing) => timing.label)) {
      registerError('Every duty timing requires a label.', 2);
    }
    if (timings.some((timing) => !timing.start_time || !timing.end_time)) {
      registerError('Provide start and end times for every duty timing.', 2);
    }

    const activeTimings = getActiveTimings(timings, periodsOfDutyValue);
    const cycle = sanitizeCycleEntries(collectCycleRows(timings), activeTimings, periodsOfDutyValue);
    if (cycle.length !== shiftCycleValue) {
      registerError('The cycle template must include an entry for each day in the cycle length.', 2);
    }
    if (!cycle.some((entry) => entry.type === 'timing')) {
      registerError('The cycle template must contain at least one duty timing.', 2);
    }

    const selectedUnits = unitOptions
      .filter((unit) => {
        const input = elements.unitChecklist.querySelector(`input[data-unit="${unit.key}"]`);
        return input && input.checked;
      })
      .map((unit) => unit.key);

    if (!selectedUnits.length) {
      registerError('Select at least one roster unit.', 3);
    }

    if (errors.length) {
      if (errorStage !== null) {
        setConfigStage(errorStage);
      }
      showStatus(errors.join(' '), 'error');
      return null;
    }

    state.config = {
      title,
      effectiveMonth,
      effectiveFrom,
      shiftCount: shiftCountValue,
      shiftCycleLength: shiftCycleValue,
      durationDays: durationValue,
      timingCount: activeTimings.length,
      periodsOfDuty: periodsOfDutyValue,
      developedBy: elements.developedBy.value,
      verifiedBy: elements.verifiedBy.value,
      approvedBy: elements.approvedBy.value,
    };
    state.shifts = shifts;
    state.timings = activeTimings;
    state.cycle = cycle;
    state.units = selectedUnits;
    state.nonOperationalAssignments = collectNonOperationalAssignments();

    ensureDays();
    rebuildRotation();
    pruneAssignments();
    ensureAssignmentEntries();
    pruneTeamAssignments();
    applyAllTeamAssignments();
    renderTeamSetup();
    renderCalendar();
    showStatus('Configuration captured. Continue assigning officers.', 'success');
    return state;
  }

  function ensureDays() {
    state.days = buildDays(
      state.config.effectiveMonth,
      state.config.effectiveFrom,
      state.config.durationDays,
    );
    state.currentDay = state.days.length ? state.days[0].sequence : null;
  }

  function ensureAssignmentEntries() {
    state.days.forEach((day) => {
      const dayAssignments = getOrCreateDayAssignments(day.sequence);
      state.shifts.forEach((shift) => {
        const rotationEntry = getRotationEntry(day.sequence, shift.code);
        if (!rotationEntry || rotationEntry.type !== 'timing') {
          delete dayAssignments[shift.code];
          return;
        }
        if (!dayAssignments[shift.code]) {
          dayAssignments[shift.code] = {};
        }
        state.units.forEach((unitKey) => {
          if (!dayAssignments[shift.code][unitKey]) {
            dayAssignments[shift.code][unitKey] = { officers: [], remarks: '' };
          }
        });
      });
    });
  }

  function pruneTeamAssignments() {
    const validShifts = new Set(state.shifts.map((shift) => shift.code));
    const validUnits = new Set(state.units);
    Object.keys(state.teamAssignments).forEach((shiftCode) => {
      if (!validShifts.has(shiftCode)) {
        delete state.teamAssignments[shiftCode];
        return;
      }
      const unitAssignments = state.teamAssignments[shiftCode];
      Object.keys(unitAssignments).forEach((unitKey) => {
        if (!validUnits.has(unitKey)) {
          delete unitAssignments[unitKey];
        }
      });
      if (!Object.keys(unitAssignments).length) {
        delete state.teamAssignments[shiftCode];
      }
    });
  }

  function getTeamAssignment(shiftCode, unitKey) {
    const shiftTeams = state.teamAssignments[shiftCode];
    if (!shiftTeams) {
      return [];
    }
    const values = shiftTeams[unitKey] || [];
    return Array.isArray(values) ? [...values] : [];
  }

  function setTeamAssignment(shiftCode, unitKey, values) {
    if (!Array.isArray(values) || !values.length) {
      if (state.teamAssignments[shiftCode]) {
        delete state.teamAssignments[shiftCode][unitKey];
        if (!Object.keys(state.teamAssignments[shiftCode]).length) {
          delete state.teamAssignments[shiftCode];
        }
      }
      return;
    }
    if (!state.teamAssignments[shiftCode]) {
      state.teamAssignments[shiftCode] = {};
    }
    state.teamAssignments[shiftCode][unitKey] = values.map((value) => `${value}`);
  }

  function renderTeamSetup() {
    if (!elements.teamSetupList) {
      return;
    }
    const container = elements.teamSetupList;
    container.innerHTML = '';
    boardCells.clear();
    boardElements.grid = null;
    boardElements.panel = null;
    boardElements.filterList = null;
    boardElements.officerList = null;
    boardElements.emptyState = null;

    const orderedShifts = [...state.shifts].sort((a, b) => a.sequence - b.sequence);
    if (!orderedShifts.length || !state.units.length) {
      const placeholder = document.createElement('p');
      placeholder.className = 'team-setup-empty';
      placeholder.textContent = 'Select shift teams in Step 1 to assign officers across the roster.';
      container.appendChild(placeholder);
      return;
    }

    const board = document.createElement('div');
    board.className = 'deployment-board';

    const gridWrapper = document.createElement('div');
    gridWrapper.className = 'deployment-grid-wrapper';

    const grid = document.createElement('div');
    grid.className = 'deployment-grid';
    grid.style.gridTemplateColumns = `minmax(180px, 220px) repeat(${orderedShifts.length}, minmax(180px, 1fr))`;
    gridWrapper.appendChild(grid);
    board.appendChild(gridWrapper);

    const panel = createOfficerPanel();
    board.appendChild(panel);

    container.appendChild(board);

    boardElements.grid = grid;
    boardElements.panel = panel;
    boardElements.filterList = panel.querySelector('[data-officer-filters]');
    boardElements.officerList = panel.querySelector('[data-officer-list]');
    boardElements.emptyState = panel.querySelector('[data-officer-empty]');

    buildOfficerFilterButtons();
    renderDeploymentGrid(orderedShifts);
    refreshDeploymentBoard(true);
  }

  function createOfficerPanel() {
    const panel = document.createElement('aside');
    panel.className = 'officer-panel';

    const heading = document.createElement('h4');
    heading.textContent = 'Display Officers';
    panel.appendChild(heading);

    const hint = document.createElement('p');
    hint.className = 'unit-hint';
    hint.textContent = 'Filter by rating category and drag officers into the deployment grid.';
    panel.appendChild(hint);

    const filters = document.createElement('div');
    filters.className = 'officer-filter-list';
    filters.dataset.officerFilters = 'true';
    filters.addEventListener('click', handleOfficerFilterClick);
    panel.appendChild(filters);

    const list = document.createElement('div');
    list.className = 'officer-list';
    list.dataset.officerList = 'true';
    list.setAttribute('aria-live', 'polite');
    panel.appendChild(list);

    const empty = document.createElement('p');
    empty.className = 'officer-empty';
    empty.dataset.officerEmpty = 'true';
    empty.textContent = 'No officers available for this category.';
    empty.hidden = true;
    panel.appendChild(empty);

    return panel;
  }

  function buildOfficerFilterButtons() {
    if (!boardElements.filterList) {
      return;
    }
    boardElements.filterList.innerHTML = '';
    ensureActiveCategory();
    OFFICER_CATEGORIES.forEach((category) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'officer-filter';
      button.dataset.category = category.key;
      button.textContent = category.label;
      if (category.key === boardState.activeCategory) {
        button.classList.add('is-active');
      }
      boardElements.filterList.appendChild(button);
    });
  }

  function handleOfficerFilterClick(event) {
    const button = event.target.closest('button[data-category]');
    if (!button) {
      return;
    }
    const category = button.dataset.category;
    if (!category || category === boardState.activeCategory) {
      return;
    }
    boardState.activeCategory = category;
    renderOfficerPanel();
  }

  function renderDeploymentGrid(orderedShifts) {
    if (!boardElements.grid) {
      return;
    }
    const grid = boardElements.grid;
    grid.innerHTML = '';
    boardCells.clear();

    const corner = document.createElement('div');
    corner.className = 'deployment-grid-corner';
    corner.textContent = 'Unit / Shift';
    grid.appendChild(corner);

    orderedShifts.forEach((shift) => {
      const heading = document.createElement('div');
      heading.className = 'deployment-grid-heading';
      heading.textContent = `Shift ${shift.code}`;
      if (shift.title) {
        const subtitle = document.createElement('small');
        subtitle.textContent = shift.title;
        heading.appendChild(subtitle);
      }
      grid.appendChild(heading);
    });

    state.units.forEach((unitKey) => {
      const unit = unitMap.get(unitKey);
      const rowHeading = document.createElement('div');
      rowHeading.className = 'deployment-grid-row-heading';
      const title = document.createElement('span');
      title.textContent = unit ? unit.label : unitKey;
      rowHeading.appendChild(title);

      const detailParts = [];
      if (unit) {
        if (unit.requires_rating && unit.rating_codes.length) {
          detailParts.push(`Rating ${unit.rating_codes.join(', ')}`);
        }
        detailParts.push(unit.allows_multiple ? 'Multiple officers' : 'Single assignment');
      }
      if (detailParts.length) {
        const hint = document.createElement('span');
        hint.className = 'unit-hint';
        hint.textContent = detailParts.join(' · ');
        rowHeading.appendChild(hint);
      }
      grid.appendChild(rowHeading);

      orderedShifts.forEach((shift) => {
        const cell = document.createElement('div');
        cell.className = 'deployment-grid-cell';
        cell.dataset.unitKey = unitKey;
        cell.dataset.shiftCode = shift.code;
        cell.dataset.allowsMultiple = unit && unit.allows_multiple ? 'true' : 'false';
        cell.addEventListener('dragenter', handleCellDragEnter);
        cell.addEventListener('dragover', handleCellDragOver);
        cell.addEventListener('dragleave', handleCellDragLeave);
        cell.addEventListener('drop', handleCellDrop);

        const slot = document.createElement('div');
        slot.className = 'deployment-cell-slot';
        cell.appendChild(slot);

        grid.appendChild(cell);
        boardCells.set(`${shift.code}::${unitKey}`, {
          cell,
          slot,
          unit,
          shift,
        });
      });
    });
  }

  function refreshDeploymentBoard(forceCategoryReset) {
    if (forceCategoryReset && OFFICER_CATEGORIES.length) {
      boardState.activeCategory = OFFICER_CATEGORIES[0].key;
    } else {
      ensureActiveCategory();
    }
    boardCells.forEach((info, cellKey) => {
      updateBoardCell(cellKey, info);
    });
    renderOfficerPanel();
  }

  function updateTeamSetupSelections() {
    refreshDeploymentBoard(false);
  }

  function updateBoardCell(cellKey, info) {
    if (!info) {
      return;
    }
    const [shiftCode, unitKey] = parseCellKey(cellKey);
    if (!shiftCode || !unitKey) {
      return;
    }
    const slot = info.slot;
    if (!slot) {
      return;
    }
    slot.innerHTML = '';
    const officers = getTeamAssignment(shiftCode, unitKey);
    if (!officers.length) {
      const empty = document.createElement('p');
      empty.className = 'deployment-cell-empty';
      empty.textContent = 'Drop officer here';
      slot.appendChild(empty);
      return;
    }
    officers.forEach((officerId) => {
      const chip = createOfficerChip(officerId, { originCellKey: cellKey });
      slot.appendChild(chip);
    });
  }

  function renderOfficerPanel() {
    if (!boardElements.panel) {
      return;
    }
    ensureActiveCategory();
    if (boardElements.filterList) {
      Array.from(boardElements.filterList.querySelectorAll('button[data-category]')).forEach((button) => {
        button.classList.toggle('is-active', button.dataset.category === boardState.activeCategory);
      });
    }
    const list = boardElements.officerList;
    const empty = boardElements.emptyState;
    if (!list || !empty) {
      return;
    }
    list.innerHTML = '';
    const counts = getAssignedOfficerCounts();
    const available = officerOptions.filter((officer) => (
      officerMatchesCategory(officer, boardState.activeCategory)
      && !counts.has(`${officer.id}`)
    ));
    if (!available.length) {
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    available.forEach((officer) => {
      const chip = createOfficerChip(`${officer.id}`, { isAvailable: true });
      list.appendChild(chip);
    });
  }

  function getAssignedOfficerCounts() {
    const counts = new Map();
    Object.values(state.teamAssignments).forEach((unitAssignments) => {
      Object.values(unitAssignments).forEach((assignments) => {
        (Array.isArray(assignments) ? assignments : []).forEach((officerId) => {
          const key = `${officerId}`;
          counts.set(key, (counts.get(key) || 0) + 1);
        });
      });
    });
    return counts;
  }

  function officerMatchesCategory(officer, categoryKey) {
    const ratings = Array.isArray(officer && officer.ratings) ? officer.ratings : [];
    if (categoryKey === 'NON_RATED') {
      return ratings.length === 0;
    }
    return ratings.includes(categoryKey);
  }

  function ensureActiveCategory() {
    if (!OFFICER_CATEGORIES.some((category) => category.key === boardState.activeCategory)) {
      boardState.activeCategory = OFFICER_CATEGORIES.length ? OFFICER_CATEGORIES[0].key : '';
    }
    return boardState.activeCategory;
  }

  function createOfficerChip(officerId, options = {}) {
    const { originCellKey = null, isAvailable = false } = options;
    const officer = officerLookup.get(`${officerId}`);
    const chip = document.createElement('div');
    chip.className = 'deployment-chip';
    if (isAvailable) {
      chip.classList.add('is-available');
    }
    chip.draggable = true;
    chip.dataset.officerId = `${officerId}`;
    chip.dataset.origin = isAvailable ? 'panel' : 'cell';
    if (originCellKey) {
      chip.dataset.cellKey = originCellKey;
    }
    chip.addEventListener('dragstart', handleOfficerDragStart);
    chip.addEventListener('dragend', handleOfficerDragEnd);

    const name = document.createElement('span');
    name.className = 'chip-name';
    name.textContent = officer ? officer.name : officerId;
    chip.appendChild(name);

    const metaText = formatOfficerMeta(officer);
    if (metaText) {
      const meta = document.createElement('span');
      meta.className = 'chip-meta';
      meta.textContent = metaText;
      chip.appendChild(meta);
    }

    if (!isAvailable) {
      const removeButton = document.createElement('button');
      removeButton.type = 'button';
      removeButton.className = 'chip-remove';
      removeButton.setAttribute('aria-label', 'Remove officer from shift');
      removeButton.textContent = '×';
      removeButton.addEventListener('click', () => removeOfficerFromCell(originCellKey, `${officerId}`));
      chip.appendChild(removeButton);
    }

    return chip;
  }

  function formatOfficerMeta(officer) {
    if (!officer) {
      return '';
    }
    const details = [];
    if (officer.service_no) {
      details.push(officer.service_no);
    }
    if (officer.ratings && officer.ratings.length) {
      details.push(officer.ratings.join(', '));
    } else {
      details.push('No rating');
    }
    return details.join(' · ');
  }

  function handleOfficerDragStart(event) {
    const chip = event.currentTarget;
    const officerId = chip.dataset.officerId;
    if (!officerId) {
      event.preventDefault();
      return;
    }
    const officer = officerLookup.get(officerId);
    dragState.officerId = officerId;
    dragState.originType = chip.dataset.origin || 'panel';
    dragState.originCellKey = chip.dataset.cellKey || null;
    dragState.duplicate = event.shiftKey && officerHasLeadershipRating(officer);
    chip.classList.add('is-dragging');
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = dragState.duplicate ? 'copyMove' : 'move';
      event.dataTransfer.setData('text/plain', officerId);
    }
  }

  function handleOfficerDragEnd(event) {
    const chip = event.currentTarget;
    chip.classList.remove('is-dragging');
    boardCells.forEach((info) => {
      if (info && info.cell) {
        info.cell.classList.remove('is-drop-target');
      }
    });
    resetDragState();
  }

  function handleCellDragEnter(event) {
    if (!dragState.officerId) {
      return;
    }
    event.currentTarget.classList.add('is-drop-target');
  }

  function handleCellDragOver(event) {
    if (!dragState.officerId) {
      return;
    }
    event.preventDefault();
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = dragState.duplicate ? 'copy' : 'move';
    }
  }

  function handleCellDragLeave(event) {
    event.currentTarget.classList.remove('is-drop-target');
  }

  function handleCellDrop(event) {
    if (!dragState.officerId) {
      return;
    }
    event.preventDefault();
    const cell = event.currentTarget;
    cell.classList.remove('is-drop-target');
    const shiftCode = cell.dataset.shiftCode;
    const unitKey = cell.dataset.unitKey;
    if (!shiftCode || !unitKey) {
      resetDragState();
      return;
    }
    const cellKey = `${shiftCode}::${unitKey}`;
    const officerId = dragState.officerId;
    const officer = officerLookup.get(officerId);
    const unit = unitMap.get(unitKey);

    if (dragState.originCellKey === cellKey && !event.shiftKey && !dragState.duplicate) {
      resetDragState();
      return;
    }

    if (unit && unit.requires_rating && unit.rating_codes.length && !officerHasRequiredRating(officer, unit.rating_codes)) {
      showStatus(`${formatOfficerLabel(officer)} cannot be assigned — requires rating ${unit.rating_codes.join(', ')}.`, 'error');
      resetDragState();
      return;
    }

    if ((dragState.duplicate || event.shiftKey) && !officerHasLeadershipRating(officer)) {
      showStatus('Only officers rated RIV or RV can be duplicated with Shift+Drag.', 'error');
      resetDragState();
      return;
    }

    const allowMultiple = Boolean(unit && unit.allows_multiple);
    const duplicateRequested = (dragState.duplicate || event.shiftKey) && officerHasLeadershipRating(officer);
    const currentAssignments = getTeamAssignment(shiftCode, unitKey);
    const alreadyAssignedHere = currentAssignments.includes(officerId);

    if (alreadyAssignedHere && !allowMultiple) {
      resetDragState();
      return;
    }
    if (alreadyAssignedHere && allowMultiple && !duplicateRequested) {
      resetDragState();
      return;
    }

    let nextAssignments;
    if (allowMultiple) {
      nextAssignments = [...currentAssignments];
      if (!alreadyAssignedHere || duplicateRequested) {
        nextAssignments.push(officerId);
      }
      nextAssignments = Array.from(new Set(nextAssignments));
    } else {
      nextAssignments = [officerId];
    }

    let stateChanged = false;

    if (!duplicateRequested && dragState.originCellKey && dragState.originCellKey !== cellKey) {
      const [originShift, originUnit] = parseCellKey(dragState.originCellKey);
      if (originShift && originUnit) {
        const originAssignments = getTeamAssignment(originShift, originUnit).filter((value) => value !== officerId);
        setTeamAssignment(originShift, originUnit, originAssignments);
        applyTeamAssignment(originShift, originUnit);
        updateBoardCell(dragState.originCellKey, boardCells.get(dragState.originCellKey));
        stateChanged = true;
      }
    }

    setTeamAssignment(shiftCode, unitKey, nextAssignments);
    applyTeamAssignment(shiftCode, unitKey);
    updateBoardCell(cellKey, boardCells.get(cellKey));
    stateChanged = true;

    if (stateChanged) {
      refreshManualFlagsFromState();
      renderAssignments();
      renderCalendar();
      renderOfficerPanel();
    }

    resetDragState();
  }

  function officerHasRequiredRating(officer, requiredCodes) {
    if (!requiredCodes || !requiredCodes.length) {
      return true;
    }
    const ratings = Array.isArray(officer && officer.ratings) ? officer.ratings : [];
    return requiredCodes.every((code) => ratings.includes(code));
  }

  function officerHasLeadershipRating(officer) {
    if (!officer || !Array.isArray(officer.ratings)) {
      return false;
    }
    return officer.ratings.some((code) => LEADERSHIP_RATINGS.has(code));
  }

  function parseCellKey(cellKey) {
    if (!cellKey) {
      return [null, null];
    }
    const [shiftCode, unitKey] = cellKey.split('::');
    return [shiftCode || null, unitKey || null];
  }

  function removeOfficerFromCell(cellKey, officerId) {
    const [shiftCode, unitKey] = parseCellKey(cellKey);
    if (!shiftCode || !unitKey) {
      return;
    }
    const assignments = getTeamAssignment(shiftCode, unitKey).filter((value) => value !== officerId);
    setTeamAssignment(shiftCode, unitKey, assignments);
    applyTeamAssignment(shiftCode, unitKey);
    updateBoardCell(cellKey, boardCells.get(cellKey));
    refreshManualFlagsFromState();
    renderAssignments();
    renderCalendar();
    renderOfficerPanel();
  }

  function resetDragState() {
    dragState.officerId = null;
    dragState.originType = null;
    dragState.originCellKey = null;
    dragState.duplicate = false;
  }

  function applyTeamAssignment(shiftCode, unitKey) {
    const templateDay = getTemplateDaySequence(shiftCode);
    if (!templateDay) {
      return;
    }
    const officers = getTeamAssignment(shiftCode, unitKey);
    const templateEntry = ensureAssignmentEntry(templateDay, shiftCode, unitKey);
    if (!templateEntry) {
      return;
    }
    templateEntry.officers = [...officers];
    state.days.forEach((day) => {
      const entry = ensureAssignmentEntry(day.sequence, shiftCode, unitKey);
      if (!entry) {
        return;
      }
      if (day.sequence === templateDay) {
        entry.officers = [...officers];
        return;
      }
      if (entry.isManual) {
        return;
      }
      entry.officers = [...officers];
      if (!officers.length) {
        entry.remarks = '';
      }
    });
  }

  function applyAllTeamAssignments() {
    if (!state.days.length || !state.shifts.length) {
      return;
    }
    const activeKeys = new Set();
    Object.entries(state.teamAssignments).forEach(([shiftCode, unitAssignments]) => {
      Object.keys(unitAssignments).forEach((unitKey) => {
        activeKeys.add(`${shiftCode}::${unitKey}`);
        applyTeamAssignment(shiftCode, unitKey);
      });
    });

    state.days.forEach((day) => {
      state.shifts.forEach((shift) => {
        const templateDay = getTemplateDaySequence(shift.code);
        if (!templateDay) {
          return;
        }
        const dayAssignments = state.assignments[day.sequence] || {};
        const shiftAssignments = dayAssignments[shift.code];
        if (!shiftAssignments) {
          return;
        }
        state.units.forEach((unitKey) => {
          const key = `${shift.code}::${unitKey}`;
          if (activeKeys.has(key)) {
            return;
          }
          const entry = shiftAssignments[unitKey];
          if (!entry) {
            return;
          }
          if (day.sequence === templateDay || !entry.isManual) {
            entry.officers = [];
            if (day.sequence !== templateDay) {
              entry.remarks = '';
            }
          }
        });
      });
    });

    refreshManualFlagsFromState();
  }

  function syncTeamAssignmentsFromTemplateEntry(daySequence, shiftCode, unitKey) {
    const templateDay = getTemplateDaySequence(shiftCode);
    if (!templateDay || daySequence !== templateDay) {
      return;
    }
    const entry = ensureAssignmentEntry(daySequence, shiftCode, unitKey);
    if (!entry) {
      return;
    }
    const officers = Array.isArray(entry.officers) ? entry.officers.filter(Boolean) : [];
    setTeamAssignment(shiftCode, unitKey, officers);
    updateTeamSetupSelections();
  }

  function deriveTeamAssignmentsFromTemplate() {
    if (!state.shifts.length) {
      state.teamAssignments = {};
      return;
    }
    const teams = {};
    state.shifts.forEach((shift) => {
      const templateDay = getTemplateDaySequence(shift.code);
      if (!templateDay) {
        return;
      }
      const templateAssignments = state.assignments[templateDay] || {};
      const unitAssignments = templateAssignments[shift.code] || {};
      Object.entries(unitAssignments).forEach(([unitKey, entry]) => {
        if (!entry || !Array.isArray(entry.officers) || !entry.officers.length) {
          return;
        }
        if (!teams[shift.code]) {
          teams[shift.code] = {};
        }
        teams[shift.code][unitKey] = [...entry.officers];
      });
    });
    state.teamAssignments = teams;
  }

  function rebuildRotation() {
    if (!state.days.length || !state.shifts.length) {
      state.rotation = {};
      state.templateDaysByShift = {};
      return;
    }

    const periodsOfDuty = state.config.periodsOfDuty || state.timings.length;
    const activeTimings = getActiveTimings(state.timings, periodsOfDuty);
    state.timings = activeTimings;
    state.cycle = sanitizeCycleEntries(state.cycle, activeTimings, periodsOfDuty);

    if (!state.cycle.length || (!activeTimings.length && periodsOfDuty)) {
      state.rotation = {};
      state.templateDaysByShift = {};
      return;
    }

    const rotation = {};
    const orderedShifts = [...state.shifts].sort((a, b) => a.sequence - b.sequence);
    const cycleLength = state.cycle.length;

    if (periodsOfDuty === 2 && activeTimings.length) {
      state.days.forEach((day, dayIndex) => {
        const dayRotation = {};
        orderedShifts.forEach((shift, shiftIndex) => {
          const cycleIndex = (dayIndex + shiftIndex) % cycleLength;
          const template = state.cycle[cycleIndex] || null;
          if (!template) {
            return;
          }
          if (template.type === 'timing') {
            const preferredTiming = activeTimings.find((timing) => timing.id === template.timingId);
            const fallbackIndex = (dayIndex + shiftIndex) % activeTimings.length;
            const fallbackTiming = preferredTiming || activeTimings[fallbackIndex] || null;
            if (fallbackTiming) {
              dayRotation[shift.code] = {
                ...template,
                timingId: fallbackTiming.id,
              };
            } else {
              dayRotation[shift.code] = {
                sequence: template.sequence || cycleIndex + 1,
                type: 'off',
                timingId: '',
                label: template.label || 'Off Day',
              };
            }
            return;
          }
          dayRotation[shift.code] = { ...template };
        });
        rotation[day.sequence] = dayRotation;
      });
    } else {
      state.days.forEach((day, dayIndex) => {
        const dayRotation = {};
        orderedShifts.forEach((shift, shiftIndex) => {
          const cycleIndex = (dayIndex + shiftIndex) % cycleLength;
          const template = state.cycle[cycleIndex] || null;
          if (template) {
            dayRotation[shift.code] = { ...template };
          }
        });
        rotation[day.sequence] = dayRotation;
      });
    }

    state.rotation = rotation;
    computeTemplateDaysByShift();
  }

  function getRotationEntry(daySequence, shiftCode) {
    const dayRotation = state.rotation[daySequence];
    if (!dayRotation) {
      return null;
    }
    return dayRotation[shiftCode] || null;
  }

  function computeTemplateDaysByShift() {
    const mapping = {};
    const orderedDays = [...state.days].sort((a, b) => a.sequence - b.sequence);
    state.shifts.forEach((shift) => {
      for (let index = 0; index < orderedDays.length; index += 1) {
        const day = orderedDays[index];
        const rotationEntry = getRotationEntry(day.sequence, shift.code);
        if (rotationEntry && rotationEntry.type === 'timing') {
          mapping[shift.code] = day.sequence;
          break;
        }
      }
    });
    state.templateDaysByShift = mapping;
  }

  function findShiftForTiming(daySequence, timingId) {
    if (!timingId) {
      return null;
    }
    const dayRotation = state.rotation[daySequence] || {};
    return (
      state.shifts.find((shift) => {
        const entry = dayRotation[shift.code];
        return entry && entry.type === 'timing' && entry.timingId === timingId;
      }) || null
    );
  }

  function pruneAssignments() {
    const validUnits = new Set(state.units);
    const validShifts = new Set(state.shifts.map((shift) => shift.code));
    const validDays = new Set(state.days.map((day) => `${day.sequence}`));

    Object.keys(state.assignments).forEach((dayKey) => {
      if (!validDays.has(dayKey)) {
        delete state.assignments[dayKey];
        return;
      }
      const dayAssignments = state.assignments[dayKey];
      const rotation = state.rotation[dayKey] || {};
      Object.keys(dayAssignments).forEach((shiftCode) => {
        if (!validShifts.has(shiftCode)) {
          delete dayAssignments[shiftCode];
          return;
        }
        const rotationEntry = rotation[shiftCode];
        if (!rotationEntry || rotationEntry.type !== 'timing') {
          delete dayAssignments[shiftCode];
          return;
        }
        const unitAssignments = dayAssignments[shiftCode];
        Object.keys(unitAssignments).forEach((unitKey) => {
          if (!validUnits.has(unitKey)) {
            delete unitAssignments[unitKey];
          }
        });
      });
    });
  }

  function collectShiftRows() {
    const rows = Array.from(elements.shiftRows.querySelectorAll('.shift-row'));
    return rows.map((row, index) => {
      const sequence = parseInt(row.querySelector('[data-field="sequence"]').value, 10) || index + 1;
      const code = row.querySelector('[data-field="code"]').value.trim();
      const title = row.querySelector('[data-field="title"]').value.trim();
      return {
        code,
        title,
        sequence,
      };
    });
  }

  function buildDays(monthValue, effectiveFrom, durationDays) {
    if (!monthValue || !effectiveFrom || !durationDays) {
      return [];
    }
    const [yearStr, monthStr] = monthValue.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (!year || !month) {
      return [];
    }
    const parsedStart = new Date(effectiveFrom);
    if (
      Number.isNaN(parsedStart.getTime())
      || parsedStart.getMonth() + 1 !== month
      || parsedStart.getFullYear() !== year
    ) {
      return [];
    }
    const startDate = parsedStart;
    const lastDay = new Date(year, month, 0).getDate();
    const startDay = startDate.getDate();
    const days = [];
    let sequence = 1;
    for (let offset = 0; offset < durationDays; offset += 1) {
      const day = startDay + offset;
      if (day > lastDay) {
        break;
      }
      const date = `${year}-${pad(month)}-${pad(day)}`;
      days.push({ sequence, date });
      sequence += 1;
    }
    return days;
  }

  function renderDayList() {
    elements.dayList.innerHTML = '';
    state.days.forEach((day) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = formatDate(day.date, day.sequence);
      if (day.sequence === state.currentDay) {
        button.classList.add('is-active');
      }
      button.addEventListener('click', () => setActiveDay(day.sequence));
      const item = document.createElement('li');
      item.appendChild(button);
      elements.dayList.appendChild(item);
    });
  }

  function setActiveDay(sequence) {
    state.currentDay = sequence;
    Array.from(elements.dayList.querySelectorAll('button')).forEach((button, index) => {
      button.classList.toggle('is-active', state.days[index] && state.days[index].sequence === sequence);
    });
    renderAssignments();
    renderCalendar();
  }

  function renderAssignments() {
    elements.assignmentColumns.innerHTML = '';
    if (!state.currentDay) {
      return;
    }
    const dayAssignments = getOrCreateDayAssignments(state.currentDay);
    const timingOrder = [...state.timings].sort((a, b) => a.sequence - b.sequence);
    const restSummaries = [];
    const orderedShifts = [...state.shifts].sort((a, b) => a.sequence - b.sequence);

    timingOrder.forEach((timing, index) => {
      const column = document.createElement('div');
      column.className = 'assignment-column';

      const assignedShift = findShiftForTiming(state.currentDay, timing.id);
      const heading = document.createElement('h4');
      const timingLabel = timing.label || `Timing ${index + 1}`;
      if (assignedShift) {
        heading.textContent = `${timingLabel} — Shift ${assignedShift.code}`;
      } else {
        heading.textContent = `${timingLabel} — Unassigned`;
        heading.classList.add('is-unassigned');
      }
      column.appendChild(heading);

      if (assignedShift && assignedShift.title) {
        const shiftHint = document.createElement('div');
        shiftHint.className = 'hint';
        shiftHint.textContent = assignedShift.title;
        column.appendChild(shiftHint);
      }

      if (!assignedShift) {
        const message = document.createElement('p');
        message.className = 'hint';
        message.textContent = 'No shift is assigned to this timing in the current cycle.';
        column.appendChild(message);
        elements.assignmentColumns.appendChild(column);
        return;
      }

      state.units.forEach((unitKey) => {
        const definition = unitMap.get(unitKey);
        const unitContainer = document.createElement('div');
        unitContainer.className = 'unit-assignment';

        const label = document.createElement('label');
        const selectId = createAssignmentFieldId('assignment', unitKey, assignedShift.code, state.currentDay);
        label.setAttribute('for', `${selectId}-select`);
        label.textContent = definition ? definition.label : unitKey;
        unitContainer.appendChild(label);

        const hint = document.createElement('div');
        hint.className = 'hint';
        if (definition && definition.requires_rating && definition.rating_codes.length) {
          hint.textContent = `Requires rating: ${definition.rating_codes.join(', ')}`;
        } else if (definition && definition.allows_multiple) {
          hint.textContent = 'Multiple officers allowed';
        } else {
          hint.textContent = 'Select one officer';
        }
        hint.id = `${selectId}-hint`;
        unitContainer.appendChild(hint);

        const select = document.createElement('select');
        select.id = `${selectId}-select`;
        select.name = `${selectId}-select`;
        select.dataset.unitKey = unitKey;
        select.dataset.shiftCode = assignedShift.code;
        select.dataset.daySequence = state.currentDay;
        const assignmentUnitLabel = definition && definition.label ? definition.label : unitKey;
        const assignmentDay = state.currentDay;
        const hasAssignmentDay = assignmentDay !== undefined && assignmentDay !== null && assignmentDay !== '';
        const dayLabel = hasAssignmentDay ? `, day ${assignmentDay}` : '';
        select.setAttribute(
          'aria-label',
          `Assignment for ${assignmentUnitLabel}, shift ${assignedShift.code}${dayLabel}`,
        );
        select.setAttribute('aria-describedby', `${selectId}-hint`);
        if (definition && definition.allows_multiple) {
          select.multiple = true;
          select.size = Math.min(4, Math.max(2, officerOptions.length));
        } else {
          const emptyOption = document.createElement('option');
          emptyOption.value = '';
          emptyOption.textContent = 'Select officer';
          select.appendChild(emptyOption);
        }
        populateOfficerSelect(select, definition && definition.allows_multiple);

        const entry = ensureAssignmentEntry(state.currentDay, assignedShift.code, unitKey);
        if (entry.officers && entry.officers.length) {
          if (select.multiple) {
            Array.from(select.options).forEach((option) => {
              option.selected = entry.officers.includes(option.value);
            });
          } else {
            select.value = entry.officers[0] || '';
          }
        }
        select.addEventListener('change', handleOfficerChange);
        unitContainer.appendChild(select);

        const remarks = document.createElement('textarea');
        remarks.placeholder = 'Remarks (optional)';
        remarks.value = entry.remarks || '';
        remarks.dataset.unitKey = unitKey;
        remarks.dataset.shiftCode = assignedShift.code;
        remarks.dataset.daySequence = state.currentDay;
        remarks.id = `${selectId}-remarks`;
        remarks.name = `${selectId}-remarks`;
        remarks.setAttribute('aria-label', `Remarks for ${assignmentUnitLabel}, shift ${assignedShift.code}${dayLabel}`);
        remarks.addEventListener('input', handleRemarksChange);
        unitContainer.appendChild(remarks);

        column.appendChild(unitContainer);
      });

      elements.assignmentColumns.appendChild(column);
    });

    orderedShifts.forEach((shift) => {
      const rotationEntry = getRotationEntry(state.currentDay, shift.code);
      if (!rotationEntry || rotationEntry.type === 'timing') {
        return;
      }
      const label = rotationEntry.label || (rotationEntry.type === 'rest' ? 'Sleep Recovery' : 'Off Day');
      restSummaries.push(`Shift ${shift.code}: ${label}`);
    });

    if (restSummaries.length) {
      const summary = document.createElement('div');
      summary.className = 'rest-summary';
      const title = document.createElement('h4');
      title.textContent = 'Rest / Off';
      summary.appendChild(title);
      const list = document.createElement('ul');
      restSummaries.forEach((text) => {
        const item = document.createElement('li');
        item.textContent = text;
        list.appendChild(item);
      });
      summary.appendChild(list);
      elements.assignmentColumns.appendChild(summary);
    }
  }

  function renderCalendar() {
    if (!elements.rosterCalendar) {
      return;
    }
    elements.rosterCalendar.innerHTML = '';
    if (!state.days.length || !state.timings.length) {
      return;
    }

    const table = document.createElement('table');
    table.className = 'calendar-table';

    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.textContent = 'Timing';
    headerRow.appendChild(corner);

    state.days.forEach((day) => {
      const th = document.createElement('th');
      th.textContent = formatDate(day.date, day.sequence);
      if (day.sequence === state.currentDay) {
        th.classList.add('is-active');
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    const timingOrder = [...state.timings].sort((a, b) => a.sequence - b.sequence);

    timingOrder.forEach((timing, index) => {
      const row = document.createElement('tr');
      const labelCell = document.createElement('th');
      labelCell.textContent = timing.label || `Timing ${index + 1}`;
      row.appendChild(labelCell);

      state.days.forEach((day) => {
        const cell = document.createElement('td');
        const shift = findShiftForTiming(day.sequence, timing.id);
        if (shift) {
          cell.textContent = shift.code;
        } else {
          cell.textContent = '—';
          cell.classList.add('is-empty');
        }
        if (day.sequence === state.currentDay) {
          cell.classList.add('is-active');
        }
        row.appendChild(cell);
      });

      tbody.appendChild(row);
    });

    const restRow = document.createElement('tr');
    const restHeader = document.createElement('th');
    restHeader.textContent = 'Rest / Off';
    restRow.appendChild(restHeader);
    state.days.forEach((day) => {
      const cell = document.createElement('td');
      const summaries = [];
      const rotation = state.rotation[day.sequence] || {};
      Object.keys(rotation).forEach((shiftCode) => {
        const entry = rotation[shiftCode];
        if (entry && entry.type !== 'timing') {
          const label = entry.label || (entry.type === 'rest' ? 'Sleep Recovery' : 'Off Day');
          summaries.push(`${shiftCode} (${label})`);
        }
      });
      cell.textContent = summaries.join(', ') || '—';
      if (day.sequence === state.currentDay) {
        cell.classList.add('is-active');
      }
      restRow.appendChild(cell);
    });
    tbody.appendChild(restRow);

    table.appendChild(tbody);
    elements.rosterCalendar.appendChild(table);
  }

  function handleOfficerChange(event) {
    const select = event.target;
    const daySequence = parseInt(select.dataset.daySequence, 10);
    const shiftCode = select.dataset.shiftCode;
    const unitKey = select.dataset.unitKey;
    const entry = ensureAssignmentEntry(daySequence, shiftCode, unitKey);
    if (!entry) {
      return;
    }
    if (select.multiple) {
      entry.officers = Array.from(select.selectedOptions).map((option) => option.value).filter(Boolean);
    } else {
      entry.officers = select.value ? [select.value] : [];
    }
    updateManualFlag(entry, daySequence, shiftCode, unitKey);
    propagateTemplateAssignment(daySequence, shiftCode, unitKey);
    syncTeamAssignmentsFromTemplateEntry(daySequence, shiftCode, unitKey);
  }

  function handleRemarksChange(event) {
    const textarea = event.target;
    const daySequence = parseInt(textarea.dataset.daySequence, 10);
    const shiftCode = textarea.dataset.shiftCode;
    const unitKey = textarea.dataset.unitKey;
    const entry = ensureAssignmentEntry(daySequence, shiftCode, unitKey);
    if (!entry) {
      return;
    }
    entry.remarks = textarea.value.trim();
    updateManualFlag(entry, daySequence, shiftCode, unitKey);
    propagateTemplateAssignment(daySequence, shiftCode, unitKey);
  }

  function ensureAssignmentEntry(daySequence, shiftCode, unitKey) {
    const rotationEntry = getRotationEntry(daySequence, shiftCode);
    if (!rotationEntry || rotationEntry.type !== 'timing') {
      return null;
    }
    const dayAssignments = getOrCreateDayAssignments(daySequence);
    if (!dayAssignments[shiftCode]) {
      dayAssignments[shiftCode] = {};
    }
    if (!dayAssignments[shiftCode][unitKey]) {
      dayAssignments[shiftCode][unitKey] = { officers: [], remarks: '', isManual: false };
    }
    return dayAssignments[shiftCode][unitKey];
  }

  function getOrCreateDayAssignments(daySequence) {
    if (!state.assignments[daySequence]) {
      state.assignments[daySequence] = {};
    }
    return state.assignments[daySequence];
  }

  function getTemplateDaySequence(shiftCode) {
    if (shiftCode && state.templateDaysByShift && state.templateDaysByShift[shiftCode]) {
      return state.templateDaysByShift[shiftCode];
    }
    return state.days.length ? state.days[0].sequence : null;
  }

  function propagateTemplateAssignment(sourceDay, shiftCode, unitKey) {
    const templateDay = getTemplateDaySequence(shiftCode);
    if (!templateDay || sourceDay !== templateDay) {
      return;
    }
    const templateEntry = ensureAssignmentEntry(templateDay, shiftCode, unitKey);
    if (!templateEntry) {
      return;
    }
    const officers = Array.isArray(templateEntry.officers) ? [...templateEntry.officers] : [];
    const remarks = templateEntry.remarks || '';
    state.days.forEach((day) => {
      if (day.sequence === templateDay) {
        return;
      }
      const targetEntry = ensureAssignmentEntry(day.sequence, shiftCode, unitKey);
      if (!targetEntry || targetEntry.isManual) {
        return;
      }
      targetEntry.officers = [...officers];
      targetEntry.remarks = remarks;
    });
  }

  function updateManualFlag(entry, daySequence, shiftCode, unitKey) {
    if (!entry) {
      return;
    }
    const hasOfficers = Array.isArray(entry.officers) && entry.officers.length > 0;
    const hasRemarks = typeof entry.remarks === 'string' && entry.remarks.length > 0;
    const templateDay = getTemplateDaySequence(shiftCode);

    if (!templateDay) {
      entry.isManual = hasOfficers || hasRemarks;
      return;
    }

    if (daySequence === templateDay) {
      entry.isManual = true;
      return;
    }

    if (!shiftCode || !unitKey) {
      entry.isManual = hasOfficers || hasRemarks;
      return;
    }

    const rotationEntry = getRotationEntry(templateDay, shiftCode);
    if (!rotationEntry || rotationEntry.type !== 'timing') {
      entry.isManual = hasOfficers || hasRemarks;
      return;
    }

    const templateEntry = ensureAssignmentEntry(templateDay, shiftCode, unitKey);
    if (!templateEntry) {
      entry.isManual = hasOfficers || hasRemarks;
      return;
    }

    const templateOfficers = Array.isArray(templateEntry.officers) ? [...templateEntry.officers] : [];
    const currentOfficers = Array.isArray(entry.officers) ? [...entry.officers] : [];
    const templateRemarks = templateEntry.remarks || '';
    const sortedTemplate = [...templateOfficers].sort();
    const sortedCurrent = [...currentOfficers].sort();
    const officersMatch = sortedTemplate.length === sortedCurrent.length
      && sortedTemplate.every((value, index) => value === sortedCurrent[index]);
    const remarksMatch = templateRemarks === entry.remarks;

    if (!hasOfficers && !hasRemarks && !templateOfficers.length && !templateRemarks) {
      entry.isManual = false;
      return;
    }

    entry.isManual = !(officersMatch && remarksMatch);
  }

  function refreshManualFlagsFromState() {
    Object.entries(state.assignments).forEach(([dayKey, dayAssignments]) => {
      const daySequence = parseInt(dayKey, 10);
      if (Number.isNaN(daySequence)) {
        return;
      }
      Object.entries(dayAssignments).forEach(([shiftCode, shiftAssignments]) => {
        Object.entries(shiftAssignments).forEach(([unitKey, entry]) => {
          updateManualFlag(entry, daySequence, shiftCode, unitKey);
        });
      });
    });
  }

  function updateSaveButtons() {
    if (elements.saveRoster) {
      elements.saveRoster.textContent = state.isDraft ? 'Publish roster' : 'Save roster';
    }
  }

  function handleLoadPreviousConfiguration() {
    if (!builderMeta || !builderMeta.apiUrl) {
      showStatus('Previous roster data is unavailable.', 'error');
      return;
    }

    const button = elements.loadPreviousConfiguration || null;
    const originalLabel = button ? button.dataset.label || button.textContent || '' : '';
    const loadingLabel = button ? button.dataset.loadingLabel || 'Loading…' : 'Loading…';

    if (button) {
      button.disabled = true;
      button.textContent = loadingLabel;
    }

    let requestUrl;
    try {
      requestUrl = new URL(builderMeta.apiUrl, window.location.origin);
    } catch (error) {
      if (button) {
        button.disabled = false;
        button.textContent = originalLabel;
      }
      showStatus('Previous roster data is unavailable.', 'error');
      return;
    }

    if (builderMeta.locationId) {
      requestUrl.searchParams.set('location', builderMeta.locationId);
    }
    requestUrl.searchParams.set('page_size', '1');

    fetch(requestUrl.toString(), {
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load the previous roster configuration.');
        }
        return response.json();
      })
      .then((data) => {
        let rosterData = null;
        if (Array.isArray(data)) {
          rosterData = data.length ? data[0] : null;
        } else if (data && Array.isArray(data.results)) {
          rosterData = data.results.length ? data.results[0] : null;
        } else if (data && typeof data === 'object' && data.id) {
          rosterData = data;
        }

        if (!rosterData) {
          throw new Error('No previous roster is available for this location.');
        }

        hydrateFromInitialData(rosterData);
        state.isDraft = false;
        updateSaveButtons();
        showStatus('Previous roster configuration loaded. Review the details before saving.', 'success');
      })
      .catch((error) => {
        showStatus(error.message || 'Unable to load the previous roster configuration.', 'error');
      })
      .finally(() => {
        if (button) {
          button.disabled = false;
          button.textContent = originalLabel || button.textContent || '';
        }
      });
  }

  function submitRoster(saveAsDraft = false) {
    const payload = buildPayload({ allowPartial: saveAsDraft });
    if (!payload) {
      return;
    }

    payload.is_draft = saveAsDraft;

    showStatus(saveAsDraft ? 'Saving draft…' : 'Saving roster…', 'info');
    const url = builderMeta.rosterId ? builderMeta.detailUrl : builderMeta.apiUrl;
    const method = builderMeta.rosterId ? 'PUT' : 'POST';

    fetch(url, {
      method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': getCsrfToken(),
      },
      body: JSON.stringify(payload),
    })
      .then(async (response) => {
        const contentType = response.headers.get('content-type') || '';
        let data = null;

        if (contentType.includes('application/json')) {
          data = await response.json();
        } else {
          const text = await response.text();
          if (text) {
            const trimmed = text.trim();
            if (!trimmed.startsWith('<')) {
              if (!response.ok) {
                throw new Error(trimmed);
              }
            } else {
              try {
                data = JSON.parse(trimmed);
              } catch (error) {
                // Ignore parse failure for non-JSON HTML responses.
              }
            }
          }
        }

        if (!response.ok) {
          const message = data ? extractErrorMessage(data) : null;
          throw new Error(message || 'Unable to save roster. Please review the details.');
        }

        return data;
      })
      .then((data) => {
        if (!builderMeta.rosterId && data && data.id) {
          builderMeta.rosterId = data.id;
          builderMeta.detailUrl = `${builderMeta.apiUrl}${data.id}/`;
        }
        const responseIsDraft = data && typeof data.is_draft === 'boolean' ? data.is_draft : saveAsDraft;
        state.isDraft = responseIsDraft;
        updateSaveButtons();
        if (!responseIsDraft && builderMeta.listUrl) {
          showStatus('Roster saved successfully. Redirecting to the roster list…', 'success');
          window.setTimeout(() => {
            window.location.href = builderMeta.listUrl;
          }, 800);
          return;
        }
        const successMessage = responseIsDraft
          ? 'Draft saved successfully. You can resume editing later.'
          : 'Roster saved successfully. You can return to the dashboard or continue editing.';
        showStatus(successMessage, 'success');
      })
      .catch((error) => {
        showStatus(error.message || 'Unable to save roster. Please review the details.', 'error');
      });
  }

  function buildPayload(options = {}) {
    const { allowPartial = false } = options;

    if (!allowPartial && !state.days.length) {
      showStatus('Configure the roster and select at least one day before saving.', 'error');
      return null;
    }
    const [yearStr, monthStr] = (state.config.effectiveMonth || '').split('-');
    const effectiveYear = parseInt(yearStr, 10);
    const effectiveMonth = parseInt(monthStr, 10);
    if (!effectiveYear || !effectiveMonth) {
      showStatus('Roster month is not defined. Please return to Step 1.', 'error');
      return null;
    }

    const assignmentsPayload = [];
    state.days.forEach((day) => {
      const dayAssignments = state.assignments[day.sequence] || {};
      state.shifts.forEach((shift) => {
        const shiftAssignments = dayAssignments[shift.code] || {};
        state.units.forEach((unitKey) => {
          const entry = shiftAssignments[unitKey];
          if (entry && entry.officers && entry.officers.length) {
            entry.officers.forEach((officer) => {
              assignmentsPayload.push({
                day_sequence: day.sequence,
                shift_code: shift.code,
                unit_key: unitKey,
                officer,
                remarks: entry.remarks || '',
              });
            });
          }
        });
      });
    });

    if (!allowPartial && !assignmentsPayload.length) {
      showStatus('Assign at least one officer before saving the roster.', 'error');
      return null;
    }

    const nonOperationalPayload = {};
    nonOperationalUnits.forEach((unit) => {
      const values = state.nonOperationalAssignments[unit.key] || [];
      if (!values || !values.length) {
        return;
      }
      if (unit.allows_multiple_personnel) {
        nonOperationalPayload[unit.key] = [...values];
      } else {
        nonOperationalPayload[unit.key] = values[0];
      }
    });

    const shiftsPayload = state.shifts.map((shift, index) => ({
      code: shift.code,
      title: shift.title,
      sequence: shift.sequence || index + 1,
    }));

    const dutyTimingsPayload = state.timings.map((timing, index) => ({
      sequence: timing.sequence || index + 1,
      title: timing.label,
      start_time: timing.start_time || '00:00:00',
      end_time: timing.end_time || '00:00:00',
    }));

    const cycleTemplate = {
      timings: state.timings.map((timing, index) => ({
        id: timing.id,
        label: timing.label,
        sequence: timing.sequence || index + 1,
        start_time: timing.start_time || '00:00:00',
        end_time: timing.end_time || '00:00:00',
      })),
      cycle: state.cycle.map((entry, index) => ({
        sequence: entry.sequence || index + 1,
        type: entry.type,
        timing_id: entry.timingId || entry.timing_id || '',
        label: entry.label || '',
      })),
      shifts: state.shifts.map((shift) => shift.code),
    };

    return {
      title: state.config.title,
      location: builderMeta.locationId,
      effective_year: effectiveYear,
      effective_month: effectiveMonth,
      effective_from: state.config.effectiveFrom,
      shift_cycle_length: state.config.shiftCycleLength,
      duration_days: state.config.durationDays,
      developed_by: state.config.developedBy || null,
      verified_by: state.config.verifiedBy || null,
      approved_by: state.config.approvedBy || null,
      shifts: shiftsPayload,
      duty_timings: dutyTimingsPayload,
      units: state.units,
      days: state.days,
      assignments: assignmentsPayload,
      cycle_template: cycleTemplate,
      non_operational_assignments: nonOperationalPayload,
    };
  }

  function updateAssignmentSummary() {
    if (!elements.assignmentMonthLabel) {
      return;
    }
    elements.assignmentMonthLabel.textContent = formatMonth(state.config.effectiveMonth);
    elements.assignmentCycle.textContent = state.config.shiftCycleLength || 0;
    if (elements.assignmentDuration) {
      elements.assignmentDuration.textContent = state.config.durationDays || 0;
    }
  }

  function populateOfficerSelect(select, allowMultiple) {
    const fragment = document.createDocumentFragment();
    officerOptions.forEach((officer) => {
      const option = document.createElement('option');
      option.value = officer.id;
      option.textContent = `${officer.name} (${officer.service_no})`;
      fragment.appendChild(option);
    });
    select.appendChild(fragment);
    if (!allowMultiple && !select.value) {
      select.value = '';
    }
  }

  function ensureOfficerOption(select, value) {
    if (!select || value === null || value === undefined) {
      return;
    }
    const id = `${value}`;
    if (!id) {
      return;
    }
    const exists = Array.from(select.options).some((option) => option.value === id);
    if (exists) {
      return;
    }
    const option = document.createElement('option');
    option.value = id;
    const officer = officerLookup.get(id);
    option.textContent = officer ? formatOfficerLabel(officer) : id;
    option.dataset.missingOfficer = 'true';
    select.appendChild(option);
  }

  function applyOfficerSelections(select, values) {
    if (!select) {
      return;
    }
    const arrayValues = Array.isArray(values) ? values : [values];
    const selections = new Set(arrayValues.filter(Boolean).map((value) => {
      const id = `${value}`;
      ensureOfficerOption(select, id);
      return id;
    }));
    Array.from(select.options).forEach((option) => {
      option.selected = selections.has(option.value);
    });
    if (!select.multiple) {
      const [first] = selections.size ? Array.from(selections) : [''];
      select.value = first || '';
    }
  }

  function formatOfficerLabel(officer) {
    if (!officer) {
      return '';
    }
    return `${officer.name} (${officer.service_no})`;
  }

  function formatOfficerChip(officer, useDashFormat) {
    if (!officer) {
      return '';
    }
    if (useDashFormat) {
      const service = officer.service_no ? ` — ${officer.service_no}` : '';
      return `${officer.name}${service}`;
    }
    return formatOfficerLabel(officer);
  }

  function applyNonOperationalSelections(wrapper, values) {
    if (!wrapper) {
      return;
    }
    const unitKey = wrapper.dataset.unit;
    const normalized = (Array.isArray(values) ? values : [values])
      .filter(Boolean)
      .map((value) => `${value}`);
    if (wrapper.dataset.allowsMultiple === 'true') {
      renderNonOperationalSelections(wrapper, unitKey, normalized);
      return;
    }
    const select = wrapper.querySelector('select[data-unit]');
    applyOfficerSelections(select, normalized);
  }

  function renderNonOperationalSelections(wrapper, unitKey, values) {
    if (!wrapper) {
      return;
    }
    const container = wrapper.querySelector('.non-operational-selected');
    if (!container) {
      return;
    }
    const selections = (Array.isArray(values) ? values : [values])
      .filter(Boolean)
      .map((value) => `${value}`);
    container.innerHTML = '';
    if (!selections.length) {
      const empty = document.createElement('div');
      empty.className = 'non-operational-empty';
      empty.textContent = 'No officers selected';
      container.appendChild(empty);
      return;
    }
    selections.forEach((value) => {
      const chip = document.createElement('span');
      chip.className = 'selected-officer-chip';
      const officer = officerLookup.get(value);
      const label = document.createElement('span');
      label.className = 'chip-label';
      label.textContent = officer
        ? formatOfficerChip(officer, wrapper.dataset.asyncPicker === 'true')
        : value;
      chip.appendChild(label);
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'chip-remove';
      remove.dataset.removeOfficer = value;
      remove.dataset.unit = unitKey;
      remove.setAttribute('aria-label', `Remove ${label.textContent}`);
      remove.textContent = '×';
      chip.appendChild(remove);
      container.appendChild(chip);
    });
  }

  function getOfficerMatches(unitKey, query) {
    const trimmed = (query || '').toLowerCase().trim();
    const tokens = trimmed ? trimmed.split(/\s+/).filter(Boolean) : [];
    const selected = new Set(
      (state.nonOperationalAssignments[unitKey] || []).map((value) => `${value}`),
    );
    const matches = [];
    for (let index = 0; index < officerOptions.length; index += 1) {
      const officer = officerOptions[index];
      const officerId = `${officer.id}`;
      if (selected.has(officerId)) {
        continue;
      }
      if (!tokens.length) {
        matches.push(officer);
      } else {
        const haystack = `${officer.name} ${officer.service_no}`.toLowerCase();
        if (tokens.every((token) => haystack.includes(token))) {
          matches.push(officer);
        }
      }
      if (matches.length >= 8) {
        break;
      }
    }
    return matches;
  }

  function commitSearchSelection(unitKey, wrapper, query) {
    const trimmed = (query || '').trim();
    if (!trimmed) {
      return false;
    }
    const directMatchId = officerLabelLookup.get(trimmed)
      || officerLabelLookup.get(trimmed.toLowerCase());
    let added = false;
    if (directMatchId) {
      added = addOfficerToUnit(unitKey, directMatchId, wrapper);
    } else {
      const matches = getOfficerMatches(unitKey, trimmed);
      if (!matches.length) {
        return false;
      }
      added = addOfficerToUnit(unitKey, `${matches[0].id}`, wrapper);
    }
    if (!added) {
      return false;
    }
    const input = wrapper.querySelector('input[data-unit-search]');
    if (input) {
      input.value = '';
    }
    return true;
  }

  function addOfficerToUnit(unitKey, officerId, wrapper) {
    const id = `${officerId}`;
    if (!officerLookup.has(id)) {
      return false;
    }
    const existing = state.nonOperationalAssignments[unitKey] || [];
    if (existing.includes(id)) {
      return false;
    }
    const updated = [...existing, id];
    state.nonOperationalAssignments[unitKey] = updated;
    const targetWrapper = wrapper
      || (elements.nonOperationalList
        ? elements.nonOperationalList.querySelector(
          `.non-operational-item[data-unit="${unitKey}"]`,
        )
        : null);
    if (targetWrapper) {
      renderNonOperationalSelections(targetWrapper, unitKey, updated);
      if (targetWrapper.dataset.asyncPicker === 'true') {
        refreshAsyncPickerState(targetWrapper, unitKey);
      }
    }
    return true;
  }

  function removeOfficerFromUnit(unitKey, officerId, wrapper) {
    const id = `${officerId}`;
    const existing = state.nonOperationalAssignments[unitKey] || [];
    const filtered = existing.filter((value) => value !== id);
    if (filtered.length) {
      state.nonOperationalAssignments[unitKey] = filtered;
    } else {
      delete state.nonOperationalAssignments[unitKey];
    }
    const targetWrapper = wrapper
      || (elements.nonOperationalList
        ? elements.nonOperationalList.querySelector(
          `.non-operational-item[data-unit="${unitKey}"]`,
        )
        : null);
    if (targetWrapper) {
      renderNonOperationalSelections(targetWrapper, unitKey, filtered);
      if (targetWrapper.dataset.asyncPicker === 'true') {
        refreshAsyncPickerState(targetWrapper, unitKey);
      }
    }
    return true;
  }

  function buildAsyncOfficerPicker(wrapper, unit) {
    if (!wrapper || !unit) {
      return;
    }
    const picker = document.createElement('div');
    picker.className = 'officer-picker';

    const search = document.createElement('div');
    search.className = 'officer-picker-search';

    const input = document.createElement('input');
    input.type = 'search';
    input.placeholder = 'Search by Name or Service No…';
    input.autocomplete = 'off';
    input.dataset.unitSearch = unit.key;
    search.appendChild(input);

    const results = document.createElement('div');
    results.className = 'officer-picker-results';
    results.dataset.pickerResults = unit.key;
    setAsyncResultsMessage(results, 'Type to search officers', 'empty');

    const selectedSection = document.createElement('div');
    selectedSection.className = 'officer-picker-selected-section';
    const header = document.createElement('div');
    header.className = 'officer-picker-selected-header';
    header.textContent = 'Selected officers';
    selectedSection.appendChild(header);

    const selected = document.createElement('div');
    selected.className = 'non-operational-selected';
    selected.dataset.unitSelected = unit.key;
    selectedSection.appendChild(selected);

    picker.appendChild(search);
    picker.appendChild(results);
    picker.appendChild(selectedSection);

    wrapper.appendChild(picker);
  }

  function handleAsyncSearchInput(wrapper, input) {
    if (!wrapper || !input) {
      return;
    }
    scheduleAsyncSearch(wrapper, input.value);
  }

  function scheduleAsyncSearch(wrapper, rawQuery) {
    if (!wrapper) {
      return;
    }
    const unitKey = wrapper.dataset.unit;
    if (!unitKey) {
      return;
    }
    const query = (rawQuery || '').trim();
    const resultsContainer = wrapper.querySelector('[data-picker-results]');
    if (!resultsContainer) {
      return;
    }
    if (asyncSearchTimers.has(unitKey)) {
      window.clearTimeout(asyncSearchTimers.get(unitKey));
    }
    asyncSearchTimers.delete(unitKey);
    if (query.length < 2) {
      asyncSearchResults.delete(unitKey);
      if (asyncSearchControllers.has(unitKey)) {
        asyncSearchControllers.get(unitKey).abort();
        asyncSearchControllers.delete(unitKey);
      }
      setAsyncResultsMessage(resultsContainer, 'Type to search officers', 'empty');
      return;
    }
    setAsyncResultsMessage(resultsContainer, 'Searching…', 'loading');
    const timer = window.setTimeout(() => {
      performAsyncSearch(unitKey, query, wrapper);
    }, 300);
    asyncSearchTimers.set(unitKey, timer);
  }

  function performAsyncSearch(unitKey, query, wrapper) {
    if (!officerSearchUrl) {
      const resultsContainer = wrapper.querySelector('[data-picker-results]');
      if (resultsContainer) {
        setAsyncResultsMessage(resultsContainer, 'Error fetching results', 'error');
      }
      return;
    }
    if (asyncSearchControllers.has(unitKey)) {
      asyncSearchControllers.get(unitKey).abort();
    }
    const controller = new AbortController();
    asyncSearchControllers.set(unitKey, controller);
    fetch(`${officerSearchUrl}?q=${encodeURIComponent(query)}&limit=8`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Failed to load officers');
        }
        return response.json();
      })
      .then((payload) => {
        asyncSearchControllers.delete(unitKey);
        const entries = Array.isArray(payload.results) ? payload.results : [];
        updateOfficerLookupFromResults(entries);
        asyncSearchResults.set(unitKey, { query, entries });
        renderAsyncSearchResults(wrapper, unitKey, { query, entries });
      })
      .catch((error) => {
        if (error && error.name === 'AbortError') {
          return;
        }
        asyncSearchControllers.delete(unitKey);
        const resultsContainer = wrapper.querySelector('[data-picker-results]');
        if (resultsContainer) {
          setAsyncResultsMessage(resultsContainer, 'Error fetching results', 'error');
        }
      });
  }

  function renderAsyncSearchResults(wrapper, unitKey, data) {
    if (!wrapper) {
      return;
    }
    const resultsContainer = wrapper.querySelector('[data-picker-results]');
    if (!resultsContainer) {
      return;
    }
    const entries = data && Array.isArray(data.entries) ? data.entries : [];
    const selectedSet = new Set(
      (state.nonOperationalAssignments[unitKey] || []).map((value) => `${value}`),
    );
    const available = entries.filter((entry) => entry && !selectedSet.has(`${entry.id}`));
    resultsContainer.innerHTML = '';
    if (!available.length) {
      const message = data && data.query ? 'No results' : 'Type to search officers';
      setAsyncResultsMessage(resultsContainer, message, 'empty');
      return;
    }
    available.forEach((entry) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'officer-picker-result';
      button.dataset.officerOption = `${entry.id}`;
      button.dataset.unit = unitKey;
      const service = entry.service_no ? ` — ${entry.service_no}` : '';
      button.textContent = `${entry.name}${service}`;
      resultsContainer.appendChild(button);
    });
  }

  function refreshAsyncPickerState(wrapper, unitKey) {
    const targetWrapper = wrapper
      || (elements.nonOperationalList
        ? elements.nonOperationalList.querySelector(
          `.non-operational-item[data-unit="${unitKey}"]`,
        )
        : null);
    if (!targetWrapper) {
      return;
    }
    const stored = asyncSearchResults.get(unitKey);
    if (stored) {
      renderAsyncSearchResults(targetWrapper, unitKey, stored);
      return;
    }
    const resultsContainer = targetWrapper.querySelector('[data-picker-results]');
    if (resultsContainer) {
      setAsyncResultsMessage(resultsContainer, 'Type to search officers', 'empty');
    }
  }

  function selectFirstAsyncSearchResult(wrapper, unitKey) {
    const stored = asyncSearchResults.get(unitKey);
    if (!stored || !Array.isArray(stored.entries)) {
      return false;
    }
    const selectedSet = new Set(
      (state.nonOperationalAssignments[unitKey] || []).map((value) => `${value}`),
    );
    const candidate = stored.entries.find(
      (entry) => entry && !selectedSet.has(`${entry.id}`),
    );
    if (!candidate) {
      return false;
    }
    const added = addOfficerToUnit(unitKey, `${candidate.id}`, wrapper);
    if (added) {
      resetAsyncPickerInput(wrapper, unitKey);
    }
    return added;
  }

  function resetAsyncPickerInput(wrapper, unitKey) {
    if (!wrapper) {
      return;
    }
    const input = wrapper.querySelector('input[data-unit-search]');
    if (input) {
      input.value = '';
    }
    if (unitKey) {
      scheduleAsyncSearch(wrapper, '');
    }
  }

  function updateOfficerLookupFromResults(entries) {
    if (!Array.isArray(entries)) {
      return;
    }
    entries.forEach((entry) => {
      if (!entry || typeof entry.id === 'undefined') {
        return;
      }
      const normalizedId = `${entry.id}`;
      const existing = officerLookup.get(normalizedId) || {};
      officerLookup.set(normalizedId, {
        id: normalizedId,
        name: entry.name || existing.name || '',
        service_no: entry.service_no || existing.service_no || '',
      });
    });
  }

  function setAsyncResultsMessage(container, message, state) {
    if (!container) {
      return;
    }
    container.innerHTML = '';
    const text = document.createElement('div');
    text.className = 'officer-picker-results-message';
    if (state) {
      text.dataset.state = state;
    }
    text.textContent = message;
    container.appendChild(text);
  }

  function populatePersonaSelect(select, options) {
    if (!select) {
      return;
    }
    options.forEach((persona) => {
      const option = document.createElement('option');
      option.value = persona.id;
      option.textContent = `${persona.name} (${persona.service_no})`;
      select.appendChild(option);
    });
  }

  function buildUnitChecklist() {
    operationalUnits.forEach((unit) => {
      const wrapper = document.createElement('label');
      wrapper.className = 'unit-option';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.unit = unit.key;
      checkbox.value = unit.key;
      wrapper.appendChild(checkbox);

      const text = document.createElement('span');
      text.innerHTML = `${unit.label}<span class="unit-hint">${unit.allows_multiple ? 'Multiple assignments allowed' : 'Single assignment'}${unit.requires_rating && unit.rating_codes.length ? ` · Rating ${unit.rating_codes.join(', ')}` : ''}</span>`;
      wrapper.appendChild(text);
      elements.unitChecklist.appendChild(wrapper);
    });
  }

  function ensureOfficerSearchList() {
    let datalist = document.getElementById(OFFICER_SEARCH_LIST_ID);
    if (!datalist) {
      datalist = document.createElement('datalist');
      datalist.id = OFFICER_SEARCH_LIST_ID;
      officerOptions.forEach((officer) => {
        const option = document.createElement('option');
        option.value = formatOfficerLabel(officer);
        datalist.appendChild(option);
      });
      document.body.appendChild(datalist);
    }
    return datalist.id;
  }

  function bindUnitEvents() {
    elements.unitChecklist.addEventListener('change', (event) => {
      if (event.target && event.target.matches('input[type="checkbox"]')) {
        const selected = operationalUnits
          .filter((unit) => {
            const input = elements.unitChecklist.querySelector(`input[data-unit="${unit.key}"]`);
            return input && input.checked;
          })
          .map((unit) => unit.key);
        state.units = selected;
      }
    });
  }

  function buildNonOperationalList() {
    if (!elements.nonOperationalList) {
      return;
    }
    elements.nonOperationalList.innerHTML = '';
    nonOperationalUnits.forEach((unit) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'non-operational-item';
      wrapper.dataset.unit = unit.key;
      wrapper.dataset.allowsMultiple = unit.allows_multiple_personnel ? 'true' : 'false';

      const title = document.createElement('div');
      title.className = 'non-operational-title';
      title.textContent = unit.label;
      wrapper.appendChild(title);

      const hint = document.createElement('div');
      hint.className = 'unit-hint';
      if (unit.allows_multiple_personnel) {
        hint.textContent = 'Multiple officers allowed — search and add officers by name or service number.';
      } else if (unit.allows_operational_overlap) {
        hint.textContent = 'Single officer (may also hold operational roster duties)';
      } else {
        hint.textContent = 'Single officer';
      }
      wrapper.appendChild(hint);

      if (unit.allows_multiple_personnel) {
        wrapper.dataset.usesSearch = 'true';
        if (ASYNC_PICKER_UNITS.has(unit.key)) {
          wrapper.dataset.asyncPicker = 'true';
          buildAsyncOfficerPicker(wrapper, unit);
          applyNonOperationalSelections(wrapper, state.nonOperationalAssignments[unit.key] || []);
        } else {
          const search = document.createElement('div');
          search.className = 'non-operational-search';

          const input = document.createElement('input');
          input.type = 'search';
          input.placeholder = 'Search and select officer';
          input.autocomplete = 'off';
          input.dataset.unitSearch = unit.key;
          input.setAttribute('list', ensureOfficerSearchList());
          search.appendChild(input);

          wrapper.appendChild(search);

          const selected = document.createElement('div');
          selected.className = 'non-operational-selected';
          selected.dataset.unitSelected = unit.key;
          wrapper.appendChild(selected);

          applyNonOperationalSelections(wrapper, state.nonOperationalAssignments[unit.key] || []);
        }
      } else {
        const select = document.createElement('select');
        const selectId = `non-operational-${slugifyForId(unit.key)}`;
        select.id = selectId;
        select.name = `${selectId}`;
        select.dataset.unit = unit.key;
        const nonOperationalLabel = unit.label || unit.key;
        select.setAttribute('aria-label', `${nonOperationalLabel} assignment`);
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Select officer';
        select.appendChild(emptyOption);
        populateOfficerSelect(select, false);
        applyOfficerSelections(select, state.nonOperationalAssignments[unit.key] || []);
        wrapper.appendChild(select);
      }

      elements.nonOperationalList.appendChild(wrapper);
    });
  }

  function bindNonOperationalEvents() {
    if (!elements.nonOperationalList) {
      return;
    }
    elements.nonOperationalList.addEventListener('input', (event) => {
      const target = event.target;
      if (!target || !target.matches('input[data-unit-search]')) {
        return;
      }
      const wrapper = target.closest('.non-operational-item');
      if (!wrapper || wrapper.dataset.asyncPicker !== 'true') {
        return;
      }
      handleAsyncSearchInput(wrapper, target);
    });
    elements.nonOperationalList.addEventListener('change', (event) => {
      const target = event.target;
      if (!target) {
        return;
      }
      if (target.matches('select[data-unit]')) {
        const unitKey = target.dataset.unit;
        const values = getSelectValues(target).map((value) => `${value}`);
        if (values.length) {
          state.nonOperationalAssignments[unitKey] = values;
        } else {
          delete state.nonOperationalAssignments[unitKey];
        }
        return;
      }
      if (target.matches('input[data-unit-search]')) {
        const unitKey = target.dataset.unitSearch;
        const wrapper = target.closest('.non-operational-item');
        if (!unitKey || !wrapper || wrapper.dataset.asyncPicker === 'true') {
          return;
        }
        if (commitSearchSelection(unitKey, wrapper, target.value)) {
          target.value = '';
        }
      }
    });

    elements.nonOperationalList.addEventListener('keydown', (event) => {
      const target = event.target;
      if (!target || !target.matches('input[data-unit-search]')) {
        return;
      }
      const wrapper = target.closest('.non-operational-item');
      if (!wrapper) {
        return;
      }
      if (wrapper.dataset.asyncPicker === 'true') {
        if (event.key !== 'Enter') {
          return;
        }
        event.preventDefault();
        const unitKey = wrapper.dataset.unit;
        if (unitKey) {
          selectFirstAsyncSearchResult(wrapper, unitKey);
        }
        return;
      }
      if (event.key !== 'Enter') {
        return;
      }
      event.preventDefault();
      const unitKey = target.dataset.unitSearch;
      if (!unitKey || !wrapper) {
        return;
      }
      if (commitSearchSelection(unitKey, wrapper, target.value)) {
        target.value = '';
      }
    });

    elements.nonOperationalList.addEventListener('click', (event) => {
      const resultButton = event.target.closest('button[data-officer-option]');
      if (resultButton) {
        const unitKey = resultButton.dataset.unit;
        const officerId = resultButton.dataset.officerOption;
        const wrapper = resultButton.closest('.non-operational-item');
        if (unitKey && officerId && wrapper) {
          const added = addOfficerToUnit(unitKey, officerId, wrapper);
          if (added) {
            resetAsyncPickerInput(wrapper, unitKey);
          }
        }
        return;
      }
      const removeButton = event.target.closest('button[data-remove-officer]');
      if (removeButton) {
        const unitKey = removeButton.dataset.unit;
        const officerId = removeButton.dataset.removeOfficer;
        const wrapper = removeButton.closest('.non-operational-item');
        if (unitKey && officerId && wrapper) {
          removeOfficerFromUnit(unitKey, officerId, wrapper);
        }
      }
    });
  }

  function bindTeamAssignmentEvents() {
    if (!elements.teamSetupList) {
      return;
    }
    elements.teamSetupList.addEventListener('change', (event) => {
      const target = event.target;
      if (!target || !target.matches('select[data-shift][data-unit]')) {
        return;
      }
      const shiftCode = target.dataset.shift;
      const unitKey = target.dataset.unit;
      const values = getSelectValues(target);
      setTeamAssignment(shiftCode, unitKey, values);
      applyTeamAssignment(shiftCode, unitKey);
      refreshManualFlagsFromState();
      renderAssignments();
      renderCalendar();
    });
  }

  function getSelectValues(select) {
    if (!select) {
      return [];
    }
    if (select.multiple) {
      return Array.from(select.selectedOptions)
        .map((option) => option.value)
        .filter(Boolean);
    }
    return select.value ? [select.value] : [];
  }

  function normalizeShiftValue(raw) {
    const value = parseInt(raw, 10);
    if (Number.isNaN(value)) {
      return 0;
    }
    return Math.min(6, Math.max(3, value));
  }

  function normalizePeriodsOfDuty(raw) {
    const value = parseInt(raw, 10);
    if (ALLOWED_PERIODS_OF_DUTY.includes(value)) {
      return value;
    }
    return ALLOWED_PERIODS_OF_DUTY[ALLOWED_PERIODS_OF_DUTY.length - 1];
  }

  function updateShiftCycleValidity() {
    if (!elements.shiftCount || !elements.shiftCycle) {
      return true;
    }
    const shiftCountValue = parseInt(elements.shiftCount.value, 10);
    const cycleValue = parseInt(elements.shiftCycle.value, 10);
    const mismatch = shiftCountValue && cycleValue && shiftCountValue !== cycleValue;
    const message = mismatch ? 'Shift cycle days and number of shifts must be the same.' : '';
    elements.shiftCount.setCustomValidity(message);
    elements.shiftCycle.setCustomValidity(message);
    return !mismatch;
  }

  function applyShiftConfiguration(count) {
    if (!elements.shiftCount || !elements.shiftCycle) {
      return;
    }
    if (!count) {
      elements.shiftCount.value = '';
      elements.shiftCycle.value = '';
      buildShiftRows(0);
      const cycleLength = state.timings.length || 0;
      buildCycleRows(cycleLength);
      updateShiftCycleValidity();
      return;
    }
    const normalized = normalizeShiftValue(count);
    elements.shiftCount.value = `${normalized}`;
    elements.shiftCycle.value = `${normalized}`;
    buildShiftRows(normalized);
    buildCycleRows(normalized);
    updateShiftCycleValidity();
  }

  function bindShiftCycleSynchronizer() {
    if (!elements.shiftCount || !elements.shiftCycle) {
      return;
    }
    const handleShiftChange = () => {
      const count = normalizeShiftValue(elements.shiftCount.value);
      applyShiftConfiguration(count);
    };
    const handleCycleChange = () => {
      const count = normalizeShiftValue(elements.shiftCycle.value);
      applyShiftConfiguration(count);
    };
    elements.shiftCount.addEventListener('input', handleShiftChange);
    elements.shiftCount.addEventListener('change', handleShiftChange);
    elements.shiftCycle.addEventListener('input', handleCycleChange);
    elements.shiftCycle.addEventListener('change', handleCycleChange);
    handleShiftChange();
  }

  function bindTimingCountWatcher() {
    if (!elements.timingCount) {
      return;
    }
    const refreshTimingCount = () => {
      const value = parseInt(elements.timingCount.value, 10);
      const count = normalizePeriodsOfDuty(Number.isNaN(value) ? null : value);
      elements.timingCount.value = `${count}`;
      if (elements.periodsOfDuty) {
        elements.periodsOfDuty.value = `${count}`;
      }
      const existingTimings = collectTimingRows().slice(0, count);
      updateTimingCountDisplay(count);
      buildTimingRows(count, existingTimings);
      const cycleLength = normalizeShiftValue(elements.shiftCycle ? elements.shiftCycle.value : null)
        || count
        || 0;
      buildCycleRows(cycleLength || count);
    };
    elements.timingCount.addEventListener('change', refreshTimingCount);
    elements.timingCount.addEventListener('input', refreshTimingCount);
    refreshTimingCount();
  }

  function bindPeriodsOfDutyWatcher() {
    if (!elements.periodsOfDuty) {
      return;
    }
    const handlePeriodsOfDutyChange = () => {
      const parsedValue = parseInt(elements.periodsOfDuty.value, 10);
      const periods = normalizePeriodsOfDuty(Number.isNaN(parsedValue) ? null : parsedValue);
      elements.periodsOfDuty.value = `${periods}`;
      if (elements.timingCount) {
        elements.timingCount.value = `${periods}`;
      }
      updateTimingCountDisplay(periods);
      const currentTimings = collectTimingRows();
      const trimmedTimings = currentTimings.slice(0, periods);
      buildTimingRows(periods, trimmedTimings);
      const existingCycle = collectCycleRows();
      const cycleLength = existingCycle.length
        || normalizeShiftValue(elements.shiftCycle ? elements.shiftCycle.value : null)
        || normalizeShiftValue(elements.shiftCount ? elements.shiftCount.value : null)
        || periods;
      buildCycleRows(cycleLength, existingCycle);
    };
    elements.periodsOfDuty.addEventListener('input', handlePeriodsOfDutyChange);
    elements.periodsOfDuty.addEventListener('change', handlePeriodsOfDutyChange);
    handlePeriodsOfDutyChange();
  }

  function updateTimingCountDisplay(count) {
    if (!elements.timingCountDisplay) {
      return;
    }
    const value = Number.isNaN(count) || count < 1 ? 1 : count;
    elements.timingCountDisplay.textContent = `Duty timings per day: ${value}`;
  }

  function bindConfigStageNavigation() {
    if (!elements.configStages || !elements.configStages.length) {
      return;
    }
    if (elements.configStage1Next) {
      elements.configStage1Next.addEventListener('click', () => {
        if (validateConfigStage(1)) {
          setConfigStage(2);
        }
      });
    }
    if (elements.configStage2Back) {
      elements.configStage2Back.addEventListener('click', () => setConfigStage(1));
    }
    if (elements.configStage2Next) {
      elements.configStage2Next.addEventListener('click', () => {
        if (validateConfigStage(2)) {
          setConfigStage(3);
        }
      });
    }
    if (elements.configStage3Back) {
      elements.configStage3Back.addEventListener('click', () => setConfigStage(2));
    }
  }

  function setConfigStage(stage) {
    if (!elements.configStages || !elements.configStages.length) {
      currentConfigStage = 1;
      return;
    }
    const totalStages = elements.configStages.length;
    currentConfigStage = Math.min(Math.max(stage, 1), totalStages);
    const focusableSelector =
      'a[href], button:not([disabled]), input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]';
    elements.configStages.forEach((section) => {
      const stageValue = parseInt(section.dataset.configStage, 10) || 0;
      const isCurrent = stageValue === currentConfigStage;
      section.hidden = !isCurrent;
      section.setAttribute('aria-hidden', isCurrent ? 'false' : 'true');
      if (isCurrent) {
        section.removeAttribute('hidden');
        section.removeAttribute('inert');
      } else {
        section.setAttribute('hidden', '');
        section.setAttribute('inert', '');
      }
      if (isCurrent) {
        section.querySelectorAll('[data-config-saved-tabindex]').forEach((element) => {
          const saved = element.getAttribute('data-config-saved-tabindex');
          if (saved && saved !== 'none') {
            element.setAttribute('tabindex', saved);
          } else {
            element.removeAttribute('tabindex');
          }
          element.removeAttribute('data-config-saved-tabindex');
        });
        section.querySelectorAll(focusableSelector).forEach((element) => {
          if (element.getAttribute('tabindex') === '-1' && !element.hasAttribute('data-config-saved-tabindex')) {
            element.removeAttribute('tabindex');
          }
        });
      } else {
        section.querySelectorAll('a[href], button, input, select, textarea, [tabindex]').forEach((element) => {
          if (!element.hasAttribute('data-config-saved-tabindex')) {
            const hasTabindex = element.hasAttribute('tabindex');
            element.setAttribute(
              'data-config-saved-tabindex',
              hasTabindex ? element.getAttribute('tabindex') || '0' : 'none',
            );
          }
          element.setAttribute('tabindex', '-1');
        });
      }
    });
    if (elements.status) {
      elements.status.textContent = '';
      elements.status.classList.remove('is-visible', 'is-error', 'is-success');
      elements.status.setAttribute('role', 'status');
      elements.status.setAttribute('aria-live', 'polite');
    }
    focusFirstFieldInStage(currentConfigStage);
  }

  function focusFirstFieldInStage(stage) {
    if (!elements.configStages || !elements.configStages.length) {
      return;
    }
    const target = Array.from(elements.configStages).find((section) => {
      const sectionStage = parseInt(section.dataset.configStage, 10) || 0;
      return sectionStage === stage;
    });
    if (!target) {
      return;
    }
    if (typeof target.scrollIntoView === 'function') {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    let focusable = target.querySelector(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])',
    );
    if (!focusable) {
      focusable = target.querySelector('button:not([disabled])');
    }
    if (focusable && typeof focusable.focus === 'function') {
      focusable.focus({ preventScroll: true });
    }
  }

  function validateConfigStage(stage) {
    const errors = [];
    if (stage === 1) {
      if (!elements.effectiveMonth || !elements.effectiveMonth.value) {
        errors.push('Select the roster month.');
      }
      if (!elements.effectiveFrom || !elements.effectiveFrom.value) {
        errors.push('Select the effective date.');
      }
      const durationValue = elements.rosterDuration ? parseInt(elements.rosterDuration.value, 10) : 0;
      if (!durationValue || durationValue < 1) {
        errors.push('Provide the roster duration in days.');
      }
      const shiftCountValue = normalizeShiftValue(elements.shiftCount ? elements.shiftCount.value : null);
      const shiftCycleValue = normalizeShiftValue(elements.shiftCycle ? elements.shiftCycle.value : null);
      updateShiftCycleValidity();
      if (!shiftCountValue) {
        errors.push('Provide the number of shifts (between 3 and 6).');
      }
      if (!shiftCycleValue) {
        errors.push('Provide the shift cycle length (between 3 and 6).');
      }
      if (shiftCountValue && shiftCycleValue && shiftCountValue !== shiftCycleValue) {
        errors.push('Shift cycle days and number of shifts must be the same.');
      }
      const periodsValueRaw = elements.periodsOfDuty ? parseInt(elements.periodsOfDuty.value, 10) : NaN;
      const hasValidPeriods = ALLOWED_PERIODS_OF_DUTY.includes(periodsValueRaw);
      const periodsValue = hasValidPeriods
        ? periodsValueRaw
        : normalizePeriodsOfDuty(periodsValueRaw);
      if (!hasValidPeriods) {
        errors.push('Periods of duty must be either 2 or 3.');
      }
      const timingCountValueRaw = elements.timingCount ? parseInt(elements.timingCount.value, 10) : NaN;
      if (Number.isNaN(timingCountValueRaw) || !ALLOWED_PERIODS_OF_DUTY.includes(timingCountValueRaw)) {
        errors.push('Provide the number of duty timings (2 or 3).');
      }
      const timingCountValue = normalizePeriodsOfDuty(Number.isNaN(timingCountValueRaw) ? null : timingCountValueRaw);
      if (timingCountValue !== periodsValue) {
        errors.push('Number of duty timings must match the periods of duty.');
      }
    } else if (stage === 2) {
      const shiftCountValue = normalizeShiftValue(elements.shiftCount ? elements.shiftCount.value : null);
      const timingCountValue = elements.timingCount ? parseInt(elements.timingCount.value, 10) : 0;
      const shifts = collectShiftRows();
      if (shifts.length !== shiftCountValue) {
        errors.push('Review the shift teams. Each row must include a sequence and unique code.');
      }
      if (!shifts.every((shift) => shift.code)) {
        errors.push('All shift rows need a code.');
      }
      const codes = new Set(shifts.map((shift) => shift.code));
      if (codes.size !== shifts.length) {
        errors.push('Shift codes must be unique.');
      }
      const timings = collectTimingRows();
      if (timings.length !== timingCountValue) {
        const timingMessage = timingCountValue === 2
          ? 'Provide exactly two duty timings.'
          : 'Provide exactly three duty timings.';
        errors.push(timingMessage);
      }
      if (!timings.every((timing) => timing.label)) {
        errors.push('Every duty timing requires a label.');
      }
      if (timings.some((timing) => !timing.start_time || !timing.end_time)) {
        errors.push('Provide start and end times for every duty timing.');
      }
      const cycle = collectCycleRows(timings);
      if (cycle.length !== shiftCountValue) {
        errors.push('The cycle template must include an entry for each day in the cycle length.');
      }
      if (!cycle.some((entry) => entry.type === 'timing')) {
        errors.push('The cycle template must contain at least one duty timing.');
      }
    }

    if (errors.length) {
      showStatus(errors.join(' '), 'error');
      return false;
    }
    return true;
  }

  function buildShiftRows(count, existing) {
    const existingData = existing || collectShiftRows();
    elements.shiftRows.innerHTML = '';
    const total = Math.max(count, existingData.length, 1);
    for (let index = 0; index < total; index += 1) {
      const defaultCode = DEFAULT_SHIFT_CODES[index] || '';
      const data = existingData[index] || {
        sequence: index + 1,
        code: defaultCode,
        title: '',
      };
      const row = document.createElement('div');
      row.className = 'shift-row';
      const sequenceId = `shift-sequence-${index + 1}`;
      const codeId = `shift-code-${index + 1}`;
      const titleId = `shift-title-${index + 1}`;
      row.innerHTML = `
        <div class="field-group">
          <label for="${sequenceId}">Sequence</label>
          <input id="${sequenceId}" name="shift_${index + 1}_sequence" type="number" min="1" data-field="sequence" value="${data.sequence}" aria-label="Shift ${index + 1} sequence">
        </div>
        <div class="field-group">
          <label for="${codeId}">Code</label>
          <input id="${codeId}" name="shift_${index + 1}_code" type="text" data-field="code" value="${escapeHtml(data.code || '')}" placeholder="A" aria-label="Shift ${index + 1} code">
        </div>
        <div class="field-group">
          <label for="${titleId}">Title</label>
          <input id="${titleId}" name="shift_${index + 1}_title" type="text" data-field="title" value="${escapeHtml(data.title || '')}" placeholder="Shift label (optional)" aria-label="Shift ${index + 1} title">
        </div>`;
      elements.shiftRows.appendChild(row);
    }
  }

  function normaliseTimeValue(value) {
    if (!value) {
      return '';
    }
    const trimmed = `${value}`.trim();
    if (!trimmed) {
      return '';
    }
    if (/^\d{2}:\d{2}$/.test(trimmed)) {
      return `${trimmed}:00`;
    }
    return trimmed;
  }

  function formatTimeForInput(value) {
    if (!value) {
      return '';
    }
    const trimmed = `${value}`.trim();
    if (!trimmed) {
      return '';
    }
    const match = trimmed.match(/^(\d{2}:\d{2})/);
    if (match) {
      return match[1];
    }
    return trimmed;
  }

  function collectTimingRows() {
    if (!elements.timingRows) {
      return [];
    }
    const rows = Array.from(elements.timingRows.querySelectorAll('.timing-row'));
    return rows.map((row, index) => {
      const id = row.dataset.timingId || `timing-${index + 1}`;
      const label = row.querySelector('[data-field="timing-label"]').value.trim();
      const startInput = row.querySelector('[data-field="timing-start"]');
      const endInput = row.querySelector('[data-field="timing-end"]');
      return {
        id,
        label,
        sequence: index + 1,
        start_time: normaliseTimeValue(startInput ? startInput.value : ''),
        end_time: normaliseTimeValue(endInput ? endInput.value : ''),
      };
    });
  }

  function buildTimingRows(count, existing) {
    if (!elements.timingRows) {
      return;
    }
    const uiPeriods = elements.periodsOfDuty
      ? normalizePeriodsOfDuty(elements.periodsOfDuty.value)
      : null;
    const normalizedCount = Number.isNaN(count) ? 0 : count;
    const finalCount = uiPeriods || normalizedCount || 2;
    const baseData = Array.isArray(existing) ? existing : collectTimingRows();
    const total = Math.max(finalCount, 1);
    elements.timingRows.innerHTML = '';
    for (let index = 0; index < total; index += 1) {
      const source = baseData[index] || null;
      const data = {
        id: source && source.id ? source.id : `timing-${index + 1}`,
        label: source && source.label ? source.label : DEFAULT_TIMING_LABELS[index] || '',
        start_time: source && source.start_time ? source.start_time : '',
        end_time: source && source.end_time ? source.end_time : '',
      };
      const startTimeValue = escapeHtml(formatTimeForInput(data.start_time));
      const endTimeValue = escapeHtml(formatTimeForInput(data.end_time));
      const row = document.createElement('div');
      row.className = 'timing-row';
      row.dataset.timingId = data.id || `timing-${index + 1}`;
      const labelId = `timing-label-${index + 1}`;
      const startId = `timing-start-${index + 1}`;
      const endId = `timing-end-${index + 1}`;
      row.innerHTML = `
        <div class="field-group">
          <label for="${labelId}">Timing ${index + 1}</label>
          <input id="${labelId}" name="timing_${index + 1}_label" type="text" data-field="timing-label" value="${escapeHtml(data.label || '')}" placeholder="Morning" aria-label="Timing ${index + 1} label">
        </div>
        <div class="field-group">
          <label for="${startId}">Start time</label>
          <input id="${startId}" name="timing_${index + 1}_start" type="time" data-field="timing-start" value="${startTimeValue}" aria-label="Timing ${index + 1} start time">
        </div>
        <div class="field-group">
          <label for="${endId}">End time</label>
          <input id="${endId}" name="timing_${index + 1}_end" type="time" data-field="timing-end" value="${endTimeValue}" aria-label="Timing ${index + 1} end time">
        </div>`;
      elements.timingRows.appendChild(row);
    }
  }

  function collectCycleRows(timings) {
    if (!elements.cycleRows) {
      return [];
    }
    const availableTimings = timings || collectTimingRows();
    const validTimingIds = new Set(availableTimings.map((timing) => timing.id));
    const rows = Array.from(elements.cycleRows.querySelectorAll('.cycle-row'));
    return rows.map((row, index) => {
      const typeSelect = row.querySelector('[data-field="cycle-type"]');
      const timingSelect = row.querySelector('[data-field="cycle-timing"]');
      const labelInput = row.querySelector('[data-field="cycle-label"]');
      const type = typeSelect ? typeSelect.value : 'timing';
      const entry = {
        sequence: index + 1,
        type,
      };
      if (type === 'timing') {
        const selectedTiming = timingSelect ? timingSelect.value : '';
        entry.timingId = validTimingIds.has(selectedTiming)
          ? selectedTiming
          : availableTimings[0]?.id || '';
      } else {
        const defaultLabel = type === 'rest' ? 'Sleep Recovery' : 'Off Day';
        const value = labelInput ? labelInput.value.trim() : '';
        entry.label = value || defaultLabel;
      }
      return entry;
    });
  }

  function getActiveTimings(timings, periodsOfDuty) {
    const source = Array.isArray(timings) ? timings : [];
    const parsed = parseInt(periodsOfDuty, 10);
    const limit = ALLOWED_PERIODS_OF_DUTY.includes(parsed) ? parsed : source.length;
    return source.slice(0, limit);
  }

  function sanitizeCycleEntries(cycleEntries, timings, periodsOfDuty) {
    const entries = Array.isArray(cycleEntries) ? cycleEntries : [];
    const activeTimings = getActiveTimings(timings, periodsOfDuty);
    const activeTimingIds = new Set(activeTimings.map((timing) => timing.id));
    const activeCount = activeTimings.length;
    const parsed = parseInt(periodsOfDuty, 10);
    const normalizedPeriods = ALLOWED_PERIODS_OF_DUTY.includes(parsed)
      ? parsed
      : activeCount;

    return entries.map((entry, index) => {
      const sequence = entry && entry.sequence ? entry.sequence : index + 1;
      if (!entry || typeof entry !== 'object') {
        return {
          sequence,
          type: 'off',
          timingId: '',
          label: 'Off Day',
        };
      }
      if (entry.type !== 'timing') {
        return { ...entry, sequence };
      }
      if (!activeCount) {
        return {
          sequence,
          type: 'off',
          timingId: '',
          label: entry.label || 'Off Day',
        };
      }
      if (activeTimingIds.has(entry.timingId)) {
        return { ...entry, sequence };
      }
      if (normalizedPeriods === 2 && index >= activeCount) {
        return {
          sequence,
          type: 'rest',
          timingId: '',
          label: entry.label || 'Sleep Recovery',
        };
      }
      const fallback = activeTimings[index % activeCount] || activeTimings[0];
      if (fallback) {
        return { ...entry, sequence, timingId: fallback.id };
      }
      return {
        sequence,
        type: 'off',
        timingId: '',
        label: entry.label || 'Off Day',
      };
    });
  }

  function collectNonOperationalAssignments() {
    const assignments = {};
    Object.entries(state.nonOperationalAssignments || {}).forEach(([unitKey, values]) => {
      if (!unitMap.has(unitKey)) {
        return;
      }
      const normalized = (Array.isArray(values) ? values : [values])
        .filter(Boolean)
        .map((value) => `${value}`);
      if (normalized.length) {
        assignments[unitKey] = normalized;
      }
    });
    return assignments;
  }

  function buildCycleRows(length, existing) {
    if (!elements.cycleRows) {
      return;
    }
    const timings = collectTimingRows();
    const periodsOfDutyValue = elements.periodsOfDuty
      ? normalizePeriodsOfDuty(elements.periodsOfDuty.value)
      : timings.length;
    const activeTimings = getActiveTimings(timings, periodsOfDutyValue);
    const baseExisting = existing || collectCycleRows(timings);
    const existingData = sanitizeCycleEntries(baseExisting, activeTimings, periodsOfDutyValue);
    elements.cycleRows.innerHTML = '';
    const total = Math.max(length, existingData.length, 1);
    for (let index = 0; index < total; index += 1) {
      const data = existingData[index] || getDefaultCycleEntry(index, activeTimings);
      const row = document.createElement('div');
      row.className = 'cycle-row';
      row.dataset.sequence = index + 1;

      const dayLabel = document.createElement('div');
      dayLabel.className = 'cycle-day-label';
      dayLabel.textContent = `Day ${index + 1}`;
      row.appendChild(dayLabel);

      const typeGroup = document.createElement('div');
      typeGroup.className = 'field-group';
      const typeLabel = document.createElement('label');
      const typeId = `cycle-entry-${index + 1}-type`;
      typeLabel.setAttribute('for', typeId);
      typeLabel.textContent = `Entry ${index + 1} type`;
      typeGroup.appendChild(typeLabel);
      const typeSelect = document.createElement('select');
      typeSelect.id = typeId;
      typeSelect.name = `cycle_${index + 1}_type`;
      typeSelect.dataset.field = 'cycle-type';
      typeSelect.setAttribute('aria-label', `Entry ${index + 1} type`);
      ['timing', 'rest', 'off'].forEach((value) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent =
          value === 'timing' ? 'Duty timing' : value === 'rest' ? 'Sleep recovery' : 'Off day';
        typeSelect.appendChild(option);
      });
      typeSelect.value = data.type;
      typeGroup.appendChild(typeSelect);
      row.appendChild(typeGroup);

      const timingGroup = document.createElement('div');
      timingGroup.className = 'field-group cycle-timing-group';
      const timingLabel = document.createElement('label');
      const timingSelectId = `cycle-entry-${index + 1}-timing`;
      timingLabel.setAttribute('for', timingSelectId);
      timingLabel.textContent = `Entry ${index + 1} timing`;
      timingGroup.appendChild(timingLabel);
      const timingSelect = document.createElement('select');
      timingSelect.id = timingSelectId;
      timingSelect.name = `cycle_${index + 1}_timing`;
      timingSelect.dataset.field = 'cycle-timing';
      timingSelect.setAttribute('aria-label', `Entry ${index + 1} timing`);
      timings.forEach((timing) => {
        const option = document.createElement('option');
        option.value = timing.id;
        option.textContent = timing.label || timing.id;
        timingSelect.appendChild(option);
      });
      if (timings.length) {
        if (data.timingId && timings.some((timing) => timing.id === data.timingId)) {
          timingSelect.value = data.timingId;
        } else {
          timingSelect.value = timings[0].id;
        }
      } else {
        timingSelect.disabled = true;
      }
      timingGroup.appendChild(timingSelect);
      row.appendChild(timingGroup);

      const labelGroup = document.createElement('div');
      labelGroup.className = 'field-group cycle-label-group';
      const labelTitle = document.createElement('label');
      const labelId = `cycle-entry-${index + 1}-label`;
      labelTitle.setAttribute('for', labelId);
      labelTitle.textContent = `Entry ${index + 1} label`;
      labelGroup.appendChild(labelTitle);
      const labelInput = document.createElement('input');
      labelInput.type = 'text';
      labelInput.id = labelId;
      labelInput.name = `cycle_${index + 1}_label`;
      labelInput.dataset.field = 'cycle-label';
      labelInput.placeholder = data.type === 'rest' ? 'Sleep Recovery' : 'Off Day';
      labelInput.setAttribute('aria-label', `Entry ${index + 1} label`);
      labelInput.value = data.label || '';
      labelGroup.appendChild(labelInput);
      row.appendChild(labelGroup);

      elements.cycleRows.appendChild(row);

      const refresh = () => {
        const currentType = typeSelect.value;
        timingGroup.style.display = currentType === 'timing' ? '' : 'none';
        labelGroup.style.display = currentType === 'timing' ? 'none' : '';
        labelInput.placeholder = currentType === 'rest' ? 'Sleep Recovery' : 'Off Day';
        if (currentType !== 'timing' && !labelInput.value) {
          labelInput.value = currentType === 'rest' ? 'Sleep Recovery' : 'Off Day';
        }
      };
      refresh();
      typeSelect.addEventListener('change', refresh);
    }
  }

  function getDefaultCycleEntry(index, timings) {
    const sequence = index + 1;
    if (!timings.length) {
      return {
        sequence,
        type: 'off',
        timingId: '',
        label: 'Off Day',
      };
    }

    if (index < timings.length) {
      const timing = timings[index];
      return {
        sequence,
        type: 'timing',
        timingId: timing ? timing.id : '',
        label: '',
      };
    }

    if (index === timings.length) {
      return {
        sequence,
        type: 'rest',
        timingId: '',
        label: 'Sleep Recovery',
      };
    }

    return {
      sequence,
      type: 'off',
      timingId: '',
      label: 'Off Day',
    };
  }

  function hydrateFromInitialData(data) {
    state.isDraft = Boolean(data.is_draft);
    updateSaveButtons();
    if (state.isDraft) {
      showStatus('This roster is currently saved as a draft. Complete the assignments and publish when ready.', 'info');
    }
    elements.rosterTitle.value = data.title || '';
    if (data.effective_year && data.effective_month) {
      elements.effectiveMonth.value = `${data.effective_year}-${pad(data.effective_month)}`;
    }
    elements.effectiveFrom.value = data.effective_from || '';
    elements.shiftCycle.value = data.shift_cycle_length || data.shift_count || 1;
    elements.shiftCount.value = (data.shifts && data.shifts.length) || 1;
    applyShiftConfiguration(parseInt(elements.shiftCount.value, 10) || 1);
    const durationDays = data.duration_days || (data.days ? data.days.length : 0) || 1;
    if (elements.rosterDuration) {
      elements.rosterDuration.value = durationDays;
    }
    elements.developedBy.value = data.developed_by || '';
    elements.verifiedBy.value = data.verified_by || '';
    elements.approvedBy.value = data.approved_by || '';

    const cycleTemplate = data.cycle_template || {};
    const dutyTimings = Array.isArray(data.duty_timings) ? data.duty_timings : [];
    const dutyTimingBySequence = new Map(
      dutyTimings.map((item, idx) => [item.sequence || idx + 1, item]),
    );

    const timingsFromTemplate = (cycleTemplate.timings || []).map((timing, index) => {
      const sequence = timing.sequence || index + 1;
      const dutyTiming = dutyTimingBySequence.get(sequence) || dutyTimings[index] || {};
      return {
        id: timing.id || `timing-${index + 1}`,
        label: timing.label || dutyTiming.title || '',
        sequence,
        start_time: dutyTiming.start_time || timing.start_time || '',
        end_time: dutyTiming.end_time || timing.end_time || '',
      };
    });

    const timingsData = timingsFromTemplate.length
      ? timingsFromTemplate
      : dutyTimings.map((timing, index) => ({
          id: `timing-${index + 1}`,
          label: timing.title || DEFAULT_TIMING_LABELS[index] || '',
          sequence: timing.sequence || index + 1,
          start_time: timing.start_time || '',
          end_time: timing.end_time || '',
        }));
    const initialTimingCount = timingsData.length
      || parseInt(elements.timingCount.value, 10)
      || ALLOWED_PERIODS_OF_DUTY[ALLOWED_PERIODS_OF_DUTY.length - 1];
    const timingCount = normalizePeriodsOfDuty(initialTimingCount);
    const trimmedTimings = timingsData.slice(0, timingCount);
    elements.timingCount.value = `${timingCount}`;
    if (elements.periodsOfDuty) {
      elements.periodsOfDuty.value = `${timingCount}`;
    }
    updateTimingCountDisplay(timingCount);

    const cycleData = (cycleTemplate.cycle || []).map((entry, index) => ({
      sequence: entry.sequence || index + 1,
      type: entry.type || 'timing',
      timingId: entry.timing_id || entry.timingId || '',
      label: entry.label || '',
    }));

    buildShiftRows(data.shifts.length, data.shifts);
    const normalizedTimings = trimmedTimings.map((timing, index) => ({
      id: timing.id || `timing-${index + 1}`,
      label: timing.label || '',
      sequence: timing.sequence || index + 1,
      start_time: timing.start_time || '',
      end_time: timing.end_time || '',
    }));
    const selectedPeriods = elements.periodsOfDuty
      ? normalizePeriodsOfDuty(elements.periodsOfDuty.value)
      : timingCount;
    buildTimingRows(selectedPeriods, normalizedTimings);
    const cycleLength = parseInt(elements.shiftCycle.value, 10) || cycleData.length || selectedPeriods;
    const validTimingIds = new Set(normalizedTimings.map((timing) => timing.id));
    const sanitizedCycleData = cycleData.map((entry) => {
      if (entry.type === 'timing' && entry.timingId && !validTimingIds.has(entry.timingId)) {
        return {
          ...entry,
          timingId: normalizedTimings[0]?.id || '',
        };
      }
      return entry;
    });
    const normalizedCycle = sanitizeCycleEntries(
      sanitizedCycleData,
      normalizedTimings,
      timingCount,
    );
    buildCycleRows(cycleLength, normalizedCycle);

    const selectedUnits = (data.units || []).map((unit) => unit.unit_key || unit);
    state.units = selectedUnits;
    selectedUnits.forEach((unitKey) => {
      const checkbox = elements.unitChecklist.querySelector(`input[data-unit="${unitKey}"]`);
      if (checkbox) {
        checkbox.checked = true;
      }
    });

    const nonOperational = {};
    Object.entries(data.non_operational_assignments || {}).forEach(([unitKey, values]) => {
      if (Array.isArray(values)) {
        const normalized = values
          .map((value) => `${value}`)
          .filter((value) => value.trim().length);
        if (normalized.length) {
          nonOperational[unitKey] = normalized;
        }
        return;
      }
      if (values) {
        const value = `${values}`.trim();
        if (value) {
          nonOperational[unitKey] = [value];
        }
      }
    });
    state.nonOperationalAssignments = nonOperational;
    buildNonOperationalList();

    state.shifts = data.shifts.map((shift) => ({
      code: shift.code,
      title: shift.title,
      sequence: shift.sequence,
    }));
    state.timings = normalizedTimings;
    state.cycle = normalizedCycle.length ? normalizedCycle : collectCycleRows(normalizedTimings);

    state.config = {
      title: data.title || '',
      effectiveMonth: elements.effectiveMonth.value,
      effectiveFrom: elements.effectiveFrom.value,
      shiftCount: data.shifts.length,
      shiftCycleLength: data.shift_cycle_length || data.shift_count || 1,
      durationDays,
      timingCount,
      periodsOfDuty: timingCount,
      developedBy: elements.developedBy.value,
      verifiedBy: elements.verifiedBy.value,
      approvedBy: elements.approvedBy.value,
    };

    state.days = (data.days || []).map((day) => ({
      sequence: day.sequence,
      date: day.date,
    }));
    state.currentDay = state.days.length ? state.days[0].sequence : null;
    state.assignments = {};

    rebuildRotation();

    (data.assignments || []).forEach((assignment) => {
      const entry = ensureAssignmentEntry(assignment.day_sequence, assignment.shift_code, assignment.unit_key);
      if (!entry) {
        return;
      }
      if (!entry.officers.includes(assignment.officer)) {
        entry.officers.push(assignment.officer);
      }
      if (assignment.remarks) {
        entry.remarks = assignment.remarks;
      }
    });

    refreshManualFlagsFromState();
    pruneTeamAssignments();
    deriveTeamAssignmentsFromTemplate();
    renderTeamSetup();

    renderDayList();
    renderAssignments();
    renderCalendar();
    updateAssignmentSummary();
  }

  function setStep(step) {
    elements.steps.forEach((section, index) => {
      const isActive = index === step - 1;
      section.classList.toggle('is-active', isActive);
      if (isActive) {
        section.removeAttribute('hidden');
      } else {
        section.setAttribute('hidden', 'hidden');
      }
    });
    elements.stepPills.forEach((pill) => {
      const isActive = parseInt(pill.dataset.step, 10) === step;
      pill.classList.toggle('is-active', isActive);
    });
    const activeSection = elements.steps[step - 1];
    if (activeSection && typeof activeSection.scrollIntoView === 'function') {
      activeSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function showStatus(message, type) {
    if (!elements.status) {
      return;
    }
    elements.status.textContent = message;
    elements.status.classList.add('is-visible');
    const isError = type === 'error';
    const isSuccess = type === 'success';
    elements.status.classList.toggle('is-error', isError);
    elements.status.classList.toggle('is-success', isSuccess);
    if (!isError && !isSuccess) {
      elements.status.classList.remove('is-error', 'is-success');
    }
    elements.status.setAttribute('role', isError ? 'alert' : 'status');
    elements.status.setAttribute('aria-live', isError ? 'assertive' : 'polite');
    if (!isError && typeof elements.status.scrollIntoView === 'function') {
      elements.status.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function readJson(id) {
    const element = document.getElementById(id);
    if (!element) {
      return null;
    }
    try {
      return JSON.parse(element.textContent);
    } catch (error) {
      return null;
    }
  }

  function formatDate(dateString, sequence) {
    const parsed = new Date(dateString);
    if (Number.isNaN(parsed.getTime())) {
      return `Day ${sequence}`;
    }
    return parsed.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
  }

  function formatMonth(monthValue) {
    if (!monthValue) {
      return '';
    }
    const [yearStr, monthStr] = monthValue.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    if (!year || !month) {
      return '';
    }
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  function flattenErrorValue(value, prefix) {
    if (value === null || value === undefined) {
      return [];
    }
    if (typeof value === 'string') {
      return [prefix ? `${prefix}: ${value}` : value];
    }
    if (Array.isArray(value)) {
      const results = [];
      value.forEach((item) => {
        results.push(...flattenErrorValue(item, prefix));
      });
      return results;
    }
    if (typeof value === 'object') {
      const results = [];
      Object.keys(value).forEach((key) => {
        const nextPrefix = prefix ? `${prefix}.${key}` : key;
        results.push(...flattenErrorValue(value[key], nextPrefix));
      });
      return results;
    }
    return [];
  }

  function extractErrorMessage(data) {
    if (!data) {
      return 'Unknown error';
    }
    if (typeof data === 'string') {
      return data;
    }
    if (data.detail) {
      return data.detail;
    }
    if (Array.isArray(data)) {
      const messages = [];
      data.forEach((item) => {
        messages.push(...flattenErrorValue(item, ''));
      });
      return messages.join(' ') || 'Unable to save roster.';
    }
    if (typeof data === 'object') {
      const messages = [];
      Object.keys(data).forEach((key) => {
        messages.push(...flattenErrorValue(data[key], key));
      });
      return messages.join(' ') || 'Unable to save roster.';
    }
    return 'Unable to save roster.';
  }

  function escapeHtml(value) {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function getCookie(name) {
    if (!name) {
      return '';
    }
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
      return parts.pop().split(';').shift();
    }
    return '';
  }

  function getCsrfToken() {
    const tokenField = document.querySelector('[data-roster-builder-csrf-token]');
    if (tokenField) {
      if (typeof tokenField.value === 'string' && tokenField.value) {
        return tokenField.value;
      }
      const content = tokenField.getAttribute('content');
      if (content) {
        return content;
      }
    }

    const formField = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (formField && typeof formField.value === 'string' && formField.value) {
      return formField.value;
    }

    const cookieToken = getCookie('csrftoken');
    return cookieToken ? decodeURIComponent(cookieToken) : '';
  }
})();
