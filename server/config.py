import os
import re
import subprocess
import json
from databricks.sdk import WorkspaceClient

# Path to the persistent config file (lives next to app.py)
_APP_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_PATH = os.path.join(_APP_DIR, "lattice_config.json")


def load_app_config() -> dict:
    """Load lattice_config.json. Returns {} if not found or unreadable."""
    try:
        with open(CONFIG_PATH) as f:
            return json.load(f)
    except Exception:
        return {}


def save_app_config(updates: dict) -> dict:
    """Merge updates into existing config and save. Returns the full saved config."""
    existing = load_app_config()
    existing.update(updates)
    existing.setdefault("version", 1)
    try:
        with open(CONFIG_PATH, "w") as f:
            json.dump(existing, f, indent=2)
        os.chmod(CONFIG_PATH, 0o600)
    except Exception as e:
        print(f"[config] Save failed: {e}")
    return existing


def apply_app_config():
    """Load lattice_config.json and apply settings to environment variables.
    Call this at startup before ingestion begins."""
    cfg = load_app_config()
    if not cfg:
        return

    catalogs = cfg.get("catalogs", [])
    if catalogs:
        os.environ["LATTICE_CATALOGS"] = ",".join(catalogs)

    if cfg.get("schema_limit"):
        os.environ["LATTICE_SCHEMA_LIMIT"] = str(cfg["schema_limit"])

    if cfg.get("table_limit"):
        os.environ["LATTICE_TABLE_LIMIT"] = str(cfg["table_limit"])

    if cfg.get("warehouse_id"):
        # Only override if not already set by app.yaml resource injection
        if not os.environ.get("DATABRICKS_WAREHOUSE_ID"):
            os.environ["DATABRICKS_WAREHOUSE_ID"] = cfg["warehouse_id"]

    print(f"[config] Loaded lattice_config.json: catalogs={catalogs or 'all'}")

# Profiles: alphanumerics, hyphens, underscores, dots only (matches Databricks CLI convention)
_PROFILE_RE = re.compile(r'^[a-zA-Z0-9_\-\.]{1,128}$')
# Hosts: https scheme, no embedded newlines or shell metacharacters
_HOST_RE = re.compile(r'^https://[a-zA-Z0-9._\-]+(:\d+)?$')


def _get_token_for_profile(profile: str, host: str) -> str | None:
    """Use the Databricks CLI to get a fresh OAuth token for a profile."""
    # Validate before passing to subprocess to prevent argument injection
    if not _PROFILE_RE.match(profile):
        print(f"[config] Rejected invalid profile name: {profile!r}")
        return None
    if not _HOST_RE.match(host):
        print(f"[config] Rejected invalid host: {host!r}")
        return None
    try:
        result = subprocess.run(
            ["databricks", "auth", "token", "--host", host, "--profile", profile],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0:
            data = json.loads(result.stdout)
            return data.get("access_token")
    except Exception:
        pass
    return None


def get_stored_profiles() -> dict:
    """Return Lattice-managed profiles from lattice_config.json."""
    return load_app_config().get("profiles", {})


def get_workspace_client() -> WorkspaceClient:
    # In Databricks App: auto-injected credentials
    if os.environ.get("DATABRICKS_APP_NAME"):
        return WorkspaceClient()

    # Explicit token via env
    host = os.environ.get("DATABRICKS_HOST")
    token = os.environ.get("DATABRICKS_TOKEN")
    if host and token:
        return WorkspaceClient(host=host, token=token)

    # Profile-based
    profile = os.environ.get("DATABRICKS_PROFILE", "e2-demo-west")

    # Check Lattice-stored profiles first (PAT-based, managed in Settings UI)
    stored = get_stored_profiles()
    if profile in stored:
        sp = stored[profile]
        if sp.get("host") and sp.get("token"):
            return WorkspaceClient(host=sp["host"], token=sp["token"])

    # Fall back to ~/.databrickscfg (OAuth via CLI)
    try:
        import configparser
        cfg = configparser.ConfigParser()
        cfg.read(os.path.expanduser("~/.databrickscfg"))
        if profile in cfg:
            profile_host = cfg[profile].get("host", "")
            token = _get_token_for_profile(profile, profile_host)
            if token and profile_host:
                return WorkspaceClient(host=profile_host, token=token)
    except Exception:
        pass

    return WorkspaceClient(profile=profile)
