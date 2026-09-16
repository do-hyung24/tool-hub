"use client";

import { InlineDeleteButton } from "@/app/_components/InlineDeleteButton";
import { deleteToolRequestAction } from "@/app/requestActions";

export function DeleteRequestButton({ requestId }: { requestId: string }) {
  return <InlineDeleteButton action={deleteToolRequestAction} hiddenFields={{ requestId }} />;
}
