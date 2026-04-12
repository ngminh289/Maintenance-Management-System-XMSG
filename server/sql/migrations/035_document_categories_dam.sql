-- 035_document_categories_dam.sql
-- DAM: bảng phân loại tài liệu (1 tài liệu — tối đa 1 loại); NV KT quản lý CRUD.
-- RBAC: ResourceType DOCUMENT_CATEGORY; NV KT xóa tag danh mục (DELETE TAG).
USE warehouse_maintenance;

ALTER TABLE Roles_Permissions
MODIFY COLUMN ResourceType ENUM(
  'ASSET','DIGITAL_ASSET','WORK_ORDER','MAINTENANCE_PLAN',
  'CHECKLIST_TEMPLATE','CHECKLIST_RESULT','RUNTIME_LOG',
  'EMPLOYEE','TAG','WORKFLOW','REPORT','INVENTORY',
  'DOCUMENT_CATEGORY'
) NOT NULL;

CREATE TABLE IF NOT EXISTS DocumentCategories (
  DocumentCategoryID INT          AUTO_INCREMENT PRIMARY KEY,
  CategoryName       VARCHAR(120) NOT NULL UNIQUE,
  Description        VARCHAR(255) NULL,
  CreatedAt          DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE DigitalAssets
  ADD COLUMN DocumentCategoryID INT NULL AFTER AssetID,
  ADD INDEX idx_doc_category (DocumentCategoryID),
  ADD CONSTRAINT fk_digitalassets_documentcategory
    FOREIGN KEY (DocumentCategoryID) REFERENCES DocumentCategories (DocumentCategoryID)
    ON DELETE SET NULL;

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(2, 'DELETE', 'TAG'),
(1, 'READ',   'DOCUMENT_CATEGORY'),
(2, 'CREATE', 'DOCUMENT_CATEGORY'),
(2, 'READ',   'DOCUMENT_CATEGORY'),
(2, 'UPDATE', 'DOCUMENT_CATEGORY'),
(2, 'DELETE', 'DOCUMENT_CATEGORY'),
(3, 'READ',   'DOCUMENT_CATEGORY'),
(4, 'READ',   'DOCUMENT_CATEGORY'),
(5, 'READ',   'DOCUMENT_CATEGORY');

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT 6, rp.PermissionName, rp.ResourceType
FROM Roles_Permissions rp
WHERE rp.PositionID = 3
  AND rp.ResourceType = 'DOCUMENT_CATEGORY'
  AND EXISTS (SELECT 1 FROM Positions p WHERE p.PositionID = 6);
