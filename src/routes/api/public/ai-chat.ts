import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const DEFAULT_MODEL = "google/gemini-3-flash-preview";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Lovable-AIG-Run-ID",
};

const chatBodySchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string(),
    }),
  ),
});

function aiErrorMessage(error: unknown) {
  const raw = error instanceof Error ? error.message : "AI request failed";
  if (raw.includes("429") || raw.toLowerCase().includes("rate")) {
    return "L'IA est temporairement limitée. Réessaie dans un instant.";
  }
  if (raw.includes("402") || raw.toLowerCase().includes("credit")) {
    return "Les crédits IA du workspace sont épuisés.";
  }
  return raw;
}

export const Route = createFileRoute("/api/public/ai-chat")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { headers: corsHeaders }),
      POST: async ({ request }) => {
        try {
          const parsed = chatBodySchema.safeParse(await request.json());
          if (!parsed.success) {
            return Response.json(
              { error: "Messages invalides." },
              { status: 400, headers: corsHeaders },
            );
          }

          const lovableApiKey = process.env.LOVABLE_API_KEY;
          if (!lovableApiKey) {
            return Response.json(
              { error: "Lovable AI n'est pas encore configuré pour ce projet." },
              { status: 500, headers: corsHeaders },
            );
          }

          const [{ generateText }, aiGateway] = await Promise.all([
            import("ai"),
            import("@/lib/ai-gateway.server"),
          ]);
          const gateway = aiGateway.createLovableAiGatewayProvider(
            lovableApiKey,
            aiGateway.getLovableAiGatewayRunId(request),
          );
          const result = await generateText({
            model: gateway(DEFAULT_MODEL),
            messages: parsed.data.messages,
          });

          return Response.json(
            { text: result.text },
            {
              headers: aiGateway.getLovableAiGatewayResponseHeaders(
                result.response.headers,
                corsHeaders,
              ),
            },
          );
        } catch (error) {
          return Response.json(
            { error: aiErrorMessage(error) },
            { status: 500, headers: corsHeaders },
          );
        }
      },
    },
  },
});