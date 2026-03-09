import { Buffer } from "buffer";
(window as any).Buffer = Buffer;

import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { walletAdapterIdentity } from "@metaplex-foundation/umi-signer-wallet-adapters";
import {
  mplCore,
  createCollection,
  create,
  fetchCollection,
  fetchAsset,
} from "@metaplex-foundation/mpl-core";
import {
  generateSigner,
  publicKey,
  type Umi,
  type PublicKey as UmiPublicKey,
} from "@metaplex-foundation/umi";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { clusterApiUrl } from "@solana/web3.js";

// --- Config ---
const RPC_URL = clusterApiUrl("devnet");

// --- Types ---
interface StoryNode {
  id: string; // asset pubkey
  name: string;
  description: string;
  image: string;
  owner: string;
  parent: string; // parent asset id, "root" for first chapter
  branchText: string; // link text shown on parent
  children: StoryNode[];
}

// --- State ---
let umi: Umi | null = null;
let currentCollection: string = "";
let storyNodes: StoryNode[] = [];
let currentNodeId: string = "";

// --- DOM refs ---
const $ = (id: string) => document.getElementById(id)!;
const connectBtn = $("connect-btn") as HTMLButtonElement;
const walletAddr = $("wallet-address");
const landingSection = $("landing-section");
const createSection = $("create-section");
const browseSection = $("browse-section");
const storySection = $("story-section");

// --- Helpers ---
function shortenAddr(addr: string): string {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function setStatus(id: string, msg: string, type: "success" | "error" | "info") {
  const el = $(id);
  el.textContent = msg;
  el.className = `status ${type}`;
}

function clearStatus(id: string) {
  const el = $(id);
  el.className = "status";
  el.textContent = "";
}

function showOnly(sectionId: string) {
  ["landing-section", "create-section", "browse-section", "story-section"].forEach((id) => {
    $(id).classList.toggle("hidden", id !== sectionId);
  });
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// --- Wallet ---
function getSolanaWallet(): any {
  const w = window as any;
  if (w.phantom?.solana?.isPhantom) return w.phantom.solana;
  if (w.solana?.isPhantom) return w.solana;
  if (w.solflare?.isSolflare) return w.solflare;
  if (w.backpack?.isBackpack) return w.backpack;
  if (w.braveSolana) return w.braveSolana;
  if (w.solana) return w.solana;
  return null;
}

async function connectWallet() {
  const wallet = getSolanaWallet();
  if (!wallet) {
    alert("No Solana wallet found! Install Phantom, Solflare, or Brave Wallet.");
    return;
  }

  try {
    await wallet.connect();
    const pubkeyStr = wallet.publicKey.toBase58();

    // Create Umi instance with wallet adapter
    umi = createUmi(RPC_URL)
      .use(mplCore())
      .use(dasApi())
      .use(walletAdapterIdentity(wallet));

    connectBtn.textContent = "Connected";
    connectBtn.disabled = true;
    walletAddr.textContent = shortenAddr(pubkeyStr);
  } catch (err: any) {
    console.error("Wallet connect failed:", err);
    alert("Failed to connect wallet: " + err.message);
  }
}

// --- Create Story (Collection + First Chapter) ---
async function createStory() {
  if (!umi) { alert("Connect wallet first"); return; }

  const storyName = ($("story-name") as HTMLInputElement).value.trim();
  const chapterTitle = ($("first-chapter-title") as HTMLInputElement).value.trim();
  const chapterText = ($("first-chapter-text") as HTMLTextAreaElement).value.trim();
  const chapterImage = ($("first-chapter-image") as HTMLInputElement).value.trim();

  if (!storyName || !chapterTitle || !chapterText) {
    setStatus("create-status", "Fill in story name, chapter title, and text", "error");
    return;
  }

  ($("create-btn") as HTMLButtonElement).disabled = true;
  setStatus("create-status", "Creating collection...", "info");

  try {
    // Step 1: Create the Collection (= the Story)
    const collectionSigner = generateSigner(umi);

    await createCollection(umi, {
      collection: collectionSigner,
      name: storyName,
      uri: "", // We could upload JSON metadata but keeping it simple for V1
    }).sendAndConfirm(umi);

    const collectionId = collectionSigner.publicKey.toString();
    setStatus("create-status", "Collection created! Minting first chapter...", "info");

    // Step 2: Mint the first chapter as an Asset in the Collection
    const assetSigner = generateSigner(umi);

    // Build metadata URI as a data URI (simple for devnet)
    const metadataJson = {
      name: chapterTitle,
      description: chapterText,
      image: chapterImage || "",
      attributes: [
        { trait_type: "parent", value: "root" },
        { trait_type: "branch_text", value: "Begin the story" },
        { trait_type: "chapter_text", value: chapterText },
      ],
    };
    const metadataUri = "data:application/json;base64," + btoa(JSON.stringify(metadataJson));

    await create(umi, {
      asset: assetSigner,
      name: chapterTitle,
      uri: metadataUri,
      collection: publicKey(collectionId),
      plugins: [
        {
          type: "Attributes",
          attributeList: [
            { key: "parent", value: "root" },
            { key: "branch_text", value: "Begin the story" },
            { key: "chapter_text", value: chapterText },
            { key: "image", value: chapterImage || "" },
          ],
        },
      ],
    }).sendAndConfirm(umi);

    setStatus(
      "create-status",
      `✅ Story created! Collection: ${shortenAddr(collectionId)}`,
      "success"
    );

    // Show the collection address for sharing
    const statusEl = $("create-status");
    statusEl.innerHTML += `<div class="collection-address">${collectionId}</div>
      <p style="margin-top:0.5rem;font-size:0.85rem;color:var(--text-dim)">Share this address so others can read and branch your story!</p>
      <button id="view-created-story" style="margin-top:0.75rem;width:100%">View Story →</button>`;

    $("view-created-story")?.addEventListener("click", () => {
      currentCollection = collectionId;
      loadStory(collectionId);
    });
  } catch (err: any) {
    console.error("Create story failed:", err);
    setStatus("create-status", `❌ ${err.message || err}`, "error");
  } finally {
    ($("create-btn") as HTMLButtonElement).disabled = false;
  }
}

// --- Load Story from Collection ---
async function loadStory(collectionAddress: string) {
  if (!umi) { alert("Connect wallet first"); return; }

  setStatus("browse-status", "Loading story...", "info");
  showOnly("story-section");

  try {
    currentCollection = collectionAddress;

    // Fetch all assets in the collection using DAS
    const assets = await (umi.rpc as any).getAssetsByGroup({
      groupKey: "collection",
      groupValue: collectionAddress,
      limit: 1000,
    });

    if (!assets || !assets.items || assets.items.length === 0) {
      // Fallback: try fetching collection directly
      setStatus("browse-status", "No chapters found in this collection", "error");
      showOnly("browse-section");
      return;
    }

    // Parse assets into StoryNodes
    storyNodes = assets.items.map((item: any) => {
      const attrs = item.content?.metadata?.attributes || [];
      const getAttr = (key: string) => attrs.find((a: any) => a.trait_type === key)?.value || "";

      return {
        id: item.id,
        name: item.content?.metadata?.name || item.name || "Untitled",
        description: getAttr("chapter_text") || item.content?.metadata?.description || "",
        image: getAttr("image") || item.content?.links?.image || "",
        owner: item.ownership?.owner || "",
        parent: getAttr("parent") || "root",
        branchText: getAttr("branch_text") || "",
        children: [],
      } as StoryNode;
    });

    // Build the tree
    const nodeMap = new Map<string, StoryNode>();
    storyNodes.forEach((n) => nodeMap.set(n.id, n));

    storyNodes.forEach((n) => {
      if (n.parent !== "root" && nodeMap.has(n.parent)) {
        nodeMap.get(n.parent)!.children.push(n);
      }
    });

    // Find root node(s)
    const roots = storyNodes.filter((n) => n.parent === "root");

    // Show story header
    $("story-title").textContent = "📖 Story";  // Could fetch collection name
    $("story-meta").textContent = `${storyNodes.length} chapter${storyNodes.length !== 1 ? "s" : ""} • Collection: ${shortenAddr(collectionAddress)}`;

    // Navigate to root
    if (roots.length > 0) {
      navigateToNode(roots[0].id);
    } else {
      $("current-node").innerHTML = '<div class="empty-state">No root chapter found</div>';
    }

    clearStatus("browse-status");
  } catch (err: any) {
    console.error("Load story failed:", err);
    setStatus("browse-status", `❌ ${err.message || err}`, "error");
    showOnly("browse-section");
  }
}

// --- Navigate to a node ---
function navigateToNode(nodeId: string) {
  const node = storyNodes.find((n) => n.id === nodeId);
  if (!node) return;

  currentNodeId = nodeId;

  // Render current node
  const imageHtml = node.image
    ? `<div class="node-image"><img src="${escapeHtml(node.image)}" alt="${escapeHtml(node.name)}" /></div>`
    : "";

  $("current-node").innerHTML = `
    <h2>${escapeHtml(node.name)}</h2>
    ${imageHtml}
    <div class="node-body">${escapeHtml(node.description)}</div>
    <div class="node-detail-meta">
      <div>Author: ${shortenAddr(node.owner)}</div>
      <div>NFT: ${shortenAddr(node.id)}</div>
    </div>
  `;

  // Render branches (children)
  const branchesList = $("branches-list");
  if (node.children.length > 0) {
    branchesList.innerHTML = node.children
      .map(
        (child) => `
        <div class="choice-link" data-id="${child.id}">
          <div class="link-text">→ ${escapeHtml(child.branchText || child.name)}</div>
          <div class="link-meta">by ${shortenAddr(child.owner)}</div>
        </div>
      `
      )
      .join("");

    branchesList.querySelectorAll(".choice-link").forEach((el) => {
      el.addEventListener("click", () => {
        const id = el.getAttribute("data-id");
        if (id) navigateToNode(id);
      });
    });
  } else {
    branchesList.innerHTML = '<div class="empty-state">No branches yet — be the first to add one!</div>';
  }

  // Show parent navigation if not root
  if (node.parent !== "root") {
    const parentNode = storyNodes.find((n) => n.id === node.parent);
    if (parentNode) {
      $("current-node").innerHTML =
        `<button class="back-btn" id="parent-nav-btn">← Back to: ${escapeHtml(parentNode.name)}</button>` +
        $("current-node").innerHTML;
      $("parent-nav-btn")?.addEventListener("click", () => navigateToNode(parentNode.id));
    }
  }

  $("branches-section").classList.remove("hidden");
  $("add-branch-form").classList.add("hidden");
}

// --- Mint a branch ---
async function mintBranch() {
  if (!umi || !currentNodeId || !currentCollection) {
    alert("Connect wallet and load a story first");
    return;
  }

  const title = ($("branch-title") as HTMLInputElement).value.trim();
  const linkText = ($("branch-link-text") as HTMLInputElement).value.trim();
  const text = ($("branch-text") as HTMLTextAreaElement).value.trim();
  const image = ($("branch-image") as HTMLInputElement).value.trim();

  if (!title || !text) {
    setStatus("branch-status", "Title and text are required", "error");
    return;
  }

  ($("mint-branch-btn") as HTMLButtonElement).disabled = true;
  setStatus("branch-status", "Minting branch NFT...", "info");

  try {
    const assetSigner = generateSigner(umi);

    const metadataJson = {
      name: title,
      description: text,
      image: image || "",
      attributes: [
        { trait_type: "parent", value: currentNodeId },
        { trait_type: "branch_text", value: linkText || title },
        { trait_type: "chapter_text", value: text },
        { trait_type: "image", value: image || "" },
      ],
    };
    const metadataUri = "data:application/json;base64," + btoa(JSON.stringify(metadataJson));

    await create(umi, {
      asset: assetSigner,
      name: title,
      uri: metadataUri,
      collection: publicKey(currentCollection),
      plugins: [
        {
          type: "Attributes",
          attributeList: [
            { key: "parent", value: currentNodeId },
            { key: "branch_text", value: linkText || title },
            { key: "chapter_text", value: text },
            { key: "image", value: image || "" },
          ],
        },
      ],
    }).sendAndConfirm(umi);

    setStatus("branch-status", "✅ Branch minted!", "success");

    // Reload the story to show the new branch
    setTimeout(() => loadStory(currentCollection), 2000);
  } catch (err: any) {
    console.error("Mint branch failed:", err);
    setStatus("branch-status", `❌ ${err.message || err}`, "error");
  } finally {
    ($("mint-branch-btn") as HTMLButtonElement).disabled = false;
  }
}

// --- Event Listeners ---
connectBtn.addEventListener("click", connectWallet);

$("create-story-card").addEventListener("click", () => showOnly("create-section"));
$("browse-card").addEventListener("click", () => showOnly("browse-section"));
$("create-back-btn").addEventListener("click", () => showOnly("landing-section"));
$("browse-back-btn").addEventListener("click", () => showOnly("landing-section"));
$("story-back-btn").addEventListener("click", () => showOnly("landing-section"));

$("create-btn").addEventListener("click", createStory);

$("load-story-btn").addEventListener("click", () => {
  const addr = ($("collection-address") as HTMLInputElement).value.trim();
  if (!addr) {
    setStatus("browse-status", "Enter a collection address", "error");
    return;
  }
  loadStory(addr);
});

$("add-branch-btn").addEventListener("click", () => {
  $("add-branch-form").classList.remove("hidden");
  ($("branch-title") as HTMLInputElement).focus();
});

$("cancel-branch-btn").addEventListener("click", () => {
  $("add-branch-form").classList.add("hidden");
  clearStatus("branch-status");
});

$("mint-branch-btn").addEventListener("click", mintBranch);

// Image preview on create form
$("first-chapter-image").addEventListener("input", () => {
  const url = ($("first-chapter-image") as HTMLInputElement).value.trim();
  const preview = $("create-image-preview");
  if (url && url.startsWith("http")) {
    preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview" />`;
    preview.classList.remove("hidden");
  } else {
    preview.classList.add("hidden");
  }
});

// Auto-connect
window.addEventListener("load", () => {
  const wallet = getSolanaWallet();
  if (wallet?.isConnected) connectWallet();
});
