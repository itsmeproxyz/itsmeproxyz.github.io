-- proxyz games database (SQL Server / Azure SQL)
-- Run this once in SSMS AFTER create-login.sql (that file creates the "proxyz" database).
-- On Azure SQL: DELETE the two lines "USE proxyz;" and "GO" below, and run this in a
-- query window opened on the proxyz database (right-click proxyz -> New Query).

USE proxyz;
GO

IF OBJECT_ID('dbo.Games', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.Games (
        Id          INT IDENTITY(1,1) PRIMARY KEY,
        Name        NVARCHAR(60)  NOT NULL,
        Genre       NVARCHAR(40)  NULL,
        Developer   NVARCHAR(40)  NULL,
        ReleaseYear NVARCHAR(4)   NULL,
        Description NVARCHAR(240) NULL,
        Color       CHAR(7)       NOT NULL CONSTRAINT DF_Games_Color DEFAULT ('#5a4fcf'),
        Pattern     VARCHAR(12)   NOT NULL CONSTRAINT DF_Games_Pattern DEFAULT ('rings'),
        SortOrder   INT           NOT NULL CONSTRAINT DF_Games_Sort DEFAULT (0),
        CreatedAt   DATETIME2     NOT NULL CONSTRAINT DF_Games_Created DEFAULT (SYSUTCDATETIME()),
        Image          VARCHAR(MAX) NULL,   -- uploaded card picture (data URL), see add-images.sql
        ImageUpdatedAt DATETIME2    NULL,   -- when the picture last changed
        Link        NVARCHAR(300) NULL,     -- official website, opens when the card is clicked
        CONSTRAINT CK_Games_Pattern CHECK (Pattern IN ('rings','mountains','shards','grid')),
        CONSTRAINT CK_Games_Color   CHECK (Color LIKE '#[0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F][0-9a-fA-F]')
    );
END
GO

-- Seed your first 4 games (only if the table is empty)
IF NOT EXISTS (SELECT 1 FROM dbo.Games)
BEGIN
    INSERT INTO dbo.Games (Name, Genre, Developer, ReleaseYear, Description, Color, Pattern, SortOrder) VALUES
    (N'Warframe', N'Co-op action shooter', N'Digital Extremes', N'2013',
     N'Space ninjas, wild movement and an endless pile of gear to farm. A looter shooter you can sink hundreds of hours into.', '#2f6f8f', 'rings', 1),
    (N'Black Desert Online', N'MMORPG', N'Pearl Abyss', N'2015',
     N'A huge open world with fast action combat, deep lifeskills and gear enhancing that tests every ounce of patience.', '#8a5a2b', 'mountains', 2),
    (N'Valorant', N'Tactical shooter', N'Riot Games', N'2020',
     N'5v5 rounds where agent abilities meet precise gunplay. Every round is a new plan, every clutch a story.', '#b8384a', 'shards', 3),
    (N'Counter-Strike 2', N'Tactical FPS', N'Valve', N'2023',
     N'The classic bomb-defuse formula. Crosshair placement, utility and teamwork decide everything.', '#c98a1c', 'grid', 4);
END
GO

SELECT * FROM dbo.Games ORDER BY SortOrder;
