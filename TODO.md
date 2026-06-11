# TODO — ToolCustody / Abu Amjad

## Done
- [x] `parser.js` — منطق مشترك
- [x] `dashboard.html` — KPI + alerts + lookup + CSV
- [x] `damage.html` — واجهة + `getDamage` API
- [x] `config.js` — theme + settings + API
- [x] `Code.gs` كامل مع `getDamage`
- [x] روابط Damage من index + dashboard
- [x] `sync_to_github.py`
- [x] `.gitignore` للـ secrets

## Backend (أنت)
- [ ] انسخ `Code.gs.txt` → Google Apps Script
- [ ] Deploy → **New version** → Anyone
- [ ] أضف تبويب **Damage** بالشيت الرئيسي:
  - A: Date | B: Code | C: Name | D: Image URL | E: Damaged By | F: Count | G: Remark
- [ ] إذا شيت B مختلف: Script Property `B_SHEET_ID`

## Next features
- [ ] End-of-day PDF report
- [ ] PWA (install on phone/scanner)
- [ ] Arabic UI toggle
- [ ] QR code generator page
- [ ] Settings panel filters on dashboard (warnings only)
