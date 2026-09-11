"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const TITLE_MIN_LENGTH = 2;
const CONTENT_MIN_LENGTH = 30;

// 이 두 값은 app/api/requests/route.ts의 MAX_IMAGES / MAX_IMAGE_SIZE_BYTES /
// ALLOWED_MIME_TYPES와 반드시 일치해야 한다(안내 문구·클라이언트 장수 제한용).
const MAX_IMAGES = 5;
const MAX_IMAGE_SIZE_MB = 2;
const ALLOWED_IMAGE_TYPES_LABEL = "jpg, png, webp";

export const ENVIRONMENT_CHIPS = [
  "엑셀/구글시트",
  "네이버 스마트스토어",
  "쿠팡",
  "카카오톡",
  "인스타그램",
  "유튜브",
  "이메일(Gmail/아웃룩)",
  "웹사이트 크롤링",
  "노션",
  "윈도우 PC 프로그램",
] as const;

const ETC_MAX_LENGTH = 100;

// buildRequiredEnvironment(아래)의 역변환 - 저장된 "칩, 칩, 기타텍스트" 형태의
// 문자열을 수정 폼 프리필용으로 다시 칩 목록/기타 텍스트로 분리한다.
export function parseRequiredEnvironment(value: string): { chips: string[]; etcText: string } {
  if (!value) return { chips: [], etcText: "" };
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "");
  const knownChips = new Set<string>(ENVIRONMENT_CHIPS);
  const chips = parts.filter((part) => knownChips.has(part));
  const etcParts = parts.filter((part) => !knownChips.has(part));
  return { chips, etcText: etcParts.join(", ") };
}

const DESCRIPTION_PLACEHOLDER = `지금 어떤 일을 손으로 하고 계신가요? (예: 매일 아침 스마트스토어 주문 내역을 엑셀로 옮겨 적습니다)
얼마나 자주 하고, 한 번에 얼마나 걸리나요? (예: 매일 1시간)
어떤 결과물을 받고 싶으신가요? (예: 정리된 엑셀 파일이 매일 오전 9시에 이메일로 도착)
꼭 지켜야 할 조건이 있나요? (예: 회사 PC는 윈도우입니다)`;

// KST(UTC+9) 기준 오늘 날짜를 YYYY-MM-DD로 계산한다. offsetMonths만큼 더한 날짜도 구할 수 있다.
function getKstDateString(offsetMonths = 0): string {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kstNow.setUTCMonth(kstNow.getUTCMonth() + offsetMonths);
  return kstNow.toISOString().slice(0, 10);
}

function formatBudgetDisplay(rawDigits: string): string {
  if (!rawDigits) return "";
  return Number(rawDigits).toLocaleString("ko-KR");
}

// "(필수)"/"(선택사항)" 뱃지 - 필수는 선택사항과 구분되는 강조색을 쓴다.
function FieldBadge({ required }: { required: boolean }) {
  return (
    <span
      className={
        required
          ? "text-xs font-normal text-emerald-600 dark:text-emerald-400"
          : "text-xs font-normal text-zinc-400 dark:text-zinc-500"
      }
    >
      {required ? "(필수)" : "(선택사항)"}
    </span>
  );
}

// 클릭 토글형 도움말 팝오버 - 참고 영상 링크/기능 설명 두 곳에서 재사용한다.
// 호버가 아니라 클릭으로 열고, Esc 또는 바깥 클릭으로 닫힌다.
function HelpPopover({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-4 w-4 items-center justify-center rounded-full border border-zinc-300 text-[10px] leading-none text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
      >
        ?
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-10 w-72 rounded-lg border border-zinc-200 bg-white p-3 text-xs leading-relaxed text-zinc-600 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
          {children}
        </div>
      )}
    </div>
  );
}

type ExistingImage = { id: string };

// 수정 모드 프리필 값. requiredEnvironment(콤마로 합쳐진 문자열)는 페이지에서
// 미리 칩/기타 텍스트로 분리해 넘긴다(이 파일의 buildRequiredEnvironment와
// 짝을 이루는 역변환이므로 한 곳에서만 관리하지 않기 위해 페이지 쪽에 둔다).
type InitialValues = {
  title: string;
  description: string;
  budgetAmount: string; // 콤마 없는 숫자 문자열, 없으면 ""
  budgetNegotiable: boolean;
  desiredDeadline: string; // 없으면 ""
  requiredEnvironmentChips: string[];
  etcText: string;
  referenceVideoUrl: string;
  existingImages: ExistingImage[];
};

export function NewRequestForm({
  initialDescription = "",
  mode = "new",
  requestId,
  initialValues,
}: {
  initialDescription?: string;
  mode?: "new" | "edit";
  requestId?: string;
  initialValues?: InitialValues;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialValues?.title ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? initialDescription);
  const [budgetAmount, setBudgetAmount] = useState(initialValues?.budgetAmount ?? ""); // 콤마 없는 숫자 문자열
  const [budgetNegotiable, setBudgetNegotiable] = useState(initialValues?.budgetNegotiable ?? false);
  const [desiredDeadline, setDesiredDeadline] = useState(initialValues?.desiredDeadline ?? "");
  const [selectedChips, setSelectedChips] = useState<string[]>(
    initialValues?.requiredEnvironmentChips ?? []
  );
  const [etcEnabled, setEtcEnabled] = useState(!!initialValues?.etcText);
  const [etcText, setEtcText] = useState(initialValues?.etcText ?? "");
  const [referenceVideoUrl, setReferenceVideoUrl] = useState(initialValues?.referenceVideoUrl ?? "");
  const [existingImages, setExistingImages] = useState<ExistingImage[]>(
    initialValues?.existingImages ?? []
  );
  const [images, setImages] = useState<File[]>([]);
  const [imageNotice, setImageNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [minDeadline] = useState(() => getKstDateString(0));
  const [maxDeadline] = useState(() => getKstDateString(6));

  const descriptionLength = description.trim().length;
  const budgetMissing = budgetAmount.trim() === "" && !budgetNegotiable;
  const budgetNumericValue = budgetAmount ? Number(budgetAmount) : null;
  const showBudgetUnitWarning =
    budgetNumericValue !== null && budgetNumericValue >= 1 && budgetNumericValue < 10000;

  function toggleChip(chip: string) {
    setSelectedChips((prev) =>
      prev.includes(chip) ? prev.filter((value) => value !== chip) : [...prev, chip]
    );
  }

  function buildRequiredEnvironment(): string {
    const parts = ENVIRONMENT_CHIPS.filter((chip) => selectedChips.includes(chip)) as string[];
    const etc = etcEnabled ? etcText.trim() : "";
    if (etc) parts.push(etc);
    return parts.join(", ");
  }

  const requiredEnvironmentValue = buildRequiredEnvironment();

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(event.target.files ?? []);
    event.target.value = ""; // 같은 파일을 다시 선택할 수 있도록 비운다.

    const merged = [...images];
    let hitLimit = false;
    for (const file of newFiles) {
      if (merged.length + existingImages.length >= MAX_IMAGES) {
        hitLimit = true;
        break;
      }
      const isDuplicate = merged.some((existing) => existing.name === file.name && existing.size === file.size);
      if (isDuplicate) continue;
      merged.push(file);
    }

    setImages(merged);
    setImageNotice(hitLimit ? `사진은 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.` : null);
  }

  function handleRemoveImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImageNotice(null);
  }

  function handleRemoveExistingImage(id: string) {
    setExistingImages((prev) => prev.filter((image) => image.id !== id));
    setImageNotice(null);
  }

  const totalImageCount = images.length + existingImages.length;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (totalImageCount === 0) {
      setError("사진을 최소 1장 첨부해주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      const requiredEnvironment = buildRequiredEnvironment();

      const formData = new FormData();
      formData.append("title", title);
      formData.append("description", description);
      if (budgetAmount.trim() !== "") formData.append("budgetAmount", budgetAmount);
      if (budgetNegotiable) formData.append("budgetNegotiable", "on");
      if (desiredDeadline.trim() !== "") formData.append("desiredDeadline", desiredDeadline);
      if (requiredEnvironment !== "") formData.append("requiredEnvironment", requiredEnvironment);
      if (referenceVideoUrl.trim() !== "") formData.append("referenceVideoUrl", referenceVideoUrl);
      for (const file of images) {
        formData.append("images", file);
      }

      if (mode === "edit") {
        for (const image of existingImages) {
          formData.append("keepImageIds", image.id);
        }
        const response = await fetch(`/api/requests/${requestId}`, {
          method: "PATCH",
          body: formData,
        });
        const result = await response.json();
        if (!response.ok) {
          setError(result.error ?? "수정에 실패했습니다.");
          return;
        }
        router.push(`/requests/${requestId}`);
        return;
      }

      const response = await fetch("/api/requests", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "등록에 실패했습니다.");
        return;
      }
      router.push(`/requests/${result.id}`);
    } catch {
      setError(
        mode === "edit"
          ? "수정 중 오류가 발생했습니다. 다시 시도해주세요."
          : "등록 중 오류가 발생했습니다. 다시 시도해주세요."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium">
          제목 <FieldBadge required />
        </label>
        <input
          id="title"
          type="text"
          required
          minLength={TITLE_MIN_LENGTH}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <label htmlFor="description" className="text-sm font-medium">
            기능 설명 <FieldBadge required />
          </label>
          <HelpPopover>
            <p className="font-semibold text-zinc-700 dark:text-zinc-200">
              이렇게 적어주시면 좋아요
            </p>
            <p className="mt-1.5">
              매일 아침 네이버 스마트스토어 관리자에 들어가 전날 주문 내역을 엑셀로 내려받고,
              상품별 수량을 합쳐 사내 재고 시트에 옮겨 적고 있습니다. 주문이 하루 50~100건이라
              1시간 넘게 걸립니다. 이 과정을 자동으로 처리해서 매일 오전 9시에 정리된 엑셀
              파일이 제 이메일로 도착하면 좋겠습니다. 회사 PC는 윈도우입니다.
            </p>
          </HelpPopover>
        </div>
        <textarea
          id="description"
          required
          minLength={CONTENT_MIN_LENGTH}
          rows={8}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder={DESCRIPTION_PLACEHOLDER}
          className="resize-none rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        <div className="flex justify-end">
          <span
            className={`text-xs ${
              descriptionLength < CONTENT_MIN_LENGTH
                ? "text-zinc-400 dark:text-zinc-500"
                : "text-zinc-600 dark:text-zinc-300"
            }`}
          >
            {descriptionLength} / 최소 {CONTENT_MIN_LENGTH}자
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="budgetAmount" className="text-sm font-medium">
          예산 <FieldBadge required />
        </label>
        <div className="flex items-center gap-3">
          <input
            id="budgetAmount"
            type="text"
            inputMode="numeric"
            value={formatBudgetDisplay(budgetAmount)}
            onChange={(event) => setBudgetAmount(event.target.value.replace(/[^0-9]/g, ""))}
            placeholder="금액(원)"
            className="w-40 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <label className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-300">
            <input
              type="checkbox"
              checked={budgetNegotiable}
              onChange={(event) => setBudgetNegotiable(event.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 dark:border-zinc-700"
            />
            협의 가능
          </label>
        </div>
        <p
          className={`text-xs ${
            budgetMissing
              ? "text-amber-600 dark:text-amber-400"
              : "text-zinc-400 dark:text-zinc-500"
          }`}
        >
          금액을 적어주세요. 감이 안 오면 &apos;협의 가능&apos;에 체크하고 비워두셔도 됩니다.
        </p>
        {showBudgetUnitWarning && (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            입력하신 금액이 맞나요? 단위를 확인해주세요.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="desiredDeadline" className="text-sm font-medium">
          희망 완료 시점 <FieldBadge required={false} />
        </label>
        <input
          id="desiredDeadline"
          type="date"
          min={minDeadline}
          max={maxDeadline}
          value={desiredDeadline}
          onChange={(event) => setDesiredDeadline(event.target.value)}
          className={`w-fit rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 ${
            desiredDeadline === ""
              ? "[&::-webkit-datetime-edit]:text-zinc-400 dark:[&::-webkit-datetime-edit]:text-zinc-500"
              : "[&::-webkit-datetime-edit]:text-zinc-900 dark:[&::-webkit-datetime-edit]:text-zinc-50"
          }`}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          필요한 프로그램/환경 <FieldBadge required />
        </label>
        <div className="flex flex-wrap gap-2">
          {ENVIRONMENT_CHIPS.map((chip) => {
            const isActive = selectedChips.includes(chip);
            return (
              <button
                key={chip}
                type="button"
                onClick={() => toggleChip(chip)}
                aria-pressed={isActive}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {chip}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setEtcEnabled((prev) => !prev)}
            aria-pressed={etcEnabled}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              etcEnabled
                ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-900"
                : "border-zinc-300 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            }`}
          >
            기타
          </button>
        </div>
        {etcEnabled && (
          <input
            type="text"
            value={etcText}
            onChange={(event) => setEtcText(event.target.value)}
            maxLength={ETC_MAX_LENGTH}
            placeholder="예: 특정 사내 시스템 이름"
            className="mt-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
          />
        )}
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <label htmlFor="referenceVideoUrl" className="text-sm font-medium">
            참고 영상 링크 <FieldBadge required={false} />
          </label>
          <HelpPopover>
            자동화하고 싶은 업무 과정을 화면 녹화하거나 영상으로 찍어 유튜브·SNS 등 본인
            계정에 올린 뒤 그 링크를 붙여넣어 주세요. 개발자가 작업 흐름을 훨씬 정확하게
            파악할 수 있어 결과물이 좋아집니다.
          </HelpPopover>
        </div>
        <input
          id="referenceVideoUrl"
          type="text"
          value={referenceVideoUrl}
          onChange={(event) => setReferenceVideoUrl(event.target.value)}
          placeholder="https://..."
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">사진 첨부</label>
        {existingImages.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {existingImages.map((image) => (
              <div key={image.id} className="relative h-16 w-16 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/api/requests/images/${image.id}`}
                  alt=""
                  className="h-full w-full rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => handleRemoveExistingImage(image.id)}
                  aria-label="사진 삭제"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-xs text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label
            htmlFor="images"
            className="cursor-pointer rounded-full border border-zinc-300 px-4 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            사진 선택
          </label>
          <input
            id="images"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFilesSelected}
            className="sr-only"
          />
          {images.map((file, index) => (
            <span
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            >
              {file.name}
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                aria-label={`${file.name} 삭제`}
                className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-50"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500">
          최대 {MAX_IMAGES}장, 장당 {MAX_IMAGE_SIZE_MB}MB까지 · {ALLOWED_IMAGE_TYPES_LABEL}
        </p>
        {imageNotice && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{imageNotice}</p>
        )}
        <p className="text-xs text-zinc-400 dark:text-zinc-500">사진을 최소 1장 첨부해주세요.</p>
      </div>

      <p className="text-xs text-zinc-400 dark:text-zinc-500">
        완성물은 제작자가 원하면 마켓에도 별도로 재판매할 수 있으며 저작권은 제작자에게 있습니다.
      </p>

      {error && <p className="text-xs font-medium text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={
          isSubmitting ||
          title.trim().length < TITLE_MIN_LENGTH ||
          descriptionLength < CONTENT_MIN_LENGTH ||
          totalImageCount === 0 ||
          budgetMissing ||
          requiredEnvironmentValue.trim() === ""
        }
        className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {isSubmitting ? (mode === "edit" ? "수정 중..." : "등록 중...") : mode === "edit" ? "수정하기" : "등록하기"}
      </button>
    </form>
  );
}
