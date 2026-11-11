# Shop Sales & Inventory (Google Sheets + Apps Script)

> **Synthetic sample data.** Every product, customer, sale and invoice in this project is generated
> by code for demonstration. No real business or person is represented.

A complete sales and stock system for a small shop, built on Google Sheets and Apps Script.
The whole workbook (sheets, formulas, validation, protection, charts, and sample data) is created
from code, versioned in Git, and deployed with [clasp](https://github.com/google/clasp).

## What it does

| Sheet | Purpose |
|---|---|
| **Dashboard** | Revenue, orders, average order value, units sold, gross margin, low-stock count, top product. Charts: monthly revenue, revenue by category, top 10 products. |
| **Sales** | Date, invoice no, SKU (dropdown), product (auto), qty, unit price (auto), total (auto), customer, source. |
| **Products** | SKU, name, category, unit cost, price, reorder level. |
| **Inventory** | Opening stock + purchases - sold = on hand. Status: **OK / LOW / OUT** (color-coded). |
| **Import** | Paste raw rows here to clean and import them. |
| **Import_Log** | Every import: summary plus each rejected or duplicate row with its reason. |
| **Settings** | Shop name, owner email, alert hour, currency, weekly summary day. |

**Shop Tools menu**
- **Import & clean CSV**: pick a CSV on your computer (read in the browser, no Drive access) or paste rows into the Import sheet. Cleaning:
  trims spaces, unifies case, parses mixed date formats, converts Arabic-Indic digits, drops exact duplicates,
  skips rows already in Sales, rejects invalid rows into Import_Log with the reason, and shows a summary.
- **Generate invoice PDF** for the selected sale: fills a template sheet and saves the PDF to a Drive folder.
- **Refresh dashboard**
- **Automation**: install/remove time triggers; send the alert or summary now.
  - Daily low-stock email (only when something is LOW or OUT).
  - Weekly summary email (KPIs + link to the sheet).

## Screenshots

_Coming soon: dashboard, import summary dialog, Import_Log, invoice PDF, alert email._

## How it is built

```
src/
  appsscript.json     V8, Africa/Cairo, explicit minimal OAuth scopes
  lib/                PURE business logic - no Google services; tested in Node
    Clean.js Csv.js Dates.js Util.js Inventory.js Kpi.js Invoice.js Settings.js Emails.js Seed.js Config.js
  services/           thin Apps Script wrappers (read/write sheets, Drive, Mail, triggers)
    Setup.js SheetIO.js Import.js Invoice.js Dashboard.js Alerts.js Triggers.js Menu.js
  ui/ImportDialog.html
tests/                node:test suites; src/lib is loaded into a vm context (Apps Script has no modules)
samples/messy_sales.csv   deliberately messy CSV for the import demo
scripts/secret-scan.sh    run before every commit
```

- **Pure core, thin shell.** All rules (cleaning, dates, stock status, KPIs, invoice numbers, email text)
  live in `src/lib` and are unit-tested. `src/services` only moves data between sheets and those functions.
- **Deterministic seed.** `setupWorkbook()` always generates the same 40 products and 1,500 sales lines
  over 6 months, with a few products deliberately LOW/OUT so the alerts have something to show.
- **Prices are frozen at sale time.** Unit price is copied into the sale row (not a live lookup),
  so changing a product price does not rewrite past sales.
- **Formula injection guard.** Imported text starting with `= + - @` is stored as plain text.

### OAuth scopes (minimal)

| Scope | Why |
|---|---|
| `spreadsheets.currentonly` | Read/write only the spreadsheet this script is bound to. |
| `script.container.ui` | Menu, dialogs, alerts. |
| `script.scriptapp` | Install/remove the time triggers. |
| `script.send_mail` | Send the alert and summary emails (sending only, no inbox access). |
| `drive.file` | Create the invoice folder and PDFs. Access is limited to files this script created. |

CSV import needs **no Drive scope**: the file is read in the browser and only its text is sent to the script.

## Run the tests

Requires Node.js 20+.

```bash
npm test          # TZ=Africa/Cairo node --test "tests/**/*.test.js"
npm run scan      # secret scan (gitleaks if installed, grep fallback)
```

## Deploy with clasp

```bash
npm install -g @google/clasp
clasp login                                   # personal Google account
clasp create --type sheets --title "Shop Sales & Inventory (synthetic sample data)" --rootDir src
clasp push
```

Then open the new spreadsheet, go to **Extensions > Apps Script**, run `setupWorkbook` once,
and approve the permissions. Reload the spreadsheet to see the **Shop Tools** menu.
Set a real **Owner email** in Settings before installing triggers.

`.clasp.json` (your script ID) is git-ignored; see `.clasp.json.example`.

## Status

- [x] Phase A: logic, tests, Apps Script code
- [ ] Phase B: create the bound project, push, verify in Google Sheets
  - verify the single-sheet PDF export (`exportSheetAsPdf_` in `src/services/Invoice.js`)
  - verify `DriveApp` folder/file creation under `drive.file`
- [ ] Screenshots

## License

MIT
