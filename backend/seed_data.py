"""
Seed script – populates MongoDB with realistic demo data for MNC PoC.
Run:  python seed_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app import create_app, mongo
from datetime import datetime, timedelta

app = create_app()

PR_DATA = [
    {
        "pr_number": "PR-1001",
        "document_type": "Standard",
        "status": "OPEN",
        "created_at": datetime.utcnow() - timedelta(days=10),
        "updated_at": datetime.utcnow(),
        "items": [
            {
                "item_number": "00010",
                "material": "RAW-STEEL-001",
                "unit_of_measure": "KG",
                "quantity": 500.0,
                "valuation_price": 85000.00,
                "delivery_date": "2025-08-15",
                "plant": "PL01",
                "storage_location": "SL01",
                "purchase_group": "PG01"
            },
            {
                "item_number": "00020",
                "material": "RAW-COPPER-002",
                "unit_of_measure": "KG",
                "quantity": 200.0,
                "valuation_price": 142000.00,
                "delivery_date": "2025-08-20",
                "plant": "PL01",
                "storage_location": "SL02",
                "purchase_group": "PG01"
            }
        ]
    },
    {
        "pr_number": "PR-1002",
        "document_type": "Service",
        "status": "IN_PROGRESS",
        "created_at": datetime.utcnow() - timedelta(days=7),
        "updated_at": datetime.utcnow(),
        "items": [
            {
                "item_number": "00010",
                "material": "SVC-MAINT-003",
                "unit_of_measure": "EA",
                "quantity": 1.0,
                "valuation_price": 250000.00,
                "delivery_date": "2025-09-01",
                "plant": "PL02",
                "storage_location": "SL03",
                "purchase_group": "PG02"
            }
        ]
    },
    {
        "pr_number": "PR-1003",
        "document_type": "Standard",
        "status": "OPEN",
        "created_at": datetime.utcnow() - timedelta(days=3),
        "updated_at": datetime.utcnow(),
        "items": [
            {
                "item_number": "00010",
                "material": "ELEC-MOTOR-007",
                "unit_of_measure": "EA",
                "quantity": 10.0,
                "valuation_price": 320000.00,
                "delivery_date": "2025-09-10",
                "plant": "PL01",
                "storage_location": "SL01",
                "purchase_group": "PG03"
            }
        ]
    }
]

PO_DATA = [
    {
        "po_number": "PO-2001",
        "pr_number": "PR-1001",
        "document_type": "Standard PO",
        "purchase_organization": "POrg-IN01",
        "purchase_group": "PG01",
        "company_code": "CC-1000",
        "vendor": "Tata Steel Pvt Ltd",
        "status": "OPEN",
        "created_at": datetime.utcnow() - timedelta(days=8),
        "updated_at": datetime.utcnow(),
        "items": [
            {
                "item_number": "00010",
                "material": "RAW-STEEL-001",
                "quantity": 500.0,
                "net_price": 83000.00,
                "delivery_date": "2025-08-15",
                "plant": "PL01",
                "storage_location": "SL01"
            },
            {
                "item_number": "00020",
                "material": "RAW-COPPER-002",
                "quantity": 200.0,
                "net_price": 140000.00,
                "delivery_date": "2025-08-20",
                "plant": "PL01",
                "storage_location": "SL02"
            }
        ]
    },
    {
        "po_number": "PO-2002",
        "pr_number": "PR-1002",
        "document_type": "Service PO",
        "purchase_organization": "POrg-IN01",
        "purchase_group": "PG02",
        "company_code": "CC-1000",
        "vendor": "Siemens India Ltd",
        "status": "IN_PROGRESS",
        "created_at": datetime.utcnow() - timedelta(days=5),
        "updated_at": datetime.utcnow(),
        "items": [
            {
                "item_number": "00010",
                "material": "SVC-MAINT-003",
                "quantity": 1.0,
                "net_price": 248000.00,
                "delivery_date": "2025-09-01",
                "plant": "PL02",
                "storage_location": "SL03"
            }
        ]
    },
    {
        "po_number": "PO-2003",
        "pr_number": "PR-1003",
        "document_type": "Standard PO",
        "purchase_organization": "POrg-IN02",
        "purchase_group": "PG03",
        "company_code": "CC-2000",
        "vendor": "ABB India Pvt Ltd",
        "status": "OPEN",
        "created_at": datetime.utcnow() - timedelta(days=2),
        "updated_at": datetime.utcnow(),
        "items": [
            {
                "item_number": "00010",
                "material": "ELEC-MOTOR-007",
                "quantity": 10.0,
                "net_price": 315000.00,
                "delivery_date": "2025-09-10",
                "plant": "PL01",
                "storage_location": "SL01"
            }
        ]
    }
]

GRN_DATA = [
    {
        "grn_number": "GRN-3001",
        "po_number": "PO-2001",
        "document_date": "2025-07-20",
        "posting_date": "2025-07-21",
        "status": "POSTED",
        "created_at": datetime.utcnow() - timedelta(days=5),
        "updated_at": datetime.utcnow(),
        "items": [
            {
                "item": "0001",
                "material": "RAW-STEEL-001",
                "unit_of_measure": "KG",
                "quantity": 500.0,
                "entry_unit": "KG",
                "plant": "PL01",
                "storage_location": "SL01",
                "price": 83000.00
            },
            {
                "item": "0002",
                "material": "RAW-COPPER-002",
                "unit_of_measure": "KG",
                "quantity": 200.0,
                "entry_unit": "KG",
                "plant": "PL01",
                "storage_location": "SL02",
                "price": 140000.00
            }
        ]
    },
    {
        "grn_number": "GRN-3002",
        "po_number": "PO-2002",
        "document_date": "2025-07-25",
        "posting_date": "2025-07-25",
        "status": "POSTED",
        "created_at": datetime.utcnow() - timedelta(days=3),
        "updated_at": datetime.utcnow(),
        "items": [
            {
                "item": "0001",
                "material": "SVC-MAINT-003",
                "unit_of_measure": "EA",
                "quantity": 1.0,
                "entry_unit": "EA",
                "plant": "PL02",
                "storage_location": "SL03",
                "price": 248000.00
            }
        ]
    }
]

INV_DATA = [
    {
        "invoice_number": "INV-4001",
        "pr_number": "PR-1001",
        "po_number": "PO-2001",
        "grn_number": "GRN-3001",
        "status": "PENDING",
        "miro_redirect_url": "https://sap-miro.example.com/miro?ref=INV-4001",
        "created_at": datetime.utcnow() - timedelta(days=2),
        "updated_at": datetime.utcnow()
    },
    {
        "invoice_number": "INV-4002",
        "pr_number": "PR-1002",
        "po_number": "PO-2002",
        "grn_number": "GRN-3002",
        "status": "PENDING",
        "miro_redirect_url": "https://sap-miro.example.com/miro?ref=INV-4002",
        "created_at": datetime.utcnow() - timedelta(days=1),
        "updated_at": datetime.utcnow()
    }
]

NOTIF_DATA = [
    {
        "type": "MISSING_DOCUMENT",
        "stage": "PR",
        "reference_number": "PR-1002",
        "message": "PR document not uploaded for PR-1002",
        "action_label": "Upload Now",
        "action_route": "/document-uploads/pr/upload?pr=PR-1002",
        "is_read": False,
        "created_at": datetime.utcnow() - timedelta(hours=2)
    },
    {
        "type": "MISSING_DOCUMENT",
        "stage": "PR",
        "reference_number": "PR-1003",
        "message": "PR document not uploaded for PR-1003",
        "action_label": "Upload Now",
        "action_route": "/document-uploads/pr/upload?pr=PR-1003",
        "is_read": False,
        "created_at": datetime.utcnow() - timedelta(hours=1)
    },
    {
        "type": "MISSING_DOCUMENT",
        "stage": "PO",
        "reference_number": "PO-2003",
        "message": "PO document not uploaded for PO-2003",
        "action_label": "Upload Now",
        "action_route": "/document-uploads/po/upload?po=PO-2003",
        "is_read": False,
        "created_at": datetime.utcnow() - timedelta(minutes=30)
    }
]

def seed():
    with app.app_context():
        db = mongo.db

        # Clear existing
        for col in ["purchase_requisitions","purchase_orders","goods_receipts",
                    "invoice_verifications","documents","notifications"]:
            db[col].drop()
            print(f"Dropped collection: {col}")

        db.purchase_requisitions.insert_many(PR_DATA)
        print(f"Seeded {len(PR_DATA)} Purchase Requisitions")

        db.purchase_orders.insert_many(PO_DATA)
        print(f"Seeded {len(PO_DATA)} Purchase Orders")

        db.goods_receipts.insert_many(GRN_DATA)
        print(f"Seeded {len(GRN_DATA)} Goods Receipts")

        db.invoice_verifications.insert_many(INV_DATA)
        print(f"Seeded {len(INV_DATA)} Invoice Verifications")

        db.notifications.insert_many(NOTIF_DATA)
        print(f"Seeded {len(NOTIF_DATA)} Notifications")

        # Create indexes
        db.purchase_requisitions.create_index("pr_number", unique=True)
        db.purchase_orders.create_index("po_number", unique=True)
        db.goods_receipts.create_index("grn_number", unique=True)
        db.invoice_verifications.create_index("invoice_number", unique=True)
        db.purchase_orders.create_index("pr_number")
        db.goods_receipts.create_index("po_number")
        db.documents.create_index([("stage", 1), ("reference_number", 1)])
        db.notifications.create_index([("is_read", 1), ("created_at", -1)])
        print("Indexes created.")
        print("\n✅ Seed completed successfully.")

if __name__ == "__main__":
    seed()
