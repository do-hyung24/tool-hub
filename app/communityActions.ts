"use server";

import { notFound, redirect } from "next/navigation";
import { countCommunityComments, deleteCommunityPost, getCommunityPostById } from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";

export type DeletePostState = { error?: string };

// redirect()는 try/catch 안에서 호출하면 안 된다(app/requestActions.ts와 동일한
// 이유) - 로그인/권한 확인은 항상 위험 구간(try) 밖에서 먼저 끝낸다.
export async function deleteCommunityPostAction(
  _prevState: DeletePostState,
  formData: FormData
): Promise<DeletePostState> {
  const postId = String(formData.get("postId") ?? "");
  const sellerId = await getCurrentSellerId();
  if (!sellerId) {
    redirect(`/login?next=${encodeURIComponent(`/community/${postId}`)}`);
  }

  const post = await getCommunityPostById(postId);
  if (!post || post.authorSellerId !== sellerId) {
    // throw는 500(서버 예외)으로 응답해 의도된 거부와 실제 오류를 구분할 수
    // 없게 만든다 - 존재 여부도 함께 감추는 notFound()로 명확한 404를 반환한다.
    notFound();
  }

  const commentCount = await countCommunityComments(postId);
  if (commentCount > 0) {
    return { error: "댓글이 달린 글은 삭제할 수 없습니다." };
  }

  await deleteCommunityPost(postId);

  redirect("/community");
}
