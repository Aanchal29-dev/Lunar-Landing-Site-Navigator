"""Search NASA's Technical Reports Server for scientific sources."""

import json
import re

import requests


NTRS_SEARCH_URL = "https://ntrs.nasa.gov/api/citations/search"
NTRS_RECORD_URL = "https://ntrs.nasa.gov/citations/{}"
REQUEST_TIMEOUT_SECONDS = 15
MAX_API_RESULTS = 100
QUERY_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "could",
    "did", "do", "does", "for", "from", "how", "i", "in", "is", "it",
    "me", "of", "on", "or", "please", "should", "that", "the", "their",
    "this", "to", "was", "were", "what", "when", "where", "which", "who",
    "why", "will", "with", "would", "important", "importance", "exploration"
}


def prepare_ntrs_query(question):
    """Reduce a conversational question to its useful search keywords."""

    if not isinstance(question, str):
        return ""

    cleaned_question = re.sub(r"(?<=\w)'s\b", "", question.lower())
    words = re.findall(r"[a-z0-9]+", cleaned_question)
    keywords = []
    for word in words:
        if word in QUERY_STOPWORDS:
            continue
        if word == "moon":
            word = "lunar"
        if word not in keywords:
            keywords.append(word)

    return " ".join(keywords) or question.strip()


def _publication_date(record):
    """Return an available publication date without inventing one."""

    publications = record.get("publications")
    if isinstance(publications, list):
        for publication in publications:
            if isinstance(publication, dict) and publication.get("publicationDate"):
                return publication["publicationDate"]

    return record.get("published") or record.get("publicationDate")


def _search_ntrs_query(query, max_results):
    try:
        result_limit = int(max_results)
    except (TypeError, ValueError):
        return []

    if result_limit <= 0 or not isinstance(query, str) or not query.strip():
        return []

    result_limit = min(result_limit, MAX_API_RESULTS)

    try:
        response = requests.get(
            NTRS_SEARCH_URL,
            params={"q": query.strip(), "page.size": result_limit},
            timeout=REQUEST_TIMEOUT_SECONDS
        )
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError):
        return []

    if not isinstance(data, dict) or not isinstance(data.get("results"), list):
        return []

    sources = []
    for record in data["results"]:
        if not isinstance(record, dict):
            continue

        record_id = record.get("id")
        title = record.get("title")
        if record_id is None or not isinstance(title, str):
            continue

        abstract = record.get("abstract") or record.get("description") or ""
        if not isinstance(abstract, str):
            abstract = ""

        sources.append({
            "title": title,
            "url": NTRS_RECORD_URL.format(record_id),
            "abstract": abstract,
            "publication_date": _publication_date(record)
        })

        if len(sources) >= result_limit:
            break

    return sources


def search_nasa_sources(question, max_results=5):
    """Search NTRS for conversational questions using prepared keywords."""

    query = prepare_ntrs_query(question)
    return _search_ntrs_query(query, max_results)


if __name__ == "__main__":
    question = "Why is water ice important for exploration of the Moon's south pole?"
    prepared_query = prepare_ntrs_query(question)
    full_question_results = _search_ntrs_query(question, 5)
    prepared_query_results = search_nasa_sources(question, 5)

    print(f"Full question: {question}")
    print("Full-question result titles:")
    print(json.dumps([record["title"] for record in full_question_results], indent=2))
    print(f"\nPrepared query: {prepared_query}")
    print("Prepared-query result titles:")
    print(json.dumps([record["title"] for record in prepared_query_results], indent=2))
