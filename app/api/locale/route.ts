type CloudflareRequest = Request & {
  cf?: {
    country?: string;
  };
};

const COUNTRY_LANGUAGE: Readonly<Record<string, "ko" | "zh" | "ja">> = {
  KR: "ko",
  CN: "zh",
  JP: "ja",
};

export async function GET(request: Request) {
  const cfCountry = (request as CloudflareRequest).cf?.country;
  const headerCountry = request.headers.get("cf-ipcountry");
  const country = (cfCountry || headerCountry || "").trim().toUpperCase();
  const language = COUNTRY_LANGUAGE[country] || "en";

  return Response.json(
    { language, country: country || null },
    {
      headers: {
        "Cache-Control": "private, no-store",
        Vary: "CF-IPCountry",
      },
    },
  );
}
