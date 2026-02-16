use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;

declare_id!("Eun9Ca5x4CGTZ53XC5ie8GidJBAgFhkr7gYwvx5qLcKq");

/// Maximum length for a content URI (IPFS/Arweave hash + protocol prefix)
const MAX_URI_LEN: usize = 200;
/// Maximum length for a story node title
const MAX_TITLE_LEN: usize = 64;

#[program]
pub mod story_chain {
    use super::*;

    /// Create a brand new story (root node with no parent).
    pub fn create_root(
        ctx: Context<CreateRoot>,
        title: String,
        content_uri: String,
        image_uri: String,
        title_seed: [u8; 32],
    ) -> Result<()> {
        require!(title.len() <= MAX_TITLE_LEN, StoryChainError::TitleTooLong);
        require!(content_uri.len() <= MAX_URI_LEN, StoryChainError::UriTooLong);
        require!(image_uri.len() <= MAX_URI_LEN, StoryChainError::ImageUriTooLong);
        require!(!content_uri.is_empty(), StoryChainError::EmptyUri);

        let expected = hash(title.as_bytes()).to_bytes();
        require!(title_seed == expected, StoryChainError::InvalidTitleSeed);

        let node = &mut ctx.accounts.story_node;
        node.author = ctx.accounts.author.key();
        node.parent = Pubkey::default();
        node.title = title;
        node.content_uri = content_uri;
        node.image_uri = image_uri;
        node.children_count = 0;
        node.created_at = Clock::get()?.unix_timestamp;
        node.bump = ctx.bumps.story_node;

        msg!("Root story node created by {}", node.author);
        Ok(())
    }

    /// Branch off an existing story node, creating a new child node.
    pub fn create_branch(
        ctx: Context<CreateBranch>,
        title: String,
        content_uri: String,
        image_uri: String,
        title_seed: [u8; 32],
    ) -> Result<()> {
        require!(title.len() <= MAX_TITLE_LEN, StoryChainError::TitleTooLong);
        require!(content_uri.len() <= MAX_URI_LEN, StoryChainError::UriTooLong);
        require!(image_uri.len() <= MAX_URI_LEN, StoryChainError::ImageUriTooLong);
        require!(!content_uri.is_empty(), StoryChainError::EmptyUri);

        let expected = hash(title.as_bytes()).to_bytes();
        require!(title_seed == expected, StoryChainError::InvalidTitleSeed);

        // Increment parent's child counter
        let parent = &mut ctx.accounts.parent_node;
        parent.children_count = parent
            .children_count
            .checked_add(1)
            .ok_or(StoryChainError::Overflow)?;

        // Initialize the new child node
        let node = &mut ctx.accounts.story_node;
        node.author = ctx.accounts.author.key();
        node.parent = parent.key();
        node.title = title;
        node.content_uri = content_uri;
        node.image_uri = image_uri;
        node.children_count = 0;
        node.created_at = Clock::get()?.unix_timestamp;
        node.bump = ctx.bumps.story_node;

        msg!(
            "Branch created by {} off parent {}",
            node.author,
            parent.key()
        );
        Ok(())
    }
}

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

#[derive(Accounts)]
#[instruction(title: String, content_uri: String, image_uri: String, title_seed: [u8; 32])]
pub struct CreateRoot<'info> {
    #[account(
        init,
        payer = author,
        space = StoryNode::space(&title, &content_uri, &image_uri),
        seeds = [
            b"story-node",
            author.key().as_ref(),
            title_seed.as_ref(),
        ],
        bump,
    )]
    pub story_node: Account<'info, StoryNode>,

    #[account(mut)]
    pub author: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(title: String, content_uri: String, image_uri: String, title_seed: [u8; 32])]
pub struct CreateBranch<'info> {
    #[account(
        init,
        payer = author,
        space = StoryNode::space(&title, &content_uri, &image_uri),
        seeds = [
            b"story-node",
            author.key().as_ref(),
            parent_node.key().as_ref(),
            title_seed.as_ref(),
        ],
        bump,
    )]
    pub story_node: Account<'info, StoryNode>,

    #[account(mut)]
    pub parent_node: Account<'info, StoryNode>,

    #[account(mut)]
    pub author: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

#[account]
pub struct StoryNode {
    /// Wallet that created this node (creator identity)
    pub author: Pubkey,
    /// Parent node pubkey (Pubkey::default() for root nodes)
    pub parent: Pubkey,
    /// Short title for navigation / display
    pub title: String,
    /// URI pointing to full content (arweave:// or ipfs://)
    pub content_uri: String,
    /// URI pointing to cover/header image (optional, empty string if none)
    pub image_uri: String,
    /// Number of direct children branching from this node
    pub children_count: u64,
    /// Unix timestamp of creation
    pub created_at: i64,
    /// PDA bump seed
    pub bump: u8,
}

impl StoryNode {
    /// 8 (disc) + 32 (author) + 32 (parent) + 4+title + 4+content_uri + 4+image_uri + 8 (children) + 8 (ts) + 1 (bump)
    pub fn space(title: &str, content_uri: &str, image_uri: &str) -> usize {
        8 + 32 + 32 + (4 + title.len()) + (4 + content_uri.len()) + (4 + image_uri.len()) + 8 + 8 + 1
    }
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

#[error_code]
pub enum StoryChainError {
    #[msg("Title exceeds 64 characters")]
    TitleTooLong,
    #[msg("Content URI exceeds 200 characters")]
    UriTooLong,
    #[msg("Image URI exceeds 200 characters")]
    ImageUriTooLong,
    #[msg("Content URI cannot be empty")]
    EmptyUri,
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Title seed does not match SHA-256 of title")]
    InvalidTitleSeed,
}
