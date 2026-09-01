"""Alembic environment for FoodLink.

The database URL is read from `foodlink.config.Settings`, never from
`alembic.ini`. That is the point: the application and the migrations resolve
`DATABASE_URL` through exactly one piece of code, so `alembic upgrade head`
cannot silently migrate a different database than the one the API is about to
serve, and no deployment-specific URL is committed to the repository.

Importing `foodlink.config` builds `Settings`, which means the signing-key rule
from D-22 applies here too: `FOODLINK_SECRET_KEY` (or the explicit
`FOODLINK_DEV_INSECURE_SECRET=1` opt-in) must be set to run migrations. A
migration does not need the key, but one configuration path for every entry
point is worth more than the exemption.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from foodlink.config import get_settings
from foodlink.database import Base

# Importing the models is what populates `Base.metadata`. Without it
# autogenerate sees an empty schema and proposes dropping every table.
from foodlink import models

config = context.config

# `configure_logger` is set to False when the application calls Alembic in
# process (see `foodlink.migrate`): fileConfig() reconfigures logging globally,
# which a library-style call has no business doing to its host.
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", get_settings().database_url)

target_metadata = Base.metadata

def render_item(type_, obj, autogen_context):
    """Render `UtcDateTime` columns as the type they actually emit as DDL.

    Autogenerate would otherwise write `foodlink.models.UtcDateTime()` into the
    migration, making every revision import the model layer — so a later
    rename or removal of that class would break migrations that already ran.
    `UtcDateTime` is a `TypeDecorator` over `DateTime(timezone=True)`; the two
    are identical to the database and differ only in Python-side coercion,
    which a migration does not do. Rendering the impl keeps revision files
    dependent on SQLAlchemy alone.
    """
    if type_ == "type" and isinstance(obj, models.UtcDateTime):
        return "sa.DateTime(timezone=True)"
    return False  # fall through to Alembic's default rendering


# `render_as_batch` makes SQLAlchemy emit SQLite's copy-and-move table rewrite
# for ALTERs it cannot express directly (SQLite supports almost none of them).
# It is a no-op on Postgres, so it is set unconditionally rather than branched.
_CONTEXT_OPTIONS = {
    "target_metadata": target_metadata,
    "render_as_batch": True,
    "compare_type": True,
    "render_item": render_item,
}


def run_migrations_offline() -> None:
    """Emit SQL to stdout without connecting — `alembic upgrade head --sql`."""
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        **_CONTEXT_OPTIONS,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = config.attributes.get("connection", None)

    if connectable is None:
        engine = engine_from_config(
            config.get_section(config.config_ini_section, {}),
            prefix="sqlalchemy.",
            poolclass=pool.NullPool,
        )
        with engine.connect() as connection:
            _run(connection)
    else:
        # A caller (the application, or a test) supplied its own connection.
        _run(connectable)


def _run(connection) -> None:
    context.configure(connection=connection, **_CONTEXT_OPTIONS)
    with context.begin_transaction():
        context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
