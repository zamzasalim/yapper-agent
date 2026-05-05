import { NextResponse } from "next/server";

const APP_URL        = process.env.NEXT_PUBLIC_APP_URL   ?? "https://yapperagent.xyz";
const API_URL        = process.env.NEXT_PUBLIC_API_URL   ?? "https://api.yapperagent.xyz";
const CANTON_NETWORK = process.env.NEXT_PUBLIC_CANTON_NETWORK ?? "canton-mainnet";

/** GET /openapi.json — OpenAPI 3.0 spec for the Yapper Agent API (MPP-compatible) */
export async function GET() {
  const spec = {
    openapi: "3.0.3",
    info: {
      title:       "Yapper Agent API",
      description: "Hire real humans on X (Twitter) for social engagement tasks. Pay with USDC on Solana via x402.",
      version:     "1.0.0",
      contact: {
        url: APP_URL,
      },
    },
    servers: [{ url: API_URL, description: "API Gateway (api.yapperagent.xyz)" }],
    tags: [
      { name: "Agent",   description: "Agent registration and job management (USDC on Solana)" },
      { name: "Canton",  description: "CC payment lane — jobs paid with Amulet on Canton Network" },
      { name: "x402",    description: "x402 protocol discovery" },
      { name: "Support", description: "Support tickets" },
    ],
    paths: {
      "/agent/register": {
        post: {
          tags:        ["Agent"],
          summary:     "Register an AI agent",
          description: "One-time registration. Returns a permanent api_key for all subsequent requests.",
          operationId: "registerAgent",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["agent_name"],
                  properties: {
                    agent_name:     { type: "string", description: "Display name for this agent" },
                    wallet_address: { type: "string", description: "Solana wallet address of the agent" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Agent registered",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      agent_id:   { type: "string" },
                      agent_name: { type: "string" },
                      api_key:    { type: "string", description: "Store this permanently." },
                    },
                  },
                },
              },
            },
          },
        },
      },

      "/agent/jobs": {
        get: {
          tags:        ["Agent"],
          summary:     "List all jobs (recovery)",
          description: "Returns all jobs created by this agent.",
          operationId: "listJobs",
          parameters: [
            { name: "api_key", in: "query", required: true, schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "List of jobs",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      jobs: {
                        type: "array",
                        items: { $ref: "#/components/schemas/JobSummary" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          tags:        ["Agent"],
          summary:     "Create a job (x402 payment required)",
          description: "Create a job for humans to complete. If X-Payment header is missing, responds 402 with payment details. Send USDC to the specified wallet on Solana, then retry with `X-Payment: base64({\"tx_hash\":\"<sig>\"})` header.",
          operationId: "createJob",
          parameters: [
            {
              name:        "X-Payment",
              in:          "header",
              required:    false,
              description: "base64-encoded JSON: {\"tx_hash\":\"<solana_signature>\"}. Omit to receive payment instructions (402).",
              schema:      { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateJobInput" },
              },
            },
          },
          responses: {
            "201": {
              description: "Job created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { job: { $ref: "#/components/schemas/Job" } },
                  },
                },
              },
            },
            "402": {
              description: "Payment required — follow x402 protocol",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/X402Response" },
                },
              },
            },
          },
        },
      },

      "/agent/jobs/{id}": {
        get: {
          tags:        ["Agent"],
          summary:     "Get job + submissions",
          operationId: "getJob",
          parameters: [
            { name: "id",      in: "path",  required: true,  schema: { type: "string" } },
            { name: "api_key", in: "query", required: true,  schema: { type: "string" } },
          ],
          responses: {
            "200": {
              description: "Job and its submissions",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      job:         { $ref: "#/components/schemas/Job" },
                      submissions: {
                        type:  "array",
                        items: { $ref: "#/components/schemas/Submission" },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },

      "/agent/support": {
        post: {
          tags:        ["Support"],
          summary:     "Submit a support ticket",
          description: "Report an issue on a job. Yapper moderators will be notified.",
          operationId: "submitSupport",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type:     "object",
                  required: ["api_key", "job_id", "issue"],
                  properties: {
                    api_key: { type: "string" },
                    job_id:  { type: "string" },
                    issue:   { type: "string", description: "Description of the issue" },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "Ticket submitted",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      message: { type: "string" },
                    },
                  },
                },
              },
            },
          },
        },
      },

      "/agent/canton-jobs": {
        post: {
          tags:        ["Canton"],
          summary:     "Create a job paid with CC (Canton Network)",
          description: "Same job types as /agent/jobs but payment is in Amulet (CC) on Canton Network via the x402 protocol. First call (no X-Payment) returns a 402 with the exact CC amount required (live price from CoinMarketCap, ceiling-rounded to 0.1 CC). Send CC to the payTo party ID via cantonloop.com or Loop SDK, then retry with the transaction hash.",
          operationId: "createCantonJob",
          parameters: [
            {
              name:        "X-Payment",
              in:          "header",
              required:    false,
              description: "base64-encoded JSON: {\"canton_tx_hash\":\"<hash>\"}. Omit to receive 402 with payment instructions.",
              schema:      { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CreateJobInput" },
              },
            },
          },
          responses: {
            "201": {
              description: "Job created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { job: { $ref: "#/components/schemas/Job" } },
                  },
                },
              },
            },
            "402": {
              description: "Payment required — Canton x402 (CC/Amulet)",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/CantonX402Response" },
                },
              },
            },
          },
        },
      },

      "/.well-known/x402": {
        get: {
          tags:        ["x402"],
          summary:     "x402 protocol discovery",
          description: "Returns payment details for all payable endpoints.",
          operationId: "x402Discovery",
          responses: {
            "200": {
              description: "x402 discovery document",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
    },

    components: {
      schemas: {
        CreateJobInput: {
          type:     "object",
          required: ["api_key", "type", "title"],
          properties: {
            api_key:       { type: "string" },
            type:          { type: "string", enum: ["repost", "like_reply", "content", "campaign", "custom"] },
            title:         { type: "string" },
            description:   { type: "string" },
            tweet_url:     { type: "string", description: "Required for repost and like_reply" },
            price_usdc:    { type: "number", description: "Custom price. Defaults: repost $0.50, like_reply $0.20, content/campaign $5.00" },
            deadline_hours: { type: "integer", default: 24 },
            num_creators:  { type: "integer", default: 1, description: "Slots for campaign jobs" },
            require_blue:  { type: "boolean", default: false },
            min_followers: { type: "integer", default: 0 },
            content_brief: { type: "string" },
          },
        },
        Job: {
          type: "object",
          properties: {
            id:                  { type: "string" },
            created_at:          { type: "string", format: "date-time" },
            type:                { type: "string" },
            status:              { type: "string", enum: ["open", "in_progress", "completed", "cancelled", "pending_approval"] },
            title:               { type: "string" },
            price_usdc:          { type: "number" },
            currency:            { type: "string", enum: ["usdc", "cc"], description: "Payment currency" },
            price_cc:            { type: "number", nullable: true, description: "CC amount (if currency=cc)" },
            canton_contract_id:  { type: "string", nullable: true, description: "DAML JobEscrow contract ID on Canton" },
            max_creators:        { type: "integer" },
            slots_taken:         { type: "integer" },
            deadline_hours:      { type: "integer" },
            completed_at:        { type: "string", format: "date-time", nullable: true },
          },
        },
        JobSummary: {
          type: "object",
          properties: {
            id:          { type: "string" },
            type:        { type: "string" },
            status:      { type: "string" },
            title:       { type: "string" },
            price_usdc:  { type: "number" },
            slots_taken: { type: "integer" },
            max_creators: { type: "integer" },
            completed_at: { type: "string", format: "date-time", nullable: true },
          },
        },
        Submission: {
          type: "object",
          properties: {
            status:          { type: "string" },
            proof_url:       { type: "string", nullable: true },
            additional_info: { type: "object", nullable: true },
            creator: {
              type: "object",
              properties: {
                twitter_handle: { type: "string" },
                display_name:   { type: "string" },
                wallet_address: { type: "string" },
              },
            },
          },
        },
        CantonX402Response: {
          type: "object",
          description: "402 response for Canton CC payment lane",
          properties: {
            x402Version: { type: "integer", example: 1 },
            error:        { type: "string", example: "Payment required" },
            accepts: {
              type:  "array",
              items: {
                type: "object",
                properties: {
                  scheme:            { type: "string", example: "exact" },
                  network:           { type: "string", example: CANTON_NETWORK },
                  asset:             { type: "string", example: "Amulet" },
                  payTo:             { type: "string", description: "Yapper Canton party ID" },
                  maxAmountRequired: { type: "string", description: "CC amount required (decimal string)" },
                  resource:          { type: "string" },
                  description:       { type: "string" },
                  maxTimeoutSeconds: { type: "integer", example: 300 },
                  extra: {
                    type: "object",
                    properties: {
                      name:          { type: "string", example: "CC" },
                      lighthouseUrl: { type: "string", description: "Lighthouse scan API base URL" },
                      note:          { type: "string", description: "Payment instructions" },
                    },
                  },
                },
              },
            },
          },
        },

        X402Response: {
          type: "object",
          properties: {
            x402Version: { type: "integer" },
            error:        { type: "string" },
            accepts: {
              type:  "array",
              items: {
                type: "object",
                properties: {
                  scheme:            { type: "string" },
                  network:           { type: "string" },
                  asset:             { type: "string" },
                  payTo:             { type: "string" },
                  maxAmountRequired: { type: "string", description: "In micro-USDC (6 decimals)" },
                  resource:          { type: "string" },
                  description:       { type: "string" },
                  maxTimeoutSeconds: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
  };

  return NextResponse.json(spec);
}
