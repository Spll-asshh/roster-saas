const ROSTER_FORM_NUMBER = 'PAAF-100-OPAT-1.0';

const UNIT_DEFINITIONS = [
  {
    key: 'aerodrome_ri',
    label: 'Aerodrome (RI)',
    ratingCodes: ['RI'],
    category: 'operational'
  },
  {
    key: 'aerodrome_approach_ri_riv',
    label: 'Aerodrome/Approach (RI/RIV)',
    ratingCodes: ['RI', 'RIV'],
    category: 'operational'
  },
  {
    key: 'ground_movement_control_ri',
    label: 'Ground Movement Control (RI)',
    ratingCodes: ['RI'],
    category: 'operational'
  },
  {
    key: 'bay_planning_unit',
    label: 'Bay Planning Unit',
    allowsMultipleAssignments: true,
    category: 'operational'
  },
  {
    key: 'ground_movement_control_north_ri',
    label: 'Ground Movement Control North (RI)',
    ratingCodes: ['RI'],
    category: 'operational'
  },
  {
    key: 'approach_control_procedural_riv',
    label: 'Approach Control Procedural (RIV)',
    ratingCodes: ['RIV'],
    category: 'operational'
  },
  {
    key: 'approach_control_surveillance_rv',
    label: 'Approach Control Surveillance (RV)',
    ratingCodes: ['RV'],
    category: 'operational'
  },
  {
    key: 'approach_coordinator',
    label: 'Approach Coordinator',
    allowsMultipleAssignments: true,
    category: 'operational'
  },
  {
    key: 'area_procedural_sa_rii',
    label: 'Area Procedural-SA (RII)',
    ratingCodes: ['RII'],
    category: 'operational'
  },
  {
    key: 'area_surveillance_sa_riii',
    label: 'Area Surveillance-SA (RIII)',
    ratingCodes: ['RIII'],
    category: 'operational'
  },
  {
    key: 'area_procedural_n_rii',
    label: 'Area Procedural-N (RII)',
    ratingCodes: ['RII'],
    category: 'operational'
  },
  {
    key: 'area_procedural_s_rii',
    label: 'Area Procedural-S (RII)',
    ratingCodes: ['RII'],
    category: 'operational'
  },
  {
    key: 'area_procedural_w_rii',
    label: 'Area Procedural-W (RII)',
    ratingCodes: ['RII'],
    category: 'operational'
  },
  {
    key: 'area_procedural_e_rii',
    label: 'Area Procedural-E (RII)',
    ratingCodes: ['RII'],
    category: 'operational'
  },
  {
    key: 'area_surveillance_n_riii',
    label: 'Area Surveillance-N (RIII)',
    ratingCodes: ['RIII'],
    category: 'operational'
  },
  {
    key: 'area_surveillance_s_riii',
    label: 'Area Surveillance-S (RIII)',
    ratingCodes: ['RIII'],
    category: 'operational'
  },
  {
    key: 'area_surveillance_w_riii',
    label: 'Area Surveillance-W (RIII)',
    ratingCodes: ['RIII'],
    category: 'operational'
  },
  {
    key: 'area_surveillance_e_riii',
    label: 'Area Surveillance-E (RIII)',
    ratingCodes: ['RIII'],
    category: 'operational'
  },
  {
    key: 'chief_ats_officer',
    label: 'Chief ATS Officer',
    allowsMultipleAssignments: true,
    category: 'operational'
  },
  {
    key: 'pfiu_officer',
    label: 'PFIU officer',
    category: 'operational'
  },
  {
    key: 'cherat_approach_south',
    label: 'Cherat Approach South',
    category: 'operational'
  },
  {
    key: 'rest_controller',
    label: 'Rest Controller',
    category: 'operational'
  },
  {
    key: 'leave_reserve',
    label: 'Leave Reserve',
    category: 'operational'
  },
  {
    key: 'safety_manager_ans',
    label: 'ANS Safety Manager',
    allowsOperationalOverlap: true,
    category: 'non_operational'
  },
  {
    key: 'facility_training_officer',
    label: 'FTO',
    allowsOperationalOverlap: true,
    category: 'non_operational'
  },
  {
    key: 'aiso',
    label: 'AISO',
    category: 'non_operational'
  },
  {
    key: 'oic_ats_revenue',
    label: 'O/IC ATS Revenue',
    category: 'non_operational'
  },
  {
    key: 'oic_rescue_coordination_center',
    label: 'O/IC Rescue Coordination Center',
    category: 'non_operational'
  },
  {
    key: 'oic_rescue_sub_center',
    label: 'O/IC Rescue Sub Center',
    category: 'non_operational'
  },
  {
    key: 'mission_coordinator_rcc_rsc',
    label: 'Mission Coordinator Officer RCC/RSC',
    allowsMultiplePersonnel: true,
    category: 'non_operational'
  },
  {
    key: 'aocc_supervisor',
    label: 'AOCC Supervisor',
    allowsMultiplePersonnel: true,
    category: 'non_operational'
  },
  {
    key: 'oic_aocc',
    label: 'O/IC AOCC',
    category: 'non_operational'
  },
  {
    key: 'chief_operations_officer',
    label: 'COO',
    category: 'non_operational'
  },
  {
    key: 'satco',
    label: 'SATCO',
    category: 'non_operational'
  },
  {
    key: 'sato_single_officer',
    label: 'SATO (single officer)',
    category: 'non_operational'
  },
  {
    key: 'radar_facility_chief',
    label: 'RFC',
    category: 'non_operational'
  },
  {
    key: 'on_job_training_instructor',
    label: 'On Job Training Instructor',
    allowsMultipleAssignments: true,
    category: 'operational'
  },
  {
    key: 'ojt_deployment',
    label: 'OJT deployment',
    allowsMultipleAssignments: true,
    category: 'operational'
  },
  {
    key: 'officers_on_leave',
    label: 'Officers on leave',
    allowsMultiplePersonnel: true,
    category: 'non_operational'
  },
  {
    key: 'officers_on_course',
    label: 'Officers on Course / Meeting',
    allowsMultiplePersonnel: true,
    category: 'non_operational'
  },
  {
    key: 'oic_tower',
    label: 'O/IC Tower',
    allowsOperationalOverlap: true,
    category: 'non_operational'
  },
  {
    key: 'oic_simulator',
    label: 'O/IC Simulator',
    allowsOperationalOverlap: true,
    category: 'non_operational'
  },
  {
    key: 'investigation_officer',
    label: 'Investigation Officer',
    allowsOperationalOverlap: true,
    category: 'non_operational'
  }
];

const UNIT_MAP = new Map(UNIT_DEFINITIONS.map((unit) => [unit.key, unit]));
const MULTI_ASSIGNMENT_UNITS = new Set(
  UNIT_DEFINITIONS.filter((unit) => unit.allowsMultipleAssignments).map((unit) => unit.key)
);
const MULTI_PERSONNEL_UNITS = new Set(
  UNIT_DEFINITIONS.filter((unit) => unit.allowsMultiplePersonnel).map((unit) => unit.key)
);
const OPERATIONAL_OVERLAP_UNITS = new Set(
  UNIT_DEFINITIONS.filter((unit) => unit.allowsOperationalOverlap).map((unit) => unit.key)
);

const ROLE_KEYWORDS_FTO = ['Facility Training Officer', 'FTO'];
const ROLE_KEYWORDS_RFC = ['Radar Facility Chief', 'RFC'];
const ROLE_KEYWORDS_COO_SATCO = [
  'COO',
  'Chief Operations Officer',
  'SATCO',
  'Senior Air Traffic Control Officer',
  'SATO'
];
const ROLE_KEYWORDS_TEAM_LEAD = ['Chief ATS Officer', 'Team Leader'];

function normalizeRoleKeywords(keywords = []) {
  return Array.from(new Set(keywords.map((keyword) => keyword.trim()).filter(Boolean))).sort();
}

function getUnitDefinition(unitKey) {
  const definition = UNIT_MAP.get(unitKey);
  if (!definition) {
    throw new Error(`Unknown roster unit key: ${unitKey}`);
  }
  return definition;
}

function unitAllowsMultipleAssignments(unitKey) {
  return MULTI_ASSIGNMENT_UNITS.has(unitKey);
}

function unitAllowsMultiplePersonnel(unitKey) {
  return MULTI_PERSONNEL_UNITS.has(unitKey);
}

function unitAllowsOperationalOverlap(unitKey) {
  return OPERATIONAL_OVERLAP_UNITS.has(unitKey);
}

function requiredRatingCodes(unitKey) {
  return getUnitDefinition(unitKey).ratingCodes || [];
}

function roleMatchesKeywords(roleValue, keywords = []) {
  if (!roleValue) return false;
  const normalizedRole = `${roleValue}`.toLowerCase();
  return keywords.some((keyword) => normalizedRole.includes(keyword.toLowerCase()));
}

function validateRosterInput(data) {
  const { name, location, start_date, end_date, approved_by_role, shift_mode } = data;
  if (!name || !location || !start_date || !end_date) {
    throw new Error('name, location, start_date, and end_date are required');
  }

  const normalizedShiftMode = (shift_mode || 'rotation').toLowerCase();
  if (!['rotation', 'timebound'].includes(normalizedShiftMode)) {
    throw new Error('shift_mode must be either rotation or timebound');
  }

  const start = new Date(start_date);
  const end = new Date(end_date);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    throw new Error('start_date and end_date must be valid dates');
  }

  if (start > end) {
    throw new Error('start_date must be on or before end_date');
  }

  if (approved_by_role && !roleMatchesKeywords(approved_by_role, ROLE_KEYWORDS_COO_SATCO)) {
    throw new Error('approved_by_role must reference a COO/SATCO equivalent');
  }

  return {
    name,
    location,
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
    shift_mode: normalizedShiftMode,
    approved_by_role: approved_by_role || null
  };
}

function coerceSlotTimes(slot, template, shiftMode) {
  if (shiftMode === 'rotation') {
    return slot;
  }

  const start_time = slot.start_time || template?.start_time;
  const end_time = slot.end_time || template?.end_time;

  if (!start_time || !end_time) {
    throw new Error('Time-bound shifts require start_time and end_time or a matching template');
  }

  return {
    ...slot,
    start_time,
    end_time
  };
}

module.exports = {
  ROSTER_FORM_NUMBER,
  UNIT_DEFINITIONS,
  UNIT_MAP,
  ROLE_KEYWORDS_COO_SATCO,
  ROLE_KEYWORDS_FTO,
  ROLE_KEYWORDS_RFC,
  ROLE_KEYWORDS_TEAM_LEAD,
  normalizeRoleKeywords,
  getUnitDefinition,
  unitAllowsMultipleAssignments,
  unitAllowsMultiplePersonnel,
  unitAllowsOperationalOverlap,
  requiredRatingCodes,
  roleMatchesKeywords,
  validateRosterInput,
  coerceSlotTimes
};
