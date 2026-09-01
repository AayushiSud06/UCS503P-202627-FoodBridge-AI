"""The migration history, checked against the models it claims to describe.

These tests exist because a migration set can drift from the model layer
silently: everything keeps working on the developer's database, which was built
by an earlier revision, and only a fresh deployment finds out. So the first
test builds a database from nothing but the revision files and asserts the
result is what `Base.metadata` says it should be.

Every test uses its own database file and never touches `DATABASE_URL`.
"""

from __future__ import annotations

import warnings

import pytest
from alembic import command
from alembic.autogenerate import compare_metadata
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect, text

from foodlink.database import Base
from foodlink.migrate import alembic_config, ensure_schema_current


@pytest.fixture
def fresh_engine(tmp_path):
    """An engine on an empty database file, disposed afterwards.

    A file rather than `sqlite://` because the migration opens its own
    connection, and an in-memory database exists only per connection.
    """
    engine = create_engine(f"sqlite:///{tmp_path / 'migration-test.db'}")
    try:
        yield engine
    finally:
        engine.dispose()


def head_revision() -> str:
    return ScriptDirectory.from_config(alembic_config()).get_current_head()


def current_revision(engine) -> str | None:
    with engine.connect() as connection:
        return MigrationContext.configure(connection).get_current_revision()


def schema_differences(engine) -> list:
    """Differences between the live schema and the models, ignoring Alembic's
    own bookkeeping table, which is deliberately absent from `Base.metadata`."""
    with engine.connect() as connection:
        context = MigrationContext.configure(
            connection, opts={"compare_type": True, "render_as_batch": True}
        )
        differences = compare_metadata(context, Base.metadata)

    def concerns_alembic_bookkeeping(difference) -> bool:
        return "alembic_version" in repr(difference)

    return [d for d in differences if not concerns_alembic_bookkeeping(d)]


def test_a_fresh_database_is_built_entirely_from_the_migration_history(fresh_engine):
    ensure_schema_current(fresh_engine)

    tables = set(inspect(fresh_engine).get_table_names())
    assert set(Base.metadata.tables) <= tables


def test_migrating_a_fresh_database_reaches_the_head_revision(fresh_engine):
    ensure_schema_current(fresh_engine)

    assert current_revision(fresh_engine) == head_revision()


def test_the_migrated_schema_matches_the_models(fresh_engine):
    """The check that catches a model change committed without a revision."""
    ensure_schema_current(fresh_engine)

    assert schema_differences(fresh_engine) == []


def test_migrating_an_already_current_database_changes_nothing(fresh_engine):
    ensure_schema_current(fresh_engine)

    with warnings.catch_warnings():
        warnings.simplefilter("error")  # a second run must not even warn
        ensure_schema_current(fresh_engine)

    assert current_revision(fresh_engine) == head_revision()


def test_a_database_predating_migrations_is_reported_rather_than_rewritten(fresh_engine):
    """The failure mode this must never have is data loss.

    A database built by the old `create_all` has the tables and no version
    row. Startup cannot safely assume that schema is current, and it certainly
    cannot re-create tables that already hold rows — so it says so and stops.
    """
    Base.metadata.create_all(bind=fresh_engine)
    with fresh_engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (name, email, password_hash, role, is_active) "
                "VALUES ('Existing', 'existing@example.com', 'x', 'donor', 1)"
            )
        )

    with pytest.warns(RuntimeWarning, match="stamp head"):
        ensure_schema_current(fresh_engine)

    with fresh_engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM users")).scalar() == 1
    assert current_revision(fresh_engine) is None
    assert "alembic_version" not in inspect(fresh_engine).get_table_names()


def test_stamping_brings_a_predating_database_under_control_without_losing_data(
    fresh_engine,
):
    """The documented baselining procedure, exercised end to end."""
    Base.metadata.create_all(bind=fresh_engine)
    with fresh_engine.begin() as connection:
        connection.execute(
            text(
                "INSERT INTO users (name, email, password_hash, role, is_active) "
                "VALUES ('Existing', 'existing@example.com', 'x', 'donor', 1)"
            )
        )

    config = alembic_config(for_application=True)
    with fresh_engine.begin() as connection:
        config.attributes["connection"] = connection
        command.stamp(config, "head")

    assert current_revision(fresh_engine) == head_revision()

    # And the database is now an ordinary managed one: startup is a no-op and
    # the rows that were there before are still there.
    ensure_schema_current(fresh_engine)
    with fresh_engine.connect() as connection:
        assert connection.execute(text("SELECT count(*) FROM users")).scalar() == 1


def test_the_migration_history_has_exactly_one_head(fresh_engine):
    """Two heads mean two branches merged carelessly; `upgrade head` then fails."""
    script = ScriptDirectory.from_config(alembic_config())

    assert len(script.get_heads()) == 1


def test_the_initial_revision_can_be_rolled_back(fresh_engine):
    """A downgrade path that does not run is a downgrade path that does not work."""
    ensure_schema_current(fresh_engine)

    config = alembic_config(for_application=True)
    with fresh_engine.begin() as connection:
        config.attributes["connection"] = connection
        command.downgrade(config, "base")

    remaining = set(inspect(fresh_engine).get_table_names())
    assert not (set(Base.metadata.tables) & remaining)
    assert current_revision(fresh_engine) is None
