## 4. `scripts/README-WITHDRAW.md`

```markdown
# Withdraw from Pool Script

Withdraw your supplied tokens (collateral) from an Aave V2 lending pool.

## Purpose

This script allows you to:
- Withdraw supplied tokens from the pool
- Receive your principal + earned interest
- Remove collateral (if no debt or safe to do so)
- Burn aTokens and receive underlying tokens

## Prerequisites

- **Supplied tokens** - Must have aTokens (deposited collateral)
- **No debt OR safe withdrawal** - Health factor must stay above 1.0
- Configured `.env` file
- For Sepolia: ETH for gas fees

## Configuration

Set these variables in your `.env` file:

```bash
# Withdraw amount
TOKEN_WITHDRAW_AMOUNT=0  # 0 = withdraw all, or specify amount

# Network and addresses
NETWORK=localhost  # or 'sepolia'
LOCAL_LENDING_POOL_ADDRESS=0x...
SEPOLIA_LENDING_POOL_ADDRESS=0x...
```

## Usage

### Full Withdrawal (All Collateral)

**⚠️ Only works if you have NO DEBT!**

```bash
# In .env:
TOKEN_WITHDRAW_AMOUNT=0

# Run script:
npx hardhat run scripts/withdraw-from-pool-configurable.ts --network localhost
# or
npx hardhat run scripts/withdraw-from-pool-configurable.ts --network sepolia
```

### Partial Withdrawal

```bash
# In .env:
TOKEN_WITHDRAW_AMOUNT=250  # Withdraw only 250 tokens

# Run script:
npx hardhat run scripts/withdraw-from-pool-configurable.ts --network sepolia
```

## What Happens

1. **Checks aToken balance** - Validates you have tokens to withdraw
2. **Checks debt** - Warns if you have outstanding debt
3. **Calculates safety** - Ensures health factor stays above 1.0
4. **Executes withdrawal** - Burns aTokens, sends underlying tokens
5. **Shows updated position** - Displays remaining collateral and health

## Example Output

### Full Withdrawal (No Debt)

```
=== Loading Configuration ===
Network: sepolia
Withdraw Amount: ALL (Full Withdrawal)

=== Initial State ===
Wallet USDT: 9500.0
Deposited (aUSDT): 500.0

=== Current Position ===
Supplied (aUSDT): 500.0 USDT
Stable debt: 0.0 USDT
Variable debt: 0.0 USDT

=== Account Health (Before Withdrawal) ===
Total Collateral (ETH): 0.142428927304491
Total Debt (ETH): 0.0
Available Borrow (ETH): 0.106821695478368
Health Factor: ∞ (No debt)

=== Withdrawing USDT ===
Withdrawing ALL available collateral...
✓ Withdrawal successful!
New wallet balance: 10000.0 USDT
Received: 500.0 USDT

=== Final Summary ===
User USDT Position:
  Supplied (aUSDT): 0.0
  Stable debt: 0.0
  Variable debt: 0.0
  Wallet balance: 10000.0 USDT

✅ No debt - Safe to withdraw anytime!

✅ Withdrawal operation completed!
```

### Partial Withdrawal (With Debt)

```
=== Current Position ===
Supplied (aUSDT): 500.0 USDT
Variable debt: 100.0 USDT

⚠️  WARNING: You have outstanding debt!
   Withdrawing too much collateral may cause liquidation.

=== Account Health (Before Withdrawal) ===
Health Factor: 4.25

=== Withdrawing USDT ===
Withdrawing 200 USDT...
💡 Checking if withdrawal is safe...
✓ Withdrawal successful!
Received: 200.0 USDT

=== Updated Account Health (After Withdrawal) ===
Total Collateral (ETH): 0.0855
Total Debt (ETH): 0.0285
Health Factor: 2.55

=== Health Factor Change ===
Health factor decreased by 40.00%
From 4.2500 → 2.5500
✅ Healthy position maintained after withdrawal.
```

## Common Errors

### Error: No tokens to withdraw

```
⚠️  No tokens deposited to withdraw!
💡 First supply tokens using supply-to-pool-configurable.ts
```

**Solution:** You need to supply tokens first.

### Error 35: Health factor too low

```
❌ Withdrawal failed!
💡 Error code 35: Health factor would drop below 1.0
   You must repay debt first or withdraw less!
```

**Solution:** 
- Repay some/all debt first
- Reduce `TOKEN_WITHDRAW_AMOUNT`
- Add more collateral

### Error 32: Not enough aTokens

```
💡 Error code 32: Not enough aTokens
```

**Solution:** You're trying to withdraw more than you have. Check your aToken balance.

### Error 33: Not enough liquidity

```
💡 Error code 33: Not enough liquidity in the pool
```

**Solution:** The pool doesn't have enough tokens. Wait or withdraw less.

## Withdrawal Scenarios

### Scenario 1: No Debt - Full Withdrawal ✅

```
Supplied: 500 USDT
Debt: 0 USDT
Health Factor: ∞

→ Can withdraw: ALL (500 USDT)
```

**Safe!** No risk.

### Scenario 2: Small Debt - Partial Withdrawal ✅

```
Supplied: 500 USDT
Debt: 100 USDT
Health Factor: 4.25
LTV: 75%

→ Can safely withdraw: ~133 USDT
→ Leaves: 367 USDT collateral
→ New health factor: ~2.62
```

**Safe!** Health factor stays above 2.0.

### Scenario 3: High Debt - Risky Withdrawal ⚠️

```
Supplied: 500 USDT
Debt: 350 USDT
Health Factor: 1.21
LTV: 75%

→ Cannot withdraw without repaying first!
```

**Risky!** Must repay debt first.

## Safety Guidelines

### If You Have NO Debt:

- ✅ Withdraw anytime
- ✅ Withdraw any amount
- ✅ No liquidation risk

### If You Have Debt:

Calculate **maximum safe withdrawal**:

```
Max Withdrawal = (Total Collateral × LTV - Total Debt) / Token Price
```

**Example:**
```
Collateral: $500 (500 USDT)
Debt: $100
LTV: 75%
Token Price: $1

Max Withdrawal = (500 × 0.75 - 100) / 1
              = 275 USDT

Keep health factor above 2.0 for safety:
Recommended: Withdraw max 175 USDT
```

## Interest Earned

You receive **more tokens** than you deposited:

```
Deposited: 500 USDT
Time: 30 days
APY: 3%
Interest earned: ~1.23 USDT

Withdrawal: 501.23 USDT ✨
```

## Best Practices

1. **Repay debt first** - Full withdrawal requires zero debt
2. **Keep health factor > 2.0** - If you have debt
3. **Withdraw gradually** - Test with small amounts first
4. **Check pool liquidity** - Ensure pool has tokens available
5. **Calculate safety** - Use `check-balance.ts` to verify

## Withdrawal Strategies

### Strategy 1: Full Exit

**Steps:**
1. Repay all debt (`repay-loan-configurable.ts`)
2. Withdraw all collateral (this script)

```bash
TOKEN_REPAY_AMOUNT=0
TOKEN_WITHDRAW_AMOUNT=0
```

### Strategy 2: Reduce Exposure

**Steps:**
1. Withdraw partial amount
2. Keep some collateral earning interest

```bash
TOKEN_WITHDRAW_AMOUNT=250  # Withdraw half
```

### Strategy 3: Rebalance

**Steps:**
1. Withdraw from one token
2. Supply to another token

## Tips

- 💡 **Check liquidity first** - Run `list-pool-reserves.ts`
- 💡 **You earn interest** - aToken balance > original deposit
- 💡 **Time value** - The longer deposited, the more interest
- 💡 **No penalties** - No fees for withdrawing
- 💡 **Instant** - Withdrawals are immediate (no lock-up)

## Health Factor Impact

### Before Withdrawal:
```
Collateral: 500 USDT ($0.285 ETH)
Debt: 100 USDT ($0.057 ETH)
Health Factor: 4.25 ✅
```

### After Withdrawing 200 USDT:
```
Collateral: 300 USDT ($0.171 ETH)
Debt: 100 USDT ($0.057 ETH)
Health Factor: 2.55 ✅ Still safe
```

### After Withdrawing 400 USDT:
```
Collateral: 100 USDT ($0.057 ETH)
Debt: 100 USDT ($0.057 ETH)
Health Factor: 0.85 ❌ LIQUIDATION!
```

## Complete Workflow

### Exit Everything:

```bash
# 1. Check position
npx hardhat run scripts/check-balance.ts --network sepolia

# 2. Repay all debt
TOKEN_REPAY_AMOUNT=0
npx hardhat run scripts/repay-loan-configurable.ts --network sepolia

# 3. Withdraw all collateral
TOKEN_WITHDRAW_AMOUNT=0
npx hardhat run scripts/withdraw-from-pool-configurable.ts --network sepolia
```

## Next Steps

After withdrawing:
- ✅ **Check balance** - Verify tokens received
- ✅ **Re-supply** - Supply again if desired
- ✅ **Different token** - Supply a different token

## Related Scripts

- `supply-to-pool-configurable.ts` - Supply tokens (reverse of this)
- `repay-loan-configurable.ts` - Must repay before full withdrawal
- `check-balance.ts` - Check position before withdrawing
- `list-pool-reserves.ts` - Check pool liquidity
```

---

These four README files provide comprehensive documentation for each script, covering configuration, usage, examples, errors, strategies, and best practices! 🎉