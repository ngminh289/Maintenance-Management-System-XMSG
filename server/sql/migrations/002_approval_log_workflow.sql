-- migrations/002_approval_log_workflow.sql
-- Thêm WorkflowID + SubmittedBy vào ApprovalLogs để biết workflow nào đang áp dụng.
-- Chạy thủ công nếu đã có DB: mysql -u root -p warehouse_maintenance < 002_approval_log_workflow.sql

USE warehouse_maintenance;

ALTER TABLE ApprovalLogs
  ADD COLUMN WorkflowID  INT AFTER ResourceType,
  ADD COLUMN SubmittedBy INT AFTER WorkflowID,
  ADD INDEX  idx_workflow  (WorkflowID),
  ADD INDEX  idx_submitter (SubmittedBy),
  ADD FOREIGN KEY fk_al_workflow  (WorkflowID)  REFERENCES WorkflowTemplates(WorkflowID) ON DELETE SET NULL,
  ADD FOREIGN KEY fk_al_submitter (SubmittedBy) REFERENCES Employees(EmployeeID)         ON DELETE SET NULL;
