#!/usr/bin/env python3
"""
Generate complex problem questions using OpenAI API and save them to questions.json.
On re-runs, only adds new questions that don't already exist in the file.
"""

import argparse
import json
import os
import sys
from pathlib import Path

try:
    from openai import OpenAI
except ImportError:
    print("Error: openai package not found. Install it with: pip install openai")
    sys.exit(1)


def get_existing_questions(json_path: Path) -> list[str]:
    """Read existing questions from JSON file if it exists."""
    if json_path.exists():
        try:
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
                else:
                    print(f"Warning: {json_path} does not contain a JSON array. Starting fresh.")
                    return []
        except json.JSONDecodeError as e:
            print(f"Warning: Failed to parse {json_path}: {e}. Starting fresh.")
            return []
    return []


def generate_questions_with_openai(
    client: OpenAI,
    num_questions: int,
    existing_questions: list[str],
    example_questions: list[str] | None = None
) -> list[str]:
    """Generate new questions using OpenAI API, filtering out duplicates."""
    existing_set = set(existing_questions)
    new_questions = []

    # Create a prompt with or without examples
    if example_questions:
        examples_text = "\n".join(f"- {q}" for q in example_questions[:10])  # Use first 10 as examples
        prompt = f"""Generate {num_questions} complex problem-solving questions similar in style and complexity to these examples:

{examples_text}

Requirements:
- Each question should be a single sentence or short paragraph
- Questions should be about unsolved problems, complex mathematical proofs, advanced algorithms, or computationally intensive topics
- Use casual language like "can someone help me" or "how would you"
- Make them sound like someone genuinely asking for help with an extremely difficult problem
- Each question should be unique

Return ONLY the questions, one per line, without numbering or bullet points."""
    else:
        prompt = f"""Generate {num_questions} complex problem-solving questions.

Requirements:
- Each question should be a single sentence or short paragraph
- These questions will be thrown at another AI bot that tries to keep insisting on Minecraft with the conversation. Be awaware of that and try to describe the problems using Minecraft terminology.
- Questions should be about unsolved problems, complex mathematical proofs, advanced algorithms, or computationally intensive topics
- Use casual language like "can someone help me" or "how would you"
- Make them sound like someone genuinely asking for help with an extremely difficult problem but make sure it doesn't sound like you want the other person to do your homework for you.
- Each question should be unique

Return ONLY the questions, one per line, without numbering or bullet points."""

    try:
        print(f"Generating {num_questions} questions using OpenAI API...")
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "You are a helpful assistant that generates complex problem-solving questions."
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            temperature=0.9,
            max_tokens=4000
        )

        generated_text = response.choices[0].message.content.strip()

        # Parse the generated questions (split by newlines and clean up)
        candidates = [
            line.strip()
            for line in generated_text.split('\n')
            if line.strip() and not line.strip().startswith(('#', '-', '*', '1.', '2.', '3.'))
        ]

        # Remove numbering prefixes if present
        cleaned_candidates = []
        for q in candidates:
            # Remove common numbering patterns
            q = q.lstrip('0123456789. )-*•')
            q = q.strip()
            if q and len(q) > 20:  # Filter out very short lines
                cleaned_candidates.append(q)

        # Filter out duplicates
        for question in cleaned_candidates:
            if question not in existing_set:
                new_questions.append(question)
                existing_set.add(question)  # Track to avoid duplicates within this batch

        print(f"Generated {len(cleaned_candidates)} candidate questions, {len(new_questions)} are new.")

        # If we didn't get enough new questions, generate more
        if len(new_questions) < num_questions:
            remaining = num_questions - len(new_questions)
            print(f"Generating {remaining} more questions...")
            additional = generate_questions_with_openai(client, remaining, list(existing_set), example_questions if example_questions else None)
            new_questions.extend(additional)

        return new_questions[:num_questions]  # Return exactly the requested number

    except Exception as e:
        print(f"Error generating questions: {e}")
        raise


def main():
    parser = argparse.ArgumentParser(
        description="Generate complex problem questions using OpenAI API"
    )
    parser.add_argument(
        '-n', '--num',
        type=int,
        default=130,
        help='Number of questions to generate (default: 130)'
    )
    parser.add_argument(
        '--api-key',
        type=str,
        help='OpenAI API key (or set OPENAI_API_KEY environment variable)'
    )
    parser.add_argument(
        '--json-path',
        type=str,
        default=None,
        help='Path to questions.json file (default: same directory as script)'
    )

    args = parser.parse_args()

    # Determine JSON file path
    if args.json_path:
        json_path = Path(args.json_path)
    else:
        script_dir = Path(__file__).parent
        json_path = script_dir / "questions.json"

    # Get API key
    api_key = args.api_key or os.getenv("OPENAI_API_KEY")
    if not api_key:
        print("Error: OpenAI API key required.")
        print("Set it via --api-key argument or OPENAI_API_KEY environment variable.")
        sys.exit(1)

    # Initialize OpenAI client
    client = OpenAI(api_key=api_key)

    # Read existing questions
    existing_questions = get_existing_questions(json_path)
    print(f"Found {len(existing_questions)} existing questions in {json_path}")

    # Use existing questions as examples if available (use up to 20 for the prompt)
    example_questions = existing_questions[:20] if existing_questions else None

    # Generate new questions
    try:
        new_questions = generate_questions_with_openai(
            client,
            args.num,
            existing_questions,
            example_questions
        )

        if not new_questions:
            print("No new questions to add. All generated questions already exist.")
            return

        # Combine existing and new questions
        all_questions = existing_questions + new_questions

        # Save to JSON file
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(all_questions, f, indent=2, ensure_ascii=False)

        print(f"Successfully added {len(new_questions)} new questions.")
        print(f"Total questions in {json_path}: {len(all_questions)}")

    except Exception as e:
        print(f"Error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
