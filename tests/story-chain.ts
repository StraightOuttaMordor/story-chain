import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StoryChain } from "../target/types/story_chain";
import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

/** SHA-256 hash of a title — matches the on-chain seed derivation. */
function titleHash(title: string): Buffer {
  return createHash("sha256").update(title, "utf8").digest();
}

/** Convert title hash to the array format Anchor expects for [u8; 32]. */
function titleSeedArg(title: string): number[] {
  return Array.from(titleHash(title));
}

describe("story-chain", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.storyChain as Program<StoryChain>;
  const author = provider.wallet;

  it("Creates a root story node", async () => {
    const title = "The Dark Forest";
    const contentUri = "arweave://abc123def456";
    const seed = titleHash(title);

    const [storyNodePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), seed],
      program.programId
    );

    const tx = await program.methods
      .createRoot(title, contentUri, titleSeedArg(title))
      .accounts({
        storyNode: storyNodePda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  createRoot tx:", tx);

    const node = await program.account.storyNode.fetch(storyNodePda);
    assert.equal(node.author.toBase58(), author.publicKey.toBase58());
    assert.equal(node.parent.toBase58(), PublicKey.default.toBase58());
    assert.equal(node.title, title);
    assert.equal(node.contentUri, contentUri);
    assert.equal(node.childrenCount.toNumber(), 0);
    assert.ok(node.createdAt.toNumber() > 0);
    console.log("  ✅ Root node verified");
  });

  it("Creates a branch off the root node", async () => {
    const rootTitle = "The Dark Forest";
    const branchTitle = "Take the left path";
    const branchUri = "arweave://branch001xyz";

    const [rootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), titleHash(rootTitle)],
      program.programId
    );

    const [branchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), rootPda.toBuffer(), titleHash(branchTitle)],
      program.programId
    );

    const tx = await program.methods
      .createBranch(branchTitle, branchUri, titleSeedArg(branchTitle))
      .accounts({
        storyNode: branchPda,
        parentNode: rootPda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  createBranch tx:", tx);

    const branch = await program.account.storyNode.fetch(branchPda);
    assert.equal(branch.author.toBase58(), author.publicKey.toBase58());
    assert.equal(branch.parent.toBase58(), rootPda.toBase58());
    assert.equal(branch.title, branchTitle);
    assert.equal(branch.contentUri, branchUri);
    assert.equal(branch.childrenCount.toNumber(), 0);
    console.log("  ✅ Branch node verified");

    const root = await program.account.storyNode.fetch(rootPda);
    assert.equal(root.childrenCount.toNumber(), 1);
    console.log("  ✅ Parent children_count = 1");
  });

  it("Creates a second branch off the root", async () => {
    const rootTitle = "The Dark Forest";
    const branch2Title = "Take the right path";
    const branch2Uri = "ipfs://QmXyz789branch2";

    const [rootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), titleHash(rootTitle)],
      program.programId
    );

    const [branch2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), rootPda.toBuffer(), titleHash(branch2Title)],
      program.programId
    );

    const tx = await program.methods
      .createBranch(branch2Title, branch2Uri, titleSeedArg(branch2Title))
      .accounts({
        storyNode: branch2Pda,
        parentNode: rootPda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  createBranch tx:", tx);

    const branch2 = await program.account.storyNode.fetch(branch2Pda);
    assert.equal(branch2.title, branch2Title);
    assert.equal(branch2.parent.toBase58(), rootPda.toBase58());
    console.log("  ✅ Second branch verified");

    const root = await program.account.storyNode.fetch(rootPda);
    assert.equal(root.childrenCount.toNumber(), 2);
    console.log("  ✅ Parent children_count = 2");
  });

  it("Creates a deep branch (branch off a branch)", async () => {
    const rootTitle = "The Dark Forest";
    const branch1Title = "Take the left path";
    const deepTitle = "Open the ancient door";
    const deepUri = "arweave://deep_node_content";

    const [rootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), titleHash(rootTitle)],
      program.programId
    );

    const [branch1Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), rootPda.toBuffer(), titleHash(branch1Title)],
      program.programId
    );

    const [deepPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), branch1Pda.toBuffer(), titleHash(deepTitle)],
      program.programId
    );

    const tx = await program.methods
      .createBranch(deepTitle, deepUri, titleSeedArg(deepTitle))
      .accounts({
        storyNode: deepPda,
        parentNode: branch1Pda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log("  deep branch tx:", tx);

    const deep = await program.account.storyNode.fetch(deepPda);
    assert.equal(deep.parent.toBase58(), branch1Pda.toBase58());
    assert.equal(deep.title, deepTitle);
    console.log("  ✅ Deep branch (depth 3) verified");

    const branch1 = await program.account.storyNode.fetch(branch1Pda);
    assert.equal(branch1.childrenCount.toNumber(), 1);
    console.log("  ✅ Branch1 children_count = 1");
  });

  it("Rejects empty content URI", async () => {
    const title = "Bad Node";
    const emptyUri = "";

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), titleHash(title)],
      program.programId
    );

    try {
      await program.methods
        .createRoot(title, emptyUri, titleSeedArg(title))
        .accounts({
          storyNode: pda,
          author: author.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have thrown EmptyUri error");
    } catch (err: any) {
      const errStr = err.toString();
      assert.ok(
        errStr.includes("EmptyUri") || errStr.includes("6002"),
        `Expected EmptyUri error, got: ${errStr.slice(0, 300)}`
      );
      console.log("  ✅ Empty URI correctly rejected");
    }
  });

  it("Rejects title over 64 characters", async () => {
    const longTitle = "A".repeat(65);
    const uri = "arweave://something";

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), titleHash(longTitle)],
      program.programId
    );

    try {
      await program.methods
        .createRoot(longTitle, uri, titleSeedArg(longTitle))
        .accounts({
          storyNode: pda,
          author: author.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have thrown TitleTooLong error");
    } catch (err: any) {
      const errStr = err.toString();
      assert.ok(
        errStr.includes("TitleTooLong") || errStr.includes("6000"),
        `Expected TitleTooLong error, got: ${errStr.slice(0, 300)}`
      );
      console.log("  ✅ Long title correctly rejected");
    }
  });
});
