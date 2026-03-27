"""
MongoDB Collections & Schema Definitions
=========================================

Collection: purchase_requisitions
----------------------------------
{
    "_id": ObjectId,
    "pr_number": str (unique, e.g. "PR-1001"),
    "document_type": str,           # PurchaseRequisitionType
    "items": [
        {
            "item_number": str,     # PurchaseRequisitionItem
            "material": str,
            "unit_of_measure": str, # baseunit
            "quantity": float,      # RequestedQuantity
            "valuation_price": float, # NetPriceAmount
            "delivery_date": str,   # ISO date
            "plant": str,
            "storage_location": str,
            "purchase_group": str   # PurchasingGroup
        }
    ],
    "status": str,  # OPEN | CLOSED | IN_PROGRESS
    "created_at": datetime,
    "updated_at": datetime
}

Collection: purchase_orders
-----------------------------
{
    "_id": ObjectId,
    "po_number": str (unique, e.g. "PO-2001"),
    "pr_number": str,               # linked PR
    "document_type": str,           # PurchaseOrderType
    "purchase_organization": str,   # PurchasingOrganization
    "purchase_group": str,          # PurchasingGroup
    "company_code": str,            # CompanyCode
    "vendor": str,                  # Supplier
    "items": [
        {
            "item_number": str,     # PurchaseOrderItem
            "material": str,
            "quantity": float,      # OrderQuantity
            "net_price": float,     # purgreleasetimetotalamount
            "delivery_date": str,
            "plant": str,
            "storage_location": str # StorageLocation
        }
    ],
    "status": str,
    "created_at": datetime,
    "updated_at": datetime
}

Collection: goods_receipts
----------------------------
{
    "_id": ObjectId,
    "grn_number": str (unique, e.g. "GRN-3001"),
    "po_number": str,               # PurchaseOrder link
    "document_date": str,           # ISO date
    "posting_date": str,            # ISO date
    "items": [
        {
            "item": str,            # MaterialDocumentItem
            "material": str,
            "unit_of_measure": str, # purchaseorderquanityunit
            "quantity": float,      # Quantitybaseunit
            "entry_unit": str,      # entrunit
            "plant": str,
            "storage_location": str,
            "price": float          # totalgoodsmvtamtinccrrcy
        }
    ],
    "status": str,
    "created_at": datetime,
    "updated_at": datetime
}

Collection: invoice_verifications
-----------------------------------
{
    "_id": ObjectId,
    "invoice_number": str (unique, e.g. "INV-4001"),
    "pr_number": str,
    "po_number": str,
    "grn_number": str,
    "status": str,                  # PENDING | SENT_TO_MIRO | COMPLETED
    "miro_redirect_url": str,
    "created_at": datetime,
    "updated_at": datetime
}

Collection: documents
----------------------
{
    "_id": ObjectId,
    "stage": str,                   # PR | PO | GRN | INVOICE
    "reference_number": str,        # The PR/PO/GRN/INV number
    "filename": str,                # stored filename
    "original_filename": str,
    "file_path": str,
    "file_size": int,
    "mime_type": str,
    "ocr_status": str,              # PENDING | VALID | INVALID | REVIEW
    "ocr_result": {
        "document_type_detected": str,
        "expected_number_found": bool,
        "cross_reference_valid": bool,  # for PO: PR number present
        "confidence": float,
        "raw_text_snippet": str,
        "issues": [str]
    },
    "version": int,                 # increments on change
    "is_active": bool,
    "uploaded_at": datetime,
    "updated_at": datetime
}

Collection: notifications
--------------------------
{
    "_id": ObjectId,
    "type": str,       # MISSING_DOCUMENT | OCR_FAILED | OCR_REVIEW | VALIDATION_ERROR
    "stage": str,      # PR | PO | GRN | INVOICE
    "reference_number": str,
    "message": str,
    "action_label": str,
    "action_route": str,   # frontend route to redirect
    "is_read": bool,
    "created_at": datetime
}
"""

from app import mongo
from datetime import datetime


def init_indexes():
    """Create MongoDB indexes for performance."""
    db = mongo.db

    # Unique indexes
    db.purchase_requisitions.create_index("pr_number", unique=True)
    db.purchase_orders.create_index("po_number", unique=True)
    db.goods_receipts.create_index("grn_number", unique=True)
    db.invoice_verifications.create_index("invoice_number", unique=True)

    # Query indexes
    db.purchase_orders.create_index("pr_number")
    db.goods_receipts.create_index("po_number")
    db.invoice_verifications.create_index([("pr_number", 1), ("po_number", 1), ("grn_number", 1)])

    db.documents.create_index([("stage", 1), ("reference_number", 1)])
    db.documents.create_index("is_active")

    db.notifications.create_index("is_read")
    db.notifications.create_index([("stage", 1), ("reference_number", 1)])
    db.notifications.create_index("created_at")


def init_document_audit_log_indexes():
    """Create indexes for the new document_audit_logs collection."""
    db = mongo.db
    db.document_audit_logs.create_index([("stage", 1), ("reference_number", 1)])
    db.document_audit_logs.create_index("document_id")
    db.document_audit_logs.create_index("performed_by")
    db.document_audit_logs.create_index("timestamp")