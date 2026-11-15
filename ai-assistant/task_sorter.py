
from openai import OpenAI
from dotenv import load_dotenv
import os
import json

# Load our Groq API key
load_dotenv()

client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)


def detect_intent(question):

    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": """
                You are a question classifier for a
                lunar exploration assistant.

                Classify the user's question into
                one of three categories:

                schedule:
                The user wants to plan, schedule,
                change, or compare lunar surface
                mission activities, locations,
                dates, or visibility windows.

                moon_nasa:
                The user wants factual information
                about the Moon, NASA, lunar science,
                space exploration, or lunar missions.

                other:
                The question is unrelated to lunar
                exploration or NASA.

                Return only the category using
                the required JSON structure.
                """
            },
            {
                "role": "user",
                "content": question
            }
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "intent_result",
                "strict": True,
                "schema": {
                    "type": "object",
                    "properties": {
                        "intent": {
                            "type": "string",
                            "enum": [
                                "schedule",
                                "moon_nasa",
                                "other"
                            ]
                        }
                    },
                    "required": ["intent"],
                    "additionalProperties": False
                }
            }
        }
    )

    data = json.loads(
        response.choices[0].message.content
    )

    return data["intent"]


# Test intent detection
if __name__ == "__main__":

    question = input("Enter your question: ")

    intent = detect_intent(question)

    print("\nDetected Intent:", intent)
