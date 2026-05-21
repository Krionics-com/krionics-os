# LLM Wiki

A pattern for building personal knowledge bases using LLMs.

The core idea
Most people's experience with LLMs and documents looks like RAG: you upload a collection of files, the LLM retrieves relevant chunks at query time, and generates an answer. This works, but the LLM is rediscovering knowledge from scratch on every question. There's no accumulation. Ask a subtle question that requires synthesizing five documents, and the LLM has to find and piece together the relevant fragments every time. Nothing is built up.

The idea here is different. Instead of just retrieving from raw documents at query time, the LLM incrementally builds and maintains a persistent wiki -- a structured, interlinked collection of markdown files that sits between you and the raw sources. When you add a new source, the LLM doesn't just index it for later retrieval. It reads it, extracts the key information, and integrates it into the existing wiki -- updating entity pages, revising topic summaries, noting where new data contradicts old claims, strengthening or challenging the evolving synthesis. The knowledge is compiled once and then kept current, not re-derived on every query.

This is the key difference: the wiki is a persistent, compounding artifact. The cross-references are already there. The contradictions have already been flagged. The synthesis already reflects everything you've read. The wiki keeps getting richer with every source you add and every question you ask.

You never (or rarely) write the wiki yourself -- the LLM writes and maintains all of it. You're in charge of sourcing, exploration, and asking the right questions. The LLM does all the grunt work -- the summarizing, cross-referencing, filing, and bookkeeping that makes a knowledge base actually useful over time. In practice, I have the LLM agent open on one side and Obsidian open on the other. The LLM makes edits based on our conversation, and I browse the results in real time.

This can apply to a lot of different contexts. A few examples:
- Personal: tracking your own goals, health, psychology, self-improvement -- filing journal entries, articles, podcast notes, and building up a structured picture of yourself over time.
- Research: going deep on a topic over weeks or months -- reading papers, articles, reports, and incrementally building a comprehensive wiki with an evolving thesis.
- Reading a book: filing each chapter as you go, building out pages for characters, themes, plot threads, and how they connect.
- Business/team: an internal wiki maintained by LLMs, fed by Slack threads, meeting transcripts, project documents, customer calls.
- Competitive analysis, due diligence, trip planning, course notes, hobby deep-dives.

Architecture
There are three layers:
- Raw sources -- your curated collection of source documents. These are immutable -- the LLM reads from them but never modifies them.
- The wiki -- a directory of LLM-generated markdown files. The LLM owns this layer entirely.
- The schema -- a document (e.g. CLAUDE.md or AGENTS.md) that tells the LLM how the wiki is structured and how workflows should run.

Operations
- Ingest: Read a new source, write a summary, update related pages, update index and log.
- Query: Answer questions from the wiki and save reusable outputs back into the wiki.
- Lint: Periodically health-check the wiki for contradictions, stale claims, or missing links.

Indexing and logging
Two special files help the LLM and you navigate the wiki as it grows:
- index.md is content-oriented and catalogs all pages with summaries.
- log.md is chronological and append-only.

Optional: CLI tools
As the wiki grows, a local search tool can help, such as a markdown search engine or a lightweight custom script.

Why this works
The tedious part of maintaining a knowledge base is the bookkeeping. LLMs can update many files in one pass and keep cross-references current at low cost.

Note
This document is intentionally abstract. It describes the idea, not a specific implementation.
