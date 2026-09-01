"""Schema ownership: Alembic, called in process at startup.

This replaces the `Base.metadata.create_all` that `main.py`, `cli.py` and
`seed.py` each used to run (D-21). `create_all` creates missing tables and
never alters existing ones, so a new model column silently did not appear and
the only recovery was deleting the database file.

Why the migration runs at startup rather than as a separate deploy step: the
project's local workflow is "start the server and the database is ready", and
an application that creates its own schema on a bare checkout is a property
worth keeping (`cli._session`'s comment says so explicitly). SQLite has one
writer and therefore one process (ARCHITECTURE constraint 1), so the usual
objection — several workers racing to migrate the same database — does not
apply yet. It will the moment this project moves to Postgres with more than one
uvicorn worker, and at that point `ensure_schema_current()` should be dropped
from the lifespan in favour of `alembic upgrade head` in the deploy script.

The third case below is the one that needs care. A database created by an
earlier revision of FoodLink has all six tables and no `alembic_version` row.
Running the initial migration against it would fail on `CREATE TABLE users`,
and there is no safe automatic answer — the schema *looks* right but nothing
has verified that it is. So that case is reported, with the one-line
non-destructive fix, and the schema is left untouched.
"""

from __future__ import annotations

import warnings
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.runtime.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import Engine, inspect

from .database import Base, engine

#: `code/alembic.ini`, resolved from this file rather than the working
#: directory — the same reason the SQLite path being relative to the cwd is a
#: known trap in this project.
ALEMBIC_INI = Path(__file__).resolve().parent.parent / "alembic.ini"

_BASELINE_MESSAGE = """\
This database has FoodLink's tables but is not under migration control, so its
schema cannot be verified or upgraded. It was left untouched.

If it was created by an earlier revision of FoodLink and its schema is current,
bring it under control with a single non-destructive command (it writes one
row and changes no table):

    alembic -c {ini} stamp head

If it is a database you no longer need, delete the file and let it be recreated
from the migration history instead."""


def alembic_config(*, for_application: bool = False) -> Config:
    """The project's Alembic configuration.

    `for_application` suppresses env.py's fileConfig() call, so an in-process
    migration does not reconfigure the host application's logging.
    """
    config = Config(str(ALEMBIC_INI))
    if for_application:
        config.attributes["configure_logger"] = False
    return config


def _current_revision(connection) -> str | None:
    return MigrationContext.configure(connection).get_current_revision()


def _has_foodlink_tables(connection) -> bool:
    existing = set(inspect(connection).get_table_names())
    return bool(existing & set(Base.metadata.tables))


def ensure_schema_current(target_engine: Engine | None = None) -> None:
    """Bring `target_engine`'s database up to the latest revision.

    Does nothing when the database is already at head, which is the ordinary
    case on every restart after the first.
    """
    target_engine = target_engine if target_engine is not None else engine
    config = alembic_config(for_application=True)
    head = ScriptDirectory.from_config(config).get_current_head()

    with target_engine.connect() as connection:
        current = _current_revision(connection)
        if current == head:
            return
        if current is None and _has_foodlink_tables(connection):
            warnings.warn(
                _BASELINE_MESSAGE.format(ini=ALEMBIC_INI),
                RuntimeWarning,
                stacklevel=2,
            )
            return

    with target_engine.begin() as connection:
        # Handing env.py the connection keeps everything on one engine, which
        # matters for SQLite: a second connection to the same file is a second
        # writer competing for the same lock.
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
