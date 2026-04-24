import json
from pathlib import Path

import pytest

from chainlit import config as chainlit_config
from chainlit.config import ChainlitConfig


@pytest.fixture
def translation_dir(tmp_path: Path) -> Path:
    """Minimal translation directory with a controlled set of locale files."""
    t_dir = tmp_path / "translations"
    t_dir.mkdir()

    files: dict[str, dict] = {
        "en-US.json": {"greeting": "Hello"},
        "es.json": {"greeting": "Hola"},
        "da-DK.json": {"greeting": "Hej"},
        "de-DE.json": {"greeting": "Hallo"},
        "zh-CN.json": {"greeting": "你好 CN"},
        "zh-TW.json": {"greeting": "你好 TW"},
    }
    for filename, content in files.items():
        (t_dir / filename).write_text(json.dumps(content), encoding="utf-8")

    return t_dir


class TestLoadTranslation:
    """Regression tests for the load_translation fallback chain."""

    def test_exact_match_regional(
        self,
        test_config: ChainlitConfig,
        translation_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Exact regional locale (da-DK) resolves directly to its file."""
        monkeypatch.setattr(
            chainlit_config, "config_translation_dir", str(translation_dir)
        )
        assert test_config.load_translation("da-DK") == {"greeting": "Hej"}

    def test_exact_match_base(
        self,
        test_config: ChainlitConfig,
        translation_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Exact base locale (es) resolves directly to its file."""
        monkeypatch.setattr(
            chainlit_config, "config_translation_dir", str(translation_dir)
        )
        assert test_config.load_translation("es") == {"greeting": "Hola"}

    def test_parent_fallback(
        self,
        test_config: ChainlitConfig,
        translation_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Regional locale (es-419) falls back to base file (es.json) when no exact match."""
        monkeypatch.setattr(
            chainlit_config, "config_translation_dir", str(translation_dir)
        )
        assert test_config.load_translation("es-419") == {"greeting": "Hola"}

    def test_regional_variant_lookup(
        self,
        test_config: ChainlitConfig,
        translation_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Base locale (da) resolves to regional file (da-DK.json) when no exact match exists."""
        monkeypatch.setattr(
            chainlit_config, "config_translation_dir", str(translation_dir)
        )
        assert test_config.load_translation("da") == {"greeting": "Hej"}

    def test_regional_variant_lookup_de(
        self,
        test_config: ChainlitConfig,
        translation_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Base locale (de) resolves to regional file (de-DE.json) via variant lookup."""
        monkeypatch.setattr(
            chainlit_config, "config_translation_dir", str(translation_dir)
        )
        assert test_config.load_translation("de") == {"greeting": "Hallo"}

    def test_regional_variant_sorted_deterministic(
        self,
        test_config: ChainlitConfig,
        translation_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """When multiple regional variants exist, the first sorted match (zh-CN) is returned."""
        monkeypatch.setattr(
            chainlit_config, "config_translation_dir", str(translation_dir)
        )
        assert test_config.load_translation("zh") == {"greeting": "你好 CN"}

    def test_default_fallback_unknown_locale(
        self,
        test_config: ChainlitConfig,
        translation_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Completely unknown locale (xx) falls back to en-US."""
        monkeypatch.setattr(
            chainlit_config, "config_translation_dir", str(translation_dir)
        )
        assert test_config.load_translation("xx") == {"greeting": "Hello"}

    def test_default_fallback_base_without_regional_variant(
        self,
        test_config: ChainlitConfig,
        translation_dir: Path,
        monkeypatch: pytest.MonkeyPatch,
    ):
        """Base locale (fr) with no matching file at all falls back to en-US."""
        monkeypatch.setattr(
            chainlit_config, "config_translation_dir", str(translation_dir)
        )
        assert test_config.load_translation("fr") == {"greeting": "Hello"}


def test_load_settings_hides_topright_bar_from_env(monkeypatch, tmp_path: Path):
    config_dir = tmp_path / ".chainlit"
    config_dir.mkdir()
    config_path = config_dir / "config.toml"
    config_path.write_text(chainlit_config.DEFAULT_CONFIG_STR, encoding="utf-8")

    monkeypatch.setattr(chainlit_config, "config_dir", str(config_dir))
    monkeypatch.setattr(chainlit_config, "config_file", str(config_path))
    monkeypatch.setenv("CHAINLIT_HIDE_TOPRIGHT_BAR", "true")

    settings = chainlit_config.load_settings()

    assert settings["ui"].hide_topright_bar is True


def test_load_settings_reads_hide_topright_bar_from_toml(monkeypatch, tmp_path: Path):
    config_dir = tmp_path / ".chainlit"
    config_dir.mkdir()
    config_path = config_dir / "config.toml"
    config_path.write_text(
        chainlit_config.DEFAULT_CONFIG_STR.replace(
            'hide_topright_bar = false',
            'hide_topright_bar = true',
        ),
        encoding="utf-8",
    )

    monkeypatch.setattr(chainlit_config, "config_dir", str(config_dir))
    monkeypatch.setattr(chainlit_config, "config_file", str(config_path))

    settings = chainlit_config.load_settings()

    assert settings["ui"].hide_topright_bar is True


def test_load_settings_defaults_hide_topright_bar_to_false(monkeypatch, tmp_path: Path):
    config_dir = tmp_path / ".chainlit"
    config_dir.mkdir()
    config_path = config_dir / "config.toml"
    config_path.write_text(chainlit_config.DEFAULT_CONFIG_STR, encoding="utf-8")

    monkeypatch.setattr(chainlit_config, "config_dir", str(config_dir))
    monkeypatch.setattr(chainlit_config, "config_file", str(config_path))

    settings = chainlit_config.load_settings()

    assert settings["ui"].hide_topright_bar is False


def test_load_settings_ignores_invalid_hide_topright_bar_env(
    monkeypatch, tmp_path: Path
):
    config_dir = tmp_path / ".chainlit"
    config_dir.mkdir()
    config_path = config_dir / "config.toml"
    config_path.write_text(chainlit_config.DEFAULT_CONFIG_STR, encoding="utf-8")

    monkeypatch.setattr(chainlit_config, "config_dir", str(config_dir))
    monkeypatch.setattr(chainlit_config, "config_file", str(config_path))
    monkeypatch.setenv("CHAINLIT_HIDE_TOPRIGHT_BAR", "maybe")

    settings = chainlit_config.load_settings()

    assert settings["ui"].hide_topright_bar is False
