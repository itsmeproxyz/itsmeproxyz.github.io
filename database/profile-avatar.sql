/* =====================================================================
   profile-avatar.sql — adds the profile picture columns to dbo.Profile
   Run in SSMS on the proxyz database (Azure SQL), once, AFTER profile.sql.
   Safe to run twice.
   ===================================================================== */

IF COL_LENGTH('dbo.Profile', 'Avatar') IS NULL
  ALTER TABLE dbo.Profile ADD Avatar VARCHAR(MAX) NULL;        -- data URL, like dbo.Games.Image
GO

IF COL_LENGTH('dbo.Profile', 'AvatarUpdatedAt') IS NULL
  ALTER TABLE dbo.Profile ADD AvatarUpdatedAt DATETIME2 NULL;  -- changes the ?v= in the picture URL
GO

-- (proxyz_app already has SELECT/UPDATE on dbo.Profile from profile.sql)

-- Check:
SELECT Id, Tagline,
       CASE WHEN Avatar IS NULL THEN 'no picture' ELSE 'has picture' END AS Avatar,
       AvatarUpdatedAt
FROM dbo.Profile;
