#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("7Kzwk5x4WKmQ8U9yc3TRcAsmuLBu1NSiQBaBPK4a5gTi");

// ── Program ───────────────────────────────────────────────────────────────────

#[program]
pub mod yapper_escrow {
    use super::*;

    /// One-time setup. Creates the global state and vault token account.
    pub fn initialize(ctx: Context<Initialize>, admin2: Pubkey) -> Result<()> {
        let state = &mut ctx.accounts.state;
        state.admin          = ctx.accounts.admin.key();
        state.usdc_mint      = ctx.accounts.usdc_mint.key();
        state.bump           = ctx.bumps.state;
        state.vault_bump     = ctx.bumps.vault;
        state.admin2         = admin2;
        state.total_credited = 0;
        state.total_claimed  = 0;
        Ok(())
    }

    /// Migrate old state → new multi-admin + tracking state.
    /// Uses UncheckedAccount to bypass deserialization of undersized account,
    /// then reallocates and writes admin2 at the correct byte offset.
    /// New fields (total_credited, total_claimed) are zeroed on resize.
    pub fn set_admin2(ctx: Context<SetAdmin2>, admin2: Pubkey) -> Result<()> {
        let state_info = ctx.accounts.state.to_account_info();
        let new_size   = 8 + State::LEN; // 122

        // Validate: read stored admin from raw bytes (8-byte disc + 32-byte admin = [8..40])
        {
            let data = state_info.try_borrow_data()?;
            require!(data.len() >= 40, EscrowError::Unauthorized);
            let stored_admin = Pubkey::try_from(&data[8..40]).map_err(|_| EscrowError::Unauthorized)?;
            require!(stored_admin == ctx.accounts.admin.key(), EscrowError::Unauthorized);
        }

        // Fund extra rent if needed
        let rent  = Rent::get()?;
        let extra = rent.minimum_balance(new_size).saturating_sub(state_info.lamports());
        if extra > 0 {
            anchor_lang::system_program::transfer(
                CpiContext::new(
                    ctx.accounts.system_program.to_account_info(),
                    anchor_lang::system_program::Transfer {
                        from: ctx.accounts.admin.to_account_info(),
                        to:   state_info.clone(),
                    },
                ),
                extra,
            )?;
        }

        // Resize and write admin2 at offset 74
        // Layout: 8 disc | 32 admin | 32 usdc_mint | 1 bump | 1 vault_bump | 32 admin2 | 8 total_credited | 8 total_claimed
        state_info.resize(new_size)?;
        {
            let mut data = state_info.try_borrow_mut_data()?;
            data[74..106].copy_from_slice(admin2.as_ref());
            // total_credited [106..114] and total_claimed [114..122] stay zero (from resize)
        }

        Ok(())
    }

    /// Admin credits a creator's claimable balance.
    /// Checks vault has enough to cover all pending claims including this new credit.
    pub fn credit_creator(ctx: Context<CreditCreator>, amount: u64) -> Result<()> {
        require!(amount > 0, EscrowError::ZeroAmount);

        // Vault sufficiency check: pending = total_credited - total_claimed
        let new_total_credited = ctx.accounts.state.total_credited
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;
        let pending_after = new_total_credited
            .saturating_sub(ctx.accounts.state.total_claimed);
        require!(ctx.accounts.vault.amount >= pending_after, EscrowError::InsufficientVault);

        ctx.accounts.state.total_credited = new_total_credited;

        let record = &mut ctx.accounts.claim_record;
        record.creator = ctx.accounts.creator.key();
        record.amount  = record.amount.checked_add(amount).ok_or(EscrowError::Overflow)?;
        record.bump    = ctx.bumps.claim_record;

        emit!(CreditedEvent {
            creator: ctx.accounts.creator.key(),
            amount,
        });

        Ok(())
    }

    /// Admin force-withdraws USDC from vault to their own token account.
    /// Callable by either admin or admin2.
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        require!(amount > 0, EscrowError::ZeroAmount);

        let bump   = ctx.accounts.state.bump;
        let seeds: &[&[u8]] = &[b"state", &[bump]];
        let signer = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.vault.to_account_info(),
                    to:        ctx.accounts.admin_usdc.to_account_info(),
                    authority: ctx.accounts.state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        Ok(())
    }

    /// Creator claims all their earned USDC.
    /// Transfers from vault PDA → creator's USDC token account.
    pub fn claim(ctx: Context<Claim>) -> Result<()> {
        let amount = ctx.accounts.claim_record.amount;
        require!(amount > 0, EscrowError::NothingToClaim);

        ctx.accounts.claim_record.amount = 0;

        // Track total claimed for vault sufficiency checks
        ctx.accounts.state.total_claimed = ctx.accounts.state.total_claimed
            .checked_add(amount)
            .ok_or(EscrowError::Overflow)?;

        let bump   = ctx.accounts.state.bump;
        let seeds: &[&[u8]] = &[b"state", &[bump]];
        let signer = &[seeds];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from:      ctx.accounts.vault.to_account_info(),
                    to:        ctx.accounts.creator_usdc.to_account_info(),
                    authority: ctx.accounts.state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;

        emit!(ClaimedEvent {
            creator: ctx.accounts.creator.key(),
            amount,
        });

        Ok(())
    }
}

// ── Instruction contexts ───────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    pub usdc_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = admin,
        space = 8 + State::LEN,
        seeds = [b"state"],
        bump,
    )]
    pub state: Account<'info, State>,

    #[account(
        init,
        payer = admin,
        token::mint      = usdc_mint,
        token::authority = state,
        seeds = [b"vault"],
        bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program:  Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent:           Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct SetAdmin2<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: PDA validated by seeds constraint; admin field validated manually in instruction body
    #[account(
        mut,
        seeds = [b"state"],
        bump,
    )]
    pub state: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        constraint = (admin.key() == state.admin || admin.key() == state.admin2) @ EscrowError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    #[account(seeds = [b"state"], bump = state.bump)]
    pub state: Account<'info, State>,

    #[account(mut, seeds = [b"vault"], bump = state.vault_bump)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = admin_usdc.owner == admin.key()     @ EscrowError::Unauthorized,
        constraint = admin_usdc.mint  == state.usdc_mint @ EscrowError::WrongMint,
    )]
    pub admin_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct CreditCreator<'info> {
    #[account(
        mut,
        constraint = (admin.key() == state.admin || admin.key() == state.admin2) @ EscrowError::Unauthorized,
    )]
    pub admin: Signer<'info>,

    /// CHECK: creator wallet — we only store their pubkey, they don't sign here
    pub creator: UncheckedAccount<'info>,

    #[account(mut, seeds = [b"state"], bump = state.bump)]
    pub state: Account<'info, State>,

    /// Read-only: used to check vault has enough to cover all pending claims
    #[account(seeds = [b"vault"], bump = state.vault_bump)]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        init_if_needed,
        payer = admin,
        space = 8 + ClaimRecord::LEN,
        seeds = [b"claim", creator.key().as_ref()],
        bump,
    )]
    pub claim_record: Account<'info, ClaimRecord>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Claim<'info> {
    pub creator: Signer<'info>,

    #[account(mut, seeds = [b"state"], bump = state.bump)]
    pub state: Account<'info, State>,

    #[account(
        mut,
        seeds  = [b"claim", creator.key().as_ref()],
        bump   = claim_record.bump,
        constraint = claim_record.creator == creator.key() @ EscrowError::Unauthorized,
    )]
    pub claim_record: Account<'info, ClaimRecord>,

    #[account(
        mut,
        seeds = [b"vault"],
        bump  = state.vault_bump,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = creator_usdc.owner == creator.key()   @ EscrowError::Unauthorized,
        constraint = creator_usdc.mint  == state.usdc_mint @ EscrowError::WrongMint,
    )]
    pub creator_usdc: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ── State accounts ────────────────────────────────────────────────────────────

// Layout:
//   8   discriminator
//   32  admin
//   32  usdc_mint
//   1   bump
//   1   vault_bump
//   32  admin2
//   8   total_credited  (micro-USDC running total of all credits)
//   8   total_claimed   (micro-USDC running total of all claims)
#[account]
pub struct State {
    pub admin:          Pubkey, // 32
    pub usdc_mint:      Pubkey, // 32
    pub bump:           u8,     // 1
    pub vault_bump:     u8,     // 1
    pub admin2:         Pubkey, // 32
    pub total_credited: u64,    // 8
    pub total_claimed:  u64,    // 8
}
impl State {
    pub const LEN: usize = 32 + 32 + 1 + 1 + 32 + 8 + 8; // 114
}

#[account]
pub struct ClaimRecord {
    pub creator: Pubkey, // 32
    pub amount:  u64,    // 8  — micro-USDC (6 decimals)
    pub bump:    u8,     // 1
}
impl ClaimRecord {
    pub const LEN: usize = 32 + 8 + 1; // 41
}

// ── Events ────────────────────────────────────────────────────────────────────

#[event]
pub struct CreditedEvent {
    pub creator: Pubkey,
    pub amount:  u64,
}

#[event]
pub struct ClaimedEvent {
    pub creator: Pubkey,
    pub amount:  u64,
}

// ── Errors ────────────────────────────────────────────────────────────────────

#[error_code]
pub enum EscrowError {
    #[msg("Unauthorized: signer is not admin or admin2")]
    Unauthorized,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("No claimable balance")]
    NothingToClaim,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Wrong USDC mint for this network")]
    WrongMint,
    #[msg("Vault balance insufficient to cover all pending claims")]
    InsufficientVault,
}
