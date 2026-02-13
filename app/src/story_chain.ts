/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/story_chain.json`.
 */
export type StoryChain = {
  "address": "Eun9Ca5x4CGTZ53XC5ie8GidJBAgFhkr7gYwvx5qLcKq",
  "metadata": {
    "name": "storyChain",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "createBranch",
      "docs": [
        "Branch off an existing story node, creating a new child node."
      ],
      "discriminator": [
        78,
        225,
        107,
        25,
        194,
        2,
        140,
        244
      ],
      "accounts": [
        {
          "name": "storyNode",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121,
                  45,
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "author"
              },
              {
                "kind": "account",
                "path": "parentNode"
              },
              {
                "kind": "arg",
                "path": "titleSeed"
              }
            ]
          }
        },
        {
          "name": "parentNode",
          "writable": true
        },
        {
          "name": "author",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "contentUri",
          "type": "string"
        },
        {
          "name": "titleSeed",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "createRoot",
      "docs": [
        "Create a brand new story (root node with no parent)."
      ],
      "discriminator": [
        115,
        195,
        96,
        208,
        249,
        205,
        56,
        27
      ],
      "accounts": [
        {
          "name": "storyNode",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  115,
                  116,
                  111,
                  114,
                  121,
                  45,
                  110,
                  111,
                  100,
                  101
                ]
              },
              {
                "kind": "account",
                "path": "author"
              },
              {
                "kind": "arg",
                "path": "titleSeed"
              }
            ]
          }
        },
        {
          "name": "author",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "title",
          "type": "string"
        },
        {
          "name": "contentUri",
          "type": "string"
        },
        {
          "name": "titleSeed",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "storyNode",
      "discriminator": [
        81,
        76,
        245,
        170,
        43,
        108,
        134,
        24
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "titleTooLong",
      "msg": "Title exceeds 64 characters"
    },
    {
      "code": 6001,
      "name": "uriTooLong",
      "msg": "Content URI exceeds 200 characters"
    },
    {
      "code": 6002,
      "name": "emptyUri",
      "msg": "Content URI cannot be empty"
    },
    {
      "code": 6003,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6004,
      "name": "invalidTitleSeed",
      "msg": "Title seed does not match SHA-256 of title"
    }
  ],
  "types": [
    {
      "name": "storyNode",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "author",
            "docs": [
              "Wallet that created this node (creator identity)"
            ],
            "type": "pubkey"
          },
          {
            "name": "parent",
            "docs": [
              "Parent node pubkey (Pubkey::default() for root nodes)"
            ],
            "type": "pubkey"
          },
          {
            "name": "title",
            "docs": [
              "Short title for navigation / display"
            ],
            "type": "string"
          },
          {
            "name": "contentUri",
            "docs": [
              "URI pointing to full content (arweave:// or ipfs://)"
            ],
            "type": "string"
          },
          {
            "name": "childrenCount",
            "docs": [
              "Number of direct children branching from this node"
            ],
            "type": "u64"
          },
          {
            "name": "createdAt",
            "docs": [
              "Unix timestamp of creation"
            ],
            "type": "i64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump seed"
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
