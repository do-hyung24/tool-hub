import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getCommunityPostById,
  getReportedCommentIds,
  hasReportedCommunityPost,
  listCommunityCommentsForPost,
} from "@/lib/data";
import { getCurrentSellerId } from "@/lib/session";
import { formatDate, getProfileImageSrc } from "@/lib/format";
import { ReportButton } from "../ReportButton";
import { CommentForm } from "./CommentForm";

function AuthorAvatar({ src, sizeClassName }: { src: string | null; sizeClassName: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className={`${sizeClassName} rounded-full object-cover`} />;
  }
  return (
    <span
      className={`${sizeClassName} flex items-center justify-center rounded-full bg-zinc-200 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3/5 w-3/5">
        <path d="M12 12c2.7 0 4.9-2.2 4.9-4.9S14.7 2.2 12 2.2 7.1 4.4 7.1 7.1 9.3 12 12 12Zm0 2.4c-3.3 0-9.8 1.6-9.8 4.9v2.5h19.6v-2.5c0-3.3-6.5-4.9-9.8-4.9Z" />
      </svg>
    </span>
  );
}

export default async function CommunityPostDetailPage(props: PageProps<"/community/[postId]">) {
  const { postId } = await props.params;
  const post = await getCommunityPostById(postId);
  if (!post || post.hidden) {
    notFound();
  }

  const [comments, sellerId] = await Promise.all([
    listCommunityCommentsForPost(postId),
    getCurrentSellerId(),
  ]);

  const [postAlreadyReported, reportedCommentIds] = sellerId
    ? await Promise.all([
        hasReportedCommunityPost(postId, sellerId),
        getReportedCommentIds(
          comments.map((comment) => comment.id),
          sellerId
        ),
      ])
    : [false, new Set<string>()];

  const authorImageSrc = getProfileImageSrc(post.authorSellerId, post.authorProfileImageUrl);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <Link href="/community" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
        ← 목록으로
      </Link>

      <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          {post.category}
        </span>
        <span>{formatDate(post.createdAt)}</span>
      </div>

      <h1 className="mt-2 text-2xl font-bold">{post.title}</h1>

      <div className="mt-3 flex items-center gap-2">
        <AuthorAvatar src={authorImageSrc} sizeClassName="h-6 w-6" />
        <span className="text-sm text-zinc-600 dark:text-zinc-300">{post.authorNickname}</span>
      </div>

      <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
        {post.content}
      </p>

      <div className="mt-4">
        <ReportButton
          apiPath={`/api/community/posts/${post.id}/report`}
          initiallyReported={postAlreadyReported}
          isLoggedIn={!!sellerId}
        />
      </div>

      <section className="mt-10 border-t border-zinc-200 pt-8 dark:border-zinc-800">
        <h2 className="text-sm font-semibold">댓글 {comments.length}개</h2>

        <ul className="mt-4 flex flex-col gap-4">
          {comments.length === 0 && (
            <li className="text-sm text-zinc-400 dark:text-zinc-500">아직 댓글이 없습니다.</li>
          )}
          {comments.map((comment) => {
            const commentImageSrc = getProfileImageSrc(
              comment.authorSellerId,
              comment.authorProfileImageUrl
            );
            return (
              <li
                key={comment.id}
                className="flex flex-col gap-1.5 border-b border-zinc-100 pb-4 dark:border-zinc-900"
              >
                <div className="flex items-center gap-2">
                  <AuthorAvatar src={commentImageSrc} sizeClassName="h-5 w-5" />
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                    {comment.authorNickname}
                  </span>
                  <span className="text-xs text-zinc-400 dark:text-zinc-500">
                    {formatDate(comment.createdAt)}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                  {comment.content}
                </p>
                <ReportButton
                  apiPath={`/api/community/comments/${comment.id}/report`}
                  initiallyReported={reportedCommentIds.has(comment.id)}
                  isLoggedIn={!!sellerId}
                />
              </li>
            );
          })}
        </ul>

        {sellerId ? (
          <CommentForm postId={post.id} />
        ) : (
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">
            댓글을 남기려면{" "}
            <Link href="/login" className="font-medium text-zinc-900 underline dark:text-zinc-50">
              로그인
            </Link>
            해주세요.
          </p>
        )}
      </section>
    </main>
  );
}
