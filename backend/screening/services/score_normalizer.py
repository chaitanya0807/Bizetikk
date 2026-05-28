import re

WORD_TO_INT = {
    'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
    'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10
}

def normalise_score(raw: str) -> int:
    """
    Normalizes inconsistent AI output into an integer 1-10.
    Handles decimals (e.g. 7.3 -> 7) and words (e.g. 'Seven' -> 7).
    """
    if not isinstance(raw, str):
        try:
            return round(float(raw))
        except (ValueError, TypeError):
            return 0
            
    raw = raw.strip().lower()
    
    # Try word form
    if raw in WORD_TO_INT:
        return WORD_TO_INT[raw]
        
    # Extract first number (handles "7.3", "-5", "Score: 8/10")
    match = re.search(r'-?\d+\.?\d*', raw)
    if match:
        return min(10, max(1, round(float(match.group()))))
        
    return 0  # Unknown
