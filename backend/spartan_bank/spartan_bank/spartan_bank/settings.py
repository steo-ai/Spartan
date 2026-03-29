from pathlib import Path
from decouple import config
from datetime import timedelta
import base64
from django.core.exceptions import ImproperlyConfigured

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# ────────────────────────────────────────────────────────────────
# SECURITY & ENVIRONMENT
# ────────────────────────────────────────────────────────────────
SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=True, cast=bool)

if not SECRET_KEY or "change-me" in SECRET_KEY.lower():
    raise ValueError("SECRET_KEY is not set or is insecure!")

# In settings.py — replace the decoding part with:
ENCRYPTION_KEY = config('ENCRYPTION_KEY', default='').strip()

if not ENCRYPTION_KEY:
    raise ImproperlyConfigured("ENCRYPTION_KEY is missing or empty in .env")

# Optional: quick length + format check (but don't decode yet)
if len(ENCRYPTION_KEY) != 44 or '=' not in ENCRYPTION_KEY[-2:]:
    raise ImproperlyConfigured("ENCRYPTION_KEY must be a 44-char url-safe base64 string ending with =")

print(f"[DEBUG] ENCRYPTION_KEY loaded (base64 string, len={len(ENCRYPTION_KEY)})")

# ────────────────────────────────────────────────────────────────
# Hosts & CORS
# ────────────────────────────────────────────────────────────────
ALLOWED_HOSTS = config(
    "ALLOWED_HOSTS",
    default="localhost,127.0.0.1",
    cast=lambda v: [s.strip() for s in v.split(",")],
)

CSRF_TRUSTED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    # "https://your-frontend-domain.com",          # ← add when deploying
]

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:3000,http://127.0.0.1:3000",
    cast=lambda v: [s.strip() for s in v.split(",")],
)
CORS_ALLOW_CREDENTIALS = True
CORS_ALLOW_ALL_ORIGINS = False  # ← Never turn this on in production!

# ────────────────────────────────────────────────────────────────
# Installed Apps
# ────────────────────────────────────────────────────────────────
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "rest_framework.authtoken",
    "corsheaders",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    # Your apps
    "accounts",
    "payments",
    "bills",
    "cards",
    "notifications.apps.NotificationsConfig",
]

# ────────────────────────────────────────────────────────────────
# Middleware
# ────────────────────────────────────────────────────────────────
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",  # should be near top
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# ────────────────────────────────────────────────────────────────
# Database (SQLite for development — switch to PostgreSQL in prod)
# ────────────────────────────────────────────────────────────────
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": BASE_DIR / "db.sqlite3",
    }
}

# ────────────────────────────────────────────────────────────────
# Templates
# ────────────────────────────────────────────────────────────────
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

# ────────────────────────────────────────────────────────────────
# Password validation
# ────────────────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ────────────────────────────────────────────────────────────────
# Internationalization
# ────────────────────────────────────────────────────────────────
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Africa/Nairobi"
USE_I18N = True
USE_TZ = True

# ────────────────────────────────────────────────────────────────
# Static files
# ────────────────────────────────────────────────────────────────
STATIC_URL = "static/"

# ────────────────────────────────────────────────────────────────
# Default primary key field type
# ────────────────────────────────────────────────────────────────
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

ROOT_URLCONF = "spartan_bank.urls"

# ────────────────────────────────────────────────────────────────
# Django REST Framework + JWT
# ────────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_THROTTLE_CLASSES": [
        "rest_framework.throttling.AnonRateThrottle",
        "rest_framework.throttling.UserRateThrottle",
    ],
    "DEFAULT_THROTTLE_RATES": {
        "anon": "10/minute",
        "user": "100/minute",
        "login": "10/minute",
        "register": "5/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(hours=24),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=30),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ────────────────────────────────────────────────────────────────
# django-allauth (modern settings to avoid deprecation warnings)
# ────────────────────────────────────────────────────────────────
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

ACCOUNT_AUTHENTICATION_METHOD = "email"
ACCOUNT_EMAIL_REQUIRED = True
ACCOUNT_EMAIL_VERIFICATION = "mandatory"
ACCOUNT_UNIQUE_EMAIL = True
ACCOUNT_USERNAME_REQUIRED = False
ACCOUNT_PREVENT_ENUMERATION = True
ACCOUNT_LOGIN_ATTEMPTS_LIMIT = 5
ACCOUNT_LOGIN_ATTEMPTS_TIMEOUT = 300  # 5 minutes

# Redirects
LOGIN_REDIRECT_URL = "/dashboard/"
LOGOUT_REDIRECT_URL = "/login/"
ACCOUNT_LOGOUT_ON_GET = False

# ────────────────────────────────────────────────────────────────
# Email (Gmail SMTP with App Password)
# ────────────────────────────────────────────────────────────────
EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="grandviewshopafrica@gmail.com")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD")  # ← must come from .env
EMAIL_USE_TLS = True
DEFAULT_FROM_EMAIL = "Grandview <grandviewshopafrica@gmail.com>"
SERVER_EMAIL = DEFAULT_FROM_EMAIL
ADMIN_EMAIL = config("ADMIN_EMAIL", default="grandviewshopafrica@gmail.com")

# ────────────────────────────────────────────────────────────────
# Security Headers (strong defaults — adjust for prod)
# ────────────────────────────────────────────────────────────────
SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=not DEBUG, cast=bool)
SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=not DEBUG, cast=bool)
CSRF_COOKIE_SECURE = config("CSRF_COOKIE_SECURE", default=not DEBUG, cast=bool)
SECURE_HSTS_SECONDS = config("SECURE_HSTS_SECONDS", default=31536000 if not DEBUG else 0, cast=int)
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = "DENY"

# ────────────────────────────────────────────────────────────────
# Static files
# ────────────────────────────────────────────────────────────────
STATIC_URL = "static/"

# Important for production (Render + collectstatic)
STATIC_ROOT = BASE_DIR / "staticfiles"

# Optional but highly recommended: Use WhiteNoise for better performance
# (compresses files + adds cache headers)
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"