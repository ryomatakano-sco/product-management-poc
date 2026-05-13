"""Import all models so Alembic can discover them via Base.metadata."""

from app.models.base import Base  # noqa: F401
from app.models.store import Store  # noqa: F401
from app.models.branch import Branch  # noqa: F401
from app.models.vendor import Vendor  # noqa: F401
from app.models.category import Category  # noqa: F401
from app.models.product import Product, ProductVariant, ProductImage  # noqa: F401
from app.models.tag import Tag, ProductTag  # noqa: F401
from app.models.inventory import InventoryAdjustment  # noqa: F401
from app.models.sale import SalesRecord  # noqa: F401
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem, PurchaseOrderTag  # noqa: F401
from app.models.ai_session import AiSuggestionSession, AiSuggestionFieldOption  # noqa: F401
from app.models.support import SupportTicket  # noqa: F401
from app.models.settings_kv import SettingsKV  # noqa: F401
