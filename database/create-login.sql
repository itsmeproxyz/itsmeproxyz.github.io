/* =====================================================================
   create-login.sql
   Run ONCE in SSMS, connected to localhost\SQLEXPRESS with Windows
   Authentication. It creates:
     1. the database  "proxyz"
     2. a SQL login   "proxyz_app"  (the API uses this to connect)
     3. a user for that login inside "proxyz" that can read + write data
   Change the password below before you run it, and put the same
   password in api/.env as DB_PASSWORD.
   ===================================================================== */

-- 1. Create the database (skipped if it already exists)
IF DB_ID('proxyz') IS NULL
    CREATE DATABASE proxyz;
GO

-- 2. Create the server login (skipped if it already exists)
IF SUSER_ID('proxyz_app') IS NULL
    CREATE LOGIN proxyz_app
        WITH PASSWORD = 'Change_This_P@ssw0rd!',  -- <== CHANGE ME
             DEFAULT_DATABASE = proxyz,
             CHECK_POLICY = ON;
GO

-- 3. Create the database user and give it read/write rights only
USE proxyz;
GO
IF USER_ID('proxyz_app') IS NULL
    CREATE USER proxyz_app FOR LOGIN proxyz_app;
GO
ALTER ROLE db_datareader ADD MEMBER proxyz_app;  -- can SELECT
ALTER ROLE db_datawriter ADD MEMBER proxyz_app;  -- can INSERT / UPDATE / DELETE
GO

-- Check: should list proxyz_app with both roles
SELECT dp.name AS [user], r.name AS [role]
FROM sys.database_role_members rm
JOIN sys.database_principals dp ON dp.principal_id = rm.member_principal_id
JOIN sys.database_principals r  ON r.principal_id  = rm.role_principal_id
WHERE dp.name = 'proxyz_app';
