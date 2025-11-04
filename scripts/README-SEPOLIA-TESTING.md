## File 2: `README-SEPOLIA-TESTING.md`

```markdown
# Aave V2 Sepolia Testnet Testing Guide

This guide walks you through interacting with existing Aave V2 pools on the Sepolia testnet.

## 📋 Prerequisites

- Node.js v16+ installed
- Dependencies installed: `npm install`
- Sepolia testnet account with ETH (for gas)
- Sepolia testnet tokens (DAI, USDC, etc.)
- `.env` file configured (see below)

## ⚙️ Configuration

### Required `.env` Variables for Sepolia Testing

```bash
# Network Selection
NETWORK=sepolia

# Sepolia RPC & Account
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
PRIVATE_KEY_USER1=your_private_key_here

# Existing Aave V2 Pool Addresses (Example - verify these are current!)
SEPOLIA_LENDING_POOL_ADDRESS=0x20fCdB2206E0704305897638162ac94DE908feA0
SEPOLIA_DATA_PROVIDER_ADDRESS=0x6eDaC8Ff91B45d5F985aC151c11D87F671Ade816

# Token Configuration (Update based on pool reserves)
TOKEN_NAME=DAI
TOKEN_DECIMALS=18
TOKEN_SUPPLY_AMOUNT=500

# Token Address (Get from Step 2 - list-pool-reserves)
SEPOLIA_TOKEN_ADDRESS=0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6
```

## 🚀 Testing Flow

### Step 0: Get Testnet ETH & Tokens

1. **Get Sepolia ETH:**
   - Use a faucet: https://sepoliafaucet.com/
   - Or: https://www.alchemy.com/faucets/ethereum-sepolia

2. **Get Test Tokens:**
   - Aave Faucet: https://staging.aave.com/faucet/
   - Or mint from token contracts directly if available

### Step 1: Verify Pool Status

**CRITICAL FIRST STEP:** Check if the pool is operational:

```bash
npx hardhat run scripts/list-pool-reserves.ts --network sepolia
```

**Expected Output (Healthy Pool):**
```
=== Querying Pool Reserves ===
Network: sepolia
Pool: 0x20fC...
Pool Paused: false

✅ Found 4 reserve(s):

1. DAI
   Address: 0x3e62...
   Active: true
   Frozen: false

2. USDC
   Address: 0x94a9...
   Active: true
   Frozen: false
...
```

**⚠️ Warning Signs:**
```
Pool Paused: true    ← PROBLEM! Cannot interact with pool

⚠️  WARNING: This pool is PAUSED!
Error code 64 (LP_IS_PAUSED) will be returned for all operations.
```

**If Pool is Paused:**
- ❌ You cannot deposit/withdraw/borrow
- 💡 Try Aave V3 instead (different addresses)
- 💡 Or deploy your own pool locally

### Step 2: Choose Your Token

From the output of Step 1, pick a token that shows:
- ✅ Active: true
- ✅ Frozen: false
- ✅ Pool Paused: false

Update your `.env`:
```bash
TOKEN_NAME=DAI                                           # Token symbol
SEPOLIA_TOKEN_ADDRESS=0x3e622317f8C93f7328350cF0B56d9eD4C620C5d6  # From list
TOKEN_DECIMALS=18                                        # From list
```

### Step 3: Verify Token Configuration

Check if your chosen token is properly configured:

```bash
npx hardhat run scripts/check-pool-config.ts --network sepolia
```

**Expected Output (Ready to Use):**
```
=== Checking Pool Configuration ===

=== Pool Status ===
Pool Paused: false

=== Reserve Configuration ===
aToken: 0x4c3B...
Active: true
Frozen: false

=== Final Verdict ===
✅ Reserve is configured correctly
✅ Pool is active - you should be able to deposit DAI!
```

**⚠️ Common Issues:**

**Issue 1: Pool Paused**
```
Pool Paused: true
❌ BUT the pool is PAUSED - all deposits will fail with error 64!

💡 Solutions:
   1. Wait for the pool to be unpaused (if temporary)
   2. Use a different pool that is not paused
   3. Deploy your own Aave V2 pool locally
```

**Issue 2: Reserve Not Active**
```
Is Active: false
❌ ERROR: Reserve is not active!
```
→ Choose a different token from Step 1

**Issue 3: Reserve Frozen**
```
Is Frozen: true
❌ ERROR: Reserve is frozen!
```
→ Choose a different token from Step 1

### Step 4: Check Your Token Balance

Verify you have tokens to supply:

```bash
npx hardhat run scripts/check-balance.ts --network sepolia
```

**Expected Output:**
```
=== Checking All Token Balances ===
Network: sepolia
Mode: LIVE NETWORK (checking account[0])
User Address: 0x345f...

=== Token Balances ===
1. DAI
   Address: 0x3e62...
   Decimals: 18
   Wallet: 10000.0 DAI
   Deposited: 0.0 DAI
   Total: 10000.0 DAI

✅ Balance check complete!
```

**If balance is 0:**
- Get tokens from Aave faucet (Step 0)
- Or choose a different token you already have

### Step 5: Supply Tokens to Pool

Execute the supply operation:

```bash
npx hardhat run scripts/supply-to-pool-configurable.ts --network sepolia
```

**Expected Output (Success):**
```
=== Loading Configuration ===
Network: sepolia
Token: DAI (18 decimals)
Supply Amount: 500 DAI

Mode: LIVE NETWORK (using 1st account)
User: 0x345f...

=== Checking Initial Balance ===
User DAI: 10000.0

=== Supplying 500 DAI ===
Approving 500 DAI...
✓ Approved
Depositing 500 DAI...
✓ Deposited

⏰ [LIVE NETWORK] Time passes naturally
💡 Run this script again later to see interest accrual

=== Final Summary ===
aToken balance (aDAI): 500.0
Wallet balance: 9500.0 DAI

✅ All supply operations completed!
```

**If You See Error 64:**
```
❌ Error: execution reverted: 64
```
→ Go back to Step 1 - the pool is paused!

### Step 6: Verify Deposit

Check your updated balances:

```bash
npx hardhat run scripts/check-balance.ts --network sepolia
```

**Expected Output:**
```
=== Token Balances ===
1. DAI
   Wallet: 9500.0 DAI
   Deposited: 500.0 DAI
   Total: 10000.0 DAI
```

## 🔄 Testing Multiple Tokens

To test with different tokens:

1. Run Step 1 (`list-pool-reserves.ts`) to see all available tokens
2. Update `.env` with new token details:
   ```bash
   TOKEN_NAME=USDC
   SEPOLIA_TOKEN_ADDRESS=0x94a9...
   TOKEN_DECIMALS=6
   ```
3. Re-run Steps 3-6

## 🛠️ Troubleshooting

### Error: "execution reverted: 64"
**Meaning:** Pool is paused  
**Solution:** Run `check-pool-config.ts` to verify. If paused, use a different pool.

### Error: "insufficient funds for gas"
**Meaning:** You need Sepolia ETH  
**Solution:** Get ETH from faucet (Step 0)

### Error: "Insufficient balance"
**Meaning:** You don't have enough tokens  
**Solution:** Get tokens from Aave faucet or reduce `TOKEN_SUPPLY_AMOUNT` in `.env`

### Error: "Invalid account: #0 for network: sepolia"
**Meaning:** `PRIVATE_KEY_USER1` is missing or invalid  
**Solution:** Check your `.env` file has valid private key (without "0x" prefix)

### Error: "Cannot read properties of undefined"
**Meaning:** Token address is not configured  
**Solution:** Set `SEPOLIA_TOKEN_ADDRESS` in `.env` (from Step 1 output)

### Pool Shows Active but Deposits Still Fail
**Solution:** 
1. Check pool pause status with `list-pool-reserves.ts`
2. Verify you're using the correct pool address
3. Try a different token from the same pool
4. Consider using Aave V3 instead of V2

### Error: "HH701: Multiple artifacts for IERC20"
**Meaning:** Hardhat found multiple IERC20 interfaces  
**Solution:** This is already handled in the scripts - if you see this, contact support

## 🌐 Alternative: Aave V3 on Sepolia

If Aave V2 pools are paused, try Aave V3:

```bash
# Update .env with Aave V3 addresses
SEPOLIA_LENDING_POOL_ADDRESS=0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951
SEPOLIA_DATA_PROVIDER_ADDRESS=0x3e9708d80f7B3e43118013075F7e95CE3AB31F31
```

**Note:** Aave V3 may have different available tokens. Run `list-pool-reserves.ts` to check.

## 📊 Understanding Accounts

Sepolia testing uses your configured private key:
- **PRIVATE_KEY_USER1** = Your test account (pays gas, holds tokens)
- Ensure this account has both ETH (for gas) and tokens (for supply)

## 🎯 Quick Reference Commands

| Task | Command |
|------|---------|
| List reserves | `npx hardhat run scripts/list-pool-reserves.ts --network sepolia` |
| Check config | `npx hardhat run scripts/check-pool-config.ts --network sepolia` |
| Check balance | `npx hardhat run scripts/check-balance.ts --network sepolia` |
| Supply tokens | `npx hardhat run scripts/supply-to-pool-configurable.ts --network sepolia` |

## ✅ Success Checklist

- [ ] Sepolia ETH in your account (for gas)
- [ ] Test tokens in your account
- [ ] Pool shows as "not paused" ✅
- [ ] Reserve shows as "active" and "not frozen" ✅
- [ ] Supply operation succeeded
- [ ] Balance shows deposited aTokens

## 🔒 Security Notes

- **Never** commit your `.env` file with real private keys
- **Never** use mainnet keys for testing
- Use a dedicated test account for Sepolia
- Test accounts should not hold real funds

## 📝 Important Notes

1. **Pool Pause Status:** Always check if pool is paused first (Step 1)
2. **Token Availability:** Verify the token is active and not frozen (Step 3)
3. **Gas Costs:** Ensure you have enough Sepolia ETH for multiple transactions
4. **Time Delays:** On live networks, time passes naturally (no fast-forward)

---

**Need Help?** 
1. Start with `list-pool-reserves.ts` to check pool status
2. Use `check-pool-config.ts` for specific token diagnostics
3. If error 64 appears, the pool is paused - try a different pool

**Useful Links:**
- Sepolia Faucet: https://sepoliafaucet.com/
- Aave Token Faucet: https://staging.aave.com/faucet/
- Aave Docs: https://docs.aave.com/
- Sepolia Explorer: https://sepolia.etherscan.io/
```

---

## 📁 How to Use These Files

1. **Create** `README-LOCAL-TESTING.md` in your project root
2. **Create** `README-SEPOLIA-TESTING.md` in your project root
3. Copy and paste the complete markdown text above into each respective file
4. Reference them as needed during your testing workflow

Both files are complete, self-contained guides that include all the information about using your diagnostic scripts! 🚀