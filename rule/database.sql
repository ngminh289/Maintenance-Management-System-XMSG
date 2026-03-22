CREATE TABLE AssetTypes (
    AssetTypeID INT AUTO_INCREMENT PRIMARY KEY,
    TypeName VARCHAR(100) NOT NULL UNIQUE,
    Description TEXT,
    DefaultPMInterval VARCHAR(50)
);
CREATE TABLE Locations (
    LocationID INT AUTO_INCREMENT PRIMARY KEY,
    LocationName VARCHAR(100) NOT NULL,
    ParentLocationID INT,
    Description TEXT,
    FOREIGN KEY (ParentLocationID) REFERENCES Locations(LocationID)
);
CREATE TABLE Assets (
    AssetID INT AUTO_INCREMENT PRIMARY KEY,
    AssetName VARCHAR(100) NOT NULL,
    AssetTypeID INT NOT NULL,
    LocationID INT NOT NULL,
    Status ENUM(
        'AVAILABLE', 
        'MAINTENANCE', 
        'UNDER REPAIR', 
        'BROKEN', 
        'DISUSED'
    ) NOT NULL DEFAULT 'AVAILABLE',
    CommissionDate DATE NOT NULL,
    Manufacturer VARCHAR(100),
    SerialNumber VARCHAR(50) UNIQUE,
    Photo VARCHAR(255),
    QRCodePath VARCHAR(255),
    Description TEXT,
    FOREIGN KEY (AssetTypeID) REFERENCES AssetTypes(AssetTypeID),
    FOREIGN KEY (LocationID) REFERENCES Locations(LocationID)
);

CREATE TABLE Departments (
    DepartmentID INT AUTO_INCREMENT PRIMARY KEY,
    DepartmentName VARCHAR(100) NOT NULL UNIQUE,
    Description TEXT
);

CREATE TABLE Positions (
    PositionID INT AUTO_INCREMENT PRIMARY KEY,
    PositionName VARCHAR(100) NOT NULL UNIQUE,
    Level INT DEFAULT 1 -- 1: STAFF, 2: TEAM LEAD, 3: MANAGER
);

CREATE TABLE Employees (
    EmployeeID INT AUTO_INCREMENT PRIMARY KEY,
    FullName VARCHAR(100) NOT NULL,
    Username VARCHAR(50) NOT NULL UNIQUE,
    PasswordHash VARCHAR(255) NOT NULL,
    Email VARCHAR(100) NOT NULL UNIQUE,
    Phone VARCHAR(20),
    PositionID INT NOT NULL,
    DepartmentID INT NOT NULL,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (PositionID) REFERENCES Positions(PositionID),
    FOREIGN KEY (DepartmentID) REFERENCES Departments(DepartmentID)
);

CREATE TABLE MaintenanceGroups (
    GroupID INT AUTO_INCREMENT PRIMARY KEY,
    GroupName VARCHAR(100) NOT NULL,
    Description TEXT
);

CREATE TABLE GroupMembers (
    GroupMemberID INT AUTO_INCREMENT PRIMARY KEY,
    GroupID INT NOT NULL,
    EmployeeID INT NOT NULL, 
    FOREIGN KEY (GroupID) REFERENCES MaintenanceGroups(GroupID),
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
);

ALTER TABLE GroupMembers ADD COLUMN RoleNotes TEXT;

CREATE TABLE DigitalAssets (
    DigitalAssetID INT AUTO_INCREMENT PRIMARY KEY,
    FileName VARCHAR(255) NOT NULL,
    FileType VARCHAR(50) NOT NULL,
    AssetID INT, -- Sửa thành INT cho khớp với bảng Assets
    Description TEXT,
    UploadDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    UploadedBy INT NOT NULL,
    CurrentVersion INT DEFAULT 1,
    FilePath VARCHAR(255) NOT NULL,
    FileSizeKB INT,
    Status ENUM(
        'PENDING',      -- Chờ phê duyệt
        'APPROVED',     -- Đã duyệt
        'REJECTED',     -- Từ chối
        'DRAFT',        -- Bản nháp
        'ARCHIVED'      -- Bản cũ (Dùng ARCHIVED hoặc OLD_VERSION)
    ) NOT NULL DEFAULT 'DRAFT',
    FOREIGN KEY (AssetID) REFERENCES Assets(AssetID),
    FOREIGN KEY (UploadedBy) REFERENCES Employees(EmployeeID)
);

CREATE TABLE AssetVersions (
    VersionID INT AUTO_INCREMENT PRIMARY KEY,
    DigitalAssetID INT NOT NULL,
    VersionNumber INT NOT NULL,
    FilePath VARCHAR(255) NOT NULL,
    ChangeDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    ChangedBy INT NOT NULL, 
    ChangeNote TEXT,
    FOREIGN KEY (DigitalAssetID) REFERENCES DigitalAssets(DigitalAssetID),
    FOREIGN KEY (ChangedBy) REFERENCES Employees(EmployeeID)
);

CREATE TABLE Tags (
    TagID INT AUTO_INCREMENT PRIMARY KEY,
    TagName VARCHAR(100) NOT NULL UNIQUE
);


CREATE TABLE AssetTags (
    AssetTagID INT AUTO_INCREMENT PRIMARY KEY,
    DigitalAssetID INT NOT NULL,
    TagID INT NOT NULL,
    FOREIGN KEY (DigitalAssetID) REFERENCES DigitalAssets(DigitalAssetID),
    FOREIGN KEY (TagID) REFERENCES Tags(TagID)
);


CREATE TABLE MaintenanceSchedules (
    ScheduleID INT AUTO_INCREMENT PRIMARY KEY,
    AssetID INT NOT NULL, -- Khớp với kiểu INT của bảng Assets
    MaintenanceType ENUM(
        'CORRECTIVE',    -- Khắc phục
        'PREVENTIVE',    -- Phòng ngừa
        'PREDICTIVE'     -- Dự đoán
    ) NOT NULL,
    Description TEXT NOT NULL,
    Frequency VARCHAR(50),
    FrequencyValue INT,
    FrequencyUnit ENUM('HOURS','DAYS', 'WEEKS', 'MONTHS', 'YEARS') NOT NULL DEFAULT 'HOURS' ,
    StartDate DATE NOT NULL,
    EndDate DATE,
    EstimatedTime INT, -- Phút hoặc Giờ tùy bạn quy định
    Priority ENUM(
        'LOW',           -- Thấp
        'MEDIUM',        -- Trung bình
        'HIGH',          -- Cao
        'URGENT'         -- Khẩn cấp
    ) NOT NULL DEFAULT 'MEDIUM',
    DigitalAssetID INT,
    Status ENUM(
        'IN_PROGRESS',   -- Đang thực hiện
        'PENDING',       -- Chưa thực hiện
        'COMPLETED',     -- Hoàn thành
        'OVERDUE'        -- Quá hạn
    ) NOT NULL DEFAULT 'PENDING',
    FOREIGN KEY (AssetID) REFERENCES Assets(AssetID),
    FOREIGN KEY (DigitalAssetID) REFERENCES DigitalAssets(DigitalAssetID)
);

CREATE TABLE WorkOrders (
    WO_ID INT AUTO_INCREMENT PRIMARY KEY,
    ScheduleID INT,
    AssetID INT NOT NULL, -- Đồng bộ kiểu INT với bảng Assets
    PlannedDate DATE NOT NULL,
    ActualDate DATE,
    EstimatedHours DECIMAL(5,2),
    ActualHours DECIMAL(5,2),
    Status ENUM(
        'PENDING_APPROVAL', -- Chờ phê duyệt
        'WAITING',          -- Đang chờ
        'IN_PROGRESS',      -- Đang thực hiện
        'PAUSED',           -- Tạm dừng
        'COMPLETED',        -- Đã hoàn thành
        'CANCELLED'         -- Đã hủy
    ) NOT NULL DEFAULT 'WAITING',
    FOREIGN KEY (ScheduleID) REFERENCES MaintenanceSchedules(ScheduleID),
    FOREIGN KEY (AssetID) REFERENCES Assets(AssetID)
);

CREATE TABLE WO_Assignments (
    AssignmentID INT AUTO_INCREMENT PRIMARY KEY,
    WO_ID INT NOT NULL,
    EmployeeID INT NOT NULL,
    FOREIGN KEY (WO_ID) REFERENCES WorkOrders(WO_ID),
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE AssetCounters (
    AssetID INT PRIMARY KEY, -- Bỏ AUTO_INCREMENT vì đây là ID tham chiếu từ bảng Assets
    TotalAccumulatedHours BIGINT DEFAULT 0,
    LastReadingValue INT DEFAULT 0,
    AverageHoursPerDay DECIMAL(5,2) DEFAULT 0,
    EstimatedNextPMDate DATE,
    LastMaintenanceTotal BIGINT DEFAULT 0,
    LastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (AssetID) REFERENCES Assets(AssetID)
);

CREATE TABLE WorkflowTemplates (
    WorkflowID INT AUTO_INCREMENT PRIMARY KEY,
    WorkflowName VARCHAR(100) NOT NULL,
    -- Chuyển sang ENUM để quản lý các loại tài liệu/phiếu biểu cụ thể
    DocumentType ENUM(
        'DIGITAL_ASSET',    -- Tài liệu số
        'WORK_ORDER',       -- Phiếu công việc
        'PURCHASE_REQUEST', -- Yêu cầu mua sắm
        'MAINTENANCE_PLAN'  -- Kế hoạch bảo trì
    ) NOT NULL,
    TotalLevels INT NOT NULL DEFAULT 1, -- Số cấp phê duyệt (VD: 2 cấp, 3 cấp)
    Description TEXT
);


CREATE TABLE WorkflowSteps (
    StepID INT AUTO_INCREMENT PRIMARY KEY,
    WorkflowID INT NOT NULL,
    StepLevel INT NOT NULL, -- Cấp độ phê duyệt (Ví dụ: 1, 2, 3)
    PositionID INT NOT NULL, -- Thay ApproverRole bằng PositionID để tham chiếu bảng Positions
    FOREIGN KEY (WorkflowID) REFERENCES WorkflowTemplates(WorkflowID),
    FOREIGN KEY (PositionID) REFERENCES Positions(PositionID)
);

CREATE TABLE ApprovalLogs (
    LogID INT AUTO_INCREMENT PRIMARY KEY,
    ResourceID INT NOT NULL, -- ID của tài liệu/phiếu/kế hoạch cần duyệt
    ResourceType ENUM(
        'DIGITAL_ASSET',    -- Tài liệu số
        'WORK_ORDER',       -- Phiếu công việc
        'PURCHASE_REQUEST', -- Yêu cầu mua sắm
        'MAINTENANCE_PLAN'  -- Kế hoạch bảo trì (Đã thêm vào cho khớp)
    ) NOT NULL,
    CurrentLevel INT NOT NULL,
    ApproverID INT, 
    Status ENUM(
        'PENDING',           -- Chờ duyệt
        'APPROVED',          -- Đã duyệt
        'REJECTED',          -- Từ chối
        'REQUEST_CHANGES'    -- Yêu cầu chỉnh sửa
    ) NOT NULL DEFAULT 'PENDING',
    Comment TEXT,
    ActionDate DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ApproverID) REFERENCES Employees(EmployeeID)
);


CREATE TABLE ChecklistTemplates (
    TemplateID INT AUTO_INCREMENT PRIMARY KEY,
    AssetTypeID INT NOT NULL,
    TemplateName VARCHAR(100) NOT NULL,
    Description TEXT,
    FOREIGN KEY (AssetTypeID) REFERENCES AssetTypes(AssetTypeID)
);

CREATE TABLE ChecklistResults (
    ChecklistID INT AUTO_INCREMENT PRIMARY KEY,
    AssetID INT NOT NULL, -- Sửa thành INT cho khớp với bảng Assets
    WO_ID INT, -- ID của phiếu công việc (nếu có)
    CheckerID INT NOT NULL, -- Sửa thành INT cho khớp với bảng Employees
    CheckTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    OverallStatus ENUM(
        'OK',          -- Đạt (Bình thường)
        'NG',          -- Không đạt (Not Good)
        'WARNING'      -- Cảnh báo
    ) NOT NULL DEFAULT 'OK',
    EvidencePhoto VARCHAR(255), -- Đường dẫn ảnh minh chứng
    Notes TEXT,
    ReadingValue INT, -- Giá trị đo đạc (nếu có, ví dụ: nhiệt độ, áp suất)
    FOREIGN KEY (AssetID) REFERENCES Assets(AssetID),
    FOREIGN KEY (WO_ID) REFERENCES WorkOrders(WO_ID),
    FOREIGN KEY (CheckerID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE ChecklistDetails (
    DetailID INT AUTO_INCREMENT PRIMARY KEY,
    ChecklistID INT NOT NULL,
    QuestionText VARCHAR(255) NOT NULL,
    -- Enum giúp Front-end định dạng UI (Input/Camera/Dropdown)
    InputType ENUM(
        'PASS_FAIL', -- Chọn Đạt/Không đạt
        'NUMERIC',   -- Nhập số (đo đạc)
        'TEXT',      -- Nhập văn bản mô tả
        'PHOTO',     -- Yêu cầu chụp ảnh
        'RANGE'      -- Nhập giá trị trong khoảng cho phép
    ) NOT NULL DEFAULT 'PASS_FAIL',
    AnswerValue TEXT, -- Lưu giá trị thực tế người dùng nhập/chọn
    IsOK BOOLEAN DEFAULT TRUE, -- TRUE: Đạt, FALSE: Lỗi
    FOREIGN KEY (ChecklistID) REFERENCES ChecklistResults(ChecklistID) ON DELETE CASCADE
);

CREATE TABLE AssetRuntimeLogs (
    LogID BIGINT AUTO_INCREMENT PRIMARY KEY,
    AssetID INT NOT NULL, -- Sửa thành INT cho đồng bộ với bảng Assets
    ReadingValue INT NOT NULL, -- Giá trị công tơ mét/số giờ chạy tại thời điểm ghi nhận
    DeltaHours INT NOT NULL, -- Số giờ chạy tăng thêm so với lần ghi nhận trước
    ChecklistID INT, -- Liên kết nếu dữ liệu này được ghi lại trong lúc đi kiểm tra Checklist
    CaptureTime DATETIME DEFAULT CURRENT_TIMESTAMP,
    DataSource ENUM(
        'MANUAL',    -- Nhân viên nhập tay
        'IOT_SENSOR', -- Cảm biến tự động gửi về
        'SYSTEM'     -- Hệ thống tự tính toán/ước tính
    ) NOT NULL DEFAULT 'MANUAL',
    FOREIGN KEY (AssetID) REFERENCES Assets(AssetID),
    FOREIGN KEY (ChecklistID) REFERENCES ChecklistResults(ChecklistID)
);

CREATE TABLE Roles_Permissions (
    PermissionID INT AUTO_INCREMENT PRIMARY KEY,
    PositionID INT NOT NULL, -- Tham chiếu trực tiếp đến bảng Positions
    PermissionName ENUM(
        'CREATE', 
        'READ', 
        'UPDATE', 
        'DELETE', 
        'APPROVE', 
        'EXPORT'
    ) NOT NULL,
    ResourceType ENUM(
        'ASSET',            -- Tài sản
        'DIGITAL_ASSET',    -- Tài liệu số
        'WORK_ORDER',       -- Phiếu công việc
        'MAINTENANCE_PLAN', -- Kế hoạch bảo trì
        'EMPLOYEE',         -- Nhân sự
        'INVENTORY'         -- Kho bãi (nếu có)
    ) NOT NULL,
    FOREIGN KEY (PositionID) REFERENCES Positions(PositionID)
);

CREATE TABLE Notifications (
    NotiID INT AUTO_INCREMENT PRIMARY KEY,
    RecipientID INT NOT NULL, -- Sửa thành INT cho khớp với EmployeeID
    Message TEXT NOT NULL,
    Type ENUM(
        'MAINTENANCE_DUE',    -- Đến hạn bảo trì
        'APPROVAL_REQUEST',   -- Yêu cầu phê duyệt mới
        'WORK_ORDER_ASSIGNED',-- Được giao việc mới
        'SYSTEM_ALERT',       -- Cảnh báo hệ thống
        'TASK_OVERDUE'        -- Công việc quá hạn
    ) NOT NULL DEFAULT 'SYSTEM_ALERT',
    IsRead BOOLEAN DEFAULT FALSE,
    CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (RecipientID) REFERENCES Employees(EmployeeID) ON DELETE CASCADE
);

CREATE TABLE AuditLogs (
    AuditID INT AUTO_INCREMENT PRIMARY KEY,
    EmployeeID INT NOT NULL, -- Sửa thành INT cho khớp với EmployeeID
    Action ENUM(
        'INSERT', -- Thêm mới
        'UPDATE', -- Chỉnh sửa
        'DELETE', -- Xóa
        'LOGIN',  -- Đăng nhập
        'LOGOUT', -- Đăng xuất
        'EXPORT'  -- Xuất dữ liệu
    ) NOT NULL,
    TableName VARCHAR(50) NOT NULL, -- Tên bảng bị tác động (Ví dụ: 'Assets')
    RecordID INT, -- ID của bản ghi cụ thể bị thay đổi
    OldValue TEXT, -- Dữ liệu trước khi sửa (thường lưu dạng JSON)
    NewValue TEXT, -- Dữ liệu sau khi sửa
    Timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (EmployeeID) REFERENCES Employees(EmployeeID)
);

CREATE TABLE RetentionPolicies (
    PolicyID INT AUTO_INCREMENT PRIMARY KEY,
    PolicyName VARCHAR(100) NOT NULL,
    RetentionDays INT NOT NULL, -- Số ngày giữ lại dữ liệu (VD: 365 ngày)
    TargetTable VARCHAR(50) NOT NULL, -- Bảng áp dụng (VD: 'AuditLogs', 'Notifications')
    ActionAfter ENUM(
        'DELETE',   -- Xóa vĩnh viễn
        'ARCHIVE',  -- Chuyển sang bảng lưu trữ (History)
        'ANONYMIZE' -- Ẩn danh hóa dữ liệu (Xóa thông tin cá nhân nhưng giữ lại record)
    ) NOT NULL DEFAULT 'DELETE',
    Description TEXT
);

