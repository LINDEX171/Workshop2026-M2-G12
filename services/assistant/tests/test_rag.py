from app.rag import build_prompt, format_sources, load_chunks


def test_load_chunks_reads_md_and_txt(tmp_path):
    (tmp_path / "a.md").write_text("A" * 1000, encoding="utf-8")
    (tmp_path / "sub").mkdir()
    (tmp_path / "sub" / "b.txt").write_text("hello", encoding="utf-8")
    (tmp_path / "ignore.png").write_text("x", encoding="utf-8")

    chunks = load_chunks(str(tmp_path), chunk_size=400, overlap=50)
    sources = {c["source"] for c in chunks}
    assert "a.md" in sources
    assert "sub/b.txt" in sources or "sub\\b.txt" in sources
    assert "ignore.png" not in sources
    # 1000 caractères, pas de 400 avec overlap 50 -> plusieurs morceaux
    assert sum(1 for c in chunks if c["source"] == "a.md") >= 3


def test_load_chunks_skips_empty(tmp_path):
    (tmp_path / "empty.md").write_text("   \n  ", encoding="utf-8")
    assert load_chunks(str(tmp_path), 800, 120) == []


def test_build_prompt_includes_context_and_sources():
    contexts = [{"text": "La remédiation DoS bannit la signature.", "source": "runbooks/dos.md"}]
    prompt = build_prompt("Comment remédier à un DoS ?", contexts)
    assert "runbooks/dos.md" in prompt
    assert "La remédiation DoS" in prompt
    assert "Comment remédier à un DoS ?" in prompt
    assert "UNIQUEMENT" in prompt  # consigne anti-hallucination


def test_build_prompt_no_context():
    assert "aucun passage pertinent" in build_prompt("question ?", [])


def test_format_sources_dedup_keeps_order():
    contexts = [
        {"text": "x", "source": "a.md"},
        {"text": "y", "source": "b.md"},
        {"text": "z", "source": "a.md"},
    ]
    assert format_sources(contexts) == ["a.md", "b.md"]
