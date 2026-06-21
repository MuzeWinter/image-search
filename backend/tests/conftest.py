"""Shared test fixtures: in-memory SQLite with full schema."""

import pytest
import sqlite3
import os


@pytest.fixture
def in_memory_db():
    """Create an in-memory SQLite database with full schema loaded from schema.sql."""
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")

    schema_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "db", "schema.sql",
    )
    with open(schema_path, "r", encoding="utf-8") as f:
        conn.executescript(f.read())

    yield conn
    conn.close()
