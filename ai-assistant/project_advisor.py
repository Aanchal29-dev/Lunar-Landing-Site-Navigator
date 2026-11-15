"""Answer questions about the Lunar Compass project from local verified notes."""

from pathlib import Path
import re


PROJECT_KNOWLEDGE_PATH = Path(__file__).with_name("project_reference.md")
PROJECT_MODEL = "openai/gpt-oss-20b"

_PROJECT_SCOPE = re.compile(
    r"\b(?:lunar compass|lunar landing site navigator|team project|team repo(?:sitory)?|"
    r"our project|this project|the project|our app|this app|our backend|this backend|"
    r"our frontend|this frontend|our team's app|team's backend|team's frontend|"
    r"our (?:terrain|water-ice|historical|visibility|mission-window|comparison)|"
    r"team's (?:terrain|project)|three\.js frontend|fastapi backend|lola site01)\b",
    re.I,
)
_OVERVIEW_QUESTION = re.compile(
    r"\b(?:what is lunar compass(?: project)?|what does lunar compass do|"
    r"how does lunar compass work|how does it work|project overview|"
    r"explain (?:the )?(?:lunar compass(?: project)?|our lunar compass project|our project)|"
    r"describe (?:the )?(?:lunar compass(?: project)?|our lunar compass project|our project)|"
    r"project architecture)\b",
    re.I,
)
_MARKDOWN_TABLE_LINE = re.compile(r"(?m)^\s*\|.*\|\s*$")
_HTML_TAG = re.compile(r"<\s*/?\s*[a-zA-Z][^>]*>")
INCOMPLETE_ANSWER = (
    "I couldn't complete a concise, source-grounded Lunar Compass explanation "
    "this time. Please retry your question."
)
PROJECT_OVERVIEW = """## Three.js Frontend

The browser frontend uses Three.js to display an interactive 3D Moon and support exploration of documented landing sites and points of interest. Users can select locations and use their coordinates with the available analysis controls.

## FastAPI Backend

The team's FastAPI service provides NASA JPL Horizons-based sunlight and geometric Earth-visibility analysis, NASA LOLA terrain measurements, historical lunar mission locations, source-backed water-ice reference locations, and comparisons between candidate locations or time windows. These tools support exploration and comparison of sites.

## Groq-powered Streamlit AI Assistant

The separate Streamlit chatbot provides NASA science answers using retrieval, lunar mission scheduling and conversational mission memory, location-specific water-ice and historical-site queries, visibility analysis, battery estimates, and project guidance. It already calls the team's local FastAPI backend for supported location queries. The chatbot is a separate application; embedding it in the main Three.js interface is planned but not yet completed.

These capabilities have scientific limits: the project does not certify landing safety, guarantee a radio link, verify a rover-safe route, or calculate crash probability. Visibility is geometric, terrain coverage is limited, and water-ice locations are references rather than confirmed extractable deposits. Battery estimates are not flight-qualified recommendations."""


def is_project_question(question):
    """Identify questions scoped to the Lunar Compass project itself."""
    return bool(_PROJECT_SCOPE.search(question))


def load_project_knowledge():
    """Read the concise, local project facts used as answer evidence."""
    return PROJECT_KNOWLEDGE_PATH.read_text(encoding="utf-8")


def answer_project_question(question, groq_client):
    """Answer broad overviews deterministically and other questions from notes."""
    if not is_project_question(question):
        raise ValueError("Question is not identified as project-specific.")

    knowledge = load_project_knowledge()
    if _OVERVIEW_QUESTION.search(question):
        return PROJECT_OVERVIEW

    system_content = (
        "You are the Lunar Compass project advisor. Answer only from "
        "the supplied project knowledge. Do not supplement it with "
        "general model knowledge, invent implementation details, "
        "measurements, dates, sources, or capabilities, or treat the "
        "separate Streamlit chatbot as part of the team's Three.js "
        "application. Clearly distinguish implemented team-backend "
        "features from separate chatbot features. If a capability is "
        "listed as unsupported, say so directly. If the notes do not "
        "establish an answer, say the local project notes do not specify "
        "it. Be concise and preserve stated scientific limitations. "
        "Use Markdown headings and bullets where useful. Never use a "
        "Markdown table or emit HTML tags such as <br> or <br/>."
    )
    messages = [
            {
                "role": "system",
                "content": system_content,
            },
            {
                "role": "user",
                "content": (
                    f"Verified project knowledge:\n{knowledge}\n\n"
                    f"Question:\n{question}"
                ),
            },
    ]

    response = groq_client.chat.completions.create(
        model=PROJECT_MODEL,
        temperature=0,
        max_tokens=600,
        messages=messages,
    )
    answer, finish_reason = _read_completion(response)

    if _should_retry(answer, finish_reason):
        retry_messages = messages.copy()
        retry_messages.append({
            "role": "user",
            "content": (
                "Retry once with a shorter, complete answer using only the same "
                "verified project knowledge. Do not continue or concatenate the "
                "previous text. Use short headings and bullets; no Markdown "
                "tables or HTML tags."
            ),
        })
        retry_response = groq_client.chat.completions.create(
            model=PROJECT_MODEL,
            temperature=0,
            max_tokens=500,
            messages=retry_messages,
        )
        answer, finish_reason = _read_completion(retry_response)
        if _should_retry(answer, finish_reason):
            return INCOMPLETE_ANSWER

    return _remove_html_tags(answer.strip())


def _read_completion(response):
    choices = getattr(response, "choices", None)
    if not choices:
        return "", None
    choice = choices[0]
    message = getattr(choice, "message", None)
    content = getattr(message, "content", "") if message else ""
    return content if isinstance(content, str) else "", getattr(choice, "finish_reason", None)


def _should_retry(answer, finish_reason):
    return (
        finish_reason == "length"
        or not answer.strip()
        or bool(_MARKDOWN_TABLE_LINE.search(answer))
        or bool(_HTML_TAG.search(answer))
    )


def _remove_html_tags(answer):
    answer = re.sub(r"(?i)<\s*br\s*/?\s*>", "\n", answer)
    answer = re.sub(r"<\s*/?\s*[a-zA-Z][^>]*>", "", answer)
    return answer.strip()
