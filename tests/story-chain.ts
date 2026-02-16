import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { StoryChain } from "../target/types/story_chain";
import { assert } from "chai";
import { PublicKey } from "@solana/web3.js";
import { createHash } from "crypto";

function titleHash(title: string): Buffer {
  return createHash("sha256").update(title, "utf8").digest();
}

function titleSeedArg(title: string): number[] {
  return Array.from(titleHash(title));
}

describe("story-chain", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.storyChain as Program<StoryChain>;
  const author = provider.wallet;

  it("Creates a root story node with image", async () => {
    const title = "The Dark Forest";
    const contentUri = "arweave://abc123def456";
    const imageUri = "https://example.com/dark-forest.jpg";
    const seed = titleHash(title);

    const [storyNodePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), seed],
      program.programId
    );

    const tx = await program.methods
      .createRoot(title, contentUri, imageUri, titleSeedArg(title))
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
    assert.equal(node.imageUri, imageUri);
    assert.equal(node.childrenCount.toNumber(), 0);
    assert.ok(node.createdAt.toNumber() > 0);
    console.log("  ✅ Root node with image verified");
  });

  it("Creates a root node without image (empty string)", async () => {
    const title = "Minimal Story";
    const contentUri = "arweave://minimal";
    const imageUri = "";
    const seed = titleHash(title);

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), seed],
      program.programId
    );

    const tx = await program.methods
      .createRoot(title, contentUri, imageUri, titleSeedArg(title))
      .accounts({
        storyNode: pda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const node = await program.account.storyNode.fetch(pda);
    assert.equal(node.imageUri, "");
    console.log("  ✅ Root node without image verified");
  });

  it("Creates a branch with image", async () => {
    const rootTitle = "The Dark Forest";
    const branchTitle = "Take the left path";
    const branchUri = "arweave://branch001xyz";
    const branchImage = "https://example.com/left-path.png";

    const [rootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), titleHash(rootTitle)],
      program.programId
    );

    const [branchPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), rootPda.toBuffer(), titleHash(branchTitle)],
      program.programId
    );

    const tx = await program.methods
      .createBranch(branchTitle, branchUri, branchImage, titleSeedArg(branchTitle))
      .accounts({
        storyNode: branchPda,
        parentNode: rootPda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const branch = await program.account.storyNode.fetch(branchPda);
    assert.equal(branch.title, branchTitle);
    assert.equal(branch.imageUri, branchImage);
    assert.equal(branch.parent.toBase58(), rootPda.toBase58());
    console.log("  ✅ Branch with image verified");

    const root = await program.account.storyNode.fetch(rootPda);
    assert.equal(root.childrenCount.toNumber(), 1);
    console.log("  ✅ Parent children_count = 1");
  });

  it("Creates a second branch off the root", async () => {
    const rootTitle = "The Dark Forest";
    const branch2Title = "Take the right path";
    const branch2Uri = "ipfs://QmXyz789branch2";
    const branch2Image = "";

    const [rootPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), titleHash(rootTitle)],
      program.programId
    );

    const [branch2Pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), rootPda.toBuffer(), titleHash(branch2Title)],
      program.programId
    );

    await program.methods
      .createBranch(branch2Title, branch2Uri, branch2Image, titleSeedArg(branch2Title))
      .accounts({
        storyNode: branch2Pda,
        parentNode: rootPda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const root = await program.account.storyNode.fetch(rootPda);
    assert.equal(root.childrenCount.toNumber(), 2);
    console.log("  ✅ Parent children_count = 2");
  });

  it("Creates a deep branch (depth 3)", async () => {
    const rootTitle = "The Dark Forest";
    const branch1Title = "Take the left path";
    const deepTitle = "Open the ancient door";
    const deepUri = "arweave://deep_node_content";
    const deepImage = "https://example.com/ancient-door.jpg";

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

    await program.methods
      .createBranch(deepTitle, deepUri, deepImage, titleSeedArg(deepTitle))
      .accounts({
        storyNode: deepPda,
        parentNode: branch1Pda,
        author: author.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const deep = await program.account.storyNode.fetch(deepPda);
    assert.equal(deep.parent.toBase58(), branch1Pda.toBase58());
    assert.equal(deep.imageUri, deepImage);
    console.log("  ✅ Deep branch (depth 3) with image verified");
  });

  it("Rejects empty content URI", async () => {
    const title = "Bad Node";

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), titleHash(title)],
      program.programId
    );

    try {
      await program.methods
        .createRoot(title, "", "", titleSeedArg(title))
        .accounts({
          storyNode: pda,
          author: author.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have thrown");
    } catch (err: any) {
      assert.ok(err.toString().includes("EmptyUri") || err.toString().includes("6003"));
      console.log("  ✅ Empty URI correctly rejected");
    }
  });

  it("Rejects title over 64 characters", async () => {
    const longTitle = "A".repeat(65);

    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("story-node"), author.publicKey.toBuffer(), titleHash(longTitle)],
      program.programId
    );

    try {
      await program.methods
        .createRoot(longTitle, "arweave://x", "", titleSeedArg(longTitle))
        .accounts({
          storyNode: pda,
          author: author.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
      assert.fail("Should have thrown");
    } catch (err: any) {
      assert.ok(err.toString().includes("TitleTooLong") || err.toString().includes("6000"));
      console.log("  ✅ Long title correctly rejected");
    }
  });
});
