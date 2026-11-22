/* =====================================================================
   azure-create-user.sql  (Azure SQL Database ONLY)
   Azure SQL doesn't support "USE proxyz", and logins work differently
   from your local SQL Server. So instead of create-login.sql, run this.

   HOW TO RUN in SSMS:
     1. Connect to  <your-server>.database.windows.net  with the server
        admin login you made in the Azure portal.
     2. In Object Explorer, right-click the "proxyz" database -> New Query.
        (The query window MUST be on "proxyz", not "master".
         Check the database dropdown in the toolbar.)
     3. Change the password below, then press F5.
   Put the same password in the App Service setting DB_PASSWORD.
   ===================================================================== */

-- A "contained" user: lives inside the proxyz database only,
-- so the API can log in without a server-level login.
IF USER_ID('proxyz_app') IS NULL
    CREATE USER proxyz_app WITH PASSWORD = 'Change_This_Str0ng_P@ssw0rd!';  -- <== CHANGE ME
GO

-- Read + write data only (no permission to drop or change tables)
ALTER ROLE db_datareader ADD MEMBER proxyz_app;
ALTER ROLE db_datawriter ADD MEMBER proxyz_app;
GO

-- Check: should list proxyz_app with both roles
SELECT dp.name AS [user], r.name AS [role]
FROM sys.database_role_members rm
JOIN sys.database_principals dp ON dp.principal_id = rm.member_principal_id
JOIN sys.database_principals r  ON r.principal_id  = rm.role_principal_id
WHERE dp.name = 'proxyz_app';
