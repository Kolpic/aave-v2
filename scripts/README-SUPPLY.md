## 1. `scripts/README-SUPPLY.md`

```markdown
# Supply to Pool Script

Supply (deposit) tokens to an Aave V2 lending pool as collateral. Supplied tokens earn interest over time.

## Purpose

This script allows you to:
- Deposit tokens into an Aave V2 lending pool
- Receive aTokens representing your deposit
- Start earning interest on your supplied tokens
- Use supplied tokens as collateral for borrowing

## Prerequisites

- Tokens to supply (either minted locally or owned on Sepolia)
- Configured `.env` file with pool addresses
- For Sepolia: ETH for gas fees

## Configuration

Set these variables in your `.env` file:

```bash
# Network selection
NETWORK=localhost  # or 'sepolia'

# Token configuration
TOKEN_NAME=USDT
TOKEN_SYMBOL=USDT
TOKEN_DECIMALS=6
TOKEN_SUPPLY_AMOUNT=500  # Amount to supply

# Local addresses (from test-local-deployment.ts)
LOCAL_LENDING_POOL_ADDRESS=0x...
LOCAL_DATA_PROVIDER_ADDRESS=0x...
LOCAL_TOKEN_ADDRESS=0x...

# Sepolia addresses
SEPOLIA_LENDING_POOL_ADDRESS=0x...
SEPOLIA_DATA_PROVIDER_ADDRESS=0x...
SEPOLIA_TOKEN_ADDRESS=0x...
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY_USER1=your_private_key
```

## Usage

### Local Testing

```bash
# Terminal 1: Start local node
npx hardhat node

# Terminal 2: Deploy pool first
npx hardhat run scripts/test-local-deployment.ts --network localhost

# Then supply tokens (this is already done in test-local-deployment.ts)
# But you can run it again to supply more:
npx hardhat run scripts/supply-to-pool-configurable.ts --network localhost
```

### Sepolia Testing

```bash
# Make sure you have tokens first, then:
npx hardhat run scripts/supply-to-pool-configurable.ts --network sepolia
```

## What Happens

1. **Validates configuration** - Checks all required addresses are set
2. **Checks wallet balance** - Ensures you have enough tokens
3. **Approves tokens** - Allows the lending pool to transfer your tokens
4. **Deposits tokens** - Transfers tokens to the pool
5. **Receives aTokens** - You get aTokens representing your deposit
6. **Shows summary** - Displays your position and borrowing capacity

## Example Output

```
=== Loading Configuration ===
Network: sepolia
Lending Pool: 0xaa5794009E01b695416231A60E021B203a40c48F
Token: USDT (6 decimals)
Token Address: 0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0
Supply Amount: 500 USDT

Mode: LIVE NETWORK (using 1st account)
User: 0x345f009D0Bf08bc93717aE0194B0E56579170341

=== Checking Initial Balance ===
User USDT: 10000.0

=== Supplying 500 USDT ===
Approving 500 USDT...
✓ Approved
Depositing 500 USDT...
✓ Deposited

=== Final Summary ===
User USDT Position:
  aToken balance (aUSDT): 500.0
  Stable debt: 0.0
  Variable debt: 0.0
  Wallet balance: 9500.0 USDT

✅ All supply operations completed!
```

## Common Errors

### Error: Insufficient balance

```
⚠️  Insufficient USDT balance
   Required: 500 USDT
   Available: 100 USDT
```

**Solution:** Reduce `TOKEN_SUPPLY_AMOUNT` in `.env` or get more tokens.

### Error: Pool is paused (error 64)

```
❌ Error: execution reverted: 64
💡 Error code 64: Pool is paused
```

**Solution:** The pool is paused. Try a different pool or test locally.

### Error: Missing configuration

```
❌ Missing required environment variable: SEPOLIA_LENDING_POOL_ADDRESS
```

**Solution:** Add the missing address to your `.env` file.

## Key Concepts

### aTokens

When you supply tokens, you receive **aTokens** (e.g., aUSDT, aDAI):
- aTokens represent your deposit + accrued interest
- aToken balance increases over time as interest accrues
- You can transfer aTokens to others
- To withdraw, you burn aTokens and receive underlying tokens

### Collateral

Supplied tokens can be used as **collateral** for borrowing:
- Collateral value is shown in ETH (common denominator)
- You can borrow up to your Loan-to-Value (LTV) ratio
- Typical LTV: 75-80% of collateral value

### Interest

Supplied tokens earn **interest**:
- Interest accrues every block
- Rate depends on pool utilization
- Higher utilization = higher interest for suppliers

## Tips

1. **Start small** - Test with small amounts first
2. **Monitor interest** - aToken balance grows over time
3. **Track health** - Check "Available Borrow" after supplying
4. **No debt yet** - Supplying alone doesn't create debt
5. **Withdraw anytime** - If you haven't borrowed, you can withdraw freely

## Next Steps

After supplying:
- ✅ **Borrow** - Use `borrow-from-pool-configurable.ts` to borrow against your collateral
- ✅ **Check balance** - Use `check-balance.ts` to see your position
- ✅ **Withdraw** - Use `withdraw-from-pool-configurable.ts` when ready

## Related Scripts

- `test-local-deployment.ts` - Deploy local pool (includes initial supply)
- `borrow-from-pool-configurable.ts` - Borrow against supplied collateral
- `check-balance.ts` - Check your current position
- `list-pool-reserves.ts` - See all available tokens in the pool
```

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

## 3. `scripts/README-REPAY.md`

```markdown
# Repay Loan Script

Repay borrowed tokens to an Aave V2 lending pool, reducing debt and improving health factor.

## Purpose

This script allows you to:
- Repay borrowed tokens (full or partial)
- Reduce your debt and interest payments
- Improve your health factor
- Free up borrowing capacity

## Prerequisites

- **Active debt** - Must have borrowed tokens first
- Tokens to repay (in your wallet)
- Configured `.env` file
- For Sepolia: ETH for gas fees

## Configuration

Set these variables in your `.env` file:

```bash
# Repay amount
TOKEN_REPAY_AMOUNT=0  # 0 = repay all, or specify amount

# Interest rate mode (must match your debt type)
INTEREST_RATE_MODE=2  # 1 = stable, 2 = variable

# Network and addresses
NETWORK=localhost  # or 'sepolia'
LOCAL_LENDING_POOL_ADDRESS=0x...
SEPOLIA_LENDING_POOL_ADDRESS=0x...
```

## Usage

### Full Repayment (All Debt)

```bash
# In .env:
TOKEN_REPAY_AMOUNT=0

# Run script:
npx hardhat run scripts/repay-loan-configurable.ts --network localhost
# or
npx hardhat run scripts/repay-loan-configurable.ts --network sepolia
```

### Partial Repayment

```bash
# In .env:
TOKEN_REPAY_AMOUNT=50  # Repay only 50 tokens

# Run script:
npx hardhat run scripts/repay-loan-configurable.ts --network sepolia
```

## What Happens

1. **Checks debt** - Validates you have debt to repay
2. **Validates balance** - Ensures you have tokens to repay
3. **Approves tokens** - Allows pool to take your tokens
4. **Executes repayment** - Transfers tokens and burns debt
5. **Shows improvement** - Displays updated health factor

## Example Output

### Full Repayment

```
=== Loading Configuration ===
Network: sepolia
Repay Amount: ALL (Full Repayment)
Interest Rate Mode: Variable

=== Initial State ===
Wallet USDT: 9600.0

=== Current Debt Position ===
Stable debt: 0.0 USDT
Variable debt: 100.0 USDT
Total debt: 100.0 USDT

=== Account Health (Before Repayment) ===
Total Collateral (ETH): 0.142428927304491
Total Debt (ETH): 0.0285
Available Borrow (ETH): 0.0783
Health Factor: 2.98

=== Repaying USDT Debt ===
Repaying ALL debt (full repayment)...
Interest rate mode: Variable
Approving tokens for repayment...
✓ Approved
Executing repayment...
✓ Repayment successful!
New wallet balance: 9500.0 USDT
Repaid: 100.0 USDT

=== Final Summary ===
User USDT Position:
  Supplied (aUSDT): 500.0
  Stable debt: 0.0
  Variable debt: 0.0
  Wallet balance: 9500.0 USDT

=== Updated Account Health (After Repayment) ===
Total Collateral (ETH): 0.142428927304491
Total Debt (ETH): 0.0
Available Borrow (ETH): 0.106821695478368
Health Factor: ∞ (No debt)

=== Health Factor Improvement ===
✅ All debt repaid! Health Factor: ∞ (Infinite)
💯 Perfect health - Zero liquidation risk!
Previous Health Factor: 2.9800

✅ Repayment operation completed!
```

### Partial Repayment

```
=== Repaying USDT Debt ===
Repaying 50 USDT...
✓ Repayment successful!
Repaid: 50.0 USDT

=== Health Factor Improvement ===
Health factor increased by 100.00%
From 2.9800 → 5.9600 ✅
✅ Healthy position! Low liquidation risk.
```

## Common Errors

### Error: No debt to repay

```
✅ No debt to repay!
```

**Solution:** You have no outstanding debt. This is good!

### Error: Wrong debt type

```
⚠️  No variable debt to repay!
💡 Change INTEREST_RATE_MODE in .env to match your debt type
```

**Solution:** Change `INTEREST_RATE_MODE` to match your actual debt (1 for stable, 2 for variable).

### Error: Insufficient balance

```
❌ Repayment failed!
```

**Solution:** You don't have enough tokens. Get more tokens or reduce repayment amount.

### Error code 5: No debt of matching type

```
💡 Error code 5: No debt of matching type
```

**Solution:** Your `INTEREST_RATE_MODE` doesn't match your actual debt type.

## Repayment Strategies

### Strategy 1: Full Repayment

**When to use:**
- Want to withdraw all collateral
- Tired of paying interest
- Health factor at risk

```bash
TOKEN_REPAY_AMOUNT=0
```

**Pros:**
- ✅ Zero interest after repayment
- ✅ Can withdraw all collateral
- ✅ No liquidation risk

### Strategy 2: Partial Repayment

**When to use:**
- Improve health factor
- Keep some borrowing active
- Reduce interest burden

```bash
TOKEN_REPAY_AMOUNT=50
```

**Pros:**
- ✅ Improve health factor
- ✅ Reduce interest payments
- ✅ Keep some liquidity

### Strategy 3: Interest-Only Payments

**When to use:**
- Keep principal borrowed
- Prevent interest accumulation

```bash
# Calculate accrued interest from check-balance.ts
# Then repay just that amount
TOKEN_REPAY_AMOUNT=2.5  # Just the interest
```

## Health Factor Improvement

### Before Repayment:
```
Health Factor: 1.5 ⚠️  (Risky!)
```

### After Full Repayment:
```
Health Factor: ∞ ✅ (Perfect!)
```

### After Partial Repayment:
```
Health Factor: 3.0 ✅ (Healthy!)
Improvement: +100%
```

## Understanding the Numbers

### What Gets Repaid:

- **Principal** - Original amount borrowed
- **Interest** - Accrued interest (compounds every block)
- **Total** = Principal + Interest

### Example:

```
Original borrow: 100 USDT
Time passed: 30 days
Interest rate: 5% APY
Accrued interest: ~0.41 USDT

Total to repay: 100.41 USDT
```

### When repaying "ALL":
```
TOKEN_REPAY_AMOUNT=0
```
Aave automatically calculates total debt (principal + all interest) and repays exactly that amount.

## Interest Accrual

Interest accrues **every block**:

- Variable rate: Changes based on pool utilization
- Stable rate: More predictable (but can be rebalanced)
- Compounds: Interest on interest

**Check current debt:**
```bash
npx hardhat run scripts/check-balance.ts --network sepolia
```

## Best Practices

1. **Repay before liquidation** - Don't wait until health factor < 1.0
2. **Monitor interest** - Check debt regularly
3. **Partial repayments** - Improve health factor incrementally
4. **Full repayment before withdrawal** - Must repay all debt to withdraw all collateral
5. **Keep some buffer** - Don't use all tokens for repayment

## Tips

- 💡 **Interest rate mode matters** - Must match your debt type
- 💡 **Repay extra** - Small extra amount ensures full repayment (covers block interest)
- 💡 **Check before repaying** - Use `check-balance.ts` to see exact debt
- 💡 **Gas costs** - Factor in transaction fees
- 💡 **Timing** - Interest accrues continuously

## After Repayment

Once debt is repaid, you can:

1. **Withdraw collateral** - Use `withdraw-from-pool-configurable.ts`
2. **Borrow again** - Use `borrow-from-pool-configurable.ts`
3. **Leave it** - Keep earning interest on supplied tokens

## Next Steps

After repaying:
- ✅ **Check balance** - Use `check-balance.ts` to confirm
- ✅ **Withdraw** - Use `withdraw-from-pool-configurable.ts` if desired
- ✅ **Re-borrow** - Borrow again if needed (you have capacity)

## Related Scripts

- `borrow-from-pool-configurable.ts` - Create the debt you're now repaying
- `withdraw-from-pool-configurable.ts` - Withdraw collateral after repaying
- `check-balance.ts` - Check your debt before repaying
- `supply-to-pool-configurable.ts` - Add more collateral if needed
```

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