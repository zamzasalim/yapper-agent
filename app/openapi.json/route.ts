import { NextResponse } from "next/server";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://yapperagent.xyz";

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
    servers: [{ url: APP_URL }],
    tags: [
      { name: "Agent",    description: "Agent registration and job management" },
      { name: "x402",     description: "x402 protocol discovery" },
      { name: "Support",  description: "Support tickets" },
    ],
    paths: {
      "/api/agent/register": {
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

      "/api/agent/jobs": {
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

      "/api/agent/jobs/{id}": {
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

      "/api/agent/support": {
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
            id:            { type: "string" },
            created_at:    { type: "string", format: "date-time" },
            type:          { type: "string" },
            status:        { type: "string", enum: ["open", "in_progress", "completed", "cancelled", "pending_approval"] },
            title:         { type: "string" },
            price_usdc:    { type: "number" },
            max_creators:  { type: "integer" },
            slots_taken:   { type: "integer" },
            deadline_hours: { type: "integer" },
            completed_at:  { type: "string", format: "date-time", nullable: true },
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
