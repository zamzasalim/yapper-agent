/**
 * Yapper Escrow — TypeScript interface for the Anchor program.
 *
 * After deploying:
 *   1. Replace NEXT_PUBLIC_ESCROW_PROGRAM_ID in .env.local
 *   2. Replace NEXT_PUBLIC_USDC_MINT with devnet or mainnet address
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { connection } from "@/lib/solana";

// ── Config ────────────────────────────────────────────────────────────────────

export const PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_ESCROW_PROGRAM_ID ?? "11111111111111111111111111111111"
);

// Mainnet USDC: EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v
// Devnet  USDC: 4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU
export const USDC_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_USDC_MINT ??
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK === "devnet"
      ? "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
      : "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")
);

// ── PDA helpers ───────────────────────────────────────────────────────────────

export function getStatePDA(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("state")], PROGRAM_ID)[0];
}

export function getVaultPDA(): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID)[0];
}

export function getClaimRecordPDA(creatorWallet: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("claim"), creatorWallet.toBuffer()],
    PROGRAM_ID
  )[0];
}

// ── Byte helpers (Uint8Array only — no Buffer polyfill needed) ───────────────

function concatU8(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { out.set(arr, offset); offset += arr.length; }
  return out;
}

function u64LE(value: bigint): Uint8Array {
  const buf = new Uint8Array(8);
  new DataView(buf.buffer).setBigUint64(0, value, true);
  return buf;
}

// ── Anchor instruction discriminators ────────────────────────────────────────
// sha256("global:<instruction_name>")[0..8] — precomputed from Node.js, stable after compile

const DISC = {
  initialize:    new Uint8Array([175, 175, 109,  31,  13, 152, 155, 237]),
  setAdmin2:     new Uint8Array([ 21, 209,  83, 165, 159,  69, 231, 230]),
  creditCreator: new Uint8Array([ 79, 161, 203,  36,  79,  55,  92, 104]),
  withdraw:      new Uint8Array([183,  18,  70, 156, 148, 109, 161,  34]),
  claim:         new Uint8Array([ 62, 198, 214, 193, 213, 159, 108, 210]),
};

// ── Instruction builders ──────────────────────────────────────────────────────

/**
 * Build the initialize instruction (one-time setup by admin).
 * Run this once after deploying the program.
 */
export async function buildInitializeTx(adminPubkey: PublicKey, admin2Pubkey: PublicKey): Promise<Transaction> {
  const state = getStatePDA();
  const vault = getVaultPDA();

  // discriminator (8) + admin2 pubkey (32)
  const data = concatU8(DISC.initialize, admin2Pubkey.toBytes());

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: adminPubkey,             isSigner: true,  isWritable: true  }, // admin
      { pubkey: USDC_MINT,               isSigner: false, isWritable: false }, // usdc_mint
      { pubkey: state,                   isSigner: false, isWritable: true  }, // state
      { pubkey: vault,                   isSigner: false, isWritable: true  }, // vault
      { pubkey: TOKEN_PROGRAM_ID,        isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,      isSigner: false, isWritable: false },
    ],
    data: data as unknown as Buffer,
  });

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = adminPubkey;
  return tx;
}

/**
 * Build a set_admin2 instruction (upgrade old 74-byte state to 106-byte multi-admin state).
 * Only callable by the primary admin (state.admin).
 */
export async function buildSetAdmin2Tx(adminPubkey: PublicKey, admin2Pubkey: PublicKey): Promise<Transaction> {
  const state = getStatePDA();
  const data = concatU8(DISC.setAdmin2, admin2Pubkey.toBytes());

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: adminPubkey,             isSigner: true,  isWritable: true  },
      { pubkey: state,                   isSigner: false, isWritable: true  },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data: data as unknown as Buffer,
  });

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = adminPubkey;
  return tx;
}

/**
 * Build a withdraw instruction (admin force-withdraws USDC from vault).
 * amountUsdc is in USDC (not micro). adminUsdcAta must already exist.
 */
export async function buildWithdrawTx(
  adminPubkey: PublicKey,
  amountUsdc: number
): Promise<Transaction> {
  const state     = getStatePDA();
  const vault     = getVaultPDA();
  const adminUsdc = await getAssociatedTokenAddress(USDC_MINT, adminPubkey);

  const data = concatU8(DISC.withdraw, u64LE(BigInt(Math.round(amountUsdc * 1_000_000))));

  const tx = new Transaction();

  // Create admin ATA if needed
  const ataInfo = await connection.getAccountInfo(adminUsdc);
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        adminPubkey, adminUsdc, adminPubkey, USDC_MINT,
        TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
      )
    );
  }

  tx.add(new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: adminPubkey,       isSigner: true,  isWritable: false },
      { pubkey: state,             isSigner: false, isWritable: false },
      { pubkey: vault,             isSigner: false, isWritable: true  },
      { pubkey: adminUsdc,         isSigner: false, isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID,  isSigner: false, isWritable: false },
    ],
    data: data as unknown as Buffer,
  }));

  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = adminPubkey;
  return tx;
}

/**
 * Build a credit_creator instruction.
 * Admin signs this — transfers USDC from their wallet to vault and records the amount.
 * amount is in micro-USDC (multiply USD by 1_000_000).
 */
export async function buildCreditCreatorTx(
  adminPubkey: PublicKey,
  creatorWallet: PublicKey,
  amountUsdc: number
): Promise<Transaction> {
  const state       = getStatePDA();
  const claimRecord = getClaimRecordPDA(creatorWallet);

  const data = concatU8(DISC.creditCreator, u64LE(BigInt(Math.round(amountUsdc * 1_000_000))));

  const vault = getVaultPDA();

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: adminPubkey,             isSigner: true,  isWritable: true  }, // admin
      { pubkey: creatorWallet,           isSigner: false, isWritable: false }, // creator
      { pubkey: state,                   isSigner: false, isWritable: true  }, // state (mut — updates total_credited)
      { pubkey: vault,                   isSigner: false, isWritable: false }, // vault (read-only balance check)
      { pubkey: claimRecord,             isSigner: false, isWritable: true  }, // claim_record
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }, // system_program
    ],
    data: data as unknown as Buffer,
  });

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = adminPubkey;
  return tx;
}

/**
 * Build a claim instruction.
 * Creator signs this — moves all their claimable USDC from vault to their wallet.
 */
export async function buildClaimTx(creatorWallet: PublicKey): Promise<Transaction> {
  const state        = getStatePDA();
  const vault        = getVaultPDA();
  const claimRecord  = getClaimRecordPDA(creatorWallet);
  const creatorUsdc  = await getAssociatedTokenAddress(USDC_MINT, creatorWallet);

  const tx = new Transaction();

  // Auto-create ATA if the creator doesn't have a USDC token account yet
  const ataInfo = await connection.getAccountInfo(creatorUsdc);
  if (!ataInfo) {
    tx.add(
      createAssociatedTokenAccountInstruction(
        creatorWallet,           // payer
        creatorUsdc,             // ata address
        creatorWallet,           // owner
        USDC_MINT,               // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID,
      )
    );
  }

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: creatorWallet,    isSigner: true,  isWritable: false },
      { pubkey: state,            isSigner: false, isWritable: true  }, // mut — updates total_claimed
      { pubkey: claimRecord,      isSigner: false, isWritable: true  },
      { pubkey: vault,            isSigner: false, isWritable: true  },
      { pubkey: creatorUsdc,      isSigner: false, isWritable: true  },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: DISC.claim as unknown as Buffer,
  });

  tx.add(ix);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = creatorWallet;
  return tx;
}

// ── On-chain reads ────────────────────────────────────────────────────────────

const CLAIM_RECORD_DISCRIMINATOR = Buffer.from([57, 229, 0, 9, 65, 62, 96, 7]);

/**
 * Fetch a creator's claimable USDC amount from on-chain.
 * Returns 0 if no ClaimRecord exists yet.
 */
export async function fetchClaimable(creatorWallet: PublicKey): Promise<number> {
  try {
    const pda     = getClaimRecordPDA(creatorWallet);
    const account = await connection.getAccountInfo(pda);
    if (!account || account.data.length < 49) return 0;

    // Layout: 8 discriminator | 32 creator | 8 amount (u64 LE) | 1 bump
    const amountBuf = account.data.slice(40, 48);
    const amountMicro = amountBuf.readBigUInt64LE(0);
    return Number(amountMicro) / 1_000_000;
  } catch {
    return 0;
  }
}

/**
 * Fetch global vault stats from the State PDA.
 * State layout (new):
 *   8   discriminator
 *   32  admin
 *   32  usdc_mint
 *   1   bump
 *   1   vault_bump
 *   32  admin2
 *   8   total_credited  [106..114]
 *   8   total_claimed   [114..122]
 */
export async function fetchVaultStats(): Promise<{
  totalCredited: number;
  totalClaimed:  number;
  pending:       number;
}> {
  try {
    const pda     = getStatePDA();
    const account = await connection.getAccountInfo(pda);
    if (!account || account.data.length < 122) return { totalCredited: 0, totalClaimed: 0, pending: 0 };

    const view          = new DataView(account.data.buffer, account.data.byteOffset);
    const totalCredited = Number(view.getBigUint64(106, true)) / 1_000_000;
    const totalClaimed  = Number(view.getBigUint64(114, true)) / 1_000_000;
    return { totalCredited, totalClaimed, pending: totalCredited - totalClaimed };
  } catch {
    return { totalCredited: 0, totalClaimed: 0, pending: 0 };
  }
}
