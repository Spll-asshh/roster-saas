"""Utility definitions and helpers for ATS roster management.

This module centralises constants that describe the available roster
positions together with helper routines that are reused across models,
serialisers and admin classes.  Splitting the data out of ``models`` keeps
those files focused on persistence concerns while making the roster
metadata easy to reuse and to unit test.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Sequence, Set, Tuple


@dataclass(frozen=True)
class UnitDefinition:
    """Describe a roster position/unit available at a location."""

    key: str
    label: str
    rating_codes: Tuple[str, ...] = ()
    allows_multiple_assignments: bool = False
    allows_multiple_personnel: bool = False
    allows_operational_overlap: bool = False
    category: str = "operational"

    def requires_rating(self) -> bool:
        return bool(self.rating_codes)

    def is_operational(self) -> bool:
        return self.category == "operational"


def _definition(
    key: str,
    label: str,
    *,
    rating_codes: Optional[Sequence[str]] = None,
    allows_multiple: bool = False,
    allows_multiple_personnel: Optional[bool] = None,
    allows_operational_overlap: bool = False,
    category: str = "operational",
) -> UnitDefinition:
    codes = tuple(code.strip() for code in rating_codes or () if code)
    multi_personnel = allows_multiple if allows_multiple_personnel is None else allows_multiple_personnel
    return UnitDefinition(
        key=key,
        label=label,
        rating_codes=codes,
        allows_multiple_assignments=allows_multiple,
        allows_multiple_personnel=bool(multi_personnel),
        allows_operational_overlap=allows_operational_overlap,
        category=category,
    )


# fmt: off
ROSTER_FORM_NUMBER = "PAAF-100-OPAT-1.0"


ROSTER_UNIT_DEFINITIONS: Tuple[UnitDefinition, ...] = (
    _definition("aerodrome_ri", "Aerodrome (RI)", rating_codes=["RI"]),
    _definition(
        "aerodrome_approach_ri_riv",
        "Aerodrome/Approach (RI/RIV)",
        rating_codes=["RI", "RIV"],
    ),
    _definition("ground_movement_control_ri", "Ground Movement Control (RI)", rating_codes=["RI"]),
    _definition("bay_planning_unit", "Bay Planning Unit", allows_multiple=True),
    _definition("ground_movement_control_north_ri", "Ground Movement Control North (RI)", rating_codes=["RI"]),
    _definition("approach_control_procedural_riv", "Approach Control Procedural (RIV)", rating_codes=["RIV"]),
    _definition("approach_control_surveillance_rv", "Approach Control Surveillance (RV)", rating_codes=["RV"]),
    _definition("approach_coordinator", "Approach Coordinator", allows_multiple=True),
    _definition("area_procedural_sa_rii", "Area Procedural-SA (RII)", rating_codes=["RII"]),
    _definition("area_surveillance_sa_riii", "Area Surveillance-SA (RIII)", rating_codes=["RIII"]),
    _definition("area_procedural_n_rii", "Area Procedural-N (RII)", rating_codes=["RII"]),
    _definition("area_procedural_s_rii", "Area Procedural-S (RII)", rating_codes=["RII"]),
    _definition("area_procedural_w_rii", "Area Procedural-W (RII)", rating_codes=["RII"]),
    _definition("area_procedural_e_rii", "Area Procedural-E (RII)", rating_codes=["RII"]),
    _definition("area_surveillance_n_riii", "Area Surveillance-N (RIII)", rating_codes=["RIII"]),
    _definition("area_surveillance_s_riii", "Area Surveillance-S (RIII)", rating_codes=["RIII"]),
    _definition("area_surveillance_w_riii", "Area Surveillance-W (RIII)", rating_codes=["RIII"]),
    _definition("area_surveillance_e_riii", "Area Surveillance-E (RIII)", rating_codes=["RIII"]),
    _definition("chief_ats_officer", "Chief ATS Officer", allows_multiple=True),
    _definition("pfiu_officer", "PFIU officer"),
    _definition("cherat_approach_south", "Cherat Approach South"),
    _definition("rest_controller", "Rest Controller"),
    _definition("leave_reserve", "Leave Reserve"),
    _definition(
        "safety_manager_ans",
        "ANS Safety Manager",
        allows_operational_overlap=True,
        category="non_operational",
    ),
    _definition(
        "facility_training_officer",
        "FTO",
        allows_operational_overlap=True,
        category="non_operational",
    ),
    _definition("aiso", "AISO", category="non_operational"),
    _definition("oic_ats_revenue", "O/IC ATS Revenue", category="non_operational"),
    _definition(
        "oic_rescue_coordination_center",
        "O/IC Rescue Coordination Center",
        category="non_operational",
    ),
    _definition(
        "oic_rescue_sub_center",
        "O/IC Rescue Sub Center",
        category="non_operational",
    ),
    _definition(
        "mission_coordinator_rcc_rsc",
        "Mission Coordinator Officer RCC/RSC",
        allows_multiple_personnel=True,
        category="non_operational",
    ),
    _definition(
        "aocc_supervisor",
        "AOCC Supervisor",
        allows_multiple_personnel=True,
        category="non_operational",
    ),
    _definition("oic_aocc", "O/IC AOCC", category="non_operational"),
    _definition(
        "chief_operations_officer",
        "COO",
        category="non_operational",
    ),
    _definition(
        "satco",
        "SATCO",
        category="non_operational",
    ),
    _definition(
        "sato_single_officer",
        "SATO (single officer)",
        category="non_operational",
    ),
    _definition(
        "radar_facility_chief",
        "RFC",
        category="non_operational",
    ),
    _definition("on_job_training_instructor", "On Job Training Instructor", allows_multiple=True),
    _definition("ojt_deployment", "OJT deployment", allows_multiple=True),
    _definition(
        "officers_on_leave",
        "Officers on leave",
        allows_multiple_personnel=True,
        category="non_operational",
    ),
    _definition(
        "officers_on_course",
        "Officers on Course / Meeting",
        allows_multiple_personnel=True,
        category="non_operational",
    ),
    _definition(
        "oic_tower",
        "O/IC Tower",
        allows_operational_overlap=True,
        category="non_operational",
    ),
    _definition(
        "oic_simulator",
        "O/IC Simulator",
        allows_operational_overlap=True,
        category="non_operational",
    ),
    _definition(
        "investigation_officer",
        "Investigation Officer",
        allows_operational_overlap=True,
        category="non_operational",
    ),
)
# fmt: on


ROSTER_UNIT_CHOICES: Tuple[Tuple[str, str], ...] = tuple(
    (definition.key, definition.label) for definition in ROSTER_UNIT_DEFINITIONS
)

ROSTER_UNIT_MAP: Dict[str, UnitDefinition] = {
    definition.key: definition for definition in ROSTER_UNIT_DEFINITIONS
}

ROSTER_MULTI_ASSIGNMENT_UNITS: Set[str] = {
    definition.key
    for definition in ROSTER_UNIT_DEFINITIONS
    if definition.allows_multiple_assignments
}

ROSTER_MULTI_PERSONNEL_UNITS: Set[str] = {
    definition.key
    for definition in ROSTER_UNIT_DEFINITIONS
    if definition.allows_multiple_personnel
}

ROSTER_OPERATIONAL_OVERLAP_UNITS: Set[str] = {
    definition.key
    for definition in ROSTER_UNIT_DEFINITIONS
    if definition.allows_operational_overlap
}

NON_OPERATIONAL_ROLE_NAMES: Dict[str, str] = {
    definition.key: definition.label
    for definition in ROSTER_UNIT_DEFINITIONS
    if definition.category == "non_operational"
}


def get_unit_definition(unit_key: str) -> UnitDefinition:
    try:
        return ROSTER_UNIT_MAP[unit_key]
    except KeyError as exc:  # pragma: no cover - defensive guard
        raise KeyError(f"Unknown roster unit key: {unit_key}") from exc


def unit_allows_multiple_assignments(unit_key: str) -> bool:
    return unit_key in ROSTER_MULTI_ASSIGNMENT_UNITS


def unit_allows_multiple_personnel(unit_key: str) -> bool:
    return unit_key in ROSTER_MULTI_PERSONNEL_UNITS


def unit_allows_operational_overlap(unit_key: str) -> bool:
    return unit_key in ROSTER_OPERATIONAL_OVERLAP_UNITS


def required_rating_codes(unit_key: str) -> Tuple[str, ...]:
    return get_unit_definition(unit_key).rating_codes


ROLE_KEYWORDS_FTO: Tuple[str, ...] = (
    "Facility Training Officer",
    "FTO",
)

ROLE_KEYWORDS_RFC: Tuple[str, ...] = (
    "Radar Facility Chief",
    "RFC",
)

ROLE_KEYWORDS_COO_SATCO: Tuple[str, ...] = (
    "COO",
    "Chief Operations Officer",
    "SATCO",
    "Senior Air Traffic Control Officer",
    "SATO",
)

ROLE_KEYWORDS_TEAM_LEAD: Tuple[str, ...] = (
    "Chief ATS Officer",
    "Team Leader",
)


def normalize_role_keywords(keywords: Iterable[str]) -> List[str]:
    return sorted({keyword.strip() for keyword in keywords if keyword.strip()})

