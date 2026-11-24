/* =====================================================================
   add-link.sql  (run ONCE, BEFORE you push the new API code)
   Adds 1 column to dbo.Games so each game can have an official website.
     Link = the address that opens when a visitor clicks the game card
            (https://...). NULL = the card is not clickable.

   HOW TO RUN in SSMS:
     1. Connect to your Azure SQL server as your ADMIN login.
        proxyz_app is not allowed to change tables - that's on purpose.
     2. Right-click itsmeproxyzDB -> New Query (dropdown must NOT say master).
     3. Press F5. Safe to run twice: it skips the column if it already exists.
   ===================================================================== */

IF COL_LENGTH('dbo.Games', 'Link') IS NULL
    ALTER TABLE dbo.Games ADD Link NVARCHAR(300) NULL;
GO

-- Check: the new column should be listed (max_length 600 = 300 characters)
SELECT name, TYPE_NAME(system_type_id) AS type, max_length
FROM sys.columns
WHERE object_id = OBJECT_ID('dbo.Games') AND name = 'Link';
