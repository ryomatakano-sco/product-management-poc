"""Settings page schemas — one Pydantic model per namespace.

The router stores arbitrary JSON in settings_kv.data_json, but PUT validates
the body against the namespace's specific shape so we don't accidentally
break the frontend with malformed blobs.
"""

from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, field_serializer


# ── general ─────────────────────────────────────────────────────────
class GeneralSettings(BaseModel):
    company_name: str = "ペイライト歯科クリニック"
    company_registration_no: str | None = None
    representative: str | None = None
    phone: str | None = None
    email: str | None = None
    address: str | None = None
    timezone: str = "Asia/Tokyo"
    language: str = "ja"
    currency: str = "JPY"
    date_format: str = "YYYY/MM/DD"
    logo_url: str | None = None
    brand_color_hex: str = "#16A36C"


# ── notifications ──────────────────────────────────────────────────
class NotificationsSettings(BaseModel):
    email_enabled: bool = True
    low_stock: bool = True
    expiring_soon: bool = True
    po_status_change: bool = True
    daily_summary_time: str = "08:00"
    recipient_user_ids: list[int] = []
    # Email delivery (heavy-tier item 3). PoC: SMTP creds live in the settings
    # blob like the other PoC secrets. Empty smtp_host / notify_email = in-app only.
    notify_email: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = ""


# ── tax_rates ──────────────────────────────────────────────────────
class TaxRate(BaseModel):
    id: int
    name: str
    rate: Decimal
    is_default: bool = False

    @field_serializer("rate")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)


class TaxRatesSettings(BaseModel):
    # Default set mirrors Japanese consumption tax so a store that has never
    # saved this namespace still gets a valid GET response (never-saved stores
    # previously 500'd because `rates` had no default).
    rates: list[TaxRate] = [
        TaxRate(id=1, name="標準税率", rate=Decimal("10"), is_default=True),
        TaxRate(id=2, name="軽減税率", rate=Decimal("8")),
    ]


# ── ai ─────────────────────────────────────────────────────────────
class AiDailySchedule(BaseModel):
    time: str = "06:00"
    weekdays: list[int] = [1, 2, 3, 4, 5]  # ISO: Mon=1 … Sun=7


class AiUsageStats(BaseModel):
    api_calls: int = 0
    tokens: int = 0
    cost_jpy: Decimal = Decimal("0")

    @field_serializer("cost_jpy")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)


class AiSettings(BaseModel):
    """AI namespace.

    On GET we expose `openai_api_key_set: bool` instead of the actual key.
    On PUT, callers may include an `openai_api_key` string — the router
    moves it to `_secret_openai_api_key` inside data_json so subsequent GETs
    never leak it.
    """
    auto_fill_mode: str = "auto"  # auto | confirm | disabled
    openai_api_key: str | None = None  # write-only — never serialized back
    openai_api_key_set: bool = False
    daily_summary_schedule: AiDailySchedule = AiDailySchedule()
    model: str = "gpt-4o-mini"
    monthly_usage: AiUsageStats = AiUsageStats()


# ── integrations ───────────────────────────────────────────────────
class IntegrationStatus(BaseModel):
    connected: bool = False
    connected_at: datetime | None = None


class AccountingIntegration(BaseModel):
    provider: str | None = None  # freee | moneyforward | yayoi | None
    connected: bool = False


class SlackIntegration(BaseModel):
    connected: bool = False
    webhook_url_set: bool = False


class IntegrationsSettings(BaseModel):
    paylight_x_sso: IntegrationStatus = IntegrationStatus()
    accounting: AccountingIntegration = AccountingIntegration()
    line_official: IntegrationStatus = IntegrationStatus()
    slack: SlackIntegration = SlackIntegration()


# ── envelope for GET ───────────────────────────────────────────────
class SettingsEnvelope(BaseModel):
    namespace: str
    data: dict
    updated_at: datetime | None = None


# Map a namespace string to the schema class that validates its data.
NAMESPACE_SCHEMAS = {
    "general":       GeneralSettings,
    "notifications": NotificationsSettings,
    "tax_rates":     TaxRatesSettings,
    "ai":            AiSettings,
    "integrations":  IntegrationsSettings,
}
