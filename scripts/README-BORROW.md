## 2. `scripts/README-BORROW.md`

```markdown
# Borrow from Pool Script

Borrow tokens from an Aave V2 lending pool using your supplied collateral.

## Purpose

This script allows you to:
- Borrow tokens against your supplied collateral
- Choose between stable or variable interest rates
- Monitor your health factor to avoid liquidation
- Receive borrowed tokens directly to your wallet

## Prerequisites

- **Collateral supplied** - Must run `supply-to-pool-configurable.ts` first
- Sufficient borrowing capacity
- Configured `.env` file
- For Sepolia: ETH for gas fees

## Configuration

Set these variables in your `.env` file:

```bash
# Borrow amount
TOKEN_BORROW_AMOUNT=100  # Amount to borrow

# Interest rate mode
INTEREST_RATE_MODE=2  # 1 = stable, 2 = variable

# Network and addresses (same as supply script)
NETWORK=localhost  # or 'sepolia'
LOCAL_LENDING_POOL_ADDRESS=0x...
SEPOLIA_LENDING_POOL_ADDRESS=0x...
# ... other addresses
```

## Usage

### Local Testing

```bash
# Terminal 1: Local node running
npx hardhat node

# Terminal 2: Deploy and supply first
npx hardhat run scripts/test-local-deployment.ts --network localhost

# Then borrow
npx hardhat run scripts/borrow-from-pool-configurable.ts --network localhost
```

### Sepolia Testing

```bash
# Make sure you have collateral supplied first
npx hardhat run scripts/borrow-from-pool-configurable.ts --network sepolia
```

## What Happens

1. **Checks collateral** - Validates you have sufficient collateral
2. **Calculates capacity** - Shows how much you can borrow
3. **Validates health factor** - Ensures borrowing won't risk liquidation
4. **Executes borrow** - Borrows tokens and sends to your wallet
5. **Shows updated health** - Displays new health factor and risk level

## Example Output

```
=== Loading Configuration ===
Network: sepolia
Borrow Amount: 100 USDT
Interest Rate Mode: Variable

=== Initial State ===
Wallet USDT: 9500.0

=== Account Health ===
Total Collateral (ETH): 0.142428927304491
Total Debt (ETH): 0.0
Available Borrow (ETH): 0.106821695478368
Liquidation Threshold: 8500
Loan-to-Value: 7500
Health Factor: ∞ (No debt)

=== Borrowing 100 USDT ===
Requesting borrow of 100 USDT...
Interest rate mode: Variable
✓ Borrowed successfully!
New wallet balance: 9600.0 USDT
Received: 100.0 USDT

=== Final Summary ===
User USDT Position:
  Supplied (aUSDT): 500.0
  Stable debt: 0.0
  Variable debt: 100.0
  Wallet balance: 9600.0 USDT

=== Updated Account Health ===
Total Debt (ETH): 0.0285
Available Borrow (ETH): 0.0783
Health Factor: 2.98

✅ Borrow operation completed!
```

## Interest Rate Modes

### Variable Rate (Recommended)

```bash
INTEREST_RATE_MODE=2
```

**Pros:**
- ✅ Usually lower rates
- ✅ Adjusts with market conditions
- ✅ More flexible

**Cons:**
- ❌ Rate can increase
- ❌ Less predictable

### Stable Rate

```bash
INTEREST_RATE_MODE=1
```

**Pros:**
- ✅ Fixed rate (short-term)
- ✅ Predictable payments
- ✅ Protection from rate spikes

**Cons:**
- ❌ Usually higher than variable
- ❌ May not be enabled for all tokens
- ❌ Can be rebalanced by protocol

## Common Errors

### Error 12: Stable rate not enabled

```
❌ Error: execution reverted: 12
💡 Error code 12: No stable rate borrowing
```

**Solution:** Change to variable rate:
```bash
INTEREST_RATE_MODE=2
```

### Error: No collateral

```
⚠️  WARNING: No collateral supplied!
💡 You must supply collateral first
```

**Solution:** Run `supply-to-pool-configurable.ts` first.

### Error 11: Insufficient collateral

```
💡 Error code 11: Collateral cannot cover new borrow
```

**Solution:** 
- Supply more collateral
- Reduce `TOKEN_BORROW_AMOUNT`

### Error 64: Pool paused

```
💡 Error code 64: Pool is paused
```

**Solution:** Pool is paused. Test locally or use a different pool.

## Health Factor Explained

**Health Factor** = (Collateral × Liquidation Threshold) / Total Debt

### Safe Ranges:

| Health Factor | Status | Risk |
|--------------|--------|------|
| **> 2.0** | ✅ Healthy | Low risk |
| **1.5 - 2.0** | ⚠️ Moderate | Monitor closely |
| **1.0 - 1.5** | 🚨 Risky | High liquidation risk |
| **< 1.0** | ❌ Liquidation | Position will be liquidated |

### Example:

```
Collateral: 500 USDT ($0.285 ETH)
Liquidation Threshold: 85%
Borrow: 100 USDT ($0.057 ETH)

Health Factor = (0.285 × 0.85) / 0.057 = 4.25 ✅ Safe!
```

## Key Concepts

### Loan-to-Value (LTV)

- Maximum % you can borrow against collateral
- Typical: 75-80%
- Example: $1000 collateral, 75% LTV = can borrow up to $750

### Liquidation Threshold

- Point where liquidation occurs
- Typical: 85%
- Higher than LTV to give you a buffer

### Liquidation

If health factor drops below 1.0:
- Liquidators can repay your debt
- They take your collateral + bonus (~5%)
- You lose more than if you repaid yourself

## Best Practices

1. **Keep health factor above 2.0** - Safety buffer
2. **Don't max out borrowing** - Leave room for price fluctuations
3. **Use variable rate** - Usually cheaper
4. **Monitor regularly** - Check health factor often
5. **Have repayment plan** - Know when/how you'll repay

## Tips

- 💡 **Start small** - Borrow less than your max capacity
- 💡 **Test locally first** - Practice without real money
- 💡 **Watch the price** - If collateral value drops, health factor drops
- 💡 **Repay quickly** - Interest accrues every block
- 💡 **Multiple currencies** - Can borrow different token than collateral

## Next Steps

After borrowing:
- ✅ **Monitor health** - Use `check-balance.ts` regularly
- ✅ **Repay debt** - Use `repay-loan-configurable.ts` when ready
- ✅ **Add collateral** - Supply more if health factor drops

## Related Scripts

- `supply-to-pool-configurable.ts` - Must run this first
- `repay-loan-configurable.ts` - Repay your borrowed tokens
- `withdraw-from-pool-configurable.ts` - Withdraw collateral (after repaying)
- `check-balance.ts` - Monitor your position
```

