```mermaid
flowchart TD
    %% ── CLASS DEFINITIONS ───────────────────────────────────────────────────
    classDef auth      fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    classDef client    fill:#fef3c7,stroke:#f59e0b,color:#92400e
    classDef creator   fill:#dcfce7,stroke:#22c55e,color:#14532d
    classDef admin     fill:#f3e8ff,stroke:#a855f7,color:#581c87
    classDef telegram  fill:#cffafe,stroke:#06b6d4,color:#164e63
    classDef done      fill:#f0fdf4,stroke:#16a34a,color:#14532d
    classDef err       fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef cancelled fill:#fafafa,stroke:#a3a3a3,color:#525252
    classDef cron      fill:#fdf4ff,stroke:#d946ef,color:#701a75

    %% ── AUTH ────────────────────────────────────────────────────────────────
    A1([Connect X]) --> A2[Reown AppKit Twitter OAuth]
    A2 --> A3[Embedded Solana wallet created]
    A3 --> A4{User in DB?}
    A4 -->|New| A5[POST /api/user\nCreate record\nScrapeBadger: followers + blue + name + avatar]
    A4 -->|Existing| A6[POST /api/user\nSync wallet\nRefresh followers + blue\nBackfill name / avatar]
    A5 & A6 --> A7[[Dashboard ready]]
    A7 --> EDITPROF[Edit Profile modal\nCustom display_name + avatar_url\nPATCH /api/user]
    A7 --> NOTIF[Notification bell in Navbar\nGET /api/notifications — polls every 30s\nBadge count on unread]
    NOTIF --> NOTIF_LIST[Dropdown list\ne.g. Job accepted / rejected / expired]
    NOTIF_LIST --> NOTIF_READALL[CheckCheck button\nPATCH /api/notifications?handle=xxx\nMarks all as read]

    %% ── CLIENT: POST JOB ────────────────────────────────────────────────────
    A7 --> CL1[Post Job page]
    A7 --> MKPL[Creator Marketplace\n/marketplace]
    MKPL --> DIRECTHIRE[Click Hire on creator card\n/post-job?creator=handle\nAppends customRate=true if creator has custom rate]
    DIRECTHIRE --> CL1_DH[Direct Hire mode\nType locked to Content — Campaign hidden\nnumCreators fixed at 1\nTier auto-selected from follower count\nIf customRate=true: free-form agreed price shown]
    CL1_DH --> CL2

    CL1 --> CL2{Job Type}
    CL2 -->|Retweet 0.50 USDC\nLike and Reply 0.20 USDC| CL3[Fixed price\nPreset or custom deadline]
    CL2 -->|Content or Campaign\ntier pricing| CL4[Select tier — multi except Super CT\nNano CT 5 · Small CT 25 · Big CT 50 · Super CT custom\nPrice = sum of selected tiers\nmax_creators capped at 500]
    CL2 -->|Custom\nadmin approval| CL5[Free-form brief\nNo payment yet]

    CL3 & CL4 --> CL6[Send USDC to escrow vault PDA]
    CL6 --> CL7[POST /api/verify-payment\nSolana RPC tx check]
    CL7 -->|Invalid TX| CL6
    CL7 -->|Valid TX| CL8[POST /api/jobs — status: open]
    CL5 --> CL9[POST /api/jobs — status: pending_approval]

    CL8 --> TGNOTIFY[Broadcast to Telegram channel]
    CL8 -->|if direct hire| NOTIF_CREATOR[POST /api/notifications\nNotify creator: client wants to hire you]
    CL9 -->|if direct hire| NOTIF_CREATOR
    NOTIF_CREATOR -.->|creator sees in bell| NOTIF

    %% ── CREATOR: ACCEPT AND WORK ────────────────────────────────────────────
    TGNOTIFY --> CR1
    A7 --> CR1[Browse Marketplace or Telegram notification]
    CR1 --> CR2[Accept job\nPATCH /api/jobs/:id/accept]
    CR2 --> CR3{Requirements check}
    CR3 -->|Fail: blue or followers| CRERR([Rejected])
    CR3 -->|Pass| CR4{max_creators?}

    CR4 -->|Single = 1\nor Campaign type with max 1| CR5[creator_id locked — status: in_progress]
    CR5 --> NOTIF_ACCEPT[POST /api/notifications\nNotify client: creator accepted]
    NOTIF_ACCEPT -.->|client sees in bell| NOTIF

    CR4 -->|Campaign more than 1| CR6[job_completions row created\nslots_taken++]
    CR6 --> NOTIF_SLOT[POST /api/notifications\nNotify client: creator joined — slot x of max]
    NOTIF_SLOT -.->|client sees in bell| NOTIF
    CR6 --> CR7{All slots filled?}
    CR7 -->|No| CR8[Job stays open — more creators can join]
    CR7 -->|Yes| CR9[status: in_progress]

    CR5 & CR8 & CR9 --> CR10[Creator does the work]
    CR10 --> CR11[Submit proof\nPOST /api/jobs/:id/verify-proof]
    CR11 --> CR12{Job type?}

    CR12 -->|Retweet| CR13A{In-memory retweeters cache?}
    CR13A -->|Cache hit — handle found| CR15
    CR13A -->|Cache miss or not found| CR13B[ScrapeBadger fetch retweeters\nMerge into cache]
    CR13B -->|Found in fresh list| CR15
    CR13B -->|Not found| PROOFERR([Retry later\ncache accumulates over time])

    CR12 -->|Like Reply / Content / Campaign / Custom| CR14[Validate proof URL\nmatches creator handle]
    CR14 -->|Wrong account| PROOFERR
    CR14 -->|Handle match| CR14B[Duplicate URL check\nSame URL in same campaign — 409\nSame URL in any other job — 409\nSkipped for repost jobs]
    CR14B -->|Duplicate found| PROOFERR
    CR13A & CR14B -->|Verified| CR15{Single or Campaign?}

    CR15 -->|Single| CR16[job: completed\ncompleted_at set — stats incremented\nDashboard: Under Review]
    CR15 -->|Campaign| CR17[completion row: completed\nStats incremented per slot\nDashboard: Under Review]
    CR17 --> CR18{All slots done?}
    CR18 -->|No| CR19[Waiting for other creators]
    CR18 -->|Yes| CR20[job: completed — completed_at set]
    CR20 --> NOTIF_CAMPAIGN_DONE[POST /api/notifications\nNotify client: all creators completed]
    NOTIF_CAMPAIGN_DONE -.->|client sees in bell| NOTIF
    CR16 & CR20 --> JOBDONE[[Job Completed\nDashboard: Under Review\nuntil admin batch credits]]

    %% ── POST-COMPLETION ─────────────────────────────────────────────────────
    JOBDONE --> EX1{Custom job\nextra fields?}
    EX1 -->|Yes| EX2[POST /api/jobs/:id/submit-info\nwallet + email + discord + telegram\ncreator_handle verified against job or completion]
    EX1 -->|No| CLREVIEW
    EX2 --> CLREVIEW

    CLREVIEW[Client — Jobs You Posted dashboard]
    CLREVIEW --> RV1[GET /api/jobs/:id/applicants\nView proof links + extra info\nExport CSV client-side]
    RV1 --> RV2[POST /api/jobs/:id/rate — 1 to 5 stars\nJob must be completed\nSingle: rating on job row\nCampaign: pass creator_handle — per-slot rating\nstored in job_completions\nAvg recalculated across all single + campaign ratings\nFallback to current rating if no prior ratings exist]

    JOBDONE --> AD5

    %% ── ADMIN: CREATORS TAB ─────────────────────────────────────────────────
    CRTAB[Admin — Creators tab\nSearch by handle or name — Paginated 10/page\nShows custom rate flag per creator]
    CRTAB --> CRTAB_SET[Toggle custom rate ON\nPATCH /api/admin/creators\ncustom_content_rate = TRUE]
    CRTAB_SET --> CRTAB_FX([Creator card shows Rate arrow\nHire link appends customRate=true\nClient enters agreed price in post-job form])
    CRTAB --> CRTAB_CLR[Toggle custom rate OFF\ncustom_content_rate = NULL\nReverts to follower-tier price]

    %% ── ADMIN: PENDING TAB ──────────────────────────────────────────────────
    CL9 --> AD_PEND
    AD_PEND[Admin — Pending tab\nSearch + type filter]
    AD_PEND --> AD1D[View Details modal\nBrief + deadline + access + reward]
    AD1D --> AD2{Decision}
    AD2 -->|Reject| AD3[status: cancelled\ncancel_reason: admin_rejected]
    AD3 --> NOTIFCREATE[POST /api/notifications\nNotify client: job rejected]
    NOTIFCREATE -.->|client sees in bell| NOTIF
    AD3 --> AD_CAN
    AD2 -->|Approve| AD4[status: open\nPATCH /api/jobs/:id/approve]
    AD4 --> TGNOTIFY

    %% ── ADMIN: ACTIVE TAB ───────────────────────────────────────────────────
    AD_ACT[Admin — Active tab\nSearch + type + status filter]
    AD_ACT --> MANUALEXPIRE[POST /api/admin/expire-jobs\nAuto-run on tab load]
    AD_ACT --> ADMHIDE[Hide / Show — PATCH is_hidden]
    AD_ACT --> ADMEXT[Extend Deadline\nCalendarDays modal — PATCH deadline_override]
    AD_ACT --> ADMCANCEL[Cancel job\nstatus: cancelled — cancel_reason: admin_rejected\naccepted completions → missed]
    AD_ACT --> ADMVIEW[View Creators modal\nGET /api/jobs/:id/applicants\nShows handle · status · proof · completion_id]
    ADMVIEW --> ADM_REJ[Reject creator submission\nPOST /api/admin/completions/reject\ncompletion: status: rejected — slots_taken decremented — slot re-opened\nsingle job: status reset to open — proof cleared\nNotify creator via bell]
    ADM_REJ --> ADM_REOPENED([Slot available for another creator\nCredit item removed from payout queue])
    ADMCANCEL --> AD_CAN
    ADMHIDE -.->|hidden jobs excluded| CR1

    %% ── AUTO-EXPIRE: CRON + MANUAL ──────────────────────────────────────────
    CRON[GitHub Actions — every hour\nGET /api/cron/expire-jobs — CRON_SECRET protected]
    CRON --> PENDINGCHECK
    MANUALEXPIRE --> PENDINGCHECK

    PENDINGCHECK{Pass 0 — pending_approval older than 48h?}
    PENDINGCHECK -->|No| EXPCHECK
    PENDINGCHECK -->|Yes — admin did not act| PENDINGEXPIRE([status: cancelled\ncancel_reason: expired_no_approval\nNotify client: not reviewed in time])
    PENDINGEXPIRE --> AD_CAN

    EXPCHECK{Pass 1 — Job deadline passed?\nUses deadline_override if set\nelse created_at + deadline_hours}
    EXPCHECK -->|open + expired| PARTIALCHECK{Any completed slots?}
    PARTIALCHECK -->|No — zero work done| AUTOCANCEL([status: cancelled\ncancel_reason: expired_no_creator])
    AUTOCANCEL --> NOTIF_EXPIRE[POST /api/notifications\nNotify client: job expired]
    NOTIF_EXPIRE -.->|client sees in bell| NOTIF
    AUTOCANCEL --> AD_CAN
    PARTIALCHECK -->|Yes — some creators submitted| PARTCOMP[status: completed — completed_at set\naccepted-only slots → missed\nCompleted slots enter payout list]
    PARTCOMP --> NOTIF_PARTCOMP[POST /api/notifications\nNotify client: completed with partial creators]
    NOTIF_PARTCOMP -.->|client sees in bell| NOTIF
    PARTCOMP --> AD5
    EXPCHECK -->|in_progress + expired| AUTOCOMPLETE[status: completed — completed_at set\nCompleted slots enter payout list]
    AUTOCOMPLETE --> MISSEDSLOTS([accepted completions without proof\nstatus: missed])
    AUTOCOMPLETE --> NOTIF_FORCECOMP[POST /api/notifications\nNotify client: job deadline reached]
    NOTIF_FORCECOMP -.->|client sees in bell| NOTIF
    AUTOCOMPLETE --> AD5

    EXPCHECK --> SLOTCHECK{Pass 2 — Accept-to-submit window passed?\nrepost · like_reply: 1h\ncontent: 12h — campaign · custom: 24h\nlib/expire-jobs.ts shared by cron + admin}
    SLOTCHECK -->|completion accepted + window expired| SLOTREL[completion: status → missed\nslots_taken decremented\njob: in_progress → open if slots free]
    SLOTREL --> NOTIF_SLOTREL[POST /api/notifications\nNotify creator: slot released — didn't submit in time]
    NOTIF_SLOTREL -.->|creator sees in bell| NOTIF
    SLOTREL --> CR1

    %% ── ADMIN: COMPLETED TAB ────────────────────────────────────────────────
    AD5[Admin — Completed tab\nSearch + type + credited filter + pagination\nRe-fetches fresh data after batch credit]
    AD5 --> AD6[View Details modal\nJob info: client · amount · posted · completed · credit status\nSingle: creator + proof + wallet\nCampaign: per-slot creator + proof + wallet]
    AD6 --> AD7([Export Excel per job or bulk\nCredited badge shown when credited_at is set])

    %% ── ESCROW: CREDITS TAB ─────────────────────────────────────────────────
    AD5 -.->|completed not yet credited| ESCROW_PEND
    JOBDONE -.->|accumulates in| ESCROW_PEND

    ESCROW_PEND[Admin — Credits tab\nCompleted jobs where credited_at IS NULL\nCampaign completions only shown when parent job is closed\nnot open or in_progress\nGrouped by job: ID + title + type + creator list\nCustom jobs always shown even with price 0 — Mark Paid only\nnon-custom jobs: checkbox + batch credit]
    ESCROW_PEND --> ESC1[Admin connects Phantom wallet]
    ESCROW_PEND --> ESC_CUSTOM[Custom job — admin pays off-chain\nClick Mark Paid button\nPOST /api/admin/credits/mark-manual\ncredited_at set + credit_tx: manual\nNo on-chain tx required]
    ESC_CUSTOM --> ESC5
    ESC1 --> ESC2[Checkbox-select creators — non-custom only\nTotal USDC auto-calculated\nVault balance shown for sufficiency check]
    ESC2 --> ESC3[Click Batch Credit\nbuildCreditCreatorTx per creator\nPhantom signs + submits]
    ESC3 --> ESC4[ClaimRecord PDA updated on-chain\nvault total_credited incremented\nPOST /api/admin/credits/confirm — idempotent\ncredited_at + credit_tx set on jobs + job_completions\nCampaign: jobs.credited_at set when ALL slots credited\nDouble-call safe: only updates where credited_at IS NULL\nDashboard: Under Review to Done]
    ESC4 --> ESC5([Credits locked in vault\nCreator can now claim USDC])

    %% ── CREATOR: CLAIM ──────────────────────────────────────────────────────
    ESC5 --> CR_CLAIM
    CR_CLAIM[Creator Dashboard — Claimable Balance\nGET /api/user/claimable\nReads ClaimRecord PDA on-chain]
    CR_CLAIM --> CR_CLAIM2[Click Claim\nbuildClaimTx signed via Reown embedded wallet]
    CR_CLAIM2 --> CR_CLAIM3[USDC: vault PDA to creator wallet\nClaimRecord.amount reset to 0]
    CR_CLAIM3 --> CR_CLAIM4([Creator receives USDC\nTx viewable on Solscan])

    %% ── ADMIN: CANCELLED TAB ────────────────────────────────────────────────
    AD_CAN[Admin — Cancelled tab\nSearch + type filter + pagination]
    AD_CAN --> CANREASON{cancel_reason}
    CANREASON -->|expired_no_creator| CANEXP[Expired — No Creator]
    CANREASON -->|admin_rejected| CANADM[Admin Rejected]
    CANREASON -->|client_cancelled| CANCLI[Client Cancelled\nReserved — by design]
    AD_CAN --> CANVIEW[View Details modal — client brief + meta]
    AD_CAN --> RESTORE[POST /api/admin/jobs/:id/restore\nPre-check: any credited_at IS NOT NULL → 409 blocked\nstatus: open or pending_approval\ncancel_reason: null — creator_id: null\nslots_taken: 0 — deadline reset from now\nJob completions deleted]
    AD_CAN --> CANDEL[Delete permanently]
    AD_CAN --> REFUND[Copy Client Wallet\nMark Refunded — PATCH is_refunded]
    REFUND --> REFUNDED([Refund marked])
    RESTORE --> RESTORED([Back in marketplace or approval queue])

    %% ── TELEGRAM BOT ────────────────────────────────────────────────────────
    subgraph TG["Telegram Bot"]
        direction TB
        TG1[Dashboard: Connect Telegram] --> TG2[POST /api/telegram/connect\nLink token — 15 min TTL]
        TG2 --> TG3[Open bot with token\nBot saves chat_id]
        TG3 --> TG4[Dashboard polls every 5s\nmax 2 min until confirmed]
        TG4 -->|2 min no confirm| TG_TIMEOUT([UI timed out\nClick Retry to regenerate token\nToken still valid for 15 min])
        TG_TIMEOUT -.-> TG2
        TG_DISCONNECT[Dashboard: Disconnect Telegram\nDELETE /api/telegram/connect\nClears chat_id + token] -.->|already connected| TG1

        TG5[Channel: Apply via Bot] --> TG6[Bot calls accept API with job_id]
        TG6 --> TG7[User sends proof URL\nBot calls verify-proof]
        TG7 --> TG8{Custom extras?}
        TG8 -->|Yes| TG9[Bot collects wallet / email / discord / telegram]
        TG8 -->|No| TG10([Done])
        TG9 --> TG10
    end

    %% ── AGENT-TO-HUMAN (x402 / MPP) ─────────────────────────────────────────
    subgraph AGENT["Agent-to-Human (x402 / MPP)"]
        direction TB
        AG1[POST /api/agent/register\nagent_name + wallet_address\nReturns permanent api_key]
        AG1 --> AG2[POST /api/agent/jobs\napi_key + job fields in body]
        AG2 -->|No X-Payment header| AG3[402 response\nx402Body: network + asset USDC\npayTo vault PDA — maxAmountRequired]
        AG3 --> AG4[Agent pays USDC on Solana\nRetries with X-Payment header]
        AG4 --> AG5{Payment valid?}
        AG5 -->|No| AG3
        AG5 -->|Yes| AG6[Job created — is_agent_job: true\nBroadcast to Telegram]
        AG6 --> AG7[Humans complete job — same creator flow]
        AG7 --> AG8[Agent polls\nGET /api/agent/jobs/:id?api_key=xxx\nReturns job + submissions with proof_url + creator info]
        AG8 --> AG9{All done?}
        AG9 -->|No| AG8
        AG9 -->|Yes| AG10([Agent receives responses\ncontinues workflow])
        AG1 -.->|List all jobs| AG11[GET /api/agent/jobs?api_key=xxx]
        AG6 -.->|Report issue| AG12[POST /api/agent/support\napi_key + job_id + issue\nNotifies admins via bell]
        AG2 -.->|Discovery| AGDISC[GET /.well-known/x402\nPayable endpoints + pricing per type]
        AG2 -.->|Quickstart| AGSKILL[GET /skill.md\nMarkdown guide for x402-compatible agents]
        AG2 -.->|OpenAPI spec| AGOAPI[GET /openapi.json — MPP-compatible]
        AG2 -.->|MCP| AGMCP[POST /mcp — JSON-RPC 2.0\ntools: register / create / list / get / support]
    end

    %% ── REFERENCE TABLES ────────────────────────────────────────────────────
    subgraph IDS["Job ID Format"]
        direction LR
        ID1["Retweet:     RH + 8-char UUID  (agent: RA)"]
        ID2["Like Reply:  LH + 8-char UUID  (agent: LA)"]
        ID3["Content:     CH + 8-char UUID  (agent: CA)"]
        ID4["Campaign:    EH + 8-char UUID  (agent: EA)"]
        ID5["Custom:      XH + 8-char UUID  (agent: XA)"]
    end

    subgraph CANCEL_REASONS["Cancel Reasons"]
        direction LR
        CR_1["expired_no_creator  — open job, deadline passed, no creator accepted"]
        CR_2["admin_rejected      — rejected from Pending OR cancelled from Active by admin"]
        CR_3["client_cancelled    — reserved for future client-side cancellation (by design)"]
        CR_4["expired_no_approval — pending_approval job not reviewed by admin within 48h"]
    end

    subgraph DB_FIELDS["Key DB Fields (jobs + job_completions)"]
        direction LR
        DB1["completed_at:      timestamptz  — set when status becomes completed"]
        DB2["cancel_reason:     text         — set when status becomes cancelled"]
        DB3["deadline_override: timestamptz  — admin override for expiry calculation"]
        DB4["is_refunded:       boolean      — admin marks refund sent to client wallet"]
        DB5["credited_at:       timestamptz  — set by admin batch credit (jobs + job_completions)"]
        DB6["credit_tx:         text         — on-chain tx sig for batch credit, or 'manual' for custom jobs paid off-chain"]
    end

    subgraph DASH_STATS["Creator Dashboard: Job Status Logic"]
        direction LR
        DS1["Active:       status = in_progress"]
        DS2["Under Review: status = completed AND credited_at IS NULL"]
        DS3["Done:         status = completed AND credited_at IS NOT NULL"]
    end

    %% ── NAVIGATION (dotted) ─────────────────────────────────────────────────
    A7 -.->|Connect flow| TG1
    TGNOTIFY -.->|Inline button| TG5
    A7 -.->|Admin only| CRTAB
    A7 -.->|Admin only| AD_PEND
    A7 -.->|Admin only| AD_ACT
    A7 -.->|Admin only| AD5
    A7 -.->|Admin only| AD_CAN

    %% ── CLASS ASSIGNMENTS ───────────────────────────────────────────────────
    class A1,A2,A3,A4,A5,A6,A7,EDITPROF auth
    class CL1,CL2,CL3,CL4,CL5,CL6,CL7,CL8,CL9 client
    class CLREVIEW,RV1,RV2 client
    class MKPL,DIRECTHIRE,CL1_DH client
    class NOTIF,NOTIF_LIST,NOTIF_READALL,NOTIF_CREATOR client
    class NOTIF_ACCEPT,NOTIF_SLOT,NOTIF_EXPIRE,NOTIF_CAMPAIGN_DONE,NOTIF_FORCECOMP,NOTIF_PARTCOMP client
    class CR1,CR2,CR3,CR4,CR5,CR6,CR7,CR8,CR9,CR10 creator
    class CR11,CR12,CR13A,CR13B,CR14,CR14B,CR15,CR16,CR17,CR18,CR19,CR20 creator
    class CR_CLAIM,CR_CLAIM2,CR_CLAIM3 creator
    class EX1,EX2 creator
    class AD_PEND,AD1D,AD2,AD3,AD4 admin
    class AD_ACT,ADMHIDE,ADMEXT,ADMCANCEL,ADMVIEW,ADM_REJ admin
    class AD5,AD6,AD7 admin
    class AD_CAN,CANVIEW,CANREASON,CANEXP,CANADM,CANCLI,RESTORE,CANDEL,REFUND admin
    class NOTIFCREATE,ESCROW_PEND,ESC1,ESC2,ESC3,ESC4,ESC_CUSTOM admin
    class CRTAB,CRTAB_SET,CRTAB_CLR admin
    class CRON,EXPCHECK,MANUALEXPIRE,PENDINGCHECK,PARTIALCHECK,SLOTCHECK,SLOTREL cron
    class TG1,TG2,TG3,TG4,TG5,TG6,TG7,TG8,TG9,TG10,TG_DISCONNECT,TGNOTIFY telegram
    class JOBDONE,RESTORED,REFUNDED,ESC5,CR_CLAIM4,CRTAB_FX,ESC_REOPENED,ADM_REOPENED done
    class CRERR,PROOFERR err
    class AUTOCANCEL,AUTOCOMPLETE,MISSEDSLOTS,TG_TIMEOUT,PENDINGEXPIRE cancelled
    class AG1,AG2,AG3,AG4,AG5,AG6,AG7,AG8,AG9,AG10,AG11,AG12 auth
    class AGDISC,AGSKILL,AGOAPI,AGMCP auth
```
