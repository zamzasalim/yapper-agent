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
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
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

// ── Anchor instruction discriminators ────────────────────────────────────────
// sha256("global:<instruction_name>")[0..8]
// These are stable once the program is compiled.

import { createHash } from "crypto";

function discriminator(name: string): Buffer {
  return Buffer.from(
    createHash("sha256").update(`global:${name}`).digest()
  ).slice(0, 8);
}

const IX = {
  initialize:     discriminator("initialize"),
  creditCreator:  discriminator("credit_creator"),
  claim:          discriminator("claim"),
};

// ── Instruction builders ──────────────────────────────────────────────────────

/**
 * Build the initialize instruction (one-time setup by admin).
 * Run this once after deploying the program.
 */
export async function buildInitializeTx(adminPubkey: PublicKey): Promise<Transaction> {
  const state = getStatePDA();
  const vault = getVaultPDA();

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: adminPubkey, isSigner: true,  isWritable: true  }, // admin
      { pubkey: USDC_MINT,   isSigner: false, isWritable: false }, // usdc_mint
      { pubkey: state,       isSigner: false, isWritable: true  }, // state
      { pubkey: vault,       isSigner: false, isWritable: true  }, // vault
      { pubkey: TOKEN_PROGRAM_ID,              isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,       isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY,            isSigner: false, isWritable: false },
    ],
    data: IX.initialize,
  });

  const tx = new Transaction().add(ix);
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
  const vault       = getVaultPDA();
  const claimRecord = getClaimRecordPDA(creatorWallet);
  const adminUsdc   = await getAssociatedTokenAddress(USDC_MINT, adminPubkey);

  const amountMicro = BigInt(Math.round(amountUsdc * 1_000_000));
  const amountBuf   = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amountMicro);

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: adminPubkey,    isSigner: true,  isWritable: true  }, // admin
      { pubkey: creatorWallet,  isSigner: false, isWritable: false }, // creator
      { pubkey: state,          isSigner: false, isWritable: false }, // state
      { pubkey: claimRecord,    isSigner: false, isWritable: true  }, // claim_record
      { pubkey: adminUsdc,      isSigner: false, isWritable: true  }, // admin_usdc
      { pubkey: vault,          isSigner: false, isWritable: true  }, // vault
      { pubkey: TOKEN_PROGRAM_ID,         isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId,  isSigner: false, isWritable: false },
    ],
    data: Buffer.concat([IX.creditCreator, amountBuf]),
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

  const ix = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: creatorWallet, isSigner: true,  isWritable: false }, // creator
      { pubkey: state,         isSigner: false, isWritable: false }, // state
      { pubkey: claimRecord,   isSigner: false, isWritable: true  }, // claim_record
      { pubkey: vault,         isSigner: false, isWritable: true  }, // vault
      { pubkey: creatorUsdc,   isSigner: false, isWritable: true  }, // creator_usdc
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: IX.claim,
  });

  const tx = new Transaction().add(ix);
  const { blockhash } = await connection.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.feePayer = creatorWallet;
  return tx;
}

// ── On-chain reads ────────────────────────────────────────────────────────────

const CLAIM_RECORD_DISCRIMINATOR = discriminator("account:ClaimRecord");

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
