import { fetchWorldBankPreview, WorldBankPreviewError } from "@/lib/assets/worldbank-preview";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ indicator: string }> },
): Promise<Response> {
  const { indicator: rawIndicator } = await params;
  try {
    const points = await fetchWorldBankPreview(rawIndicator);

    return Response.json(
      { points },
      {
        headers: {
          "cache-control": "public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800",
          "x-content-type-options": "nosniff",
        },
      },
    );
  } catch (error) {
    return error instanceof WorldBankPreviewError
      ? errorResponse(error.status, error.message)
      : errorResponse(502, "World Bank data is temporarily unavailable.");
  }
}

function errorResponse(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } },
  );
}
