/* =====================================================================
   manage-games.sql
   Handy queries for managing your games straight from SSMS.
   Select ONE block with your mouse and press F5 (Execute) to run only it.
   After a change, refresh the website to see it.
   ===================================================================== */
USE proxyz;   -- Azure SQL: delete this line + the GO below, open the query on the proxyz database instead
GO

-- 1. See every game in the order the website shows them
SELECT Id, Name, Genre, Developer, ReleaseYear, Color, Pattern, SortOrder, CreatedAt
FROM dbo.Games
ORDER BY SortOrder, Id;

-- 2. Add a game (it goes to the end of the list)
INSERT INTO dbo.Games (Name, Genre, Developer, ReleaseYear, Description, Color, Pattern, SortOrder)
VALUES (N'Lost Ark', N'MMORPG', N'Smilegate', N'2019',
        N'Write your own short description here.',
        '#3a7bd5',          -- card color, format #RRGGBB
        'mountains',        -- rings | mountains | shards | grid
        (SELECT ISNULL(MAX(SortOrder), 0) + 1 FROM dbo.Games));

-- 3. Edit a game (change the Id to the game you want)
UPDATE dbo.Games
SET Description = N'New description',
    Color       = '#b8384a'
WHERE Id = 3;

-- 4. Move a game to the top of the list
UPDATE dbo.Games SET SortOrder = 0 WHERE Id = 2;

-- 5. Delete a game (double-check the Id first with query 1!)
DELETE FROM dbo.Games WHERE Id = 5;

-- 6. Count games per genre
SELECT Genre, COUNT(*) AS Total
FROM dbo.Games
GROUP BY Genre
ORDER BY Total DESC;
