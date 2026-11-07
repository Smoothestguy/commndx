# Kiosk rules
- Pending actions derive location from the kiosk token and person from an expiring post-punch proof; never accept a caller-selected person for historical reads or writes.
- Historical signatures use private immutable uploads and fulfill date-scoped requests; worker checkout corrections require confirmation and review, never forge supervisor approval.
- Pending writes check existing sheet/week/invoice locks; no atomic multi-request lock guarantee is claimed.