# Asset rules
- Read asset catalog/placements through authenticated role-aware projections; keep base financial rows manager/admin-only to protect costs beyond presentation gates.
- Append custody history separately from placement periods; lifecycle triggers release current responsibility without splitting customer billable days.- Asset allocated cost/day is derived on read from asset cost inputs via `src/lib/assetCost.ts` (never stored); cost fields travel only in the manager/admin block of the catalog projection.
