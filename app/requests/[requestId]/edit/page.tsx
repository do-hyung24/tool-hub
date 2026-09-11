import Link from "next/link";
import { notFound } from "next/navigation";
import { getToolRequestById, listToolRequestImages } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { NewRequestForm, parseRequiredEnvironment } from "@/app/requests/new/NewRequestForm";

export default async function EditToolRequestPage(
  props: PageProps<"/requests/[requestId]/edit">
) {
  const { requestId } = await props.params;

  const [toolRequest, sellerId] = await Promise.all([
    getToolRequestById(requestId),
    getCurrentSellerId(),
  ]);

  if (!toolRequest) {
    notFound();
  }

  if (!sellerId) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">로그인이 필요합니다</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          의뢰를 수정하려면 먼저 로그인해주세요.
        </p>
        <Link
          href={`/login?next=${encodeURIComponent(`/requests/${requestId}/edit`)}`}
          className="mt-6 inline-block rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          확인
        </Link>
      </main>
    );
  }

  const canEdit = sellerId === toolRequest.requesterSellerId && toolRequest.status === "open";
  if (!canEdit) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">접근할 수 없습니다</h1>
        <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
          모집중인 본인 의뢰만 수정할 수 있습니다.
        </p>
        <Link
          href={`/requests/${requestId}`}
          className="mt-6 inline-block rounded-full border border-zinc-300 px-5 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          의뢰로 돌아가기
        </Link>
      </main>
    );
  }

  const images = await listToolRequestImages(requestId);
  const { chips, etcText } = parseRequiredEnvironment(toolRequest.requiredEnvironment ?? "");

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link
        href={`/requests/${requestId}`}
        className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
      >
        ← 의뢰로 돌아가기
      </Link>

      <h1 className="mt-4 text-2xl font-bold">의뢰 수정</h1>

      <NewRequestForm
        mode="edit"
        requestId={requestId}
        initialValues={{
          title: toolRequest.title,
          description: toolRequest.description,
          budgetAmount: toolRequest.budgetAmount !== null ? String(toolRequest.budgetAmount) : "",
          budgetNegotiable: toolRequest.budgetNegotiable,
          desiredDeadline: toolRequest.desiredDeadline ?? "",
          requiredEnvironmentChips: chips,
          etcText,
          referenceVideoUrl: toolRequest.referenceVideoUrl ?? "",
          existingImages: images.map((image) => ({ id: image.id })),
        }}
      />
    </main>
  );
}
