# Author: Shiv Shankar Yadav
# Issue: #2 — local live-demo authentication using Firebase's official REST API
"""Obtain a real Firebase ID token without persisting credentials or tokens."""
import getpass
import os
from pathlib import Path
import re

import httpx


def sign_in():
    key = os.getenv('FIREBASE_WEB_API_KEY', '').strip()
    if not key:
        config = Path(__file__).resolve().parents[1] / 'frontend/react/lib/firebase.js'
        match = re.search(r"apiKey:\s*['\"]([^'\"]+)['\"]", config.read_text(encoding='utf-8'))
        if not match:
            raise ValueError('Set FIREBASE_WEB_API_KEY to your project public web API key.')
        key = match.group(1)
    email = getpass.getpass('PlatePal account email (hidden): ').strip()
    password = getpass.getpass('PlatePal password (hidden): ')
    if not email or not password:
        raise ValueError('An existing Firebase email/password account is required.')
    try:
        response = httpx.post(
            'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword',
            params={'key': key}, json={'email': email, 'password': password, 'returnSecureToken': True},
            timeout=30, follow_redirects=False)
        if response.status_code != 200:
            raise ValueError('Firebase sign-in failed. Check account credentials, email/password provider, and API-key restrictions.')
        token = response.json().get('idToken')
        if not isinstance(token, str) or not token:
            raise ValueError('Firebase did not return an ID token.')
        return token
    except httpx.HTTPError:
        raise ValueError('Cannot reach Firebase sign-in. Check your connection.') from None
    except (KeyError, TypeError):
        raise ValueError('Invalid Firebase sign-in response.') from None
