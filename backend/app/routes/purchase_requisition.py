"""
Purchase Requisition Routes
=============================
GET  /api/pr/                                    – list all PRs (summary)
GET  /api/pr/<pr_number>                         – get full PR details
POST /api/pr/<pr_number>/documents/upload        – upload multiple PR documents at once
PUT  /api/pr/<pr_number>/documents/<doc_id>/change – replace a PR document
GET  /api/pr/<pr_number>/documents               – view all active documents for a PR
GET  /api/pr/documents/<doc_id>/download         – download a specific document
GET  /api/pr/<pr_number>/documents/audit-logs    – full audit log for all PR documents
GET  /api/pr/documents/<doc_id>/audit-logs       – audit log for one specific document
"""
import os
from flask import Blueprint, request, send_file
from app import mongo
from app.utils.helpers import (
    serialize_doc, success_response, error_response, allowed_file
)
from app.services.document_service import (
    save_document, change_document, delete_document, get_active_documents,
    get_document_by_id, get_document_audit_logs
)

pr_bp = Blueprint("purchase_requisition", __name__)


# ── list all PRs ──────────────────────────────────────────────────────────────
@pr_bp.route("/", methods=["GET"])
def list_prs():
    cursor = mongo.db.purchase_requisitions.find(
        {}, {"pr_number": 1, "document_type": 1, "status": 1,
             "created_at": 1, "_id": 1}
    ).sort("pr_number", 1)
    data = serialize_doc(list(cursor))
    return success_response(data, "Purchase Requisitions fetched")


# ── get PR details ────────────────────────────────────────────────────────────
@pr_bp.route("/<pr_number>", methods=["GET"])
def get_pr(pr_number):
    pr = mongo.db.purchase_requisitions.find_one({"pr_number": pr_number})
    if not pr:
        return error_response(f"PR '{pr_number}' not found", 404)

    data = serialize_doc(pr)
    docs = get_active_documents("PR", pr_number)
    data["uploaded_documents_count"] = len(docs)
    data["has_documents"] = len(docs) > 0
    return success_response(data, "PR details fetched")


# ── upload multiple documents ─────────────────────────────────────────────────
@pr_bp.route("/<pr_number>/documents/upload", methods=["POST"])
def upload_pr_document(pr_number):
    """
    Accepts one or more files under the key 'files' (multipart/form-data).
    Also accepts a single file under 'file' for backward compatibility.
    Optionally pass 'uploaded_by' as a form field to record who is uploading.

    Duplicate files (identical content already uploaded for this PR) are
    REJECTED with a clear explanation — both within the same batch and
    against previously stored documents.

    Example (multi-file):
        curl -X POST .../api/pr/PR-1001/documents/upload \
             -F "files=@doc1.pdf" -F "files=@doc2.pdf" \
             -F "uploaded_by=john.doe"
    """
    pr = mongo.db.purchase_requisitions.find_one({"pr_number": pr_number})
    if not pr:
        return error_response(f"PR '{pr_number}' not found", 404)

    # Collect files
    files = request.files.getlist("files")
    if not files:
        single = request.files.get("file")
        if single:
            files = [single]

    if not files or all(f.filename == "" for f in files):
        return error_response(
            "No file(s) provided. "
            "Send one or more files under the form key 'files' "
            "(or 'file' for a single file).",
            400
        )

    uploaded = []
    errors = []
    # Track hashes seen within THIS batch to catch same-request duplicates
    seen_hashes_this_batch = {}

    for f in files:
        if not f or f.filename == "":
            continue

        if not allowed_file(f.filename):
            errors.append({
                "filename": f.filename,
                "reason": "INVALID_TYPE",
                "error": "File type not allowed. Accepted: pdf, png, jpg, jpeg, tiff, bmp"
            })
            continue

        # Check for duplicate within the same batch before hitting the DB
        from app.services.document_service import _compute_hash
        batch_hash = _compute_hash(f)
        if batch_hash in seen_hashes_this_batch:
            errors.append({
                "filename": f.filename,
                "reason": "DUPLICATE_IN_BATCH",
                "error": (
                    f"This file has identical content to '{seen_hashes_this_batch[batch_hash]}' "
                    f"which was already included in this upload batch. "
                    f"Duplicate files in the same request are not allowed."
                )
            })
            continue

        seen_hashes_this_batch[batch_hash] = f.filename

        try:
            doc = save_document(f, "PR", pr_number)
            uploaded.append({
                "document_id":          doc["_id"],
                "original_filename":    doc["original_filename"],
                "stored_filename":      doc["filename"],
                "file_size_bytes":      doc["file_size"],
                "mime_type":            doc["mime_type"],
                "ocr_status":           doc["ocr_status"],
                "ocr_rejection_detail": doc.get("ocr_rejection_detail"),
                "version":              doc["version"],
                "uploaded_by":          doc["uploaded_by"],
                "uploaded_at":          doc["uploaded_at"]
            })
        except ValueError as dup_exc:
            # Duplicate detected against existing DB records
            errors.append({
                "filename": f.filename,
                "reason": "DUPLICATE_FILE",
                "error": str(dup_exc)
            })
        except Exception as exc:
            errors.append({
                "filename": f.filename,
                "reason": "UPLOAD_ERROR",
                "error": str(exc)
            })

    # Clear "missing document" notifications if at least one file was accepted
    if uploaded:
        mongo.db.notifications.update_many(
            {"type": "MISSING_DOCUMENT", "stage": "PR", "reference_number": pr_number},
            {"$set": {"is_read": True}}
        )

    response_data = {
        "pr_number":      pr_number,
        "uploaded":       uploaded,
        "uploaded_count": len(uploaded),
        "errors":         errors,
        "error_count":    len(errors)
    }

    if not uploaded:
        return error_response("No files were uploaded successfully", 400, errors)

    return success_response(
        response_data,
        f"{len(uploaded)} document(s) uploaded successfully"
        + (f"; {len(errors)} rejected" if errors else ""),
        201
    )


# ── change (replace) a specific document ─────────────────────────────────────
@pr_bp.route("/<pr_number>/documents/<doc_id>/change", methods=["PUT"])
def change_pr_document(pr_number, doc_id):
    pr = mongo.db.purchase_requisitions.find_one({"pr_number": pr_number})
    if not pr:
        return error_response(f"PR '{pr_number}' not found", 404)

    if "file" not in request.files:
        return error_response("No replacement file provided. Use key 'file'.", 400)

    f = request.files["file"]
    if f.filename == "":
        return error_response("No file selected", 400)
    if not allowed_file(f.filename):
        return error_response("File type not allowed", 400)

    try:
        updated_doc = change_document(doc_id, f, "PR", pr_number)
    except ValueError as dup_exc:
        return error_response(str(dup_exc), 409)

    if not updated_doc:
        return error_response(f"Document '{doc_id}' not found", 404)

    return success_response(updated_doc, "Document replaced successfully")


# ── view all active documents ─────────────────────────────────────────────────
@pr_bp.route("/<pr_number>/documents", methods=["GET"])
def view_pr_documents(pr_number):
    pr = mongo.db.purchase_requisitions.find_one({"pr_number": pr_number})
    if not pr:
        return error_response(f"PR '{pr_number}' not found", 404)

    docs = get_active_documents("PR", pr_number)
    return success_response(
        {"pr_number": pr_number, "documents": docs, "count": len(docs)},
        "Documents fetched"
    )


@pr_bp.route("/documents/<doc_id>", methods=["DELETE"])
def delete_pr_document(doc_id):
    doc = get_document_by_id(doc_id)
    if not doc or doc.get("stage") != "PR":
        return error_response("Document not found", 404)

    deleted = delete_document(doc_id, stage="PR", reference_number=doc.get("reference_number"))
    if not deleted:
        return error_response("Document not found", 404)

    return success_response(deleted, "Document deleted successfully")
# ── download document ─────────────────────────────────────────────────────────
@pr_bp.route("/documents/<doc_id>/download", methods=["GET"])
def download_pr_document(doc_id):
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
        download_name=doc["original_filename"]
    )


# ── audit logs for all documents under a PR ───────────────────────────────────
@pr_bp.route("/<pr_number>/documents/audit-logs", methods=["GET"])
def pr_document_audit_logs(pr_number):
    pr = mongo.db.purchase_requisitions.find_one({"pr_number": pr_number})
    if not pr:
        return error_response(f"PR '{pr_number}' not found", 404)

    logs = get_document_audit_logs(stage="PR", reference_number=pr_number)
    return success_response(
        {"pr_number": pr_number, "audit_logs": logs, "count": len(logs)},
        "Audit logs fetched"
    )


# ── audit log for one specific document ──────────────────────────────────────
@pr_bp.route("/documents/<doc_id>/audit-logs", methods=["GET"])
def document_audit_log(doc_id):
    doc = get_document_by_id(doc_id)
    if not doc:
        return error_response("Document not found", 404)

    logs = get_document_audit_logs(document_id=doc_id)
    return success_response(
        {"document_id": doc_id, "audit_logs": logs, "count": len(logs)},
        "Document audit logs fetched"
    )