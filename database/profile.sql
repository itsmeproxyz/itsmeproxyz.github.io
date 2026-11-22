/* =====================================================================
   profile.sql — creates dbo.Profile (the "My Profile" page data)
   Run in SSMS on the proxyz database (Azure SQL), once.
   Only one row is allowed (Id = 1); the API reads and updates that row.
   ===================================================================== */

IF OBJECT_ID('dbo.Profile', 'U') IS NULL
BEGIN
  CREATE TABLE dbo.Profile (
    Id        INT NOT NULL CONSTRAINT PK_Profile PRIMARY KEY
                           CONSTRAINT CK_Profile_OneRow CHECK (Id = 1),
    Tagline   NVARCHAR(60)   NULL,
    Location  NVARCHAR(60)   NULL,
    MainGenre NVARCHAR(40)   NULL,
    SideQuest NVARCHAR(40)   NULL,
    Bio       NVARCHAR(1000) NULL,   -- empty line between paragraphs
    UpdatedAt DATETIME2 NOT NULL CONSTRAINT DF_Profile_UpdatedAt DEFAULT SYSUTCDATETIME()
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.Profile WHERE Id = 1)
BEGIN
  INSERT INTO dbo.Profile (Id, Tagline, Location, MainGenre, SideQuest, Bio)
  VALUES (1, N'Gamer', N'Indonesia', N'MMORPG', N'Tactical FPS',
    N'Online everyone knows me as proxyz. I''m based in Indonesia, and when I''m not at my desk I''m usually logged into some other world.'
    + CHAR(13) + CHAR(10) + CHAR(13) + CHAR(10) +
    N'MMORPGs are where I feel most at home. I love the huge open maps, the long grinds, the guild runs that somehow go way past midnight, and that one gear upgrade that finally drops after a hundred tries. There''s nothing quite like watching a character grow from a nobody into someone the server recognizes.'
    + CHAR(13) + CHAR(10) + CHAR(13) + CHAR(10) +
    N'When I need a quicker hit of adrenaline, I switch to tactical shooters. One clean headshot or a 1v3 clutch can make the whole night. Patient in the grind, sharp in the firefight: that''s the proxyz way.');
END
GO

-- Let the API user read + update it.
-- Harmless if proxyz_app already has db_datareader / db_datawriter.
GRANT SELECT, UPDATE ON dbo.Profile TO proxyz_app;
GO

-- Check:
SELECT * FROM dbo.Profile;
