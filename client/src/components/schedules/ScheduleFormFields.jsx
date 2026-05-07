import { useEffect, useMemo, useState } from 'react';
import { Input, Select, Textarea } from '../ui/Input.jsx';
import { fDate, todayDateInput, toDateInputValue } from '../../utils/format.js';
import { AssetIdSearchPicker } from '../AssetIdSearchPicker.jsx';
import { assetApi } from '../../api/asset.api.js';
import { assetTypeApi } from '../../api/assetType.api.js';

export const EMPTY_SCHEDULE_FORM = {
  scheduleKind: 'periodic',
  maintenanceType: 'PREVENTIVE',
  scheduleName: '',
  assetId: '',
  description: '',
  frequencyValue: 30,
  frequencyUnit: 'DAYS',
  startDate: '',
  endDate: '',
  priority: 'MEDIUM',
  checklistTemplateId: '',
};

const UNIT_LABEL = {
  HOURS: 'giờ',
  DAYS: 'ngày',
  WEEKS: 'tuần',
  MONTHS: 'tháng',
  YEARS: 'năm',
};

export function buildScheduleFormForAsset(asset) {
  return {
    ...EMPTY_SCHEDULE_FORM,
    assetId: String(asset?.assetId ?? ''),
    scheduleName: asset?.assetName ? `PM định kỳ - ${asset.assetName}` : '',
    description: asset?.assetName
      ? `Bảo trì định kỳ cho ${asset.assetName}.`
      : '',
    startDate: todayDateInput(),
  };
}

export function mapScheduleToForm(schedule) {
  const predictive = schedule?.frequencyUnit === 'HOURS';
  return {
    ...EMPTY_SCHEDULE_FORM,
    scheduleKind: predictive ? 'predictive' : 'periodic',
    maintenanceType: schedule?.maintenanceType ?? 'PREVENTIVE',
    assetId: String(schedule?.assetId ?? ''),
    scheduleName: schedule?.scheduleName ?? '',
    description: schedule?.description ?? '',
    frequencyValue:
      schedule?.frequencyValue ?? (predictive ? 720 : 30),
    frequencyUnit: schedule?.frequencyUnit ?? 'DAYS',
    startDate: toDateInputValue(schedule?.startDate),
    endDate: toDateInputValue(schedule?.endDate),
    priority: schedule?.priority ?? 'MEDIUM',
    checklistTemplateId:
      schedule?.checklistTemplateId != null
        ? String(schedule.checklistTemplateId)
        : '',
  };
}

export function validateScheduleForm(form, notifyError) {
  if (!form.assetId || !form.scheduleName?.trim() || !form.startDate) {
    notifyError?.(
      'Vui lòng điền đầy đủ: Tài sản, Tên lịch và Ngày bắt đầu',
    );
    return false;
  }
  if (!form.description?.trim()) {
    notifyError?.('Vui lòng nhập mô tả công việc');
    return false;
  }
  if (!form.frequencyValue || Number(form.frequencyValue) < 1) {
    notifyError?.('Tần suất hoặc ngưỡng giờ phải lớn hơn hoặc bằng 1');
    return false;
  }
  return true;
}

export function buildSchedulePayload(form) {
  const scheduleKind = form.scheduleKind ?? 'periodic';
  const predictive = scheduleKind === 'predictive';
  return {
    assetId: Number(form.assetId),
    scheduleName: form.scheduleName?.trim() ?? '',
    description: form.description?.trim() ?? '',
    maintenanceType: predictive ? 'PREDICTIVE' : 'PREVENTIVE',
    frequencyValue: Number(
      form.frequencyValue || (predictive ? 720 : 30),
    ),
    frequencyUnit: (
      predictive ? 'HOURS' : form.frequencyUnit || 'DAYS'
    ).toUpperCase(),
    startDate: form.startDate,
    endDate: form.endDate || undefined,
    priority: (form.priority || 'MEDIUM').toUpperCase(),
    checklistTemplateId: form.checklistTemplateId
      ? Number(form.checklistTemplateId)
      : null,
  };
}

export function ScheduleFormFields({
  form,
  setF,
  patchForm,
  assets = [],
  checklistTemplates = [],
  fixedAsset = null,
  readOnly = false,
}) {
  const isPredictive = form.scheduleKind === 'predictive';
  const ro = Boolean(readOnly);
  const [selectedAssetMeta, setSelectedAssetMeta] = useState(fixedAsset ?? null);

  const visibleAssets = useMemo(() => {
    if (fixedAsset) return [fixedAsset];
    return assets;
  }, [assets, fixedAsset]);

  useEffect(() => {
    if (fixedAsset) {
      setSelectedAssetMeta(fixedAsset);
      return;
    }
    if (!form.assetId) {
      setSelectedAssetMeta(null);
      return;
    }
    const localMatch = visibleAssets.find(
      (a) => String(a.assetId) === String(form.assetId),
    );
    if (localMatch) {
      setSelectedAssetMeta(localMatch);
      return;
    }
    let cancelled = false;
    assetApi
      .getById(form.assetId)
      .then((res) => {
        if (!cancelled) setSelectedAssetMeta(res.data?.data ?? null);
      })
      .catch(() => {
        if (!cancelled) setSelectedAssetMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fixedAsset, form.assetId, visibleAssets]);

  const selectedAssetTypeId = useMemo(() => {
    return Number(selectedAssetMeta?.assetTypeId) || null;
  }, [selectedAssetMeta?.assetTypeId]);

  const templateOptions = useMemo(() => {
    if (!selectedAssetTypeId) return [];
    return checklistTemplates.filter(
      (tpl) => Number(tpl.assetTypeId) === Number(selectedAssetTypeId),
    );
  }, [checklistTemplates, selectedAssetTypeId]);

  const handleAssetChange = async (assetId) => {
    setF('assetId', assetId);
    if (!assetId || isPredictive) return;
    try {
      let asset = visibleAssets.find((a) => String(a.assetId) === String(assetId));
      if (!asset) {
        const res = await assetApi.getById(assetId);
        asset = res.data?.data ?? null;
      }
      setSelectedAssetMeta(asset ?? null);
      if (!asset?.assetTypeId) return;
      const res = await assetTypeApi.getById(asset.assetTypeId);
      const type = res.data.data;
      if (
        type?.defaultPMValue &&
        type?.defaultPMUnit &&
        type.defaultPMUnit !== 'HOURS'
      ) {
        patchForm({
          frequencyValue: type.defaultPMValue,
          frequencyUnit: type.defaultPMUnit,
        });
      }
    } catch {
      // Non-blocking best-effort autofill from asset type defaults.
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Tên lịch *"
          value={form.scheduleName ?? ''}
          onChange={(e) => setF('scheduleName', e.target.value)}
          placeholder="VD: PM máy lọc bụi tháng 1"
          disabled={ro}
        />
        <AssetIdSearchPicker
          id="schedule-asset-picker"
          label="Tài sản *"
          value={form.assetId ?? ''}
          onChange={handleAssetChange}
          disabled={ro || Boolean(fixedAsset)}
        />

        <Select
          label="Kiểu lịch *"
          value={form.scheduleKind ?? 'periodic'}
          disabled={ro}
          onChange={(e) => {
            const kind = e.target.value;
            if (kind === 'predictive') {
              patchForm({
                scheduleKind: 'predictive',
                maintenanceType: 'PREDICTIVE',
                frequencyUnit: 'HOURS',
                frequencyValue:
                  form.frequencyUnit === 'HOURS'
                    ? Number(form.frequencyValue) || 720
                    : 720,
              });
              return;
            }
            patchForm({
              scheduleKind: 'periodic',
              maintenanceType: 'PREVENTIVE',
              frequencyUnit:
                form.frequencyUnit === 'HOURS'
                  ? 'DAYS'
                  : form.frequencyUnit ?? 'DAYS',
              frequencyValue:
                form.frequencyUnit === 'HOURS'
                  ? 30
                  : Number(form.frequencyValue) || 30,
            });
          }}
        >
          <option value="periodic">
            Định kỳ (ngày / tuần / tháng / năm)
          </option>
          <option value="predictive">Dự báo (theo giờ chạy)</option>
        </Select>

        {isPredictive ? (
          <Input
            label="Ngưỡng giờ chạy *"
            type="number"
            min={1}
            value={form.frequencyValue ?? 720}
            onChange={(e) => setF('frequencyValue', e.target.value)}
            disabled={ro}
          />
        ) : (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Tần suất *"
                type="number"
                min={1}
                value={form.frequencyValue ?? 30}
                onChange={(e) => setF('frequencyValue', e.target.value)}
                disabled={ro}
              />
            </div>
            <div className="flex-1">
              <Select
                label="Đơn vị *"
                value={form.frequencyUnit ?? 'DAYS'}
                onChange={(e) => setF('frequencyUnit', e.target.value)}
                disabled={ro}
              >
                <option value="DAYS">Ngày</option>
                <option value="WEEKS">Tuần</option>
                <option value="MONTHS">Tháng</option>
                <option value="YEARS">Năm</option>
              </Select>
            </div>
          </div>
        )}

        <Input
          label="Ngày bắt đầu *"
          type="date"
          value={form.startDate ?? ''}
          onChange={(e) => setF('startDate', e.target.value)}
          disabled={ro}
        />
        <Input
          label="Ngày kết thúc"
          type="date"
          value={form.endDate ?? ''}
          onChange={(e) => setF('endDate', e.target.value)}
          disabled={ro}
        />

        <Select
          label="Mức ưu tiên"
          value={form.priority ?? 'MEDIUM'}
          onChange={(e) => setF('priority', e.target.value)}
          disabled={ro}
        >
          <option value="LOW">Thấp</option>
          <option value="MEDIUM">Trung bình</option>
          <option value="HIGH">Cao</option>
          <option value="URGENT">Khẩn</option>
        </Select>
        <Select
          label="Checklist template (tuỳ chọn)"
          value={form.checklistTemplateId ?? ''}
          onChange={(e) => setF('checklistTemplateId', e.target.value)}
          disabled={ro || !selectedAssetTypeId}
        >
          <option value="">-- Không gắn template cố định --</option>
          {templateOptions.map((tpl) => (
            <option key={tpl.templateId} value={tpl.templateId}>
              {tpl.templateName}
            </option>
          ))}
        </Select>
      </div>

      <Textarea
        label="Mô tả công việc *"
        value={form.description ?? ''}
        onChange={(e) => setF('description', e.target.value)}
        placeholder="Mô tả nội dung bảo trì cần thực hiện..."
        disabled={ro}
      />

      {!isPredictive && form.startDate && (
        <p className="rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700">
          Ngày đến hạn đầu tiên: <strong>{fDate(form.startDate)}</strong> +{' '}
          {form.frequencyValue} {UNIT_LABEL[form.frequencyUnit] ?? form.frequencyUnit}.
        </p>
      )}
      {isPredictive && (
        <p className="rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
          Lịch dự báo theo giờ chạy. Khi đồng hồ máy vượt ngưỡng, hệ thống tự
          tạo phiếu bảo trì tương ứng.
        </p>
      )}
    </div>
  );
}
