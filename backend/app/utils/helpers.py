import os
from bson import ObjectId
from datetime import datetime
from flask import current_app
import re

ALLOWED_EXTENSIONS = {"pdf", "png", "jpg", "jpeg", "tiff", "bmp"}

def allowed_file(filename: str) -> bool:
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS

def serialize_doc(doc: dict) -> dict:
    """Recursively convert ObjectId and datetime to JSON-serializable types."""
    if doc is None:
        return None
    if isinstance(doc, list):
        return [serialize_doc(d) for d in doc]
    if isinstance(doc, dict):
        return {k: serialize_doc(v) for k, v in doc.items()}
    if isinstance(doc, ObjectId):
        return str(doc)
    if isinstance(doc, datetime):
        return doc.isoformat()
    return doc

def success_response(data=None, message="Success", status_code=200):
    resp = {"success": True, "message": message}
    if data is not None:
        resp["data"] = data
    return resp, status_code

def error_response(message="Error", status_code=400, errors=None):
    resp = {"success": False, "message": message}
    if errors:
        resp["errors"] = errors
    return resp, status_code

def safe_filename(stage: str, ref_number: str, original: str) -> str:
    """Build a safe stored filename preserving the extension."""
    ext = original.rsplit(".", 1)[-1].lower() if "." in original else "bin"
    ts = datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
    clean_ref = re.sub(r"[^A-Za-z0-9\-]", "", ref_number)
    return f"{stage}_{clean_ref}_{ts}.{ext}"

def get_upload_path(stage: str) -> str:
    folder_map = {"PR": "pr", "PO": "po", "GRN": "grn", "INVOICE": "invoice"}
    sub = folder_map.get(stage.upper(), "misc")
    path = os.path.join(current_app.config["UPLOAD_FOLDER"], sub)
    os.makedirs(path, exist_ok=True)
    return path
