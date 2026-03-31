-- 018_wo_urgent_two_level_approval.sql
-- WO khẩn cấp: 2 bước duyệt (ban đầu cùng PositionID 3). Migration 019 gán bước 2 → Position 6 (Trưởng phòng).
-- Liên quan: approval.service.js getWorkflowForWO.
USE warehouse_maintenance;

-- Khớp tên mẫu với approval.service.js (fallback routing WO thường)
UPDATE WorkflowTemplates
SET WorkflowName = 'Phê duyệt Work Order thông thường'
WHERE WorkflowName = 'Phê duyệt Work Order' AND DocumentType = 'WORK_ORDER';

-- Đảm bảo có mẫu (DB chỉ chạy 013 có thể chưa có bản ghi khẩn cấp)
INSERT INTO WorkflowTemplates (WorkflowName, DocumentType, TotalLevels, Description)
SELECT
  'Phê duyệt WO khẩn cấp',
  'WORK_ORDER',
  2,
  'WO PREDICTIVE/CORRECTIVE hoặc HIGH/EMERGENCY — 2 bước (sau 019: bước 1 Position 3, bước 2 Position 6).'
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM WorkflowTemplates
  WHERE WorkflowName = 'Phê duyệt WO khẩn cấp' AND DocumentType = 'WORK_ORDER'
);

UPDATE WorkflowTemplates
SET
  TotalLevels = 2,
  Description = 'WO PREDICTIVE/CORRECTIVE hoặc HIGH/EMERGENCY — 2 bước (sau 019: bước 1 Position 3, bước 2 Position 6).'
WHERE WorkflowName = 'Phê duyệt WO khẩn cấp' AND DocumentType = 'WORK_ORDER';

DELETE ws FROM WorkflowSteps ws
INNER JOIN WorkflowTemplates wt ON wt.WorkflowID = ws.WorkflowID
WHERE wt.WorkflowName = 'Phê duyệt WO khẩn cấp' AND wt.DocumentType = 'WORK_ORDER';

INSERT INTO WorkflowSteps (WorkflowID, StepLevel, PositionID)
SELECT w.WorkflowID, s.stepLevel, 3
FROM WorkflowTemplates w
CROSS JOIN (
  SELECT 1 AS stepLevel UNION ALL SELECT 2
) AS s
WHERE w.WorkflowName = 'Phê duyệt WO khẩn cấp' AND w.DocumentType = 'WORK_ORDER';
