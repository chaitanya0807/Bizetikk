import os
import json
import google.generativeai as genai
from django.conf import settings

# Configure Gemini API
genai.configure(api_key=settings.GEMINI_API_KEY)

SYSTEM_PROMPT = """You are an expert HR screening assistant. 
Your task is to evaluate how well a candidate's resume matches a job description.

Respond ONLY in this exact JSON format:
{
  "score": <integer 1-10>,
  "reasons": [
    "<concise reason 1>",
    "<concise reason 2>",
    "<concise reason 3>"
  ]
}

Scoring guide:
- 1-4: Poor match (missing core skills/experience)
- 5-6: Partial match (some relevant skills, gaps exist)
- 7-8: Good match (meets most requirements)
- 9-10: Excellent match (exceeds requirements)

Rules:
- Evaluate SKILLS and EXPERIENCE only, not name/university/location
- Be specific in reasons - reference actual content from both documents
- Do NOT include any markdown formatting, code blocks, or text outside the JSON block. Just return raw JSON.
"""

USER_PROMPT_TEMPLATE = """
Job Description:
{job_description}

---

Candidate Resume:
{resume}

---

Please evaluate this candidate.
"""

def screen_candidate_stream(job_description: str, resume: str):
    """
    Streams the response from Gemini.
    """
    model = genai.GenerativeModel(
        model_name="gemini-2.5-flash",
        system_instruction=SYSTEM_PROMPT
    )
    
    prompt = USER_PROMPT_TEMPLATE.format(
        job_description=job_description, 
        resume=resume
    )
    
    response = model.generate_content(prompt, stream=True)
    
    for chunk in response:
        yield chunk.text
