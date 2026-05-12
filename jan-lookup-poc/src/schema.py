from __future__ import annotations

from typing import ClassVar, Optional, Union

from pydantic import BaseModel, Field


class GroundedField(BaseModel):
    """A field value paired with the source URL it was extracted from.
    If no source URL was actually visited, value must be null."""

    value: Optional[Union[str, float, list[str]]] = None
    source_url: Optional[str] = None


class ProductLookupResult(BaseModel):
    """Structured extraction result for a single JAN code lookup."""

    jan_code: str
    found: bool = Field(description="Did web search return anything plausibly matching this JAN?")
    title: GroundedField = Field(default_factory=GroundedField, description="商品名")
    brand: GroundedField = Field(default_factory=GroundedField, description="メーカー / ブランド")
    description: GroundedField = Field(
        default_factory=GroundedField, description="1-3 sentence Japanese description"
    )
    category: GroundedField = Field(
        default_factory=GroundedField,
        description="歯ブラシ / 歯間ブラシ / フロス / 洗口液 / 歯磨剤 / その他",
    )
    indications: GroundedField = Field(
        default_factory=GroundedField,
        description="list[str]: 歯周病, 知覚過敏, インプラント周囲, 矯正中, 子供用, 高齢者, ドライマウス, etc.",
    )
    bristle_hardness: GroundedField = Field(
        default_factory=GroundedField,
        description="やわらかめ / ふつう / かため (only if applicable)",
    )
    head_size: GroundedField = Field(
        default_factory=GroundedField, description="Only if applicable"
    )
    fluoride_ppm: GroundedField = Field(
        default_factory=GroundedField, description="Numeric, only if applicable"
    )
    weight_g: GroundedField = Field(
        default_factory=GroundedField, description="Numeric"
    )
    dimensions: GroundedField = Field(
        default_factory=GroundedField, description='Free text or "WxDxH mm"'
    )
    price_jpy: GroundedField = Field(
        default_factory=GroundedField, description="Numeric"
    )
    image_urls: GroundedField = Field(
        default_factory=GroundedField, description="list[str] of URLs — do NOT download"
    )
    raw_search_notes: str = Field(
        default="",
        description="Agent's free-text log of what it searched, what it saw, any conflicts",
    )

    # --- Helpers for reporting ---

    GROUNDED_FIELD_NAMES: ClassVar[list[str]] = [
        "title",
        "brand",
        "description",
        "category",
        "indications",
        "bristle_hardness",
        "head_size",
        "fluoride_ppm",
        "weight_g",
        "dimensions",
        "price_jpy",
        "image_urls",
    ]

    model_config = {"arbitrary_types_allowed": True}

    def grounded_count(self) -> int:
        """Number of fields that have both a value and a source_url."""
        count = 0
        for name in self.GROUNDED_FIELD_NAMES:
            field: GroundedField = getattr(self, name)
            if field.value is not None and field.source_url is not None:
                count += 1
        return count

    def total_fields(self) -> int:
        return len(self.GROUNDED_FIELD_NAMES)

    def top_source_domain(self) -> str:
        """Return the most frequently cited domain across grounded fields."""
        from urllib.parse import urlparse
        from collections import Counter

        domains: list[str] = []
        for name in self.GROUNDED_FIELD_NAMES:
            field: GroundedField = getattr(self, name)
            if field.source_url:
                try:
                    domains.append(urlparse(field.source_url).netloc)
                except Exception:
                    pass
        if not domains:
            return "-"
        return Counter(domains).most_common(1)[0][0]


class ProductNameLookupResult(BaseModel):
    """Structured extraction result for a product name lookup.

    Unlike ProductLookupResult (keyed by JAN), this is keyed by product name
    and treats jan_code as a discoverable grounded field.
    """

    product_name: str
    found: bool = Field(description="Did web search return anything plausibly matching this product name?")
    jan_code: GroundedField = Field(default_factory=GroundedField, description="JANコード (barcode)")
    title: GroundedField = Field(default_factory=GroundedField, description="商品名 (正式名称)")
    brand: GroundedField = Field(default_factory=GroundedField, description="メーカー / ブランド")
    description: GroundedField = Field(
        default_factory=GroundedField, description="1-3 sentence Japanese description"
    )
    category: GroundedField = Field(
        default_factory=GroundedField,
        description="歯ブラシ / 歯間ブラシ / フロス / 洗口液 / 歯磨剤 / その他",
    )
    indications: GroundedField = Field(
        default_factory=GroundedField,
        description="list[str]: 歯周病, 知覚過敏, インプラント周囲, 矯正中, 子供用, 高齢者, ドライマウス, etc.",
    )
    bristle_hardness: GroundedField = Field(
        default_factory=GroundedField,
        description="やわらかめ / ふつう / かため (only if applicable)",
    )
    head_size: GroundedField = Field(
        default_factory=GroundedField, description="Only if applicable"
    )
    fluoride_ppm: GroundedField = Field(
        default_factory=GroundedField, description="Numeric, only if applicable"
    )
    weight_g: GroundedField = Field(
        default_factory=GroundedField, description="Numeric"
    )
    dimensions: GroundedField = Field(
        default_factory=GroundedField, description='Free text or "WxDxH mm"'
    )
    price_jpy: GroundedField = Field(
        default_factory=GroundedField, description="Numeric"
    )
    image_urls: GroundedField = Field(
        default_factory=GroundedField, description="list[str] of URLs — do NOT download"
    )
    raw_search_notes: str = Field(
        default="",
        description="Agent's free-text log of what it searched, what it saw, any conflicts",
    )

    GROUNDED_FIELD_NAMES: ClassVar[list[str]] = [
        "jan_code",
        "title",
        "brand",
        "description",
        "category",
        "indications",
        "bristle_hardness",
        "head_size",
        "fluoride_ppm",
        "weight_g",
        "dimensions",
        "price_jpy",
        "image_urls",
    ]

    model_config = {"arbitrary_types_allowed": True}

    def grounded_count(self) -> int:
        count = 0
        for name in self.GROUNDED_FIELD_NAMES:
            field: GroundedField = getattr(self, name)
            if field.value is not None and field.source_url is not None:
                count += 1
        return count

    def total_fields(self) -> int:
        return len(self.GROUNDED_FIELD_NAMES)

    def top_source_domain(self) -> str:
        from urllib.parse import urlparse
        from collections import Counter

        domains: list[str] = []
        for name in self.GROUNDED_FIELD_NAMES:
            field: GroundedField = getattr(self, name)
            if field.source_url:
                try:
                    domains.append(urlparse(field.source_url).netloc)
                except Exception:
                    pass
        if not domains:
            return "-"
        return Counter(domains).most_common(1)[0][0]
