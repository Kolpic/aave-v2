import { ethers } from 'hardhat';
import { parseUnits } from 'ethers/lib/utils';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

function isLocalNetwork(): boolean {
  const network = process.env.NETWORK || 'hardhat';
  return network === 'hardhat' || network === 'localhost';
}

interface Config {
  network: string;
  lendingPoolAddress: string;
  dataProviderAddress: string;
  token: {
    name: string;
    address: string;
    decimals: number;
  };
  borrowAmount: string;
  interestRateMode: number; // 1 = stable, 2 = variable
  timeDelay: number;
}

function loadConfig(): Config {
  const network = process.env.NETWORK || 'localhost';
  const isLocal = network === 'hardhat' || network === 'localhost';
  
  // Auto-select addresses based on network
  const tokenAddress = isLocal 
    ? (process.env.LOCAL_TOKEN_ADDRESS || process.env.TOKEN_ADDRESS)
    : (process.env.SEPOLIA_TOKEN_ADDRESS || process.env.TOKEN_ADDRESS);
    
  const lendingPoolAddress = isLocal
    ? (process.env.LOCAL_LENDING_POOL_ADDRESS || process.env.LENDING_POOL_ADDRESS)
    : (process.env.SEPOLIA_LENDING_POOL_ADDRESS || process.env.LENDING_POOL_ADDRESS);
    
  const dataProviderAddress = isLocal
    ? (process.env.LOCAL_DATA_PROVIDER_ADDRESS || process.env.DATA_PROVIDER_ADDRESS)
    : (process.env.SEPOLIA_DATA_PROVIDER_ADDRESS || process.env.DATA_PROVIDER_ADDRESS);

  // Validate required fields
  const required = [
    { name: 'LENDING_POOL_ADDRESS', value: lendingPoolAddress },
    { name: 'TOKEN_ADDRESS', value: tokenAddress }
  ];

  for (const field of required) {
    if (!field.value) {
      const prefix = isLocal ? 'LOCAL_' : 'SEPOLIA_';
      throw new Error(
        `Missing required environment variable: ${prefix}${field.name} (or fallback ${field.name})`
      );
    }
  }

  const tokenName = process.env.TOKEN_NAME || 'TOKEN';
  const tokenDecimals = parseInt(process.env.TOKEN_DECIMALS || '18');
  const borrowAmount = process.env.TOKEN_BORROW_AMOUNT || '100';
  const interestRateMode = parseInt(process.env.INTEREST_RATE_MODE || '2'); // Default to variable

  return {
    network,
    lendingPoolAddress: lendingPoolAddress!,
    dataProviderAddress: dataProviderAddress || '',
    token: {
      name: tokenName,
      address: tokenAddress!,
      decimals: tokenDecimals,
    },
    borrowAmount: borrowAmount,
    interestRateMode: interestRateMode,
    timeDelay: parseInt(process.env.TIME_DELAY || '86400'),
  };
}

async function main() {
  console.log('=== Loading Configuration ===');
  const config = loadConfig();
  
  console.log('Network:', config.network);
  console.log('Lending Pool:', config.lendingPoolAddress);
  console.log(`Token: ${config.token.name} (${config.token.decimals} decimals)`);
  console.log('Token Address:', config.token.address);
  console.log('Borrow Amount:', config.borrowAmount, config.token.name);
  console.log('Interest Rate Mode:', config.interestRateMode === 1 ? 'Stable' : 'Variable');
  console.log('\n');

  // Get signer - network-aware account selection
  const signers = await ethers.getSigners();
  const isLocal = isLocalNetwork();
  
  let user1;
  if (isLocal) {
    // LOCAL: Use second account (matches test-local-deployment.ts pattern)
    if (signers.length < 2) {
      throw new Error('❌ Local network needs at least 2 accounts (deployer + user)');
    }
    const [deployer, localUser] = signers;
    user1 = localUser;
    console.log('Mode: LOCAL (using 2nd account - separate from deployer)');
    console.log('Deployer:', deployer.address);
    console.log('User:', user1.address);
  } else {
    // SEPOLIA: Use first account (the only one configured)
    if (signers.length === 0) {
      throw new Error('❌ No accounts configured! Check your .env file and hardhat.config.ts');
    }
    user1 = signers[0];
    console.log('Mode: LIVE NETWORK (using 1st account)');
    console.log('User:', user1.address);
  }

  // Connect to contracts
  const lendingPool = await ethers.getContractAt(
    'ILendingPool',
    config.lendingPoolAddress
  );
  
  const token = await ethers.getContractAt(
    'contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20',
    config.token.address
  );

  // Check initial state
  console.log('\n=== Initial State ===');
  const initialBalance = await token.balanceOf(user1.address);
  console.log(
    `Wallet ${config.token.name}:`,
    ethers.utils.formatUnits(initialBalance, config.token.decimals)
  );

  // Get user account data (health factor, available borrow)
  if (config.dataProviderAddress) {
    try {
      const accountData = await lendingPool.getUserAccountData(user1.address);
      
      console.log('\n=== Account Health ===');
      console.log('Total Collateral (ETH):', ethers.utils.formatEther(accountData.totalCollateralETH));
      console.log('Total Debt (ETH):', ethers.utils.formatEther(accountData.totalDebtETH));
      console.log('Available Borrow (ETH):', ethers.utils.formatEther(accountData.availableBorrowsETH));
      console.log('Liquidation Threshold:', accountData.currentLiquidationThreshold.toString());
      console.log('Loan-to-Value:', accountData.ltv.toString());
      console.log('Health Factor:', ethers.utils.formatUnits(accountData.healthFactor, 18));
      
      // Check if user has sufficient collateral
      if (accountData.totalCollateralETH.eq(0)) {
        console.log('\n⚠️  WARNING: No collateral supplied!');
        console.log('💡 You must supply collateral first using supply-to-pool-configurable.ts');
        return;
      }
      
      if (accountData.availableBorrowsETH.eq(0)) {
        console.log('\n⚠️  WARNING: No borrowing capacity available!');
        console.log('💡 Your collateral may be insufficient or already fully utilized');
        return;
      }
      
    } catch (e: any) {
      console.log('⚠️  Could not fetch account data:', e.message);
    }
  }

  // BORROW
  console.log(`\n=== Borrowing ${config.borrowAmount} ${config.token.name} ===`);
  
  const borrowAmountWei = parseUnits(
    config.borrowAmount,
    config.token.decimals
  );

  try {
    console.log(`Requesting borrow of ${config.borrowAmount} ${config.token.name}...`);
    console.log(`Interest rate mode: ${config.interestRateMode === 1 ? 'Stable' : 'Variable'}`);
    
    const borrowTx = await lendingPool.connect(user1).borrow(
      config.token.address,
      borrowAmountWei,
      config.interestRateMode, // 1 = stable, 2 = variable
      0, // referralCode
      user1.address
    );
    await borrowTx.wait();
    console.log('✓ Borrowed successfully!');
    
    // Show new balance
    const newBalance = await token.balanceOf(user1.address);
    console.log(
      `New wallet balance:`,
      ethers.utils.formatUnits(newBalance, config.token.decimals),
      config.token.name
    );
    console.log(
      `Received:`,
      ethers.utils.formatUnits(newBalance.sub(initialBalance), config.token.decimals),
      config.token.name
    );
    
  } catch (error: any) {
    console.log('❌ Borrow failed!');
    console.log('Error:', error.message);
    
    // Common error codes
    if (error.message.includes('1')) {
      console.log('💡 Error code 1: Invalid reserve used as collateral');
    } else if (error.message.includes('3')) {
      console.log('💡 Error code 3: Invalid amount (0 or exceeds max)');
    } else if (error.message.includes('11')) {
      console.log('💡 Error code 11: Collateral cannot cover new borrow');
    } else if (error.message.includes('64')) {
      console.log('💡 Error code 64: Pool is paused');
    }
    
    return;
  }

  // Simulate time passing (optional - for testing interest accrual)
  if (isLocal) {
    console.log('\n⏰ [LOCAL] Fast-forwarding time...');
    console.log(`Advancing ${config.timeDelay / 86400} days...`);
    await ethers.provider.send('evm_increaseTime', [config.timeDelay]);
    await ethers.provider.send('evm_mine', []);
    console.log('✓ Time advanced');
  } else {
    console.log('\n⏰ [LIVE NETWORK] Time passes naturally');
    console.log('💡 Run this script again later to see interest accrual');
  }

  // Final summary
  console.log('\n=== Final Summary ===');
  
  if (config.dataProviderAddress) {
    try {
      const dataProvider = await ethers.getContractAt(
        'AaveProtocolDataProvider',
        config.dataProviderAddress
      );
      
      const userReserve = await dataProvider.getUserReserveData(
        config.token.address,
        user1.address
      );
      
      console.log(`\nUser ${config.token.name} Position:`);
      console.log(
        `  Supplied (a${config.token.name}):`,
        ethers.utils.formatUnits(userReserve.currentATokenBalance, config.token.decimals)
      );
      console.log(
        `  Stable debt:`,
        ethers.utils.formatUnits(userReserve.currentStableDebt, config.token.decimals)
      );
      console.log(
        `  Variable debt:`,
        ethers.utils.formatUnits(userReserve.currentVariableDebt, config.token.decimals)
      );
      
      // Show wallet balance
      const finalBalance = await token.balanceOf(user1.address);
      console.log(
        `  Wallet balance:`,
        ethers.utils.formatUnits(finalBalance, config.token.decimals),
        config.token.name
      );
      
      // Show updated health factor
      const accountData = await lendingPool.getUserAccountData(user1.address);
      console.log('\n=== Updated Account Health ===');
      console.log('Total Debt (ETH):', ethers.utils.formatEther(accountData.totalDebtETH));
      console.log('Available Borrow (ETH):', ethers.utils.formatEther(accountData.availableBorrowsETH));
      console.log('Health Factor:', ethers.utils.formatUnits(accountData.healthFactor, 18));
      
      if (accountData.healthFactor.lt(ethers.utils.parseUnits('1.5', 18))) {
        console.log('⚠️  WARNING: Health factor is low! Risk of liquidation.');
      }
      
    } catch (e: any) {
      console.log('❌ Could not fetch detailed reserve data');
      console.log('Error:', e.message || e);
    }
  } else {
    console.log('⚠️  No Data Provider address configured - skipping detailed summary');
    
    // Just show wallet balance
    const finalBalance = await token.balanceOf(user1.address);
    console.log(
      `Wallet balance:`,
      ethers.utils.formatUnits(finalBalance, config.token.decimals),
      config.token.name
    );
  }

  console.log('\n✅ Borrow operation completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });