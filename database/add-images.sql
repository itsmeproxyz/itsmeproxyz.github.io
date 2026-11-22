/* =====================================================================
   add-images.sql  (run ONCE, BEFORE you push the new API code)
   Adds 2 columns to dbo.Games so each game can have an uploaded picture.
     Image          = the picture as a "data URL" text
                      (data:image/webp;base64,....). The website shrinks
                      the picture before upload, so it's usually 30-150 KB.
     ImageUpdatedAt = when the picture last changed. The website adds it
                      to the picture's address (?v=...) so browsers
                      download a fresh copy only when it really changed.

   HOW TO RUN in SSMS:
     1. Connect to proxyz.database.windows.net as your ADMIN (proxyzdb).
        proxyz_app is not allowed to change tables - that's on purpose.
     2. Right-click itsmeproxyzDB -> New Query (dropdown must NOT say master).
     3. Press F5. Safe to run twice: it skips columns that already exist.
   ===================================================================== */

IF COL_LENGTH('dbo.Games', 'Image') IS NULL
    ALTER TABLE dbo.Games ADD Image VARCHAR(MAX) NULL;
GO

IF COL_LENGTH('dbo.Games', 'ImageUpdatedAt') IS NULL
    ALTER TABLE dbo.Games ADD ImageUpdatedAt DATETIME2 NULL;
GO

-- Check: both new columns should be listed
SELECT name, TYPE_NAME(system_type_id) AS type, max_length
FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Games') AND name IN ('Image', 'ImageUpdatedAt');
