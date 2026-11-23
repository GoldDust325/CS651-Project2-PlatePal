"""Shiv Shankar Yadav — Windows-safe local startup; key stays in this process."""
import argparse
import getpass
import os
import uvicorn


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--model', default=os.getenv('GEMINI_MODEL', 'gemini-3.8-flash'))
    args = parser.parse_args()
    key = getpass.getpass('Gemini API key (hidden): ').strip()
    if not key:
        parser.error('A Gemini API key is required.')
    os.environ['GOOGLE_API_KEY'] = key
    os.environ.pop('GEMINI_API_KEY', None)
    os.environ['GOOGLE_GENAI_USE_VERTEXAI'] = 'false'
    os.environ['GEMINI_MODEL'] = args.model
    print('Starting local ADK service. Model availability is checked when a meal is submitted.')
    uvicorn.run('adk_service.service:app', host='127.0.0.1', port=8000, access_log=False)


if __name__ == '__main__': main()
