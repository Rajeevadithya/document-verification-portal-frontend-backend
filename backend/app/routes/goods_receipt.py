"""
Goods Receipt (GRN) Routes
============================
GET  /api/grn/                              – list all GRNs
GET  /api/grn/<grn_number>                  – get GRN details
GET  /api/grn/by-po/<po_number>             – get GRN linked to a PO
POST /api/grn/<grn_number>/documents/upload – upload GRN document (single)
PUT  /api/grn/<grn_number>/documents/<doc_id>/change – replace GRN doc
GET  /api/grn/<grn_number>/documents        – view active GRN document
GET  /api/grn/documents/<doc_id>/download   – download GRN document
"""
import os
from collections import OrderedDict
from flask import Blueprint, request, send_file
from datetime import datetime
from backend.app import mongo
from backend.app.utils.helpers import (
    serialize_doc, success_response, error_response, allowed_file, allowed_extensions_text
)
from backend.app.services.document_service import (
    save_document, change_document, delete_document, review_document, update_document_comment,
    get_active_documents, get_document_by_id, OCRValidationError
)

grn_bp = Blueprint("goods_receipt", __name__)


def _as_text(value):
    return "" if value is None else str(value)


def _extract_year(date_str):
    if date_str and len(str(date_str)) >= 4:
        try:
            return str(date_str)[:4]
        except Exception:
            pass
    return str(datetime.utcnow().year)


def _format_grn_response(grn_doc):
    serialized = serialize_doc(grn_doc)

    def reorder_item(item):
        ordered = OrderedDict()
        ordered["itemNumber"]          = _as_text(item.get("itemNumber", item.get("item_number", item.get("item", ""))))
        ordered["material"]            = item.get("material", "")
        ordered["materialDescription"] = item.get("materialDescription", "")
        ordered["quantity"]            = item.get("quantity", "")
        ordered["price"]               = item.get("price", "")
        ordered["amount"]              = item.get("amount", "")
        ordered["plant"]               = item.get("plant", "")
        ordered["purchaseOrder"]       = item.get("purchaseOrder", "")
        return ordered

    material_document_number = serialized.get("materialDocumentNumber", "")
    material_document_year = (
        serialized.get("materialDocumentYear")
        or _extract_year(serialized.get("documentDate", ""))
    )

    data = OrderedDict()
    data["materialDocumentNumber"] = material_document_number
    data["materialDocumentYear"]   = material_document_year
    data["documentDate"]           = serialized.get("documentDate", "")
    data["postingDate"]            = serialized.get("postingDate", "")
    data["items"]                  = [reorder_item(i) for i in serialized.get("items", [])]
    return data


# ── Ingest ────────────────────────────────────────────────────────────────────
@grn_bp.route("/ingest", methods=["POST"])
def ingest_grn():
    data = request.get_json()
    if not data:
        return error_response("No data received", 400)

    if isinstance(data, list):
        if not data:
            return error_response("Empty list received", 400)
        data = data[0]

    if not isinstance(data, dict):
        return error_response("Invalid payload: expected a JSON object", 400)

    po_number = data.get("purchaseOrderNumber") or data.get("purchaseOrder") or ""

    grn_number = (
        data.get("materialDocumentNumber")
        or data.get("goods_receipt_number")
        or ""
    )

    document_date = data.get("documentDate", "")
    material_document_year = (
        data.get("materialDocumentYear")
        or _extract_year(document_date)
    )

    items = []
    for item in data.get("items", []):
        qty   = float(item.get("quantity") or 0)
        price = float(item.get("price") or 0)
        items.append({
            "itemNumber":          item.get("itemNumber", ""),
            "material":            item.get("material", ""),
            "materialDescription": item.get("materialDescription", ""),
            "quantity":            qty,
            "price":               price,
            "amount":              round(float(item.get("amount") or qty * price), 2),
            "plant":               item.get("plant", ""),
            "purchaseOrder":       item.get("purchaseOrder") or item.get("purchaseOrderNumber") or po_number,
        })

    grn_doc = {
        "materialDocumentNumber": grn_number,
        "materialDocumentYear":   str(material_document_year),
        "documentDate":           document_date,
        "postingDate":            data.get("postingDate", ""),
        "items":                  items,
        "created_at":             datetime.utcnow(),
        "updated_at":             datetime.utcnow(),
    }

    if not grn_doc["materialDocumentNumber"]:
        return error_response("materialDocumentNumber is required", 400)

    mongo.db.goods_receipts.update_one(
        {"materialDocumentNumber": grn_doc["materialDocumentNumber"]},
        {"$set": grn_doc},
        upsert=True
    )
    return success_response(_format_grn_response(grn_doc), "GRN ingested")


# ── List all GRNs ─────────────────────────────────────────────────────────────
@grn_bp.route("/", methods=["GET"])
def list_grns():
    cursor = mongo.db.goods_receipts.find(
        {},
        {
            "materialDocumentNumber": 1, "materialDocumentYear": 1,
            "documentDate": 1, "postingDate": 1, "items": 1,
        }
    ).sort("materialDocumentNumber", 1)

    raw  = serialize_doc(list(cursor))
    data = [_format_grn_response(grn) for grn in raw]
    return success_response(data, "Goods Receipts fetched")


# ── Get GRN details ───────────────────────────────────────────────────────────
@grn_bp.route("/<grn_number>", methods=["GET"])
def get_grn(grn_number):
    grn = mongo.db.goods_receipts.find_one({"materialDocumentNumber": grn_number})
    if not grn:
        return error_response(f"GRN '{grn_number}' not found", 404)
    return success_response(_format_grn_response(grn), "GRN details fetched")


# ── Get GRN by PO ─────────────────────────────────────────────────────────────
@grn_bp.route("/by-po/<po_number>", methods=["GET"])
def get_grn_by_po(po_number):
    grn = mongo.db.goods_receipts.find_one({"items.purchaseOrder": po_number})
    if not grn:
        return error_response(f"No GRN found for PO '{po_number}'", 404)
    return success_response(_format_grn_response(grn), "GRN fetched for PO")


# ── Upload GRN document (single, auto-replace if exists) ──────────────────────
@grn_bp.route("/<grn_number>/documents/upload", methods=["POST"])
def upload_grn_document(grn_number):
    grn = mongo.db.goods_receipts.find_one({"materialDocumentNumber": grn_number})
    if not grn:
        return error_response(f"GRN '{grn_number}' not found", 404)

    if "file" not in request.files:
        return error_response("No file provided. Use key 'file'.", 400)

    f = request.files["file"]
    if f.filename == "" or not allowed_file(f.filename, "GRN"):
        return error_response(
            f"Invalid or unsupported file type. Allowed: {allowed_extensions_text('GRN')}",
            400,
        )

    existing = get_active_documents("GRN", grn_number)

    try:
        if existing:
            doc = change_document(existing[0]["_id"], f, "GRN", grn_number)
            mongo.db.notifications.update_many(
                {"type": "MISSING_DOCUMENT", "stage": "GRN", "reference_number": grn_number},
                {"$set": {"is_read": True}}
            )
            return success_response(doc, "GRN document replaced successfully")
        else:
            doc = save_document(f, "GRN", grn_number)
            mongo.db.notifications.update_many(
                {"type": "MISSING_DOCUMENT", "stage": "GRN", "reference_number": grn_number},
                {"$set": {"is_read": True}}
            )
            return success_response(doc, "GRN document uploaded successfully", 201)

    except OCRValidationError as e:
        return error_response(str(e), 422, errors={
            "ocr_status": e.ocr_result.get("ocr_status") if e.ocr_result else None,
            "ocr_rejection_detail": e.ocr_rejection_detail,
        })
    except ValueError as e:
        return error_response(str(e), 409)


# ── Change (replace) GRN document ────────────────────────────────────────────
@grn_bp.route("/<grn_number>/documents/<doc_id>/change", methods=["PUT"])
def change_grn_document(grn_number, doc_id):
    grn = mongo.db.goods_receipts.find_one({"materialDocumentNumber": grn_number})
    if not grn:
        return error_response(f"GRN '{grn_number}' not found", 404)

    if "file" not in request.files:
        return error_response("No replacement file provided. Use key 'file'.", 400)

    f = request.files["file"]
    if f.filename == "" or not allowed_file(f.filename, "GRN"):
        return error_response(
            f"Invalid or unsupported file type. Allowed: {allowed_extensions_text('GRN')}",
            400,
        )

    try:
        updated = change_document(doc_id, f, "GRN", grn_number)
        if not updated:
            return error_response(f"Document '{doc_id}' not found", 404)
        return success_response(updated, "GRN document replaced successfully")
    except OCRValidationError as e:
        return error_response(str(e), 422, errors={
            "ocr_status": e.ocr_result.get("ocr_status") if e.ocr_result else None,
            "ocr_rejection_detail": e.ocr_rejection_detail,
        })
    except ValueError as e:
        return error_response(str(e), 409)


# ── View active GRN documents ─────────────────────────────────────────────────
@grn_bp.route("/<grn_number>/documents", methods=["GET"])
def view_grn_documents(grn_number):
    grn = mongo.db.goods_receipts.find_one({"materialDocumentNumber": grn_number})
    if not grn:
        return error_response(f"GRN '{grn_number}' not found", 404)
    docs = get_active_documents("GRN", grn_number)
    return success_response(
        {"materialDocumentNumber": grn_number, "document": docs[0] if docs else None, "count": len(docs)},
        "Documents fetched",
    )


# ── Delete GRN document ───────────────────────────────────────────────────────
@grn_bp.route("/documents/<doc_id>", methods=["DELETE"])
def delete_grn_document(doc_id):
    doc = get_document_by_id(doc_id)
    if not doc or doc.get("stage") != "GRN":
        return error_response("Document not found", 404)
    deleted = delete_document(doc_id, stage="GRN", reference_number=doc.get("reference_number"))
    if not deleted:
        return error_response("Document not found", 404)
    return success_response(deleted, "GRN document deleted successfully")


# ── Download GRN document ─────────────────────────────────────────────────────
@grn_bp.route("/documents/<doc_id>/download", methods=["GET"])
def download_grn_document(doc_id):
    doc = get_document_by_id(doc_id)
    if not doc:
        return error_response("Document not found", 404)
    if not os.path.exists(doc["file_path"]):
        return error_response("File not found on server", 404)
    inline = request.args.get("inline", "false").lower() == "true"
    return send_file(
        doc["file_path"],
        mimetype=doc.get("mime_type", "application/octet-stream"),
        as_attachment=not inline,
        download_name=doc["original_filename"],
    )


@grn_bp.route("/<grn_number>/documents/<doc_id>/review", methods=["PUT"])
def review_grn_uploaded_document(grn_number, doc_id):
    grn = mongo.db.goods_receipts.find_one({"materialDocumentNumber": grn_number})
    if not grn:
        return error_response(f"GRN '{grn_number}' not found", 404)

    body = request.get_json(silent=True) or {}
    decision = (body.get("decision") or "").upper()
    comment = body.get("comment")
    reviewed_by = body.get("reviewed_by")

    doc = get_document_by_id(doc_id)
    if not doc or doc.get("stage") != "GRN" or doc.get("reference_number") != grn_number:
        return error_response("Document not found", 404)

    try:
        reviewed = review_document(doc_id, decision, comment=comment, reviewed_by=reviewed_by)
    except ValueError as e:
        return error_response(str(e), 400)

    return success_response(reviewed, f"GRN document {decision.lower()} successfully")


@grn_bp.route("/<grn_number>/documents/<doc_id>/comment", methods=["PUT"])
def comment_grn_uploaded_document(grn_number, doc_id):
    grn = mongo.db.goods_receipts.find_one({"materialDocumentNumber": grn_number})
    if not grn:
        return error_response(f"GRN '{grn_number}' not found", 404)

    body = request.get_json(silent=True) or {}
    comment = body.get("comment")
    commented_by = body.get("commented_by")

    doc = get_document_by_id(doc_id)
    if not doc or doc.get("stage") != "GRN" or doc.get("reference_number") != grn_number:
        return error_response("Document not found", 404)

    updated = update_document_comment(doc_id, comment=comment, commented_by=commented_by)
    return success_response(updated, "GRN document comment saved successfully")
