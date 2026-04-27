import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { YapperEscrow } from "../target/types/yapper_escrow";
import {
  createMint, createAccount, mintTo,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { assert } from "chai";

describe("yapper-escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.YapperEscrow as Program<YapperEscrow>;

  const admin   = provider.wallet as anchor.Wallet;
  const creator = anchor.web3.Keypair.generate();

  let usdcMint:    anchor.web3.PublicKey;
  let adminUsdc:   anchor.web3.PublicKey;
  let creatorUsdc: anchor.web3.PublicKey;
  let statePDA:    anchor.web3.PublicKey;
  let vaultPDA:    anchor.web3.PublicKey;
  let claimRecord: anchor.web3.PublicKey;

  before(async () => {
    // Fund creator with SOL for tx fees
    const sig = await provider.connection.requestAirdrop(
      creator.publicKey, 2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    // Create test USDC mint (admin is mint authority on localnet/devnet)
    usdcMint = await createMint(
      provider.connection, admin.payer, admin.publicKey, null, 6
    );

    // Admin USDC ATA
    const adminATA = await getOrCreateAssociatedTokenAccount(
      provider.connection, admin.payer, usdcMint, admin.publicKey
    );
    adminUsdc = adminATA.address;

    // Mint 100 USDC to admin
    await mintTo(
      provider.connection, admin.payer, usdcMint, adminUsdc, admin.payer, 100_000_000
    );

    // Creator USDC ATA
    const creatorATA = await getOrCreateAssociatedTokenAccount(
      provider.connection, admin.payer, usdcMint, creator.publicKey
    );
    creatorUsdc = creatorATA.address;

    // Derive PDAs
    [statePDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state")], program.programId
    );
    [vaultPDA] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("vault")], program.programId
    );
    [claimRecord] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("claim"), creator.publicKey.toBuffer()], program.programId
    );
  });

  it("initializes the vault", async () => {
    await program.methods.initialize().accounts({
      admin:         admin.publicKey,
      usdcMint,
      state:         statePDA,
      vault:         vaultPDA,
      tokenProgram:  TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
      rent:          anchor.web3.SYSVAR_RENT_PUBKEY,
    }).rpc();

    const state = await program.account.state.fetch(statePDA);
    assert.ok(state.admin.equals(admin.publicKey));
    assert.ok(state.usdcMint.equals(usdcMint));
  });

  it("credits a creator (5 USDC)", async () => {
    const amount = new anchor.BN(5_000_000); // 5 USDC

    await program.methods.creditCreator(amount).accounts({
      admin:         admin.publicKey,
      creator:       creator.publicKey,
      state:         statePDA,
      claimRecord,
      adminUsdc,
      vault:         vaultPDA,
      tokenProgram:  TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    const record = await program.account.claimRecord.fetch(claimRecord);
    assert.equal(record.amount.toNumber(), 5_000_000);

    const vaultBal = await provider.connection.getTokenAccountBalance(vaultPDA);
    assert.equal(vaultBal.value.uiAmount, 5);
  });

  it("credits the same creator again (accumulates)", async () => {
    const amount = new anchor.BN(2_500_000); // 2.50 USDC

    await program.methods.creditCreator(amount).accounts({
      admin:         admin.publicKey,
      creator:       creator.publicKey,
      state:         statePDA,
      claimRecord,
      adminUsdc,
      vault:         vaultPDA,
      tokenProgram:  TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    }).rpc();

    const record = await program.account.claimRecord.fetch(claimRecord);
    assert.equal(record.amount.toNumber(), 7_500_000); // 5 + 2.5
  });

  it("creator claims all USDC", async () => {
    await program.methods.claim().accounts({
      creator:       creator.publicKey,
      state:         statePDA,
      claimRecord,
      vault:         vaultPDA,
      creatorUsdc,
      tokenProgram:  TOKEN_PROGRAM_ID,
    }).signers([creator]).rpc();

    const record = await program.account.claimRecord.fetch(claimRecord);
    assert.equal(record.amount.toNumber(), 0);

    const creatorBal = await provider.connection.getTokenAccountBalance(creatorUsdc);
    assert.equal(creatorBal.value.uiAmount, 7.5);
  });

  it("rejects claim with zero balance", async () => {
    try {
      await program.methods.claim().accounts({
        creator:       creator.publicKey,
        state:         statePDA,
        claimRecord,
        vault:         vaultPDA,
        creatorUsdc,
        tokenProgram:  TOKEN_PROGRAM_ID,
      }).signers([creator]).rpc();
      assert.fail("should have thrown");
    } catch (e: any) {
      assert.include(e.message, "NothingToClaim");
    }
  });
});
