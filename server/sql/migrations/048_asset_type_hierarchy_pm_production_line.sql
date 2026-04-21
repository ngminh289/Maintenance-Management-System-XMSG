-- Migration 048: 4 thay đổi nghiệp vụ
-- 1. AssetTypes: thêm ParentTypeID (cây 2 cấp) + đổi DefaultPMInterval → DefaultPMValue + DefaultPMUnit
-- 2. ProductionLines: bảng mới thay thế ENUM trong Assets.ProductionLine
-- 3. Fix WorkflowSteps: tài liệu số (WorkflowID=2) do Trưởng phòng duyệt (PositionID=6)

USE warehouse_maintenance;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1a. Thêm ParentTypeID cho cây loại tài sản (self-referential, max 2 cấp)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE AssetTypes
  ADD COLUMN ParentTypeID INT NULL
    COMMENT 'NULL = loại cha (abstract); có giá trị = loại con'
    AFTER TypeName,
  ADD CONSTRAINT fk_assettype_parent
    FOREIGN KEY (ParentTypeID) REFERENCES AssetTypes(AssetTypeID)
    ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1b. Đổi DefaultPMInterval VARCHAR → hai cột có cấu trúc khớp MaintenanceSchedules
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE AssetTypes
  DROP COLUMN DefaultPMInterval,
  ADD COLUMN DefaultPMValue INT NULL
    COMMENT 'Giá trị chu kỳ PM mặc định (chỉ type con)' AFTER ParentTypeID,
  ADD COLUMN DefaultPMUnit  ENUM('HOURS','DAYS','WEEKS','MONTHS','YEARS') NULL
    COMMENT 'Đơn vị chu kỳ PM mặc định (chỉ type con)' AFTER DefaultPMValue;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Bảng ProductionLines thay thế ENUM cứng
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ProductionLines (
  LineID      INT           AUTO_INCREMENT PRIMARY KEY,
  LineName    VARCHAR(100)  NOT NULL UNIQUE COMMENT 'VD: Dây chuyền 1, Dùng chung',
  Description TEXT          NULL,
  IsActive    TINYINT(1)    NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO ProductionLines (LineName) VALUES
  ('Dây chuyền'),
  ('Dùng chung');

-- Đổi cột ProductionLine từ ENUM → FK số nguyên
-- (dữ liệu cũ: 'Dây chuyền' → LineID 1, 'Dùng chung' → LineID 2)
ALTER TABLE Assets
  MODIFY COLUMN ProductionLine INT NULL
    COMMENT 'FK → ProductionLines.LineID';

UPDATE Assets a
  JOIN ProductionLines pl ON pl.LineName = 'Dây chuyền'
  SET a.ProductionLine = pl.LineID
  WHERE a.ProductionLine IS NOT NULL
    AND a.ProductionLine NOT REGEXP '^[0-9]+$';

UPDATE Assets a
  JOIN ProductionLines pl ON pl.LineName = 'Dùng chung'
  SET a.ProductionLine = pl.LineID
  WHERE a.ProductionLine IS NOT NULL
    AND a.ProductionLine NOT REGEXP '^[0-9]+$';

ALTER TABLE Assets
  ADD CONSTRAINT fk_assets_production_line
    FOREIGN KEY (ProductionLine) REFERENCES ProductionLines(LineID)
    ON DELETE SET NULL ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Luồng phê duyệt tài liệu số → Trưởng phòng (PositionID 6) thay Trưởng ca (3)
-- ─────────────────────────────────────────────────────────────────────────────
UPDATE WorkflowSteps
  SET PositionID = 6
  WHERE WorkflowID = 2 AND StepLevel = 1;
