# Story Chain 📖⛓️

**Permissionless branching narratives on Solana**

A blockchain choose-your-own-adventure where anyone can create story nodes and branch off other people's stories. Think Geocities "links pages" meets collaborative fiction — creation is permissionless, curation happens on the read side.

## Architecture

### On-Chain Program (Anchor/Rust)
- **`create_root`** — Create a new story origin (no parent)
- **`create_branch`** — Fork off any existing node, creating a child

Each `StoryNode` PDA stores:
- `author` — minting wallet (creator identity)
- `parent` — parent node pubkey (null for roots)
- `title` — short display title (≤64 chars)
- `content_uri` — link to full content (Arweave/IPFS/data URI)
- `children_count` — how many branches exist
- `created_at` — unix timestamp

### Frontend (Vite + TypeScript)
- Connect via Phantom wallet
- Mint root stories and branches
- Browse the story graph
- View node details and navigate branches

## Development

### Prerequisites
- Rust + Cargo
- Solana CLI (`solana-install`)
- Anchor CLI (`avm`)
- Node.js + Yarn

### Build & Test
```bash
# Build the program
anchor build

# Start local validator with program loaded
solana-test-validator --bpf-program Eun9Ca5x4CGTZ53XC5ie8GidJBAgFhkr7gYwvx5qLcKq target/deploy/story_chain.so --reset

# Run tests (in another terminal)
ANCHOR_PROVIDER_URL=http://localhost:8899 ANCHOR_WALLET=~/.config/solana/id.json yarn run ts-mocha -p ./tsconfig.json -t 1000000 'tests/**/*.ts'
```

### Frontend
```bash
cd app
npm install
npm run dev  # http://localhost:3000
```

## Roadmap

### V1 (Current) ✅
- [x] On-chain program: create_root + create_branch
- [x] PDA-based story graph
- [x] 6 passing tests
- [x] Basic frontend: connect wallet, mint, browse

### V2
- [ ] Off-chain indexer for graph traversal
- [ ] Creator profiles (wallet → display name)
- [ ] Creator recommendations ("links page")
- [ ] Subscription/follow system (client-side)

### V3
- [ ] Arweave/IPFS content storage
- [ ] Rich content (markdown, images)
- [ ] NFT minting for story nodes
- [ ] Social graph visualization

## License
MIT
