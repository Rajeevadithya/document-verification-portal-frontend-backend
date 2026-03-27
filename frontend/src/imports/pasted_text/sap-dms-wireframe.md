Design a **complete SAP Fiori-style desktop application wireframe** for an enterprise **Document Management System (DMS)** used in procurement workflows.

The design must strictly follow **SAP Fiori UX principles**, especially:

* Value Help (F4) inputs
* Filter Bar
* Table-heavy layouts
* Enterprise density (compact, data-first UI)
* Minimal modern UI (avoid cards unless necessary)

This is a **static high-fidelity wireframe** with **realistic interactions simulated using dummy SAP-like data**.

---

## 🎯 GLOBAL LAYOUT (ALL SCREENS)

1. **Top Header (SAP Style)**

* Left: Application Title (Document Management System)
* Right:

  * Notification Bell Icon (with count badge)
  * User Profile Avatar + Dropdown

2. **Left Sidebar Navigation**
   Menu items:

* Dashboard
* Document Uploads
* Approval Dashboard
* Reports

Active menu should be highlighted (SAP style)

3. **Content Area**

* Clean layout
* Section headers
* Breadcrumb (optional)

---

## 📊 DASHBOARD PAGE

1. KPI Cards (Minimal SAP style, not modern cards)

* Total PR Documents
* Total PO Documents
* Pending Approvals
* Missing Documents

2. Summary Table
   Columns:

* Document Type
* Total
* Uploaded
* Pending
* Missing

3. Chatbot Panel (Right side)

* Input field: "Ask about documents..."
* Static suggestions:

  * "Show missing PR documents"
  * "Pending approvals"
* Chat UI (static responses)

---

## 📂 DOCUMENT UPLOADS MODULE

Main Tabs:

* Purchase Requisition (PR)
* Purchase Orders (PO)
* GRN
* Invoice Verification

Each main tab contains Sub-tabs:

* Upload Document
* Change Document
* View Document

---

## 🔍 FILTER BAR (MANDATORY - SAP FIORI STYLE)

At top of every tab:

Include:

* Value Help Fields:

  * PR Number / PO Number / GRN Number
* Dropdown Filters:

  * Plant
  * Vendor
  * Date Range
* Buttons:

  * Search (Primary SAP blue)
  * Clear

Filters must visually affect table data

---

## 🔎 VALUE HELP (F4) FIELDS (VERY IMPORTANT)

All document number inputs MUST use SAP Value Help pattern:

Each field:

* Input box
* Value help icon (🔍)

On click:

* Open dialog with:

  * Search bar
  * Filter options
  * Table of values

Dummy Data:

PR:

* PR1001, PR1002, PR1003

PO:

* PO2001, PO2002

GRN:

* GR3001, GR3002

Behavior:

* Selecting a value auto-fills input
* Triggers table data population below

---

## 📊 SAP-STYLE TABLES (CRITICAL)

Tables must replicate **SAP Fiori Grid Table** style:

Features:

* Dense layout (compact rows)
* Column headers (bold)
* Row selection checkboxes
* Sorting indicators
* Column filter icons
* Horizontal grid lines
* Pagination or scroll
* No card UI

Example Columns (PR Table):

* PR Number
* Item
* Material
* Description
* Quantity
* Unit
* Plant
* Status

Example Data Row:
PR1001 | 10 | Steel Rod | Industrial Steel | 100 | EA | 1000 | Open

---

## 📁 DOCUMENT TABLES (UPLOAD / VIEW)

Always use TABLE format (not forms)

PR:

* Multiple documents allowed

PO / GRN / Invoice:

* Single document

Columns:

* File Name
* Document Number
* Upload Date
* Uploaded By
* Actions (View / Download icons)

---

## 📤 UPLOAD DOCUMENT (SUB-TAB)

Components:

* Value Help Field (Document Number)
* Drag & Drop Upload Area
* Upload Button

After upload:

* Show entry in table below

---

## ✏️ CHANGE DOCUMENT (SUB-TAB)

* Table showing existing documents
* Actions:

  * Replace
  * Delete

---

## 👁️ VIEW DOCUMENT (SUB-TAB)

* Table of uploaded documents
* Actions:

  * View
  * Download

---

## 🧠 OCR VALIDATION PANEL

Display validation results:

Fields:

* Document Type → Valid / Invalid
* Document Number Detected → Yes / No
* PR/PO Matching → Yes / No

Use:

* Green indicators → Valid
* Red indicators → Invalid

---

## 🔔 NOTIFICATIONS PANEL

Bell icon (top right):

Dropdown items:

* "PR1001 document missing"
* "PO2002 pending approval"

Click behavior:

* Visual navigation hint (no real routing needed)

---

## ✅ APPROVAL DASHBOARD

Table Columns:

* Document Number
* Type
* Submitted By
* Date
* Status
* Actions

Actions:

* Approve (green button)
* Reject (red button)

---

## 📈 REPORTS PAGE

Filters:

* Date Range
* Document Type

Display:

* Table summary
* Optional simple charts (minimal SAP style)

---

## 🎨 DESIGN GUIDELINES

* Follow SAP Fiori:

  * Clean, structured layout
  * No excessive colors
  * Blue primary actions
  * Neutral backgrounds
* Typography:

  * Clear hierarchy
* Spacing:

  * Compact (enterprise style)

---

## 🚫 STRICT RULES

* DO NOT use modern card-heavy UI
* DO NOT design mobile screens
* DO NOT skip tables
* DO NOT skip value help dialogs
* EVERYTHING must look like SAP application

---

## 🎯 FINAL OUTPUT EXPECTATION

* Fully structured enterprise UI
* All pages connected logically
* Realistic SAP-like behavior simulation
* Tables and filters dominate the interface

This design should look like a **real SAP production application mockup**, not a generic UI.
