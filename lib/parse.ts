import Anthropic from "@anthropic-ai/sdk";
import { ParsedEntry, RequiredField, computeMissing } from "./types";

const MODEL = "claude-opus-4-8";

// Structured-outputs JSON schema for the parsed entry. Structured outputs
// don't allow numeric min/max constraints, so effectiveness uses an enum.
const ENTRY_SCHEMA = {
  type: "object",
  properties: {
    date: {
      type: "string",
      description:
        "Session date as YYYY-MM-DD. Resolve relative dates ('yesterday', 'last Tuesday') against today's date given in the instructions. Default to today if no date is mentioned.",
    },
    location: { anyOf: [{ type: "string" }, { type: "null" }] },
    who: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Name or descriptor of the person hypnotized ('Tomás', 'a waitress at the café'). Null if not mentioned.",
    },
    language: {
      type: "string",
      description:
        "Language the session was conducted in, inferred from context. Default 'English'.",
    },
    goal: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description: "What the person wanted, in a short phrase.",
    },
    goal_tag: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Normalized lowercase category for the goal (e.g. 'confidence', 'sleep', 'anxiety', 'habit change', 'performance'). Reuse an existing tag whenever one fits.",
    },
    metaphors: {
      type: "array",
      items: { type: "string" },
      description:
        "Each distinct metaphor/visualization as its own short item, e.g. 'radio volume knob — turn down analytical channel'.",
    },
    technique: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Induction/technique used (e.g. 'fractionation', 'Elman', 'confusion', 'arm levitation').",
    },
    effectiveness: {
      anyOf: [
        { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
        { type: "null" },
      ],
      description:
        "How well it worked, 1-10, only if stated or clearly implied ('it was an 8').",
    },
    notes: {
      anyOf: [{ type: "string" }, { type: "null" }],
      description:
        "Everything else worth keeping: reactions, quotes, surprises, follow-up texts.",
    },
    missing_required: {
      type: "array",
      items: {
        type: "string",
        enum: ["effectiveness", "goal", "metaphors", "technique"],
      },
      description: "Required fields that could not be extracted.",
    },
  },
  required: [
    "date",
    "location",
    "who",
    "language",
    "goal",
    "goal_tag",
    "metaphors",
    "technique",
    "effectiveness",
    "notes",
    "missing_required",
  ],
  additionalProperties: false,
} as const;

function systemPrompt(existingTags: string[], today: string): string {
  return `You are the parsing engine of a personal hypnosis session logger. The user is a hypnotist who dictates free-form descriptions of one-on-one hypnosis sessions. Extract the session into structured fields.

Today's date is ${today}. Resolve relative dates ("yesterday", "last Tuesday") against it.

Rules:
- Only extract what is actually said or clearly implied. Never invent details.
- "who" and "location" are optional — null if not mentioned.
- "language" defaults to "English" unless the dump indicates otherwise ("I did it in French", the session clearly happened in another language).
- Split distinct metaphors/visualizations into separate short items; keep the hypnotist's own imagery and wording.
- "goal_tag" is a short normalized lowercase category. Existing tags in the log: ${
    existingTags.length ? existingTags.join(", ") : "(none yet)"
  }. Reuse one of these whenever it fits the goal; only create a new tag when nothing fits.
- "notes" captures useful extras (reactions, quotes, follow-up messages) but must not duplicate the other fields.
- List every required field you could not fill in "missing_required" (required: goal, metaphors, technique, effectiveness).`;
}

export type ParseRequest = {
  dump: string;
  entry?: Partial<ParsedEntry> | null;
  answers?: { field: RequiredField; answer: string }[];
};

export async function parseDump(
  req: ParseRequest,
  existingTags: string[]
): Promise<ParsedEntry> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw Object.assign(
      new Error(
        "ANTHROPIC_API_KEY is not configured — set it in your environment."
      ),
      { status: 503 }
    );
  }
  const client = new Anthropic();
  const today = new Date().toISOString().slice(0, 10);

  let userContent = `Voice dump of the session:\n\n"""\n${req.dump}\n"""`;
  if (req.entry && req.answers?.length) {
    userContent += `\n\nA previous parse produced this entry:\n${JSON.stringify(
      req.entry,
      null,
      2
    )}\n\nThe hypnotist answered follow-up question(s):\n${req.answers
      .map((a) => `- Asked about "${a.field}", they answered: "${a.answer}"`)
      .join(
        "\n"
      )}\n\nMerge the answers into the entry and return the full updated entry. Keep all previously extracted fields unless an answer corrects them.`;
  }

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt(existingTags, today),
    output_config: {
      format: { type: "json_schema", schema: ENTRY_SCHEMA },
    },
    messages: [{ role: "user", content: userContent }],
  });

  if (response.stop_reason === "refusal") {
    throw Object.assign(new Error("The model declined to parse this dump."), {
      status: 502,
    });
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") {
    throw Object.assign(new Error("Empty response from parser."), {
      status: 502,
    });
  }
  const parsed = JSON.parse(text.text) as ParsedEntry;
  parsed.language = parsed.language?.trim() || "English";
  parsed.metaphors = (parsed.metaphors ?? []).filter((m) => m && m.trim());
  // Recompute missing fields locally — the source of truth for follow-ups.
  parsed.missing_required = computeMissing(parsed);
  return parsed;
}
