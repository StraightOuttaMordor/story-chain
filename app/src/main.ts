import { Buffer } from "buffer";
(window as any).Buffer = Buffer;

import {
  AnchorProvider,
  Program,
  BN,
  web3,
} from "@coral-xyz/anchor";
import { Connection, PublicKey, clusterApiUrl } from "@solana/web3.js";
import idl from "./story_chain.json";
import type { StoryChain } from "./story_chain";
import { createHash } from "crypto";

// --- Config ---
const PROGRAM_ID = new PublicKey(idl.address);
// Devnet for production, localhost for local dev
const NETWORK = clusterApiUrl("devnet");
// const NETWORK = "http://localhost:8899";

// --- Types ---
interface StoryNodeData {
  publicKey: PublicKey;
  author: PublicKey;
  parent: PublicKey;
  title: string;
  contentUri: string;
  childrenCount: number;
  createdAt: number;
}

// --- State ---
let provider: AnchorProvider | null = null;
let program: Program<StoryChain> | null = null;
let allNodes: StoryNodeData[] = [];

// --- DOM refs ---
const connectBtn = document.getElementById("connect-btn") as HTMLButtonElement;
const walletAddr = document.getElementById("wallet-address") as HTMLSpanElement;
const mintSection = document.getElementById("mint-section") as HTMLElement;
const browseSection = document.getElementById("browse-section") as HTMLElement;
const nodeDetail = document.getElementById("node-detail") as HTMLElement;
const nodeType = document.getElementById("node-type") as HTMLSelectElement;
const parentField = document.getElementById("parent-field") as HTMLElement;
const parentAddress = document.getElementById("parent-address") as HTMLInputElement;
const titleInput = document.getElementById("title-input") as HTMLInputElement;
const contentInput = document.getElementById("content-input") as HTMLTextAreaElement;
const charCount = document.getElementById("char-count") as HTMLSpanElement;
const mintBtn = document.getElementById("mint-btn") as HTMLButtonElement;
const mintStatus = document.getElementById("mint-status") as HTMLElement;
const storiesLoading = document.getElementById("stories-loading") as HTMLElement;
const storiesList = document.getElementById("stories-list") as HTMLElement;
const backBtn = document.getElementById("back-btn") as HTMLButtonElement;
const nodeContent = document.getElementById("node-content") as HTMLElement;
const branchesList = document.getElementById("branches-list") as HTMLElement;

// --- Helpers ---
function titleHash(title: string): Buffer {
  return Buffer.from(
    createHash("sha256").update(title, "utf8").digest()
  );
}

function titleSeedArg(title: string): number[] {
  return Array.from(titleHash(title));
}

function shortenAddr(addr: string): string {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function formatDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function setStatus(msg: string, type: "success" | "error" | "info") {
  mintStatus.textContent = msg;
  mintStatus.className = `status ${type}`;
}

// --- Phantom wallet ---
function getPhantom(): any {
  const w = window as any;
  if (w.solana?.isPhantom) return w.solana;
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  return null;
}

async function connectWallet() {
  const phantom = getPhantom();
  if (!phantom) {
    alert("Phantom wallet not found! Install it from phantom.app");
    return;
  }

  try {
    const resp = await phantom.connect();
    const pubkey = resp.publicKey;

    const connection = new Connection(NETWORK, "confirmed");
    provider = new AnchorProvider(
      connection,
      phantom as any,
      { commitment: "confirmed" }
    );
    program = new Program(idl as any, provider) as unknown as Program<StoryChain>;

    // Update UI
    connectBtn.textContent = "Connected";
    connectBtn.disabled = true;
    walletAddr.textContent = shortenAddr(pubkey.toBase58());
    mintSection.classList.remove("hidden");
    storiesLoading.textContent = "Loading stories...";

    await loadStories();
  } catch (err: any) {
    console.error("Wallet connect failed:", err);
    alert("Failed to connect wallet: " + err.message);
  }
}

// --- Load all story nodes ---
async function loadStories() {
  if (!program) return;

  try {
    const accounts = await program.account.storyNode.all();
    allNodes = accounts.map((a) => ({
      publicKey: a.publicKey,
      author: a.account.author,
      parent: a.account.parent,
      title: a.account.title,
      contentUri: a.account.contentUri,
      childrenCount: (a.account.childrenCount as BN).toNumber(),
      createdAt: (a.account.createdAt as BN).toNumber(),
    }));

    renderStoryList();
  } catch (err: any) {
    console.error("Failed to load stories:", err);
    storiesLoading.textContent = "Failed to load stories";
  }
}

// --- Render the story list ---
function renderStoryList() {
  const roots = allNodes.filter(
    (n) => n.parent.toBase58() === PublicKey.default.toBase58()
  );
  const branches = allNodes.filter(
    (n) => n.parent.toBase58() !== PublicKey.default.toBase58()
  );

  if (allNodes.length === 0) {
    storiesLoading.textContent = "";
    storiesList.innerHTML =
      '<div class="empty-state">No stories yet. Be the first to create one! ✍️</div>';
    return;
  }

  storiesLoading.textContent = "";
  let html = "";

  for (const root of roots) {
    html += renderNodeCard(root, true);
    // Show direct children
    const children = branches.filter(
      (b) => b.parent.toBase58() === root.publicKey.toBase58()
    );
    for (const child of children) {
      html += renderNodeCard(child, false);
    }
  }

  // Orphan branches (parent not in our loaded set — shouldn't happen but be safe)
  const shownKeys = new Set([
    ...roots.map((r) => r.publicKey.toBase58()),
    ...branches
      .filter((b) =>
        roots.some((r) => r.publicKey.toBase58() === b.parent.toBase58())
      )
      .map((b) => b.publicKey.toBase58()),
  ]);
  for (const node of allNodes) {
    if (!shownKeys.has(node.publicKey.toBase58())) {
      html += renderNodeCard(node, false);
    }
  }

  storiesList.innerHTML = html;

  // Attach click handlers
  document.querySelectorAll(".story-node").forEach((el) => {
    el.addEventListener("click", () => {
      const pk = el.getAttribute("data-pk");
      if (pk) showNodeDetail(pk);
    });
  });
}

function renderNodeCard(node: StoryNodeData, isRoot: boolean): string {
  return `
    <div class="story-node ${isRoot ? "root" : "branch"}" data-pk="${node.publicKey.toBase58()}">
      <div class="node-title">${isRoot ? "📖 " : "↳ "}${escapeHtml(node.title)}</div>
      <div class="node-meta">
        <span class="author">by ${shortenAddr(node.author.toBase58())}</span>
        <span class="branches">${node.childrenCount} branch${node.childrenCount !== 1 ? "es" : ""}</span>
        <span>${formatDate(node.createdAt)}</span>
      </div>
    </div>
  `;
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Show node detail ---
async function showNodeDetail(pubkey: string) {
  const node = allNodes.find((n) => n.publicKey.toBase58() === pubkey);
  if (!node) return;

  browseSection.classList.add("hidden");
  mintSection.classList.add("hidden");
  nodeDetail.classList.remove("hidden");

  const isRoot = node.parent.toBase58() === PublicKey.default.toBase58();

  // Try to fetch content from URI (for now just show the URI)
  let bodyContent = `<em>Content stored at: ${escapeHtml(node.contentUri)}</em>`;

  nodeContent.innerHTML = `
    <div class="detail-title">${escapeHtml(node.title)}</div>
    <div class="detail-meta">
      <div>Author: ${node.author.toBase58()}</div>
      <div>Address: ${node.publicKey.toBase58()}</div>
      ${!isRoot ? `<div>Parent: ${node.parent.toBase58()}</div>` : ""}
      <div>Created: ${formatDate(node.createdAt)}</div>
      <div>Branches: ${node.childrenCount}</div>
    </div>
    <div class="detail-body">${bodyContent}</div>
    <button class="branch-btn" id="branch-from-btn">+ Branch from this node</button>
  `;

  // Show child branches
  const children = allNodes.filter(
    (n) => n.parent.toBase58() === node.publicKey.toBase58()
  );

  if (children.length > 0) {
    let branchHtml = "";
    for (const child of children) {
      branchHtml += renderNodeCard(child, false);
    }
    branchesList.innerHTML = branchHtml;
    branchesList.querySelectorAll(".story-node").forEach((el) => {
      el.addEventListener("click", () => {
        const pk = el.getAttribute("data-pk");
        if (pk) showNodeDetail(pk);
      });
    });
  } else {
    branchesList.innerHTML =
      '<div class="empty-state">No branches yet</div>';
  }

  // Wire up "branch from this" button
  document.getElementById("branch-from-btn")?.addEventListener("click", () => {
    nodeDetail.classList.add("hidden");
    mintSection.classList.remove("hidden");
    browseSection.classList.remove("hidden");
    nodeType.value = "branch";
    parentField.classList.remove("hidden");
    parentAddress.value = node.publicKey.toBase58();
    titleInput.focus();
  });
}

// --- Minting ---
async function mintNode() {
  if (!program || !provider) return;

  const title = titleInput.value.trim();
  const content = contentInput.value.trim();
  const type = nodeType.value;

  if (!title) {
    setStatus("Title is required", "error");
    return;
  }
  if (!content) {
    setStatus("Story content is required", "error");
    return;
  }

  // For V1, store content directly as the URI (in production, upload to Arweave/IPFS first)
  const contentUri = `data:text/plain;${content}`;

  mintBtn.disabled = true;
  setStatus("Preparing transaction...", "info");

  try {
    const authorPk = provider.wallet.publicKey;
    const seed = titleHash(title);

    if (type === "root") {
      const [storyNodePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("story-node"), authorPk.toBuffer(), seed],
        PROGRAM_ID
      );

      setStatus("Waiting for wallet approval...", "info");
      const tx = await program.methods
        .createRoot(title, contentUri, titleSeedArg(title))
        .accounts({
          storyNode: storyNodePda,
          author: authorPk,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      setStatus(`✅ Root node minted! TX: ${shortenAddr(tx)}`, "success");
    } else {
      const parentPk = new PublicKey(parentAddress.value.trim());
      const [branchPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("story-node"),
          authorPk.toBuffer(),
          parentPk.toBuffer(),
          seed,
        ],
        PROGRAM_ID
      );

      setStatus("Waiting for wallet approval...", "info");
      const tx = await program.methods
        .createBranch(title, contentUri, titleSeedArg(title))
        .accounts({
          storyNode: branchPda,
          parentNode: parentPk,
          author: authorPk,
          systemProgram: web3.SystemProgram.programId,
        })
        .rpc();

      setStatus(`✅ Branch minted! TX: ${shortenAddr(tx)}`, "success");
    }

    // Refresh the list
    titleInput.value = "";
    contentInput.value = "";
    charCount.textContent = "0";
    await loadStories();
  } catch (err: any) {
    console.error("Mint failed:", err);
    setStatus(`❌ ${err.message || err}`, "error");
  } finally {
    mintBtn.disabled = false;
  }
}

// --- Event listeners ---
connectBtn.addEventListener("click", connectWallet);
mintBtn.addEventListener("click", mintNode);
backBtn.addEventListener("click", () => {
  nodeDetail.classList.add("hidden");
  browseSection.classList.remove("hidden");
  mintSection.classList.remove("hidden");
});

nodeType.addEventListener("change", () => {
  if (nodeType.value === "branch") {
    parentField.classList.remove("hidden");
  } else {
    parentField.classList.add("hidden");
  }
});

titleInput.addEventListener("input", () => {
  charCount.textContent = String(titleInput.value.length);
});

// Auto-connect if Phantom is already authorized
window.addEventListener("load", () => {
  const phantom = getPhantom();
  if (phantom?.isConnected) {
    connectWallet();
  }
});
