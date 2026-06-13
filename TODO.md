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
- [ ] انسخ `Code.gs.example` → Google Apps Script (أضف `submitDamage` + sheet ID)
- [ ] Deploy → **New version** → Anyone
- [ ] Damage sheet ID: `17nQDnJogZapc8W5RHU8HN8hoSHg_ctym8H37tQWpw68`
- [ ] تبويب **Damage**: A=Date B=Code C=Name D=ImageURL E=DamagedBy F=Count G=Remark
- [ ] (اختياري) Script Property `DAMAGE_DRIVE_FOLDER_ID` لمجلد صور Drive
- [ ] إذا شيت B مختلف: Script Property `B_SHEET_ID`

## Next features
- [ ] End-of-day PDF report
- [ ] PWA (install on phone/scanner)
- [ ] Arabic UI toggle
- [ ] QR code generator page
- [ ] Settings panel filters on dashboard (warnings only)
