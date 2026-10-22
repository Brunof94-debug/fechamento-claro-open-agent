# Meterless H-MEM reference

Source: https://github.com/Meterless/Meterless/tree/1742dec56a66e58eef9dda2d2b865823758ca8cd/engines/hmem/reference/src

Upstream commit: `1742dec56a66e58eef9dda2d2b865823758ca8cd`.

The src files are copied without modification. This is pre-existing Apache-2.0 code, not original contest implementation. LICENSE accompanies this copy. The reference uses deterministic lightweight embeddings and rule-based mining. Its use does not mean that a generative model ran.

Browser build supplies a filesystem adapter that throws if called and a minimal path adapter. H-MEM is constructed without persistDir, so its documented in-memory mode never calls the filesystem. No persistence is claimed.
