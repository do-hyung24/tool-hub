import "server-only";
import { randomUUID } from "node:crypto";
import { ensureInitialized, getSql } from "./db";
import type { Category, Listing, Seller } from "./types";

type ListingRow = {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  code_url: string;
  scan_result: Listing["scanResult"] | null;
  is_verified: boolean;
  created_at: string;
  seller_id: string;
};

function rowToListing(row: ListingRow): Listing {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    price: row.price,
    category: row.category as Category,
    codeUrl: row.code_url,
    scanResult: row.scan_result,
    isVerified: row.is_verified,
    createdAt: row.created_at,
    sellerId: row.seller_id,
  };
}

export async function getListings(): Promise<Listing[]> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM listings ORDER BY created_at DESC
  `) as ListingRow[];
  return rows.map(rowToListing);
}

export async function getListingById(id: string): Promise<Listing | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM listings WHERE id = ${id}
  `) as ListingRow[];
  return rows[0] ? rowToListing(rows[0]) : null;
}

export async function getSellerById(id: string): Promise<Seller | null> {
  await ensureInitialized();
  const sql = getSql();
  const rows = (await sql`
    SELECT * FROM sellers WHERE id = ${id}
  `) as Seller[];
  return rows[0] ?? null;
}

export async function addListing(
  input: Omit<
    Listing,
    "id" | "createdAt" | "scanResult" | "isVerified" | "sellerId"
  >
): Promise<Listing> {
  await ensureInitialized();
  const sql = getSql();

  const listing: Listing = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    scanResult: null,
    isVerified: false,
    // 아직 로그인/판매자 프로필이 없어 임시로 첫 판매자에게 귀속시킵니다.
    sellerId: "s1",
  };

  await sql`
    INSERT INTO listings (
      id, title, description, price, category, code_url,
      scan_result, is_verified, created_at, seller_id
    )
    VALUES (
      ${listing.id}, ${listing.title}, ${listing.description}, ${listing.price},
      ${listing.category}, ${listing.codeUrl}, ${null},
      ${listing.isVerified}, ${listing.createdAt}, ${listing.sellerId}
    )
  `;

  return listing;
}

export async function updateListingScanResult(
  id: string,
  scanResult: Listing["scanResult"]
): Promise<void> {
  await ensureInitialized();
  const sql = getSql();

  await sql`
    UPDATE listings
    SET
      scan_result = ${scanResult ? JSON.stringify(scanResult) : null},
      is_verified = ${scanResult?.passed ?? false}
    WHERE id = ${id}
  `;
}
