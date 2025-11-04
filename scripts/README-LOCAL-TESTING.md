## File 1: `README-LOCAL-TESTING.md`

```markdown
# Aave V2 Local Testing Guide

This guide walks you through deploying and testing Aave V2 locally using Hardhat.

## 📋 Prerequisites

- Node.js v16+ installed
- Dependencies installed: `npm install`
- `.env` file configured (see below)

## ⚙️ Configuration

### Required `.env` Variables for Local Testing

```bash
# Network Selection
NETWORK=localhost

# Token Configuration (for local deployment)
TOKEN_NAME=DAI
TOKEN_SYMBOL=DAI
TOKEN_DECIMALS=18
TOKEN_MINT_AMOUNT=10000      # Amount to mint to test user
TOKEN_SUPPLY_AMOUNT=500      # Amount to supply to pool

# Optional: Time delay for interest accrual testing (in seconds)
TIME_DELAY=86400             # 1 day default
```

**Note:** You do NOT need to set addresses for local testing - they will be generated during deployment!

## 🚀 Testing Flow

### Step 1: Start Local Hardhat Network

In a separate terminal, start the local blockchain:

```bash
npx hardhat node
```

Keep this terminal running throughout your testing session.

### Step 2: Deploy Aave V2 Pool & Initialize

Deploy a complete Aave V2 lending pool with your configured token:

```bash
npx hardhat run scripts/test-local-deployment.ts --network localhost
```

**What This Does:**
- ✅ Deploys all Aave V2 core contracts
- ✅ Deploys lending pool, configurator, oracle, data provider
- ✅ Creates and initializes your test token (e.g., DAI)
- ✅ Mints tokens to test user (account[1])
- ✅ Performs initial supply operation
- ✅ Displays all deployed addresses

**Expected Output:**
```
=== Deploying Aave V2 Test Environment ===
Network: localhost
Token: DAI (18 decimals)
...
✅ Deployment Summary:
Lending Pool: 0x1234...
Data Provider: 0x5678...
DAI Token: 0x9abc...
User Balance: 10000.0 DAI
```

**📝 IMPORTANT:** Save the output addresses! Update your `.env` with:
```bash
LOCAL_LENDING_POOL_ADDRESS=0x...    # From deployment output
LOCAL_DATA_PROVIDER_ADDRESS=0x...   # From deployment output
LOCAL_TOKEN_ADDRESS=0x...           # From deployment output
```

### Step 3: Verify Pool Configuration (Optional)

Check that your token reserve is properly configured:

```bash
npx hardhat run scripts/check-pool-config.ts --network localhost
```

**Expected Output:**
```
=== Pool Status ===
Pool Paused: false

=== Reserve Status ===
Is Active: true
Is Frozen: false

=== Final Verdict ===
✅ Reserve is configured correctly
✅ Pool is active - you should be able to deposit DAI!
```

### Step 4: List Available Reserves (Optional)

View all tokens supported by your pool:

```bash
npx hardhat run scripts/list-pool-reserves.ts --network localhost
```

**Expected Output:**
```
=== Querying Pool Reserves ===
Network: localhost
Pool: 0x1234...
Pool Paused: false

✅ Found 1 reserve(s):

1. DAI
   Address: 0x9abc...
   aToken: 0xdef0...
   Active: true
   Frozen: false
```

### Step 5: Supply Tokens to Pool

Execute additional supply operations:

```bash
npx hardhat run scripts/supply-to-pool-configurable.ts --network localhost
```

**Expected Output:**
```
=== Loading Configuration ===
Network: localhost
Mode: LOCAL (using 2nd account)

=== Supplying 500 DAI ===
✓ Approved
✓ Deposited

⏰ [LOCAL] Fast-forwarding time...
✓ Time advanced

=== Final Summary ===
aToken balance: 500.0 DAI
✅ All supply operations completed!
```

### Step 6: Check Balances

View wallet and deposited balances:

```bash
npx hardhat run scripts/check-balance.ts --network localhost
```

**Expected Output:**
```
=== Checking All Token Balances ===
Network: localhost
Mode: LOCAL (checking account[1])

1. DAI
   Address: 0x9abc...
   Decimals: 18
   Wallet: 9500.0 DAI
   Deposited: 500.0 DAI
   Total: 10000.0 DAI

✅ Balance check complete!
```

## 🔄 Iterative Testing

To test multiple scenarios:

1. **Stop** the local node (Ctrl+C)
2. **Restart** with `npx hardhat node`
3. **Re-run** Step 2 (deployment) to get a fresh state
4. Update `.env` with new addresses
5. Continue with Steps 3-6

## 🛠️ Troubleshooting

### Issue: "Contract deployment failed"
- **Solution:** Restart the Hardhat node and try again

### Issue: "Insufficient balance" error
- **Solution:** Check that `TOKEN_MINT_AMOUNT` is greater than `TOKEN_SUPPLY_AMOUNT` in `.env`

### Issue: "Cannot estimate gas" or "execution reverted"
- **Solution:** Run `check-pool-config.ts` to diagnose pool/reserve status
- Check that you're using the correct addresses from deployment output

### Issue: "Network connection failed"
- **Solution:** Ensure `npx hardhat node` is running in another terminal

### Issue: Wrong account has tokens
- **Solution:** Local scripts use account[1] for testing. The script mints to and supplies from this account automatically.

## 📊 Understanding Accounts

Local Hardhat provides 20 test accounts:
- **account[0]** = Deployer (deploys contracts, has ETH for gas)
- **account[1]** = Test User (receives minted tokens, makes deposits)
- **account[2-19]** = Available for additional testing

## 🎯 Quick Reference Commands

| Task | Command |
|------|---------|
| Start node | `npx hardhat node` |
| Deploy & init | `npx hardhat run scripts/test-local-deployment.ts --network localhost` |
| Check config | `npx hardhat run scripts/check-pool-config.ts --network localhost` |
| List reserves | `npx hardhat run scripts/list-pool-reserves.ts --network localhost` |
| Supply tokens | `npx hardhat run scripts/supply-to-pool-configurable.ts --network localhost` |
| Check balance | `npx hardhat run scripts/check-balance.ts --network localhost` |

## ✅ Success Checklist

- [ ] Hardhat node running
- [ ] Deployment completed successfully
- [ ] `.env` updated with deployment addresses
- [ ] Pool shows as "not paused"
- [ ] Reserve shows as "active" and "not frozen"
- [ ] Supply operation succeeded
- [ ] Balance shows deposited tokens

## 🧹 Cleanup

When finished testing:
1. Stop the Hardhat node (Ctrl+C)
2. (Optional) Clear deployment addresses from `.env` to avoid confusion

---

**Need Help?** Check that your `.env` file matches the configuration above and all addresses are updated after deployment.
```

---
