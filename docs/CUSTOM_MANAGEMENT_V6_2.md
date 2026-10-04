# V6.2 Custom Jersey Management

## Customer
- Custom request requires login.
- Submission creates a real database record.
- Customer can see custom request history on Account.
- Customer can track:
  consultation -> designing -> revision -> approved -> PO -> production -> completed

## Admin
- Custom request list comes from MySQL.
- Admin can change status inline.
- Admin can open request detail.
- Detail includes team, PIC, WhatsApp, team size, brief, reference filename, and workflow timeline.

## Note on reference image
The current MVP stores the uploaded reference file name only in the database. The browser can still preview the selected image before submission.
Actual persistent image upload/storage is intentionally reserved for the next image-storage phase.
