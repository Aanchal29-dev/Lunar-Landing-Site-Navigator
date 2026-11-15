from pathlib import Path
from difflib import SequenceMatcher
import re
from openai import OpenAI
from dotenv import load_dotenv
import os
from nasa_search import search_nasa_sources
from datetime import datetime, timezone
from urllib.parse import urlparse

# Load our existing API key
load_dotenv()

# Connect to Groq
client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)


REFERENCE_STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "could",
    "did", "do", "does", "for", "from", "how", "i", "in", "is", "it",
    "me", "of", "on", "or", "please", "should", "that", "the", "their",
    "this", "to", "was", "were", "what", "when", "where", "which", "who",
    "why", "will", "with", "would", "moon", "lunar", "nasa", "space",
    "science", "exploration", "s", "important", "importance"
}


def _topic_words(text):
    words = set(re.findall(r"[a-z0-9]+", text.lower()))
    normalized = set()
    for word in words:
        if word in REFERENCE_STOPWORDS:
            continue
        if word == "ices":
            word = "ice"
        elif len(word) > 4 and word.endswith("s"):
            word = word[:-1]
        normalized.add(word)
    return normalized


def _source_authority(source):
    host = (urlparse(source["url"]).hostname or "").lower()
    if host == "science.nasa.gov":
        return 3
    if host == "ntrs.nasa.gov":
        return 2.5
    if host == "nasa.gov" or host.endswith(".nasa.gov"):
        return 2.4
    return 0


def _source_recency(source):
    publication_date = source.get("publication_date")
    match = re.search(r"\b(19|20)\d{2}\b", str(publication_date or ""))
    if not match:
        return 0
    age = max(0, datetime.now(timezone.utc).year - int(match.group(0)))
    return 1 / (1 + age / 20)


def _select_sources(question, ntrs_sources, local_sections, max_sources=5):
    """Rank deduplicated sources by relevance, NASA authority, then recency."""

    candidates = []
    by_url = {}

    for source in ntrs_sources:
        candidate = dict(source)
        candidate["kind"] = "ntrs"
        candidate["local_sections"] = []
        by_url[candidate["url"]] = candidate
        candidates.append(candidate)

    for section in local_sections:
        for url in section["urls"]:
            existing = by_url.get(url)
            if existing:
                if section not in existing["local_sections"]:
                    existing["local_sections"].append(section)
                continue

            candidate = {
                "title": f"Local reference section: {section['title']}",
                "url": url,
                "publication_date": None,
                "kind": "local",
                "section": section,
                "local_sections": []
            }
            by_url[url] = candidate
            candidates.append(candidate)

    question_terms = _topic_words(question)
    for source in candidates:
        if source["kind"] == "ntrs":
            content = f"{source['title']} {source['abstract']}"
            content += " " + " ".join(
                section["text"] for section in source["local_sections"]
            )
        else:
            content = f"{source['section']['title']} {source['section']['text']}"
        source_terms = _topic_words(content)
        title_terms = _topic_words(source["title"])
        url_terms = _topic_words(urlparse(source["url"]).path)
        if not question_terms:
            source["relevance"] = 0
        else:
            title_match = len(question_terms & title_terms) / len(question_terms)
            content_match = len(question_terms & source_terms) / len(question_terms)
            url_match = len(question_terms & url_terms) / len(question_terms)
            source["relevance"] = (
                3 * title_match + content_match + 2 * url_match
            )

    candidates = [source for source in candidates if source["relevance"] > 0]
    candidates.sort(
        key=lambda source: (
            -source["relevance"],
            -_source_authority(source),
            -_source_recency(source),
            source["title"].lower(),
            source["url"]
        )
    )

    unique_candidates = []
    for source in candidates:
        if source["kind"] == "ntrs" and any(
            prior["kind"] == "ntrs"
            and SequenceMatcher(
                None,
                re.sub(r"[^a-z0-9]+", " ", prior["title"].lower()).strip(),
                re.sub(r"[^a-z0-9]+", " ", source["title"].lower()).strip()
            ).ratio() >= 0.92
            for prior in unique_candidates
        ):
            continue
        unique_candidates.append(source)
        if len(unique_candidates) == max_sources:
            break

    return unique_candidates


def answer_question(question):

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": """
                You are a friendly educational assistant.

                Answer questions about:
                - The Moon
                - Lunar exploration
                - NASA
                - Space science
                - Lunar missions

                Explain concepts in simple language.

                Be scientifically accurate.
                If you are unsure, say so.

                Do not invent NASA mission details,
                dates, scientific measurements,
                or references.

                Do not generate landing-site
                recommendations or mission schedules.
                Those require our separate NASA
                calculation engine.

                Keep responses clear and informative.
                """
            },
            {
                "role": "user",
                "content": question
            }
        ]
    )

    return response.choices[0].message.content


def answer_project_question(question):

    # Find the project knowledge file
    file_path = Path(__file__).with_name("my_reference.md")

    # Read the knowledge file
    project_info = file_path.read_text(encoding="utf-8")

    # Ask the LLM to answer using this information
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": """
                You are an assistant explaining the
                Lunar Compass project.

                Use only the supplied project notes
                when answering project-specific questions.

                Clearly distinguish between completed
                features and planned features.

                Do not invent functionality,
                scientific results, or technologies.

                If a detail is not available in the
                project notes, explain that it is unknown.

                Keep explanations simple and helpful.
                """
            },
            {
                "role": "user",
                "content": (
                    f"Project information:\n{project_info}\n\n"
                    f"Question: {question}"
                )
            }
        ]
    )

    return response.choices[0].message.content


def _relevant_reference_sections(question, reference_text):
    """Select local reference sections with topic terms matching a question."""
    question_words = _topic_words(question)
    headings = list(re.finditer(r"(?m)^##\s+(.+?)\s*$", reference_text))
    selected = []

    for index, match in enumerate(headings):
        section_end = (
            headings[index + 1].start()
            if index + 1 < len(headings)
            else len(reference_text)
        )
        heading = match.group(1).strip()
        body = reference_text[match.end():section_end].strip()
        if question_words & _topic_words(f"{heading} {body}"):
            urls = list(dict.fromkeys(
                re.findall(r"https?://[^\s)]+", body)
            ))
            text_without_sources = re.sub(
                r"(?m)^\s*(?:Sources?|Source URLs):\s*$", "", body
            )
            text_without_sources = re.sub(
                r"(?m)^\s*https?://\S+\s*$", "", text_without_sources
            ).strip()
            selected.append({
                "title": heading,
                "text": text_without_sources,
                "urls": urls
            })

    return selected


def answer_verified_question(question):

    # Retrieve NASA records, keeping only useful, distinct abstracts.
    try:
        retrieved_records = search_nasa_sources(question, max_results=5)
    except Exception:
        retrieved_records = []
    if not isinstance(retrieved_records, list):
        retrieved_records = []

    sources = []
    for record in retrieved_records:
        if not isinstance(record, dict):
            continue

        title = record.get("title")
        url = record.get("url")
        abstract = record.get("abstract") or record.get("description")
        if not all(isinstance(value, str) and value.strip()
                   for value in (title, url, abstract)):
            continue

        normalized_title = re.sub(r"[^a-z0-9]+", " ", title.lower()).strip()
        if any(
            source["url"] == url
            or SequenceMatcher(
                None,
                normalized_title,
                source["normalized_title"]
            ).ratio() >= 0.92
            for source in sources
        ):
            continue

        sources.append({
            "title": title.strip(),
            "url": url.strip(),
            "abstract": abstract.strip()[:1400],
            "publication_date": record.get("publication_date"),
            "normalized_title": normalized_title
        })

        if len(sources) == 5:
            break

    file_path = Path(__file__).with_name("science_reference.md")
    nasa_knowledge = file_path.read_text(encoding="utf-8")
    local_sections = _relevant_reference_sections(question, nasa_knowledge)

    citation_sources = _select_sources(question, sources, local_sections)
    for source_id, source in enumerate(citation_sources, start=1):
        source["citation_id"] = source_id

    evidence_parts = []
    for source in citation_sources:
        if source["kind"] == "ntrs":
            evidence_parts.append(
                f"[{source['citation_id']}] NASA NTRS publication\n"
                f"Title: {source['title']}\n"
                f"Publication date: {source.get('publication_date') or 'Not provided'}\n"
                f"Abstract: {source['abstract']}\n"
                f"URL: {source['url']}"
            )

    local_section_sources = {}
    for source in citation_sources:
        attached_sections = list(source.get("local_sections", []))
        if source["kind"] == "local":
            attached_sections.append(source["section"])
        for section in attached_sections:
            section_sources = local_section_sources.setdefault(
                section["title"], {"text": section["text"], "references": []}
            )
            section_sources["references"].append(
                (source["citation_id"], source["url"])
            )

    for title, section in local_section_sources.items():
        references = "\n".join(
            f"[{source_id}] {url}"
            for source_id, url in section["references"]
        )
        evidence_parts.append(
            f"Local NASA reference section: {title}\n"
            f"{section['text']}\nSelected source markers and URLs:\n{references}"
        )

    evidence = (
        "Selected NASA evidence (source markers are stable for this answer):\n\n"
        + "\n\n".join(evidence_parts)
        if evidence_parts
        else "No relevant NASA sources were available from NTRS or the local science reference.\n"
    )

    def format_source(index, source):
        citation_title = source["title"]
        if source.get("publication_date"):
            citation_title += f" ({source['publication_date']})"
        return f"[{index}] {citation_title} — {source['url']}"

    messages = [
            {
                "role": "system",
                "content": """
                You are a NASA and lunar science educational assistant.
                Answer using only the supplied evidence. The NTRS abstracts
                are research summaries and are not automatically verified
                current facts. The curated local reference is supplied as
                additional evidence and has source URLs listed below it.

                Do not invent facts, measurements, mission details, dates,
                or references. Explicitly say when the evidence does not
                support a claim. Use older NASA technical reports as
                historical evidence of what was reported at that time;
                present a claim as current only when current evidence
                supports it. Do not use an old report to state the current
                status of a NASA mission.

                For Artemis schedules, prefer the newer official NASA
                mission pages and Artemis overview in the supplied local
                reference over older NTRS reports. If older reports describe
                a different mission plan, treat them as historical and do
                not present their schedule as current. Label future launch
                dates and mission plans as targets that are subject to change.

                Separate measured or confirmed findings from hypotheses,
                proposed applications, and future plans. In particular,
                evidence that lunar ice exists does not establish that it
                can be extracted or processed into usable water or propellant.
                Describe such uses as proposals or possibilities unless the
                supplied evidence demonstrates them. Preserve uncertainty
                where evidence is incomplete. Never claim that a source or
                landing site was independently verified or is safe.

                Cite a claim only when the cited record directly supports
                that claim. Keyword overlap or a related topic is not enough.
                If no supplied source directly supports a claim, say so and
                leave it uncited. Use approximately 2–5 strong references
                when sufficient, and fewer when fewer sources directly
                support the answer; do not cite every available record.

                For lunar polar water ice, distinguish earlier tentative
                indications from later confirmed findings described in the
                supplied NASA reference. The existence of polar surface ice
                is confirmed. Do not describe that existence as unresolved
                solely because older work reported uncertainty. The amount,
                detailed distribution, useful accessibility, and practical
                extraction of the ice remain uncertain; do not imply that
                confirmation of ice proves those points.

                Cite supported statements only with the source markers
                supplied in the evidence, such as [1]. Do not create source
                numbers, titles, dates, URLs, or a separate source list.
                A valid source number is only a pointer to a supplied record;
                it does not by itself establish that the record supports a
                claim or guarantee scientific accuracy.
                Acknowledge when the supplied evidence is insufficient to
                support a claim. Keep the answer concise, conversational,
                and understandable. Do not generate mission schedules.
                """

            },
            {
                "role": "user",
                "content": f"Evidence:\n{evidence}\nQuestion:\n{question}"
            }
        ]

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=messages,
        temperature=0
    )

    # Get the generated answer
    answer = response.choices[0].message.content

    # Handle empty responses
    if not answer or not answer.strip():
        return (
        "I couldn't generate a reliable answer. "
        "Please try asking the question again."
    )

    valid_source_numbers = set(range(1, len(citation_sources) + 1))

    def clean_citations(text):
        text = re.split(
            r"(?im)^\s*#{0,6}\s*(?:sources|references)\s*:?.*$",
            text.strip(),
            maxsplit=1
        )[0].strip()
        text = re.sub(r"https?://\S+", "", text)
        cited = set()

        def keep_valid_marker(match):
            source_id = int(match.group(1))
            if source_id not in valid_source_numbers:
                return ""
            cited.add(source_id)
            return match.group(0)

        return re.sub(r"\[(\d+)\]", keep_valid_marker, text), cited

    answer, cited_source_numbers = clean_citations(answer)

    if not cited_source_numbers and citation_sources:
        retry_messages = messages + [
            {"role": "assistant", "content": answer},
            {
                "role": "user",
                "content": (
                    "Revise your answer once. Add an inline source marker "
                    "such as [1] only to claims directly supported by the "
                    "matching numbered evidence already provided. Do not "
                    "invent source numbers, URLs, titles, or a bibliography. "
                    "Leave unsupported claims uncited and acknowledge gaps."
                )
            }
        ]
        try:
            retry_response = client.chat.completions.create(
                model="openai/gpt-oss-20b",
                messages=retry_messages,
                temperature=0
            )
            retry_answer = retry_response.choices[0].message.content or ""
            if retry_answer.strip():
                answer, cited_source_numbers = clean_citations(retry_answer)
        except Exception:
            pass

    cited_sources = [
        format_source(number, citation_sources[number - 1])
        for number in sorted(cited_source_numbers)
    ]
    if cited_sources:
        answer += "\n\n### Sources\n" + "\n".join(cited_sources)
    elif citation_sources:
        consulted_sources = [
            format_source(number, source)
            for number, source in enumerate(citation_sources, start=1)
        ]
        answer += (
            "\n\n### Sources consulted\n"
            "These sources were provided as background; this list does not "
            "show that each source supports every claim above.\n"
            + "\n".join(consulted_sources)
        )
    return answer

# Test the function
if __name__ == "__main__":

    question = "Why is water ice important for exploration of the Moon's south pole?"

    answer = answer_verified_question(question)

    print("\nAssistant Response:")
    print(answer)


