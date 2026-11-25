-- Relax legacy NOT NULL constraints/defaults from the initial scaffold so
-- Shawn's inserts (which omit legacy columns) succeed.
ALTER TABLE jobs ALTER COLUMN workbook_id DROP NOT NULL;
ALTER TABLE jobs ALTER COLUMN workbook_id DROP DEFAULT;

ALTER TABLE access_requests ALTER COLUMN workbook_id DROP NOT NULL;
ALTER TABLE access_requests ALTER COLUMN workbook_id DROP DEFAULT;
ALTER TABLE access_requests ALTER COLUMN requester_id DROP NOT NULL;
ALTER TABLE access_requests ALTER COLUMN requester_id DROP DEFAULT;

ALTER TABLE workbooks ALTER COLUMN owner_email DROP NOT NULL;
