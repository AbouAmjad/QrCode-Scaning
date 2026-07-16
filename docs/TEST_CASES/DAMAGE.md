# Test Cases — Damage

## Related documents
- [WORKFLOWS/DAMAGE_REPORT.md](../WORKFLOWS/DAMAGE_REPORT.md)
- [API_REFERENCE.md](../API_REFERENCE.md)
- [SECURITY_POLICY.md](../SECURITY_POLICY.md)

## Scope
Validate damage submit/list flows on `damage.html` including photo paths.

| ID | Steps | Expected |
|----|-------|----------|
| G1 | Submit without photo | Success message; Damage sheet row |
| G2 | Submit with photo | Success or remark notes photo failure gracefully |
| G3 | Person not starting with P | Client validation error |
| G4 | Tool bad prefix | Client validation error |
| G5 | Load by date | List + KPIs |
| G6 | Deny camera permission | Gallery/file fallback still usable |
| G7 | Open Take photo | Camera modal or device capture path |

