#!/usr/bin/env python3
"""
CF SMS - Bulk SMS Sender with Alphanumeric Sender ID Support
Uses EasySendSMS API for alphanumeric sender ID support.

Usage:
    python send_sms.py --sender "YourBrand" --to "+447123456789,+447987654321" --message "Hello!"
    
Or with a file of recipients:
    python send_sms.py --sender "YourBrand" --file recipients.txt --message "Hello!"

Environment Variables Required:
    EASYSENDSMS_USERNAME - Your EasySendSMS username
    EASYSENDSMS_PASSWORD - Your EasySendSMS password
"""

import os
import sys
import argparse
import requests
from typing import List, Optional
from urllib.parse import urlencode


class EasySendSMS:
    """EasySendSMS API client with alphanumeric sender ID support."""
    
    BASE_URL = "https://api.easysendsms.app"
    
    def __init__(self, username: str, password: str):
        self.username = username
        self.password = password
    
    def send_sms(
        self,
        sender_id: str,
        recipients: List[str],
        message: str,
        flash: bool = False
    ) -> dict:
        """
        Send SMS to multiple recipients with alphanumeric sender ID.
        
        Args:
            sender_id: Alphanumeric sender ID (1-11 characters, e.g., "YourBrand")
            recipients: List of phone numbers in E.164 format
            message: SMS message content
            flash: If True, send as flash SMS
            
        Returns:
            dict with 'success', 'message_id', and 'response' keys
        """
        # Validate sender ID (alphanumeric, 1-11 chars)
        if not sender_id or len(sender_id) > 11:
            raise ValueError("Sender ID must be 1-11 characters")
        if not sender_id.replace(' ', '').isalnum():
            raise ValueError("Sender ID must be alphanumeric")
        
        # Format recipients
        recipient_list = ','.join(recipients)
        
        # Build request
        params = {
            'username': self.username,
            'password': self.password,
            'from': sender_id,
            'to': recipient_list,
            'text': message,
            'type': '0',  # Plain text
        }
        
        if flash:
            params['flash'] = '1'
        
        url = f"{self.BASE_URL}/bulksms?{urlencode(params)}"
        
        try:
            response = requests.get(url, timeout=30)
            response_text = response.text.strip()
            
            # Check for success (OK or numeric message ID)
            if response_text.startswith('OK') or response_text.isdigit():
                return {
                    'success': True,
                    'message_id': response_text,
                    'recipients_count': len(recipients),
                    'sender_id': sender_id
                }
            else:
                return {
                    'success': False,
                    'error': response_text,
                    'error_code': self._parse_error(response_text)
                }
                
        except requests.RequestException as e:
            return {
                'success': False,
                'error': str(e),
                'error_code': 'NETWORK_ERROR'
            }
    
    def check_balance(self) -> dict:
        """Check account balance."""
        params = {
            'username': self.username,
            'password': self.password,
        }
        
        url = f"{self.BASE_URL}/balance?{urlencode(params)}"
        
        try:
            response = requests.get(url, timeout=10)
            balance = response.text.strip()
            return {'success': True, 'balance': balance}
        except requests.RequestException as e:
            return {'success': False, 'error': str(e)}
    
    def _parse_error(self, error_text: str) -> str:
        """Parse error response to error code."""
        error_map = {
            'ERROR:1': 'INVALID_CREDENTIALS',
            'ERROR:2': 'INSUFFICIENT_CREDITS',
            'ERROR:3': 'INVALID_DESTINATION',
            'ERROR:4': 'INVALID_SENDER_ID',
            'ERROR:5': 'MESSAGE_TOO_LONG',
        }
        for code, name in error_map.items():
            if error_text.startswith(code):
                return name
        return 'UNKNOWN_ERROR'


def load_recipients_from_file(filepath: str) -> List[str]:
    """Load phone numbers from a file (one per line)."""
    recipients = []
    with open(filepath, 'r') as f:
        for line in f:
            number = line.strip()
            if number and not number.startswith('#'):
                # Ensure E.164 format
                if not number.startswith('+'):
                    number = '+' + number
                recipients.append(number)
    return recipients


def main():
    parser = argparse.ArgumentParser(
        description='Send bulk SMS with alphanumeric sender ID',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s --sender "YourBrand" --to "+447123456789" --message "Hello!"
  %(prog)s --sender "CFSMS" --file numbers.txt --message "Promo alert!"
  %(prog)s --balance
        """
    )
    
    parser.add_argument(
        '--sender', '-s',
        help='Alphanumeric sender ID (1-11 chars, e.g., "YourBrand")'
    )
    parser.add_argument(
        '--to', '-t',
        help='Comma-separated phone numbers in E.164 format'
    )
    parser.add_argument(
        '--file', '-f',
        help='File containing phone numbers (one per line)'
    )
    parser.add_argument(
        '--message', '-m',
        help='SMS message content'
    )
    parser.add_argument(
        '--flash',
        action='store_true',
        help='Send as flash SMS'
    )
    parser.add_argument(
        '--balance', '-b',
        action='store_true',
        help='Check account balance'
    )
    parser.add_argument(
        '--username',
        help='EasySendSMS username (or set EASYSENDSMS_USERNAME env var)'
    )
    parser.add_argument(
        '--password',
        help='EasySendSMS password (or set EASYSENDSMS_PASSWORD env var)'
    )
    
    args = parser.parse_args()
    
    # Get credentials
    username = args.username or os.getenv('EASYSENDSMS_USERNAME')
    password = args.password or os.getenv('EASYSENDSMS_PASSWORD')
    
    if not username or not password:
        print("Error: EasySendSMS credentials required.", file=sys.stderr)
        print("Set EASYSENDSMS_USERNAME and EASYSENDSMS_PASSWORD environment variables,")
        print("or use --username and --password arguments.")
        sys.exit(1)
    
    client = EasySendSMS(username, password)
    
    # Check balance
    if args.balance:
        result = client.check_balance()
        if result['success']:
            print(f"Account Balance: {result['balance']}")
        else:
            print(f"Error: {result['error']}", file=sys.stderr)
            sys.exit(1)
        return
    
    # Validate required args for sending
    if not args.sender:
        print("Error: --sender is required for sending SMS", file=sys.stderr)
        sys.exit(1)
    
    if not args.message:
        print("Error: --message is required", file=sys.stderr)
        sys.exit(1)
    
    if not args.to and not args.file:
        print("Error: Either --to or --file is required", file=sys.stderr)
        sys.exit(1)
    
    # Get recipients
    recipients = []
    if args.to:
        recipients = [n.strip() for n in args.to.split(',')]
    if args.file:
        recipients.extend(load_recipients_from_file(args.file))
    
    if not recipients:
        print("Error: No valid recipients found", file=sys.stderr)
        sys.exit(1)
    
    # Remove duplicates
    recipients = list(set(recipients))
    
    print(f"Sending SMS to {len(recipients)} recipient(s)...")
    print(f"Sender ID: {args.sender}")
    print(f"Message: {args.message[:50]}{'...' if len(args.message) > 50 else ''}")
    print()
    
    # Send SMS
    result = client.send_sms(
        sender_id=args.sender,
        recipients=recipients,
        message=args.message,
        flash=args.flash
    )
    
    if result['success']:
        print(f"✓ SMS sent successfully!")
        print(f"  Message ID: {result['message_id']}")
        print(f"  Recipients: {result['recipients_count']}")
        print(f"  Sender ID: {result['sender_id']}")
    else:
        print(f"✗ Failed to send SMS", file=sys.stderr)
        print(f"  Error: {result['error']}", file=sys.stderr)
        print(f"  Code: {result.get('error_code', 'UNKNOWN')}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
