export interface Account {
  id: string
  name: string
  number: string
  type: "checking" | "savings" | "credit"
  balance: number
  availableBalance?: number
  creditLimit?: number
  apy?: number
  interestEarned?: number
  pending?: number
}
