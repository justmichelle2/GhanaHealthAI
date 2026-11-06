import re

import httpx

from app.core.config import get_settings


class DahlProviderError(Exception):
    """A provider failure that can be reported without exposing provider details."""


def _clean_reply(content: str) -> str:
    # Some reasoning models include a private <think> section in their output.
    # Never persist or display that section to the patient.
    cleaned = re.sub(r"<think\b[^>]*>.*?(?:</think\s*>|$)", "", content, flags=re.IGNORECASE | re.DOTALL)
    cleaned = re.sub(r"</?think\b[^>]*>", "", cleaned, flags=re.IGNORECASE)
    return cleaned.strip()


async def generate_reply(message: str, language: str) -> str:
    settings = get_settings()
    if not settings.dahl_api_key:
        raise DahlProviderError("AI replies are not configured")

    system_message = (
        "You are a general health information assistant for Ghana. You are not a clinician. "
        "Do not diagnose, prescribe, recommend a dose, or claim certainty. Give brief general "
        "information, say when you are unsure, and encourage a qualified health professional "
        "for personal concerns. For possible emergencies, tell the user to contact local "
        "emergency services or go to the nearest emergency department now. Reply in the "
        f"requested language code: {language}."
    )
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=10.0)) as client:
            response = await client.post(
                "https://inference.dahl.global/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.dahl_api_key}"},
                json={
                    "model": settings.dahl_model,
                    "messages": [
                        {"role": "system", "content": system_message},
                        {"role": "user", "content": message},
                    ],
                    "max_tokens": 500,
                },
            )
        if response.status_code == 402:
            raise DahlProviderError("AI provider has no available balance")
        if response.status_code == 401:
            raise DahlProviderError("AI provider authentication failed")
        if response.status_code == 404:
            raise DahlProviderError("AI model is unavailable")
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        if not isinstance(content, str) or not content.strip():
            raise DahlProviderError("AI returned an empty reply")
        cleaned = _clean_reply(content)
        if not cleaned:
            raise DahlProviderError("AI returned an empty reply")
        return cleaned[:4000]
    except DahlProviderError:
        raise
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError):
        raise DahlProviderError("AI service is temporarily unavailable") from None
