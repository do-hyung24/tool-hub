"use client";

import { InlineDeleteButton } from "@/app/_components/InlineDeleteButton";
import { deleteProposalAction } from "@/app/requestActions";

export function DeleteProposalButton({ proposalId }: { proposalId: string }) {
  return <InlineDeleteButton action={deleteProposalAction} hiddenFields={{ proposalId }} />;
}
