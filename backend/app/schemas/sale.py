from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.models.sale import PaymentMethod


def _utc_iso(v: datetime) -> str:
    """Serialize a datetime as a UTC ISO string with explicit timezone.

    MySQL stores DateTime(timezone=True) as a naive DATETIME column, and
    SQLAlchemy returns it tz-naive even though we wrote it as UTC. Without
    an explicit tz suffix, JS `new Date(...)` interprets the string as
    *local* time and shifts it by the browser offset.
    """
    if v.tzinfo is None:
        v = v.replace(tzinfo=timezone.utc)
    return v.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


class RefundRequest(BaseModel):
    """Optional body for POST /sales/{id}/refund."""
    reason: str | None = Field(None, max_length=500, description="返品理由（任意）")


class SaleCreate(BaseModel):
    branch_id: int
    variant_id: int
    quantity: int = Field(gt=0, description="Must be at least 1")
    unit_price: Decimal = Field(ge=0, description="Must be 0 or greater")
    payment_method: PaymentMethod = PaymentMethod.cash
    sold_at: datetime | None = None
    sold_by: str | None = None
    patient_ref: str | None = None
    note: str | None = None


class SaleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    store_id: int
    branch_id: int
    variant_id: int
    transaction_id: str
    quantity: int
    unit_price: Decimal
    payment_method: PaymentMethod
    sold_at: datetime
    sold_by: str | None
    patient_ref: str | None
    note: str | None
    refunded_at: datetime | None = None
    refund_of_sale_id: int | None = None
    created_at: datetime
    # Denormalized for the list view — populated by the GET handler.
    product_name: str | None = None
    sku: str | None = None

    @field_serializer("unit_price")
    @classmethod
    def ser_decimal(cls, v: Decimal) -> str:
        return str(v)

    @field_serializer("sold_at", "created_at", "refunded_at")
    @classmethod
    def ser_datetime(cls, v: datetime | None) -> str | None:
        return _utc_iso(v) if v is not None else None


class SaleListResponse(BaseModel):
    items: list[SaleRead]
    total: int


class SalesSummary(BaseModel):
    today_count: int
    today_revenue: str
    yesterday_count: int = 0
    yesterday_revenue: str = "0"
    month_count: int
    month_revenue: str
    last_month_count: int = 0
    last_month_revenue: str = "0"


class ReceiptLine(BaseModel):
    """One line item in the receipt breakdown."""
    name: str
    quantity: int
    unit_price: str
    line_total: str
    tax_rate: str          # 'standard' | 'reduced'
    tax_rate_pct: int      # 10 or 8
    is_reduced: bool


class ReceiptStore(BaseModel):
    company_name: str
    address: str | None = None
    phone: str | None = None
    registration_no: str | None = None  # 適格請求書 登録番号 (T-13-digit)


class ReceiptData(BaseModel):
    """Everything the receipt page needs to render one transaction."""
    transaction_id: str
    sold_at: str            # ISO 8601 UTC (Z-suffixed)
    payment_method: str
    payment_method_label: str
    lines: list[ReceiptLine]
    subtotal_10_tax_excl: str
    tax_10: str
    subtotal_10_tax_incl: str
    subtotal_8_tax_excl: str
    tax_8: str
    subtotal_8_tax_incl: str
    total: str
    store: ReceiptStore
