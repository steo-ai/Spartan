import base64
import logging
import requests
from datetime import datetime
from decouple import config

logger = logging.getLogger('wallet')

class PaymentClient:
    def __init__(self, callback_url=None):
        self.consumer_key = config('PAYMENT_CONSUMER_KEY')
        self.consumer_secret = config('PAYMENT_CONSUMER_SECRET')
        self.shortcode = config('PAYMENT_SHORTCODE')
        self.till_number = config('PAYMENT_TILL_NUMBER', default='3526578')
        self.passkey = config('PAYMENT_PASSKEY')
        self.callback_url = callback_url or config('PAYMENT_CALLBACK_URL')
        self.auth_url = 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
        self.stk_push_url = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
        self.query_url = 'https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query'
        logger.info(f"PaymentClient initialized with stk_push_url: {self.stk_push_url}")
        logger.info(f"Using callback URL: {self.callback_url}")

    @staticmethod
    def normalize_mpesa_phone(phone: str) -> str:
        """
        Convert various Kenyan phone formats to Safaricom-required international format:
        Must return 2547XXXXXXXX (12 digits starting with 254)
        
        Accepted inputs:
        - 0712345678        → 254712345678
        - +254712345678     → 254712345678
        - 254712345678      → 254712345678 (as-is)
        - 712345678         → 254712345678
        
        Raises ValueError for invalid formats.
        """
        if not phone:
            raise ValueError("Phone number is required")

        # Remove spaces, dashes, parentheses, etc.
        phone = ''.join(c for c in str(phone) if c.isdigit())

        if phone.startswith('0') and len(phone) == 10:
            # Local format: 07xxxxxxxx → 2547xxxxxxxx
            return '254' + phone[1:]

        elif phone.startswith('254') and len(phone) == 12:
            # Already correct international format
            return phone

        elif phone.startswith('7') and len(phone) == 9:
            # Short format without 0: 7xxxxxxxx → 2547xxxxxxxx
            return '254' + phone

        elif phone.startswith('2547') and len(phone) == 12:
            # Already good (redundant check for safety)
            return phone

        else:
            raise ValueError(
                f"Invalid Kenyan phone number format: '{phone}'. "
                "Use formats like: 0712345678, +254712345678, 254712345678 or 712345678"
            )

    def get_access_token(self):
        """Obtain an access token from the payment API."""
        try:
            auth = base64.b64encode(f"{self.consumer_key}:{self.consumer_secret}".encode()).decode()
            headers = {'Authorization': f'Basic {auth}'}
            logger.info(f"Auth request: URL={self.auth_url}")
            response = requests.get(self.auth_url, headers=headers, timeout=10)
            logger.info(f"Auth response: Status={response.status_code}, Body={response.text}")
            response.raise_for_status()
            access_token = response.json()['access_token']
            logger.info(f"Access token obtained: {access_token[:10]}...")
            return access_token
        except requests.RequestException as e:
            logger.error(f"Failed to get access token: {str(e)}")
            raise
        except Exception as e:
            logger.error(f"Unexpected error in get_access_token: {str(e)}")
            raise

    def initiate_stk_push(self, phone_number, amount, transaction_id):
        """Initiate an STK Push for wallet deposit."""
        try:
            # Normalize phone number BEFORE using it (this fixes 07xxx → 2547xxx)
            normalized_phone = self.normalize_mpesa_phone(phone_number)
            logger.info(f"Normalized phone for STK Push: {phone_number} → {normalized_phone}")

            access_token = self.get_access_token()
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            password = base64.b64encode(f"{self.shortcode}{self.passkey}{timestamp}".encode()).decode()

            payload = {
                'BusinessShortCode': self.shortcode,
                'Password': password,
                'Timestamp': timestamp,
                'TransactionType': 'CustomerBuyGoodsOnline',
                'Amount': str(int(float(amount))),
                'PartyA': normalized_phone,
                'PartyB': self.till_number,
                'PhoneNumber': normalized_phone,
                'CallBackURL': self.callback_url,
                'AccountReference': transaction_id[:12],
                'TransactionDesc': 'Wallet Deposit'
            }

            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }

            expected_url = 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
            if self.stk_push_url != expected_url:
                logger.error(f"Invalid STK Push URL: {self.stk_push_url}")
                self.stk_push_url = expected_url

            logger.info(f"Initiating STK Push: URL={self.stk_push_url}, Payload={payload}")
            response = requests.post(self.stk_push_url, json=payload, headers=headers, timeout=30)
            logger.info(f"STK Push response: Status={response.status_code}, Body={response.text}")
            response.raise_for_status()
            response_json = response.json()
            logger.info(f"STK Push success: {response_json}")
            return response_json
        except requests.RequestException as e:
            error_msg = f"STK Push failed: {str(e)}, Response={getattr(e.response, 'text', '')}"
            logger.error(error_msg)
            return {'ResponseCode': '1', 'error': error_msg}
        except ValueError as ve:
            # Catch phone normalization errors
            logger.error(f"Phone normalization error: {str(ve)}")
            return {'ResponseCode': '1', 'error': str(ve)}
        except Exception as e:
            error_msg = f"Unexpected error in STK Push: {str(e)}"
            logger.error(error_msg)
            return {'ResponseCode': '1', 'error': error_msg}