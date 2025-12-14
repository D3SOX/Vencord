# AI Keepalive Question Generator

This plugin uses a JSON file to store complex problem questions. Use the Python script to generate new questions using OpenAI API.

## Setup

1. Setup a virtual environment:
    ```bash
    python -m venv .venv
    source .venv/bin/activate
    ```

2. Install the required Python package:
   ```bash
   pip install openai
   ```

3. Set your OpenAI API key:
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```
   Or pass it via command line: `--api-key your-api-key-here`

## Usage

Generate questions (default: 130):
```bash
python generate_questions.py
```

Generate a specific number of questions:
```bash
python generate_questions.py -n 50
```

The script will:
- Read existing questions from `questions.json` if it exists
- Generate new questions using OpenAI API
- Filter out duplicates (questions already in the file)
- Append only new questions to the file
- Save the updated list to `questions.json`

## Plugin Behavior

The plugin will:
1. Try to load questions from `questions.json` on startup
2. Fall back to the hardcoded array if the JSON file doesn't exist or fails to load
3. Use the loaded questions for random message generation

## File Structure

- `generate_questions.py` - Python script to generate questions
- `questions.json` - Generated questions file (created by the script)
- `index.tsx` - Plugin code that loads questions from JSON
