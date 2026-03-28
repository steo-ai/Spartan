// UserProfile - from accounts/models.py + serializers
export interface UserProfile {
  id: number;
  user: number;                       // FK to django User (often exposed as pk)
  email: string;
  first_name: string;
  last_name: string;
  phone_number: string | null;        // blank=True → nullable
  date_of_birth: string | null;       // DateField(null=True)
  address: string | null;
  national_id: string | null;         // renamed from id_number for consistency with backend
  kyc_verified: boolean;
  mfa_enabled: boolean;
  is_verified: boolean;               // from model (OTP/email verified)
  daily_deposit_limit: number;
  daily_withdrawal_limit: number;
  daily_transfer_limit: number;
  daily_outflow_limit: number;
  // Optional: if you expose more security fields later
  // security_question?: string;
  // trusted_devices_count?: number;
}

// Account - from accounts/models.py + AccountSerializer
export interface Account {
  id: number;
  account_number: string;             // plain (but encrypted on backend)
  masked_account_number?: string;     // frontend-only or from serializer
  account_type: "savings" | "checking" | "loan" | "investment"; // add more if needed
  balance: number;                    // decrypted value
  currency: string;                   // e.g. "KES" (currently hardcoded)
  is_active: boolean;
  created_at: string;                 // ISO datetime
  // Very useful additions from serializer
  user?: number;                      // owner
  full_name?: string;                 // from get_full_name
  // Optional future fields
  // available_balance?: number;      // if you implement holds/pending
  // interest_rate?: number | null;
}

// Transaction - from accounts/models.py + TransactionSerializer
export interface Transaction {
  id: number;
  account: number;                    // FK to Account
  account_number?: string;            // from serializer
  related_account?: number | null;
  related_account_number?: string | null;
  amount: number;                     // positive = credit, negative = debit
  transaction_type:
    | "deposit"
    | "withdrawal"
    | "transfer_in"
    | "transfer_out"
    | "payment"                       // bills/airtime
    | "card_purchase"
    | "fee"
    | "interest"
    | "refund"
    | "loan_disbursement"
    | "loan_repayment"
    | "adjustment";                  // add more real backend values
  category: string;                   // e.g. "salary", "utilities", "airtime", ...
  category_display?: string;          // get_category_display()
  description: string;
  reference?: string | null;
  timestamp: string;                  // ISO datetime
  balance_after: number;
  // Very useful for UI
  direction?: "in" | "out";           // computed: amount > 0 ? "in" : "out"
  // Optional: if you expose more
  // related_entity?: "mpesa" | "card" | "bill" | null;
}

// Card - from cards/models.py + CardSerializer
export interface Card {
  id: number;
  account: number;                    // linked account
  card_type: "debit_physical" | "debit_virtual" | "prepaid";
  masked_number: string;
  masked_cvv?: string;                // only shown sometimes
  expiry_date: string;                // "MM/YY" or full date
  status: "active" | "frozen" | "expired" | "cancelled" | "lost_stolen";
  daily_spend_limit: number;
  transaction_limit: number;          // per tx limit
  used_today: number;
  issued_at: string;
  last_used?: string | null;
  full_card_number?: string;
  cvv?: string;
  pin_set?: boolean;
  account_number?:string
}