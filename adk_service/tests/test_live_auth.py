# Author: Shiv Shankar Yadav | Issue #2
import pytest
from adk_service import live_auth


def test_login_returns_token_without_printing_credentials(monkeypatch, capsys):
    monkeypatch.setenv('FIREBASE_WEB_API_KEY', 'public-test-key')
    entries = iter(['test@example.invalid', 'private-password'])
    monkeypatch.setattr(live_auth.getpass, 'getpass', lambda _: next(entries))
    def post(url, **kwargs):
        assert url == 'https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword'
        assert kwargs['json'] == {'email': 'test@example.invalid', 'password': 'private-password', 'returnSecureToken': True}
        assert kwargs['follow_redirects'] is False
        return type('Response', (), {'status_code': 200, 'json': lambda self: {'idToken': 'private-token'}})()
    monkeypatch.setattr(live_auth.httpx, 'post', post)
    assert live_auth.sign_in() == 'private-token'
    output = capsys.readouterr()
    assert not output.out and not output.err


def test_login_failure_does_not_expose_provider_body(monkeypatch):
    monkeypatch.setenv('FIREBASE_WEB_API_KEY', 'public-test-key')
    monkeypatch.setattr(live_auth.getpass, 'getpass', lambda _: 'private-input')
    monkeypatch.setattr(live_auth.httpx, 'post', lambda *a, **kw: type('Response', (), {'status_code': 400, 'text': 'SECRET'})())
    with pytest.raises(ValueError) as error:
        live_auth.sign_in()
    assert 'SECRET' not in str(error.value)
    assert 'private-input' not in str(error.value)


def test_missing_token_rejected(monkeypatch):
    monkeypatch.setenv('FIREBASE_WEB_API_KEY', 'public-test-key')
    monkeypatch.setattr(live_auth.getpass, 'getpass', lambda _: 'private-input')
    monkeypatch.setattr(live_auth.httpx, 'post', lambda *a, **kw: type('Response', (), {'status_code': 200, 'json': lambda self: {}})())
    with pytest.raises(ValueError, match='ID token'):
        live_auth.sign_in()
