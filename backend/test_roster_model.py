from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase

from ATSdb_manager.models import Location, Persona, Roster
from ATSdb_manager.roster import ROLE_KEYWORDS_COO_SATCO


class RosterModelCleanTests(TestCase):
    """Validate roster model constraints that depend on role keywords."""

    def setUp(self):
        self.location = Location.objects.create(location="TEST")
        self.creator = User.objects.create_user(username="creator", password="pass")
        self.approver = Persona.objects.create(service_no="SERV001", name="Approver")

    def test_approved_by_checks_coo_satco_roles(self):
        roster = Roster(
            location=self.location,
            title="Test Roster",
            effective_year=2024,
            effective_month=1,
            effective_from=date(2024, 1, 1),
            shift_cycle_length=5,
            shift_count=3,
            duration_days=30,
            created_by=self.creator,
            approved_by=self.approver,
        )

        with patch.object(Roster, "_persona_has_role", return_value=True) as mock_has_role:
            roster.clean()

        role_checks = [call.args[1] for call in mock_has_role.call_args_list]
        self.assertIn(ROLE_KEYWORDS_COO_SATCO, role_checks)
