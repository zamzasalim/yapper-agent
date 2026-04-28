```mermaid
flowchart TD
    classDef auth      fill:#dbeafe,stroke:#3b82f6,color:#1e40af
    classDef client    fill:#fef3c7,stroke:#f59e0b,color:#92400e
    classDef creator   fill:#dcfce7,stroke:#22c55e,color:#14532d
    classDef admin     fill:#f3e8ff,stroke:#a855f7,color:#581c87
    classDef telegram  fill:#cffafe,stroke:#06b6d4,color:#164e63
    classDef done      fill:#f0fdf4,stroke:#16a34a,color:#14532d
    classDef err       fill:#fee2e2,stroke:#ef4444,color:#7f1d1d
    classDef cancelled fill:#fafafa,stroke:#a3a3a3,color:#525252
    classDef cron      fill:#fdf4ff,stroke:#d946ef,color:#701a75

    %% ── AUTH ────────────────────────────────────────────────────
    A1([Connect X]) --> A2[Reown AppKit Twitter OAuth]
    A2 --> A3[Embedded Solana wallet created]
    A3 --> A4{User in DB?}
    A4 -->|New| A5[POST /api/user\nCreate record\nScrapeBadger: followers + blue + name + avatar]
    A4 -->|Existing| A6[POST /api/user\nSync wallet\nRefresh followers + blue + backfill name/avatar]
    A5 & A6 --> A7[[Dashboard ready]]
    A7 --> EDITPROF[Edit Profile modal\nCustom display_name + avatar_url\nPATCH /api/user]
    A7 --> NOTIF[Notification bell in Navbar\nVisible only on /dashboard\nGET /api/notifications\nbadge count - polls every 30s]
    NOTIF --> NOTIF_LIST[Dropdown: notification list\ne.g. Your custom job XH-xxxx was rejected\nor @client wants to hire you directly]
    NOTIF_LIST --> NOTIF_READALL[CheckCheck button in header\nPATCH /api/notifications?handle=xxx\nMarks all as read - clears red badge]

    %% ── CLIENT: POST JOB ────────────────────────────────────────
    A7 --> CL1[Post Job page]
    A7 --> MKPL[Creator Marketplace\n/marketplace]
    MKPL --> DIRECTHIRE[Click Hire at creator\nopens /post-job?creator=handle and followers=n\nappends customRate=true if creator has custom rate flag set]
    DIRECTHIRE --> CL1_DH[Post Job - Direct Hire mode\nJob type locked to Content\nCampaign option hidden\nnumCreators fixed at 1\nTier auto-selected and locked\nbased on creator follower count\nIf customRate=true param: hasMacro=true\nfree-form agreed price input shown below tier\nno standard tier amount applied - client enters negotiated value]
    CL1_DH --> CL2

    CL1 --> CL2{Job Type}
    CL2 -->|Retweet 0.50 USDC\nLike and Reply 0.20 USDC| CL3[Fixed price\nPreset or custom deadline]
    CL2 -->|Content or Campaign\ntier pricing| CL4[Select tier - multi except Super CT\nNano CT 5 Small CT 25 Big CT 50 Super CT custom gt 50\nPrice = sum of selected tiers\nPreset or custom deadline]
    CL2 -->|Custom\nadmin approval| CL5[Free-form brief\nNo payment yet]

    CL3 & CL4 --> CL6[Send USDC to escrow vault PDA]
    CL6 --> CL7[POST /api/verify-payment\nSolana RPC check]
    CL7 -->|Invalid TX| CL6
    CL7 -->|Valid TX| CL8[POST /api/jobs\nstatus: open]
    CL5 --> CL9[POST /api/jobs\nstatus: pending_approval]

    CL8 --> TGNOTIFY[Broadcast to\nTelegram channel]
    CL8 -->|if direct hire| NOTIF_CREATOR[POST /api/notifications\nNotify creator:\nhandle = prefilledCreator\nmessage: @client wants to hire you directly]
    CL9 -->|if direct hire| NOTIF_CREATOR
    NOTIF_CREATOR -.->|creator sees in bell| NOTIF

    %% ── CREATOR: ACCEPT AND WORK ────────────────────────────────
    TGNOTIFY --> CR1
    A7 --> CR1[Browse Marketplace\nexcludes hidden jobs\nor Telegram notification]
    CR1 --> CR2[Accept job\nPATCH /api/jobs/:id/accept]
    CR2 --> CR3{Requirements check}
    CR3 -->|Fail: blue or followers| CRERR([Rejected])
    CR3 -->|Pass| CR4{max creators?}

    CR4 -->|Single = 1| CR5[creator_id locked\nstatus: in_progress]
    CR5 --> NOTIF_ACCEPT[POST /api/notifications\nNotify client: creator accepted job]
    NOTIF_ACCEPT -.->|client sees in bell| NOTIF
    CR4 -->|Campaign more than 1| CR6[job_completions row\nslots_taken++]
    CR6 --> NOTIF_SLOT[POST /api/notifications\nNotify client: creator joined campaign\nslot x of max]
    NOTIF_SLOT -.->|client sees in bell| NOTIF
    CR4 -->|Campaign type with max 1\ntreated as Single| CR5
    CR6 --> CR7{All slots filled?}
    CR7 -->|No| CR8[Job stays open\nmore creators can join]
    CR7 -->|Yes| CR9[status: in_progress]

    CR5 & CR8 & CR9 --> CR10[Creator does the work]
    CR10 --> CR11[Submit proof\nPOST /api/jobs/:id/verify-proof]
    CR11 --> CR12{Job type}
    CR12 -->|Retweet| CR13A{In-memory\nretweeters cache?}
    CR13A -->|Cache hit - handle found| CR15
    CR13A -->|Cache miss or not found| CR13B[ScrapeBadger\nfetch retweeters list\nmerge into cache]
    CR13B -->|Found in fresh list| CR15
    CR13B -->|Not found| PROOFERR([Retry later\ncache accumulates\nover time])
    CR12 -->|Like Reply Content Campaign Custom| CR14[Validate proof URL\nmatches creator handle]
    CR14 -->|Wrong account| PROOFERR
    CR13A & CR14 -->|Verified| CR15{Single or Campaign?}

    CR15 -->|Single| CR16[job: completed\ncompleted_at set\nstats incremented\nDashboard: Under Review]
    CR15 -->|Campaign| CR17[completion row: completed\nstats incremented per slot\nDashboard: Under Review]
    CR17 --> CR18{All slots done?}
    CR18 -->|No| CR19[Waiting for others]
    CR18 -->|Yes| CR20[job: completed\ncompleted_at set]
    CR20 --> NOTIF_CAMPAIGN_DONE[POST /api/notifications\nNotify client: all creators\ncompleted your campaign]
    NOTIF_CAMPAIGN_DONE -.->|client sees in bell| NOTIF
    CR16 & CR20 --> JOBDONE[[Job Completed\nDashboard: Under Review\nuntil admin batch credits]]

    %% ── POST-COMPLETION ─────────────────────────────────────────
    JOBDONE --> EX1{Custom job\nextra fields?}
    EX1 -->|Yes| EX2[POST /api/jobs/:id/submit-info\nwallet + email + discord + telegram\ncreator_handle verified against\ncompleted job or completion row]
    EX1 -->|No| CLREVIEW
    EX2 --> CLREVIEW

    CLREVIEW[Client - Jobs You Posted dashboard]
    CLREVIEW --> RV1[GET /api/jobs/:id/applicants\nView proof links + extra info\nExport CSV]
    RV1 --> RV2[POST /api/jobs/:id/rate\n1-5 stars - job must be completed\nSingle: rating stored on job row\nCampaign: pass creator_handle - per-slot rating\nstored in job_completions - avg recalculated\nfrom both single-job and campaign ratings]

    JOBDONE --> AD5

    %% ── ADMIN: CREATORS TAB (CUSTOM RATE) ──────────────────────
    CRTAB[Admin - Creators tab\nSearch all creators by handle or name\nPaginated list 10 per page\nSee boolean custom rate flag per creator]
    CRTAB --> CRTAB_SET[Toggle custom rate flag ON\nPATCH /api/admin/creators\nbody: rate: true\ncustom_content_rate = TRUE in users table]
    CRTAB_SET --> CRTAB_FX([Creator card shows Rate ↗ instead of tier price\nHire link appends customRate=true\nAgreed price entered by client in post-job form])
    CRTAB --> CRTAB_CLR[Toggle custom rate flag OFF\nPATCH /api/admin/creators\nbody: rate: null\ncustom_content_rate = NULL\nReverts to follower-tier price on card]

    %% ── ADMIN: PENDING TAB ──────────────────────────────────────
    CL9 --> AD_PEND
    AD_PEND[Admin - Pending tab\nsearch + type filter + table]
    AD_PEND --> AD1D[View Details modal\nbrief + deadline + access + reward]
    AD1D --> AD2{Decision}
    AD2 -->|Reject| AD3[status: cancelled\ncancel_reason: admin_rejected]
    AD3 --> NOTIFCREATE[POST /api/notifications\ncreate rejection notification\nfor job owner]
    AD3 --> AD_CAN
    NOTIFCREATE -.->|client sees in bell| NOTIF
    AD2 -->|Approve| AD4[status: open\nPATCH /api/jobs/:id/approve]
    AD4 --> TGNOTIFY

    %% ── ADMIN: ACTIVE TAB ───────────────────────────────────────
    AD_ACT[Admin - Active tab\nsearch + type + status filter]
    AD_ACT --> MANUALEXPIRE[POST /api/admin/expire-jobs\nauto-run on tab load]
    AD_ACT --> ADMHIDE[Hide / Show\nPATCH is_hidden]
    AD_ACT --> ADMEXT[Extend Deadline\nCalendarDays modal\nPATCH deadline_override]
    AD_ACT --> ADMCANCEL[Cancel job\nstatus: cancelled\ncancel_reason: admin_rejected]
    ADMCANCEL --> AD_CAN
    ADMHIDE -.->|hidden jobs excluded| CR1

    %% ── AUTO-EXPIRE: CRON + MANUAL ──────────────────────────────
    CRON[GitHub Actions - every hour\nGET /api/cron/expire-jobs\nCRON_SECRET protected]
    CRON --> EXPCHECK
    MANUALEXPIRE --> EXPCHECK

    EXPCHECK{Deadline passed?\nUses deadline_override\nif set, else\ncreated_at + deadline_hours}
    EXPCHECK -->|open + expired| AUTOCANCEL([status: cancelled\ncancel_reason: expired_no_creator])
    AUTOCANCEL --> NOTIF_EXPIRE[POST /api/notifications\nNotify client: job expired\nno creator accepted in time]
    NOTIF_EXPIRE -.->|client sees in bell| NOTIF
    AUTOCANCEL --> AD_CAN
    EXPCHECK -->|in_progress + expired| AUTOCOMPLETE[status: completed\ncompleted_at set\ncompleted slots still enter payout list]
    AUTOCOMPLETE --> MISSEDSLOTS([accepted job_completions without proof\nstatus: missed])
    AUTOCOMPLETE --> NOTIF_FORCECOMP[POST /api/notifications\nNotify client: job reached deadline\nmarked completed]
    NOTIF_FORCECOMP -.->|client sees in bell| NOTIF
    AUTOCOMPLETE --> AD5

    %% ── ADMIN: COMPLETED TAB ────────────────────────────────────
    AD5[Admin - Completed tab\nsearch + type + credited filter + pagination]
    AD5 --> AD6[View Details modal\ncreator handle + proof + wallet\nCampaign: completions array\nper-slot creator + proof + wallet]
    AD6 --> AD7([Export Excel per job or bulk\nCredited badge shown when credited_at is set])

    %% ── ESCROW: CREDITS TAB ─────────────────────────────────────
    AD5 -.->|completed not yet credited| ESCROW_PEND
    JOBDONE -.->|accumulates in| ESCROW_PEND

    ESCROW_PEND[Admin - Credits tab\nList completed jobs where credited_at IS NULL\nGrouped by job: job ID + title + type + creator list]
    ESCROW_PEND --> ESC1[Admin connects Phantom\nadmin wallet in browser]
    ESC1 --> ESC2[Checkbox-select creators\nTotal USDC auto-calculated\nVault balance shown for sufficiency check]
    ESC2 --> ESC3[Click Batch Credit\nbuildCreditCreatorTx per creator\nPhantom signs + submits]
    ESC3 --> ESC4[ClaimRecord PDA per creator updated on-chain\nvault total_credited incremented\nPOST /api/admin/credits/confirm\ncredited_at + credit_tx set in DB\nDashboard: moves from Under Review to Done]
    ESC4 --> ESC5([Credits locked in vault\ncreator can now claim USDC])

    %% ── CREATOR: CLAIM ──────────────────────────────────────────
    ESC5 --> CR_CLAIM
    CR_CLAIM[Creator Dashboard\nClaimable Balance card visible when balance gt 0\nGET /api/user/claimable → fetchClaimable reads ClaimRecord on-chain]
    CR_CLAIM --> CR_CLAIM2[Click Claim\nbuildClaimTx signed via Reown embedded wallet]
    CR_CLAIM2 --> CR_CLAIM3[USDC: vault PDA → creator wallet\nClaimRecord.amount reset to 0]
    CR_CLAIM3 --> CR_CLAIM4([Creator receives USDC\nTx viewable on Solscan])

    %% ── ADMIN: CANCELLED TAB ────────────────────────────────────
    AD_CAN[Admin - Cancelled tab\nsearch + type filter + pagination]
    AD_CAN --> CANREASON{cancel_reason}
    CANREASON -->|expired_no_creator| CANEXP[Expired - No Creator]
    CANREASON -->|admin_rejected| CANADM[Admin Rejected]
    CANREASON -->|client_cancelled| CANCLI[Client Cancelled]
    AD_CAN --> CANVIEW[View Details modal\nclient brief + meta]
    AD_CAN --> RESTORE[POST /api/admin/jobs/:id/restore\nstatus: open or pending_approval for custom\ncancel_reason: null\ncreator_id: null\nslots_taken: 0\ndeadline_override = now + deadline_hours\ndelete job_completions]
    AD_CAN --> CANDEL[Delete permanently]
    AD_CAN --> REFUND[Copy Client Wallet\nMark Refunded\nPATCH is_refunded]
    REFUND --> REFUNDED([Refund marked])
    RESTORE --> RESTORED([Back in marketplace or approval queue\ndeadline reset from now])

    %% ── TELEGRAM BOT ────────────────────────────────────────────
    subgraph TG["Telegram Bot"]
        direction TB
        TG1[Dashboard: Connect Telegram] --> TG2[POST /api/telegram/connect\nLink token 15 min TTL]
        TG2 --> TG3[Open bot with token\nBot saves chat_id]
        TG3 --> TG4[Dashboard polls every 3s\nmax 2 min until confirmed]
        TG4 -->|2 min no confirm| TG_TIMEOUT([UI timed out\nClick Retry to regenerate token\nNote: actual token still valid 15 min])
        TG_TIMEOUT -.-> TG2
        TG_DISCONNECT[Dashboard: Disconnect Telegram\nDELETE /api/telegram/connect\nClears chat_id + token fields] -.->|already connected| TG1

        TG5[Channel: Apply via Bot] --> TG6[Bot calls accept API\nwith job id]
        TG6 --> TG7[User sends proof URL\nBot calls verify-proof]
        TG7 --> TG8{Custom extras?}
        TG8 -->|Yes| TG9[Bot collects\nwallet email discord telegram]
        TG8 -->|No| TG10([Done])
        TG9 --> TG10
    end

    %% ── REFERENCE ───────────────────────────────────────────────
    %% ── AGENT-TO-HUMAN ─────────────────────────────────────────
    subgraph AGENT["Agent-to-Human (x402 / MPP)"]
        direction TB
        AG1[POST /api/agent/register\nagent_name + wallet_address\nReturns permanent api_key]
        AG1 --> AG2[POST /api/agent/jobs\napi_key + job fields in body]
        AG2 -->|No X-Payment header| AG3[402 response\nx402Body: network devnet or mainnet from env\nasset USDC - payTo vault PDA\nmaxAmountRequired in micro-USDC]
        AG3 --> AG4[Agent pays USDC on Solana\nRetries with X-Payment header\nbase64 json tx_hash OR raw sig]
        AG4 --> AG5{Payment valid?}
        AG5 -->|No| AG3
        AG5 -->|Yes| AG6[Job created\nis_agent_job: true\nBroadcast to Telegram]
        AG6 --> AG7[Humans complete job\nsame creator flow]
        AG7 --> AG8[Agent polls\nGET /api/agent/jobs/:id?api_key=xxx\nReturns job + submissions array\nwith proof_url + creator info]
        AG8 --> AG9{All done?}
        AG9 -->|No| AG8
        AG9 -->|Yes| AG10([Agent receives responses\ncontinues its workflow])
        AG1 -.->|Recovery: list all jobs| AG11[GET /api/agent/jobs?api_key=xxx]
        AG6 -.->|Issue on job| AG12[POST /api/agent/support\napi_key + job_id + issue\nNotifies admins via bell]
        AG2 -.->|Discovery| AGDISC[GET /.well-known/x402\nLists payable endpoints\npricing per job type]
        AG2 -.->|Skill file| AGSKILL[GET /skill.md\nMarkdown quickstart\nfor x402-compatible agents]
        AG2 -.->|MPP spec| AGOAPI[GET /openapi.json\nOpenAPI 3.0 spec\nfor MPP-compatible agents]
        AG2 -.->|MCP| AGMCP[POST /mcp\nJSON-RPC 2.0\nModel Context Protocol\ntools: register create list get support]
    end

    subgraph IDS["Job ID Format"]
        direction LR
        ID1["Retweet:      RH + 8-char UUID"]
        ID2["Like Reply:   LH + 8-char UUID"]
        ID3["Content:      CH + 8-char UUID"]
        ID4["Campaign:     EH + 8-char UUID"]
        ID5["Custom:       XH + 8-char UUID"]
        ID6["Agent jobs:   RA  LA  CA  EA  XA  (is_agent_job: true)"]
    end

    subgraph CANCEL_REASONS["Cancel Reasons"]
        direction LR
        CR_1["expired_no_creator: open job, deadline passed, no creator accepted"]
        CR_2["admin_rejected: rejected from Pending OR cancelled from Active by admin"]
        CR_3["client_cancelled: reserved for future client-side cancellation"]
    end

    subgraph DB_FIELDS["Key DB Fields on jobs + job_completions"]
        direction LR
        DB1["completed_at:      timestamptz - set when status becomes completed"]
        DB2["cancel_reason:     text        - set when status becomes cancelled"]
        DB3["deadline_override: timestamptz - admin override for expiry calculation"]
        DB4["is_refunded:       boolean     - admin marks refund sent to client wallet"]
        DB5["credited_at:       timestamptz - set when admin batch-credits on-chain (jobs + job_completions)\n                               Dashboard: completed + credited_at set = Done"]
        DB6["credit_tx:         text        - on-chain tx sig for the credit transaction"]
    end

    subgraph DASH_STATS["Creator Dashboard Stats Logic"]
        direction LR
        DS1["Active:       jobs.status = in_progress"]
        DS2["Under Review: jobs.status = completed AND credited_at IS NULL\n               (proof submitted, waiting for admin batch credit)"]
        DS3["Done:         jobs.status = completed AND credited_at IS NOT NULL\n               (admin has credited on-chain)"]
    end

    %% ── NAVIGATION (dotted) ─────────────────────────────────────
    A7 -.->|Connect flow| TG1
    TGNOTIFY -.->|Inline button| TG5
    A7 -.->|Admin only| CRTAB
    A7 -.->|Admin only| AD_PEND
    A7 -.->|Admin only| AD_ACT
    A7 -.->|Admin only| AD5
    A7 -.->|Admin only| AD_CAN

    %% ── CLASS ASSIGNMENTS ───────────────────────────────────────
    class A1,A2,A3,A4,A5,A6,A7,EDITPROF auth
    class CL1,CL2,CL3,CL4,CL5,CL6,CL7,CL8,CL9,CLREVIEW,RV1,RV2,NOTIF,NOTIF_LIST,NOTIF_READALL,MKPL,DIRECTHIRE,CL1_DH,NOTIF_CREATOR,NOTIF_ACCEPT,NOTIF_SLOT,NOTIF_EXPIRE,NOTIF_CAMPAIGN_DONE,NOTIF_FORCECOMP client
    class CR1,CR2,CR3,CR4,CR5,CR6,CR7,CR8,CR9,CR10,CR11,CR12,CR13A,CR13B,CR14,CR15,CR16,CR17,CR18,CR19,CR20,EX1,EX2 creator
    class AD_PEND,AD1D,AD2,AD3,AD4,AD5,AD6,AD7,AD_ACT,ADMHIDE,ADMEXT,ADMCANCEL,AD_CAN,CANVIEW,RESTORE,CANDEL,CANREASON,CANEXP,CANADM,CANCLI,NOTIFCREATE,REFUND,ESCROW_PEND,ESC1,ESC2,ESC3,ESC4,CRTAB,CRTAB_SET,CRTAB_CLR admin
    class CRTAB_FX done
    class ESC5,CR_CLAIM4 done
    class CR_CLAIM,CR_CLAIM2,CR_CLAIM3 creator
    class TG1,TG2,TG3,TG4,TG5,TG6,TG7,TG8,TG9,TG10,TGNOTIFY,TG_DISCONNECT telegram
    class JOBDONE,RESTORED,REFUNDED done
    class CRERR,PROOFERR err
    class AUTOCANCEL,AUTOCOMPLETE,MISSEDSLOTS,TG_TIMEOUT cancelled
    class CRON,EXPCHECK,MANUALEXPIRE cron
    class AG1,AG2,AG3,AG4,AG5,AG6,AG7,AG8,AG9,AG10,AG11,AG12,AGDISC,AGSKILL,AGOAPI,AGMCP auth
```
