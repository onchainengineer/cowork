from __future__ import annotations

from pathlib import Path

import pytest

from .unix_agent import UnixAgent


@pytest.fixture(autouse=True)
def _clear_mux_env(monkeypatch: pytest.MonkeyPatch) -> None:
    keys = (*MuxAgent._PROVIDER_ENV_KEYS, *MuxAgent._CONFIG_ENV_KEYS)
    for key in keys:
        monkeypatch.delenv(key, raising=False)


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def test_env_defaults_are_normalized(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UNIX_AGENT_REPO_ROOT", str(_repo_root()))
    agent = UnixAgent(model_name="anthropic/claude-sonnet-4-5")

    env = agent._env

    assert env["UNIX_MODEL"] == "anthropic:claude-sonnet-4-5"
    assert env["UNIX_THINKING_LEVEL"] == "high"
    assert env["UNIX_MODE"] == "exec"
    assert env["UNIX_PROJECT_CANDIDATES"] == agent._DEFAULT_PROJECT_CANDIDATES


def test_timeout_must_be_numeric(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("UNIX_AGENT_REPO_ROOT", str(_repo_root()))
    monkeypatch.setenv("UNIX_TIMEOUT_MS", "not-a-number")

    agent = UnixAgent()
    with pytest.raises(ValueError):
        _ = agent._env
