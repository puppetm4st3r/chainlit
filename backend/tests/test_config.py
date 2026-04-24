from pathlib import Path

from chainlit import config as chainlit_config


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
