-- ============================================================
-- schema.sql — Schema MySQL hiện đại cho hệ thống bảo trì kho.
-- Charset: utf8mb4 (hỗ trợ tiếng Việt + emoji).
-- Tất cả bảng dùng IF NOT EXISTS → chạy lại an toàn.
-- Script tự động: npm run db:setup (scripts/setup-db.js).
-- ============================================================

CREATE DATABASE IF NOT EXISTS warehouse_maintenance
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE warehouse_maintenance;

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------------------------------------
-- 1. AssetTypes — Loại tài sản (máy nghiền, lò nung...)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS AssetTypes (
    AssetTypeID       INT          AUTO_INCREMENT PRIMARY KEY,
    TypeName          VARCHAR(100) NOT NULL UNIQUE,
    Description       TEXT,
    DefaultPMInterval VARCHAR(50)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 2. Locations — Vị trí (cây: nhà máy → phân xưởng → khu vực)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS Locations (
    LocationID       INT          AUTO_INCREMENT PRIMARY KEY,
    LocationName     VARCHAR(100) NOT NULL,
    ParentLocationID INT          DEFAULT NULL,
    Description      TEXT,
    INDEX idx_parent (ParentLocationID),
    FOREIGN KEY (ParentLocationID) REFERENCES Locations(LocationID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 3. Departments — Phòng ban
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS Departments (
    DepartmentID   INT          AUTO_INCREMENT PRIMARY KEY,
    DepartmentName VARCHAR(100) NOT NULL UNIQUE,
    Description    TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 4. Positions — Chức vụ (Level: 1=Nhân viên, 2=Trưởng nhóm, 3=Quản lý)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS Positions (
    PositionID   INT          AUTO_INCREMENT PRIMARY KEY,
    PositionName VARCHAR(100) NOT NULL UNIQUE,
    Level        INT          NOT NULL DEFAULT 1,
    INDEX idx_level (Level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 5. Employees — Nhân viên (tài khoản hệ thống)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS Employees (
    EmployeeID   INT          AUTO_INCREMENT PRIMARY KEY,
    FullName     VARCHAR(100) NOT NULL,
    Username     VARCHAR(50)  NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Email        VARCHAR(100) NOT NULL UNIQUE,
    EmailVerified BOOLEAN     NOT NULL DEFAULT FALSE,
    IsActive      BOOLEAN     NOT NULL DEFAULT TRUE,
    WasEverActivated BOOLEAN  NOT NULL DEFAULT FALSE,
    LeaveStartAt DATETIME NULL,
    LeaveEndAt   DATETIME NULL,
    Phone        VARCHAR(20),
    PositionID   INT          NOT NULL,
    DepartmentID INT          NOT NULL,
    CreatedAt    DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_position   (PositionID),
    INDEX idx_department (DepartmentID),
    INDEX idx_active     (IsActive),
    FOREIGN KEY (PositionID)   REFERENCES Positions(PositionID),
    FOREIGN KEY (DepartmentID) REFERENCES Departments(DepartmentID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 6. Assets — Tài sản thiết bị
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS Assets (
    AssetID        INT          AUTO_INCREMENT PRIMARY KEY,
    AssetName      VARCHAR(100) NOT NULL,
    AssetTypeID    INT          NOT NULL,
    LocationID     INT          NOT NULL,
    Status         ENUM('AVAILABLE','MONITORING','CAUTION','MAINTENANCE','BROKEN','DECOMMISSIONED')
                               NOT NULL DEFAULT 'AVAILABLE',
    CommissionDate DATE         NOT NULL,
    Manufacturer   VARCHAR(100),
    SerialNumber   VARCHAR(50)  UNIQUE,
    Photo          VARCHAR(255),
    QRCodePath     VARCHAR(255),
    Description    TEXT,
    INDEX idx_type     (AssetTypeID),
    INDEX idx_location (LocationID),
    INDEX idx_status   (Status),
    FOREIGN KEY (AssetTypeID) REFERENCES AssetTypes(AssetTypeID),
    FOREIGN KEY (LocationID)  REFERENCES Locations(LocationID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 7. MaintenanceGroups — Nhóm bảo trì
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS MaintenanceGroups (
    GroupID     INT          AUTO_INCREMENT PRIMARY KEY,
    GroupName   VARCHAR(100) NOT NULL,
    Description TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 8. GroupMembers — Thành viên nhóm bảo trì (M:N)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS GroupMembers (
    GroupMemberID INT  AUTO_INCREMENT PRIMARY KEY,
    GroupID       INT  NOT NULL,
    EmployeeID    INT  NOT NULL,
    RoleNotes     TEXT,
    UNIQUE KEY uq_group_emp (GroupID, EmployeeID),
    INDEX idx_employee (EmployeeID),
    FOREIGN KEY (GroupID)    REFERENCES MaintenanceGroups(GroupID) ON DELETE CASCADE,
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)      ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 9. Tags — Nhãn tài liệu số (#BanVe, #AnToan...)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS Tags (
    TagID   INT          AUTO_INCREMENT PRIMARY KEY,
    TagName VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 9b. DocumentCategories — Phân loại tài liệu DAM (mỗi tài liệu tối đa 1 loại)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS DocumentCategories (
    DocumentCategoryID INT          AUTO_INCREMENT PRIMARY KEY,
    CategoryName       VARCHAR(120) NOT NULL UNIQUE,
    Description        VARCHAR(255) NULL,
    CreatedAt          DATETIME     DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 10. DigitalAssets — Kho tài liệu kỹ thuật số
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS DigitalAssets (
    DigitalAssetID INT          AUTO_INCREMENT PRIMARY KEY,
    FileName       VARCHAR(255) NOT NULL,
    FileType       VARCHAR(50)  NOT NULL,
    AssetID        INT,
    DocumentCategoryID INT,
    Description    TEXT,
    UploadDate     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    UploadedBy     INT          NOT NULL,
    CurrentVersion INT          DEFAULT 1,
    FilePath       VARCHAR(255) NOT NULL,
    FileSizeKB     INT,
    Status         ENUM('DRAFT','PENDING','APPROVED','REJECTED','ARCHIVED')
                                NOT NULL DEFAULT 'DRAFT',
    INDEX idx_asset      (AssetID),
    INDEX idx_doc_category (DocumentCategoryID),
    INDEX idx_uploader   (UploadedBy),
    INDEX idx_status     (Status),
    FOREIGN KEY (AssetID)    REFERENCES Assets(AssetID)    ON DELETE SET NULL,
    FOREIGN KEY (DocumentCategoryID) REFERENCES DocumentCategories (DocumentCategoryID) ON DELETE SET NULL,
    FOREIGN KEY (UploadedBy) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 11. AssetVersions — Lịch sử phiên bản tài liệu
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS AssetVersions (
    VersionID      INT          AUTO_INCREMENT PRIMARY KEY,
    DigitalAssetID INT          NOT NULL,
    VersionNumber  INT          NOT NULL,
    FilePath       VARCHAR(255) NOT NULL,
    ChangeDate     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    ChangedBy      INT          NOT NULL,
    ChangeNote     TEXT,
    INDEX idx_digital (DigitalAssetID),
    UNIQUE KEY uq_da_vernum (DigitalAssetID, VersionNumber),
    FOREIGN KEY (DigitalAssetID) REFERENCES DigitalAssets(DigitalAssetID) ON DELETE CASCADE,
    FOREIGN KEY (ChangedBy)      REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 12. AssetTags — Gắn thẻ cho tài liệu số (M:N)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS AssetTags (
    AssetTagID     INT AUTO_INCREMENT PRIMARY KEY,
    DigitalAssetID INT NOT NULL,
    TagID          INT NOT NULL,
    UNIQUE KEY uq_doc_tag (DigitalAssetID, TagID),
    FOREIGN KEY (DigitalAssetID) REFERENCES DigitalAssets(DigitalAssetID) ON DELETE CASCADE,
    FOREIGN KEY (TagID)          REFERENCES Tags(TagID)                   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 13. ChecklistTemplates — Mẫu checklist theo loại tài sản
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ChecklistTemplates (
    TemplateID   INT          AUTO_INCREMENT PRIMARY KEY,
    AssetTypeID  INT          NOT NULL,
    TemplateName VARCHAR(100) NOT NULL,
    Description  TEXT,
    INDEX idx_type (AssetTypeID),
    FOREIGN KEY (AssetTypeID) REFERENCES AssetTypes(AssetTypeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 14. ChecklistTemplateItems — Câu hỏi của mẫu checklist
--     (Cần thiết để hiển thị form checklist khi quét QR)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ChecklistTemplateItems (
    ItemID       INT          AUTO_INCREMENT PRIMARY KEY,
    TemplateID   INT          NOT NULL,
    QuestionText VARCHAR(255) NOT NULL,
    InputType    ENUM('PASS_FAIL','NUMERIC','TEXT','PHOTO','RANGE','SELECTION')
                              NOT NULL DEFAULT 'PASS_FAIL',
    RangeMin     DECIMAL(10,2),
    RangeMax     DECIMAL(10,2),
    SafeNumericMin DECIMAL(12,4),
    SafeNumericMax DECIMAL(12,4),
    OutOfRangeSuggest ENUM('WARNING','NG'),
    PassFailFailSuggest ENUM('WARNING','NG'),
    Unit         VARCHAR(20),
    SortOrder    INT          NOT NULL DEFAULT 0,
    IsRequired   BOOLEAN      NOT NULL DEFAULT TRUE,
    INDEX idx_template (TemplateID),
    FOREIGN KEY (TemplateID) REFERENCES ChecklistTemplates(TemplateID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 15. MaintenanceSchedules — Lịch bảo trì (định kỳ/dự đoán/khắc phục)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS MaintenanceSchedules (
    ScheduleID      INT          AUTO_INCREMENT PRIMARY KEY,
    AssetID         INT          NOT NULL,
    ScheduleName    VARCHAR(200) NOT NULL DEFAULT '',
    MaintenanceType ENUM('CORRECTIVE','PREVENTIVE','PREDICTIVE') NOT NULL,
    Description     TEXT         NOT NULL,
    Frequency       VARCHAR(50),
    FrequencyValue  INT,
    FrequencyUnit   ENUM('HOURS','DAYS','WEEKS','MONTHS','YEARS') NOT NULL DEFAULT 'HOURS',
    StartDate       DATE         NOT NULL,
    NextDueDate     DATE,
    LastExecutedDate DATE,
    EndDate         DATE,
    EstimatedTime   INT,
    Priority        ENUM('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
    DigitalAssetID  INT,
    Status          ENUM('DRAFT','PENDING_APPROVAL','PENDING','IN_PROGRESS','COMPLETED','OVERDUE','CANCELLED','REJECTED') NOT NULL DEFAULT 'PENDING',
    CreatedBy       INT,
    CreatedAt       DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_asset    (AssetID),
    INDEX idx_status   (Status),
    INDEX idx_priority (Priority),
    FOREIGN KEY (AssetID)        REFERENCES Assets(AssetID),
    FOREIGN KEY (DigitalAssetID) REFERENCES DigitalAssets(DigitalAssetID) ON DELETE SET NULL,
    FOREIGN KEY (CreatedBy)      REFERENCES Employees(EmployeeID)         ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 16. WorkOrders — Phiếu công việc bảo trì
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkOrders (
    WO_ID          INT          AUTO_INCREMENT PRIMARY KEY,
    ScheduleID     INT,
    AssetID        INT          NOT NULL,
    Description    TEXT,
    PlannedDate    DATE         NOT NULL,
    ActualDate     DATE,
    EstimatedHours DECIMAL(5,2),
    ActualHours    DECIMAL(5,2),
    Status         ENUM('PENDING_APPROVAL','WAITING','IN_PROGRESS','PAUSED','AWAITING_CLOSURE','COMPLETED','CANCELLED')
                                NOT NULL DEFAULT 'WAITING',
    WO_Source      ENUM('SCHEDULE','PREDICTIVE','MANUAL','CORRECTIVE') NOT NULL DEFAULT 'MANUAL',
    Priority       ENUM('EMERGENCY','HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'MEDIUM',
    CreatedBy      INT,
    CreatedAt      DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_asset    (AssetID),
    INDEX idx_status   (Status),
    INDEX idx_priority (Priority),
    INDEX idx_planned  (PlannedDate),
    FOREIGN KEY (ScheduleID) REFERENCES MaintenanceSchedules(ScheduleID) ON DELETE SET NULL,
    FOREIGN KEY (AssetID)    REFERENCES Assets(AssetID),
    FOREIGN KEY (CreatedBy)  REFERENCES Employees(EmployeeID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 17. WO_Assignments — Phân công nhân viên cho phiếu việc (M:N)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS WO_Assignments (
    AssignmentID INT AUTO_INCREMENT PRIMARY KEY,
    WO_ID        INT NOT NULL,
    EmployeeID   INT NOT NULL,
    UNIQUE KEY uq_wo_emp (WO_ID, EmployeeID),
    INDEX idx_employee (EmployeeID),
    FOREIGN KEY (WO_ID)      REFERENCES WorkOrders(WO_ID)     ON DELETE CASCADE,
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- WorkOrderPhotos — ảnh hiện trường khi thực hiện WO (migration 029; timing cột xem migration 021).
CREATE TABLE IF NOT EXISTS WorkOrderPhotos (
    PhotoID    INT AUTO_INCREMENT PRIMARY KEY,
    WO_ID      INT          NOT NULL,
    FilePath   VARCHAR(512) NOT NULL,
    UploadedBy INT          NULL,
    CreatedAt  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_wo (WO_ID),
    FOREIGN KEY (WO_ID)      REFERENCES WorkOrders(WO_ID)     ON DELETE CASCADE,
    FOREIGN KEY (UploadedBy) REFERENCES Employees(EmployeeID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 18. AssetCounters — Bộ đếm giờ chạy máy (dự báo bảo trì)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS AssetCounters (
    AssetID                INT        PRIMARY KEY,
    TotalAccumulatedHours  BIGINT     DEFAULT 0,
    LastReadingValue       INT        DEFAULT 0,
    AverageHoursPerDay     DECIMAL(5,2) DEFAULT 0,
    EstimatedNextPMDate    DATE,
    LastMaintenanceTotal   BIGINT     DEFAULT 0,
    LastUpdated            DATETIME   DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (AssetID) REFERENCES Assets(AssetID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 19. WorkflowTemplates — Mẫu luồng phê duyệt
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkflowTemplates (
    WorkflowID   INT          AUTO_INCREMENT PRIMARY KEY,
    WorkflowName VARCHAR(100) NOT NULL,
    DocumentType ENUM('DIGITAL_ASSET','WORK_ORDER','MAINTENANCE_PLAN') NOT NULL,
    TotalLevels  INT          NOT NULL DEFAULT 1,
    Description  TEXT,
    INDEX idx_doctype (DocumentType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 20. WorkflowSteps — Từng bước phê duyệt theo chức vụ
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS WorkflowSteps (
    StepID     INT AUTO_INCREMENT PRIMARY KEY,
    WorkflowID INT NOT NULL,
    StepLevel  INT NOT NULL,
    PositionID INT NOT NULL,
    UNIQUE KEY uq_workflow_level (WorkflowID, StepLevel),
    FOREIGN KEY (WorkflowID) REFERENCES WorkflowTemplates(WorkflowID) ON DELETE CASCADE,
    FOREIGN KEY (PositionID) REFERENCES Positions(PositionID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 21. ApprovalLogs — Nhật ký phê duyệt từng cấp
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ApprovalLogs (
    LogID        INT          AUTO_INCREMENT PRIMARY KEY,
    ResourceID   INT          NOT NULL,
    ResourceType ENUM('DIGITAL_ASSET','WORK_ORDER','MAINTENANCE_PLAN') NOT NULL,
    WorkflowID   INT,
    SubmittedBy  INT,
    CurrentLevel INT          NOT NULL,
    ApproverID   INT,
    Status       ENUM('PENDING','APPROVED','REJECTED','REQUEST_CHANGES') NOT NULL DEFAULT 'PENDING',
    Comment      TEXT,
    ActionDate   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_resource  (ResourceID, ResourceType),
    INDEX idx_approver  (ApproverID),
    INDEX idx_status    (Status),
    INDEX idx_workflow  (WorkflowID),
    INDEX idx_submitter (SubmittedBy),
    FOREIGN KEY (ApproverID)  REFERENCES Employees(EmployeeID)        ON DELETE SET NULL,
    FOREIGN KEY (WorkflowID)  REFERENCES WorkflowTemplates(WorkflowID) ON DELETE SET NULL,
    FOREIGN KEY (SubmittedBy) REFERENCES Employees(EmployeeID)        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 22. ChecklistResults — Kết quả kiểm tra thực tế tại hiện trường
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ChecklistResults (
    ChecklistID   INT          AUTO_INCREMENT PRIMARY KEY,
    AssetID       INT          NOT NULL,
    WO_ID         INT,
    CheckerID     INT          NOT NULL,
    CheckTime     DATETIME     DEFAULT CURRENT_TIMESTAMP,
    OverallStatus ENUM('OK','NG','WARNING') NOT NULL DEFAULT 'OK',
    EvidencePhoto VARCHAR(255),
    Notes         TEXT,
    ReadingValue  INT,
    ReviewStatus  ENUM('PENDING','APPROVED','REJECTED') NOT NULL DEFAULT 'PENDING',
    ReviewedBy    INT,
    ReviewedAt    DATETIME,
    SupervisorNotes TEXT,
    INDEX idx_asset    (AssetID),
    INDEX idx_review_status (ReviewStatus),
    INDEX idx_wo       (WO_ID),
    INDEX idx_checker  (CheckerID),
    INDEX idx_checktime (CheckTime),
    FOREIGN KEY (AssetID)   REFERENCES Assets(AssetID),
    FOREIGN KEY (WO_ID)     REFERENCES WorkOrders(WO_ID)     ON DELETE SET NULL,
    FOREIGN KEY (CheckerID) REFERENCES Employees(EmployeeID),
    FOREIGN KEY (ReviewedBy) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 23. ChecklistDetails — Chi tiết từng câu trả lời checklist
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS ChecklistDetails (
    DetailID     INT          AUTO_INCREMENT PRIMARY KEY,
    ChecklistID  INT          NOT NULL,
    QuestionText VARCHAR(255) NOT NULL,
    InputType    ENUM('PASS_FAIL','NUMERIC','TEXT','PHOTO','RANGE','SELECTION')
                              NOT NULL DEFAULT 'PASS_FAIL',
    AnswerValue  TEXT,
    IsOK         BOOLEAN      DEFAULT TRUE,
    INDEX idx_checklist (ChecklistID),
    FOREIGN KEY (ChecklistID) REFERENCES ChecklistResults(ChecklistID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 24. AssetRuntimeLogs — Lịch sử giờ chạy máy (dự báo bảo trì)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS AssetRuntimeLogs (
    LogID        BIGINT       AUTO_INCREMENT PRIMARY KEY,
    AssetID      INT          NOT NULL,
    ReadingValue INT          NOT NULL,
    DeltaHours   INT          NOT NULL,
    ChecklistID  INT,
    CaptureTime  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    DataSource   ENUM('MANUAL','IOT_SENSOR','SYSTEM') NOT NULL DEFAULT 'MANUAL',
    INDEX idx_asset       (AssetID),
    INDEX idx_capturetime (CaptureTime),
    FOREIGN KEY (AssetID)     REFERENCES Assets(AssetID),
    FOREIGN KEY (ChecklistID) REFERENCES ChecklistResults(ChecklistID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 25. Roles_Permissions — Phân quyền theo chức vụ (RBAC)
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS Roles_Permissions (
    PermissionID   INT AUTO_INCREMENT PRIMARY KEY,
    PositionID     INT NOT NULL,
    PermissionName ENUM('CREATE','READ','UPDATE','DELETE','APPROVE','EXPORT','SUBMIT') NOT NULL,
    ResourceType   ENUM(
        'ASSET','DIGITAL_ASSET','WORK_ORDER','MAINTENANCE_PLAN',
        'CHECKLIST_TEMPLATE','CHECKLIST_RESULT','RUNTIME_LOG',
        'EMPLOYEE','TAG','WORKFLOW','REPORT','INVENTORY','DOCUMENT_CATEGORY'
    ) NOT NULL,
    UNIQUE KEY uq_perm (PositionID, PermissionName, ResourceType),
    FOREIGN KEY (PositionID) REFERENCES Positions(PositionID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 26. Notifications — Thông báo in-app
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS Notifications (
    NotiID      INT          AUTO_INCREMENT PRIMARY KEY,
    RecipientID INT          NOT NULL,
    Message     TEXT         NOT NULL,
    Type        ENUM('MAINTENANCE_DUE','APPROVAL_REQUEST','WORK_ORDER_ASSIGNED','WORK_ORDER_COMPLETED','SYSTEM_ALERT','TASK_OVERDUE','DOCUMENT_FEEDBACK_NEW','DOCUMENT_FEEDBACK_STATUS')
                             NOT NULL DEFAULT 'SYSTEM_ALERT',
    IsRead      BOOLEAN      DEFAULT FALSE,
    CreatedAt   DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_recipient (RecipientID),
    INDEX idx_is_read   (IsRead),
    INDEX idx_created   (CreatedAt),
    FOREIGN KEY (RecipientID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 27. AuditLogs — Nhật ký thao tác người dùng
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS AuditLogs (
    AuditID    INT          AUTO_INCREMENT PRIMARY KEY,
    EmployeeID INT          NOT NULL,
    Action     ENUM('INSERT','UPDATE','DELETE','LOGIN','LOGOUT','EXPORT') NOT NULL,
    TableName  VARCHAR(50)  NOT NULL,
    RecordID   INT,
    OldValue   TEXT,
    NewValue   TEXT,
    Timestamp  DATETIME     DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_employee  (EmployeeID),
    INDEX idx_timestamp (Timestamp),
    INDEX idx_action    (Action),
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------
-- 28. RetentionPolicies — Chính sách lưu trữ/xóa dữ liệu
-- ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS RetentionPolicies (
    PolicyID      INT          AUTO_INCREMENT PRIMARY KEY,
    PolicyName    VARCHAR(100) NOT NULL,
    RetentionDays INT          NOT NULL,
    TargetTable   VARCHAR(50)  NOT NULL UNIQUE,
    ActionAfter   ENUM('DELETE','ARCHIVE','ANONYMIZE') NOT NULL DEFAULT 'DELETE',
    Description   TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
