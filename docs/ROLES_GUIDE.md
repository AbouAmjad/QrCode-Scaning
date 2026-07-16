# Roles guide — موظف / مهندس / أدمن

## Login redirect

| Role | Arabic | Sees | Home page |
|------|--------|------|-----------|
| `employee` | موظف | Terminal · Not returned · Receiving · Damage | `index.html` |
| `engineer` | مهندس | Inventory · Store request · Overview · Search · Alerts | `inventory.html` |
| `admin` | أدمن | **Everything** | `dashboard.html` |

## Inventory formula

```text
Available = Received (Receiving) − Damaged − (Out | Issued)
```

- **Tools:** Out = currently with workers  
- **Consumables:** Issued = OUT scans of C/B codes  
- **Damage:** subtracts from available quantity  

## Credentials sheet (on main/ops spreadsheet)

Tab name: **`Credentials`**

| A User | B Pass | C Role |
|--------|--------|--------|
| staff1 | **** | employee |
| eng1 | **** | engineer |
| abouamjad | **** | admin |

Also: Script Property `APP_ROLE=admin` for the main `APP_USER`.

## Deploy

1. Paste updated `Code.gs.txt` into Apps Script → **New version**.  
2. Create Credentials rows for employee + engineer.  
3. Hard-refresh GitHub Pages (SW v6).
