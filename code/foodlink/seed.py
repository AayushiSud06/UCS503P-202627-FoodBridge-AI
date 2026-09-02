"""Populate a database with demo data.

    python -m foodlink.seed          (from the `code/` directory)

Deadlines are generated relative to the moment the script runs, so the app
never opens with every donation already overdue — which is what happens when
demo data hard-codes wall-clock times like "8:00 PM".
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from .config import get_settings
from .database import SessionLocal
from .matching import rank_recipients
from .migrate import ensure_schema_current
from .models import (
    Donation, DonationStatus, Recipient, Requirement, StatusEvent, User, UserRole, Volunteer,
)
from .security import hash_password

# Thapar University, Patiala and nearby points.
CAMPUS = (30.3540, 76.3630)

DEMO_PASSWORD = "foodlink123"


def seed() -> None:
    ensure_schema_current()

    with SessionLocal() as db:
        if db.scalar(select(User).limit(1)):
            print("Database already has users — nothing seeded.")
            return

        now = datetime.now(timezone.utc)

        donors = [
            User(name="Aayushi Sharma", email="aayushi@thapar.edu",
                 password_hash=hash_password(DEMO_PASSWORD), role=UserRole.donor,
                 organization="College Central Mess", phone="+91-98765-43210"),
            User(name="Vikram Mehta", email="vikram@grandorchid.com",
                 password_hash=hash_password(DEMO_PASSWORD), role=UserRole.donor,
                 organization="Grand Orchid Banquets", phone="+91-98765-11111"),
        ]

        ngo_users = [
            User(name="Raj Malhotra", email="raj@helpinghands.org",
                 password_hash=hash_password(DEMO_PASSWORD), role=UserRole.ngo,
                 organization="Helping Hands Community Kitchen", phone="+91-98111-22222"),
            User(name="Priya Singh", email="priya@umeedshelter.org",
                 password_hash=hash_password(DEMO_PASSWORD), role=UserRole.ngo,
                 organization="Umeed Shelter & Care", phone="+91-98111-33333"),
        ]

        volunteer_users = [
            User(name="Aarav Sharma", email="aarav@thapar.edu",
                 password_hash=hash_password(DEMO_PASSWORD), role=UserRole.volunteer,
                 phone="+91-98001-23456"),
            User(name="Meera Kapoor", email="meera@gmail.com",
                 password_hash=hash_password(DEMO_PASSWORD), role=UserRole.volunteer,
                 phone="+91-97001-34567"),
        ]

        admin = User(name="Admin Controller", email="admin@foodlink.ai",
                     password_hash=hash_password(DEMO_PASSWORD), role=UserRole.admin)

        db.add_all(donors + ngo_users + volunteer_users + [admin])
        db.flush()

        recipients = [
            Recipient(user_id=ngo_users[0].id, name="Helping Hands Community Kitchen",
                      type="Community Kitchen", location="Model Town, Patiala",
                      latitude=30.3400, longitude=76.3800, capacity=150,
                      contact_person="Raj Malhotra", phone="+91-98111-22222",
                      is_verified=True, accepted_donations=41, completed_donations=39),
            Recipient(user_id=ngo_users[1].id, name="Umeed Shelter & Care",
                      type="Night Shelter", location="Urban Estate, Patiala",
                      latitude=30.3700, longitude=76.3900, capacity=80,
                      contact_person="Priya Singh", phone="+91-98111-33333",
                      is_verified=True, accepted_donations=22, completed_donations=20),
            Recipient(name="Apna Ghar Senior Living", type="Senior Home",
                      location="Leela Bhawan, Patiala",
                      latitude=30.3320, longitude=76.3950, capacity=60,
                      contact_person="Sunita Rao", phone="+91-98111-44444",
                      is_verified=True, accepted_donations=15, completed_donations=13),
        ]
        volunteers = [
            Volunteer(user_id=volunteer_users[0].id, location="Thapar University Campus",
                      latitude=CAMPUS[0], longitude=CAMPUS[1], completed_deliveries=18, rating=4.9),
            Volunteer(user_id=volunteer_users[1].id, location="Model Town, Patiala",
                      latitude=30.3410, longitude=76.3810, completed_deliveries=14, rating=4.7),
        ]
        db.add_all(recipients + volunteers)
        db.flush()

        # (food, category, qty, unit, hours until deadline, storage, status)
        plan = [
            ("Vegetarian Thali Meals", "Vegetarian", 50, "Meals", 4, "Room Temperature",
             DonationStatus.MATCHED),
            ("Fresh Sandwich & Snack Boxes", "Bakery", 25, "Boxes", 2, "Refrigerated",
             DonationStatus.AVAILABLE),
            ("Seasonal Fruit Crates", "Fruits & Vegetables", 35, "Kg", 9, "Room Temperature",
             DonationStatus.PICKED_UP),
            ("Meal Combos (Veg & Non-Veg)", "Non-Vegetarian", 45, "Meals", 6, "Refrigerated",
             DonationStatus.COMPLETED),
        ]

        radius_km = get_settings().max_match_radius_km

        for i, (food, cat, qty, unit, hours, storage, target) in enumerate(plan):
            created = now - timedelta(hours=2)
            donation = Donation(
                donor_id=donors[i % len(donors)].id,
                food_name=food, category=cat, quantity=qty, unit=unit,
                storage_type=storage,
                description=f"{qty} {unit.lower()} of {food.lower()} surplus from today's service.",
                location="College Central Mess, Thapar University",
                latitude=CAMPUS[0], longitude=CAMPUS[1],
                prepared_at=created,
                pickup_deadline=now + timedelta(hours=hours),
                status=DonationStatus.AVAILABLE,
                created_at=created,
            )
            db.add(donation)
            db.flush()

            # Walk the donation forward, stamping each step a few minutes apart
            # so the timing metrics have something realistic to measure.
            path = [DonationStatus.AVAILABLE, DonationStatus.MATCHED, DonationStatus.ACCEPTED,
                    DonationStatus.VOLUNTEER_ASSIGNED, DonationStatus.PICKED_UP,
                    DonationStatus.DELIVERED, DonationStatus.COMPLETED]
            offset = 0
            for step in path:
                db.add(StatusEvent(donation_id=donation.id, to_status=step,
                                   occurred_at=created + timedelta(minutes=offset)))
                donation.status = step
                if step is DonationStatus.MATCHED:
                    # Ranked, not invented. This used to write a literal (94, 91,
                    # 88, …), which then sat on screen beside the real ranking
                    # and disagreed with it — demo data has to come from the same
                    # matcher the API uses or the demo is showing a different
                    # product.
                    ranked = rank_recipients(
                        donation, recipients, radius_km=radius_km, limit=1
                    )
                    if ranked:
                        donation.match_score = ranked[0].overall_score
                if step is DonationStatus.ACCEPTED:
                    taker = recipients[i % len(recipients)]
                    donation.recipient_id = taker.id
                    # Re-frozen against the organisation that actually took it,
                    # exactly as `update_status` does.
                    ranked = rank_recipients(donation, [taker], radius_km=radius_km, limit=1)
                    if ranked:
                        donation.match_score = ranked[0].overall_score
                if step is DonationStatus.VOLUNTEER_ASSIGNED:
                    donation.volunteer_id = volunteers[i % len(volunteers)].id
                if step is target:
                    break
                offset += 18

        db.add(Requirement(
            recipient_id=recipients[0].id, food_type="Hot vegetarian meals",
            quantity_needed=120, unit="Meals", beneficiary_count=140,
            urgency="High", daily_recurring=True,
            notes="Needed before 7 PM daily. No onion or garlic.",
        ))
        db.add(Requirement(
            recipient_id=recipients[1].id, food_type="Packaged dry rations",
            quantity_needed=40, unit="Boxes", beneficiary_count=60,
            urgency="Medium", daily_recurring=False,
            notes="Long shelf life preferred.",
        ))

        db.commit()

    print("Seeded. Every demo account uses the password:", DEMO_PASSWORD)
    print("  donor      aayushi@thapar.edu")
    print("  recipient  raj@helpinghands.org")
    print("  courier    aarav@thapar.edu")
    print("  admin      admin@foodlink.ai")


if __name__ == "__main__":
    seed()
