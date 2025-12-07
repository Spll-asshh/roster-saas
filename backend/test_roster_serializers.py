from datetime import date
from types import SimpleNamespace
from unittest import skipUnless

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase

from ATSdb_manager.models import Location, Roster
from ATSdb_manager.serializers import RosterSerializer


@skipUnless(connection.vendor == "postgresql", "Roster serializer tests require PostgreSQL backend")
class RosterSerializerValidationTests(TestCase):
    """Ensure serializer level validation aligns with the viewset behaviour."""

    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="roster_tester",
            password="pass",
        )

    def test_duplicate_period_defers_to_viewset_conflict_resolution(self):
        location = Location.objects.create(location="AIIAP")
        Roster.objects.create(
            location=location,
            title="Existing Roster",
            effective_year=2025,
            effective_month=1,
            effective_from=date(2025, 1, 1),
            shift_cycle_length=5,
            shift_count=0,
            duration_days=31,
            is_draft=True,
            created_by=self.user,
            cycle_template={},
            non_operational_assignments={},
        )

        payload = {
            "title": "Replacement Roster",
            "location": location.pk,
            "effective_year": 2025,
            "effective_month": 1,
            "effective_from": "2025-01-01",
            "shift_cycle_length": 5,
            "duration_days": 31,
            "is_draft": True,
            "cycle_template": {},
            "non_operational_assignments": {},
            "shifts": [],
            "duty_timings": [],
            "units": [],
            "days": [],
            "assignments": [],
        }

        request = SimpleNamespace(user=self.user)
        serializer = RosterSerializer(data=payload, context={"request": request})

        self.assertTrue(serializer.is_valid(), serializer.errors)
        self.assertNotIn("non_field_errors", serializer.errors)
