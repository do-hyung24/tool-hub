"use client";

import { InlineDeleteButton } from "@/app/_components/InlineDeleteButton";
import { deleteCommunityPostAction } from "@/app/communityActions";

export function DeleteCommunityPostButton({ postId }: { postId: string }) {
  return <InlineDeleteButton action={deleteCommunityPostAction} hiddenFields={{ postId }} />;
}
