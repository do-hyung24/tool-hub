"use client";

import { InlineDeleteButton } from "@/app/_components/InlineDeleteButton";
import { deleteListingAction } from "@/app/actions";

export function DeleteListingButton({ listingId }: { listingId: string }) {
  return <InlineDeleteButton action={deleteListingAction} hiddenFields={{ listingId }} />;
}
