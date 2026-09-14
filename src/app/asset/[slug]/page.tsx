import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Asset",
};

type AssetPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AssetPage({ params }: AssetPageProps) {
  await params;
  notFound();
}
