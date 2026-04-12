-- 038_document_asset_feedback.sql
-- Module phản hồi / góp ý tài liệu (DAM): mọi chức vụ trừ NV Kỹ thuật (Position 2) được CREATE;
-- NV KT READ + UPDATE để xem xét, ghi chú, đổi trạng thái.
-- Liên quan: routes/documentFeedback.routes.js, digitalAsset.routes.js (nested /:id/feedback).
USE warehouse_maintenance;

ALTER TABLE Roles_Permissions
  MODIFY COLUMN ResourceType ENUM(
    'ASSET','DIGITAL_ASSET','WORK_ORDER','MAINTENANCE_PLAN',
    'CHECKLIST_TEMPLATE','CHECKLIST_RESULT','RUNTIME_LOG',
    'EMPLOYEE','TAG','WORKFLOW','REPORT','INVENTORY',
    'DOCUMENT_CATEGORY','DOCUMENT_FEEDBACK'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS DigitalAssetFeedback (
  FeedbackID       INT AUTO_INCREMENT PRIMARY KEY,
  DigitalAssetID   INT          NOT NULL,
  CreatedBy        INT          NOT NULL,
  Body             VARCHAR(4000) NOT NULL,
  Status           ENUM('OPEN','IN_REVIEW','RESOLVED','DISMISSED') NOT NULL DEFAULT 'OPEN',
  ReviewNote       VARCHAR(1000) NULL,
  ReviewedBy       INT NULL,
  ReviewedAt       DATETIME NULL,
  CreatedAt        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_daf_digitalasset FOREIGN KEY (DigitalAssetID) REFERENCES DigitalAssets (DigitalAssetID)
    ON DELETE CASCADE,
  CONSTRAINT fk_daf_author FOREIGN KEY (CreatedBy) REFERENCES Employees (EmployeeID)
    ON DELETE RESTRICT,
  CONSTRAINT fk_daf_reviewer FOREIGN KEY (ReviewedBy) REFERENCES Employees (EmployeeID)
    ON DELETE SET NULL,
  INDEX idx_daf_asset (DigitalAssetID),
  INDEX idx_daf_status_created (Status, CreatedAt),
  INDEX idx_daf_author (CreatedBy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- READ: mọi vai có quyền đọc tài liệu (1,2,3,4,5,6)
-- CREATE: không gán cho Position 2 (NV KT)
-- UPDATE: chỉ Position 2 — xử lý phản hồi
INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType) VALUES
(1, 'READ',   'DOCUMENT_FEEDBACK'),
(1, 'CREATE', 'DOCUMENT_FEEDBACK'),
(2, 'READ',   'DOCUMENT_FEEDBACK'),
(2, 'UPDATE', 'DOCUMENT_FEEDBACK'),
(3, 'READ',   'DOCUMENT_FEEDBACK'),
(3, 'CREATE', 'DOCUMENT_FEEDBACK'),
(4, 'READ',   'DOCUMENT_FEEDBACK'),
(4, 'CREATE', 'DOCUMENT_FEEDBACK'),
(5, 'READ',   'DOCUMENT_FEEDBACK'),
(5, 'CREATE', 'DOCUMENT_FEEDBACK');

INSERT IGNORE INTO Roles_Permissions (PositionID, PermissionName, ResourceType)
SELECT 6, rp.PermissionName, rp.ResourceType
FROM Roles_Permissions rp
WHERE rp.PositionID = 3
  AND rp.ResourceType = 'DOCUMENT_FEEDBACK'
  AND EXISTS (SELECT 1 FROM Positions p WHERE p.PositionID = 6);
