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
  withdrawAmount: string;
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
  const withdrawAmount = process.env.TOKEN_WITHDRAW_AMOUNT || '0'; // 0 = withdraw all

  return {
    network,
    lendingPoolAddress: lendingPoolAddress!,
    dataProviderAddress: dataProviderAddress || '',
    token: {
      name: tokenName,
      address: tokenAddress!,
      decimals: tokenDecimals,
    },
    withdrawAmount: withdrawAmount,
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
  console.log('Withdraw Amount:', config.withdrawAmount === '0' ? 'ALL (Full Withdrawal)' : `${config.withdrawAmount} ${config.token.name}`);
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

  // Get reserve data to find aToken address
  const reserveData = await lendingPool.getReserveData(config.token.address);
  const aToken = await ethers.getContractAt(
    'contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20',
    reserveData.aTokenAddress
  );
  
  const aTokenBalance = await aToken.balanceOf(user1.address);
  console.log(
    `Deposited (a${config.token.name}):`,
    ethers.utils.formatUnits(aTokenBalance, config.token.decimals)
  );

  if (aTokenBalance.eq(0)) {
    console.log('\n⚠️  No tokens deposited to withdraw!');
    console.log('💡 First supply tokens using supply-to-pool-configurable.ts');
    return;
  }

  // Get current position details
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
      
      console.log('\n=== Current Position ===');
      console.log(
        `Supplied (a${config.token.name}):`,
        ethers.utils.formatUnits(userReserve.currentATokenBalance, config.token.decimals),
        config.token.name
      );
      console.log(
        `Stable debt:`,
        ethers.utils.formatUnits(userReserve.currentStableDebt, config.token.decimals),
        config.token.name
      );
      console.log(
        `Variable debt:`,
        ethers.utils.formatUnits(userReserve.currentVariableDebt, config.token.decimals),
        config.token.name
      );
      
      const totalDebt = userReserve.currentStableDebt.add(userReserve.currentVariableDebt);
      if (totalDebt.gt(0)) {
        console.log('\n⚠️  WARNING: You have outstanding debt!');
        console.log('   Withdrawing too much collateral may cause liquidation.');
      }
      
    } catch (e: any) {
      console.log('⚠️  Could not fetch position data:', e.message);
    }
  }

  // Get account health before withdrawal
  const accountDataBefore = await lendingPool.getUserAccountData(user1.address);
  console.log('\n=== Account Health (Before Withdrawal) ===');
  console.log('Total Collateral (ETH):', ethers.utils.formatEther(accountDataBefore.totalCollateralETH));
  console.log('Total Debt (ETH):', ethers.utils.formatEther(accountDataBefore.totalDebtETH));
  console.log('Available Borrow (ETH):', ethers.utils.formatEther(accountDataBefore.availableBorrowsETH));
  
  // Format health factor nicely
  const hfBefore = accountDataBefore.healthFactor;
  if (hfBefore.gt(ethers.utils.parseUnits('1000000', 18))) {
    console.log('Health Factor: ∞ (No debt)');
  } else {
    console.log('Health Factor:', ethers.utils.formatUnits(hfBefore, 18));
  }

  // WITHDRAW
  console.log(`\n=== Withdrawing ${config.token.name} ===`);
  
  let withdrawAmountWei;
  if (config.withdrawAmount === '0' || config.withdrawAmount === '') {
    // Withdraw all - use max uint256 (Aave will withdraw max available)
    withdrawAmountWei = ethers.constants.MaxUint256;
    console.log('Withdrawing ALL available collateral...');
  } else {
    withdrawAmountWei = parseUnits(config.withdrawAmount, config.token.decimals);
    console.log(`Withdrawing ${config.withdrawAmount} ${config.token.name}...`);
  }

  try {
    // Check if withdrawal would be safe
    if (accountDataBefore.totalDebtETH.gt(0)) {
      console.log('💡 Checking if withdrawal is safe (you have outstanding debt)...');
    }
    
    const withdrawTx = await lendingPool.connect(user1).withdraw(
      config.token.address,
      withdrawAmountWei,
      user1.address
    );
    const receipt = await withdrawTx.wait();
    console.log('✓ Withdrawal successful!');
    
    // Show new balance
    const newBalance = await token.balanceOf(user1.address);
    console.log(
      `New wallet balance:`,
      ethers.utils.formatUnits(newBalance, config.token.decimals),
      config.token.name
    );
    
    const received = newBalance.sub(initialBalance);
    console.log(
      `Received:`,
      ethers.utils.formatUnits(received, config.token.decimals),
      config.token.name
    );
    
  } catch (error: any) {
    console.log('❌ Withdrawal failed!');
    console.log('Error:', error.message);
    
    // Common error codes
    if (error.message.includes('32')) {
      console.log('💡 Error code 32: Not enough aTokens');
    } else if (error.message.includes('35')) {
      console.log('💡 Error code 35: Health factor would drop below 1.0 (liquidation threshold)');
      console.log('   You must repay debt first or withdraw less!');
    } else if (error.message.includes('33')) {
      console.log('💡 Error code 33: Not enough liquidity in the pool');
    }
    
    return;
  }

  // Simulate time passing (optional)
  if (isLocal) {
    console.log('\n⏰ [LOCAL] Fast-forwarding time...');
    console.log(`Advancing ${config.timeDelay / 86400} days...`);
    await ethers.provider.send('evm_increaseTime', [config.timeDelay]);
    await ethers.provider.send('evm_mine', []);
    console.log('✓ Time advanced');
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
      const accountDataAfter = await lendingPool.getUserAccountData(user1.address);
      console.log('\n=== Updated Account Health (After Withdrawal) ===');
      console.log('Total Collateral (ETH):', ethers.utils.formatEther(accountDataAfter.totalCollateralETH));
      console.log('Total Debt (ETH):', ethers.utils.formatEther(accountDataAfter.totalDebtETH));
      console.log('Available Borrow (ETH):', ethers.utils.formatEther(accountDataAfter.availableBorrowsETH));
      
      // Format health factor nicely
      const hfAfter = accountDataAfter.healthFactor;
      if (hfAfter.gt(ethers.utils.parseUnits('1000000', 18))) {
        console.log('Health Factor: ∞ (No debt)');
      } else {
        console.log('Health Factor:', ethers.utils.formatUnits(hfAfter, 18));
      }
      
      // Show health factor change if both are measurable
      if (accountDataBefore.totalDebtETH.gt(0)) {
        console.log('\n=== Health Factor Change ===');
        
        if (accountDataAfter.totalDebtETH.eq(0)) {
          console.log('Debt fully repaid - Health Factor: ∞');
        } else if (
          accountDataBefore.healthFactor.lt(ethers.utils.parseUnits('1000000', 18)) &&
          accountDataAfter.healthFactor.lt(ethers.utils.parseUnits('1000000', 18))
        ) {
          const hfBeforeNum = parseFloat(ethers.utils.formatUnits(accountDataBefore.healthFactor, 18));
          const hfAfterNum = parseFloat(ethers.utils.formatUnits(accountDataAfter.healthFactor, 18));
          
          if (hfAfterNum < hfBeforeNum) {
            const decrease = ((hfBeforeNum - hfAfterNum) / hfBeforeNum * 100).toFixed(2);
            console.log(`Health factor decreased by ${decrease}%`);
            console.log(`From ${hfBeforeNum.toFixed(4)} → ${hfAfterNum.toFixed(4)}`);
            
            if (hfAfterNum < 1.5) {
              console.log('⚠️  WARNING: Health factor is getting low!');
            }
          } else {
            console.log(`Health factor: ${hfAfterNum.toFixed(4)} (unchanged)`);
          }
        }
        
        // Safety warnings
        if (accountDataAfter.healthFactor.lt(ethers.utils.parseUnits('1.5', 18)) &&
            accountDataAfter.healthFactor.gt(0)) {
          console.log('⚠️  WARNING: Low health factor! Risk of liquidation.');
          console.log('💡 Consider adding more collateral or repaying debt.');
        } else if (accountDataAfter.totalDebtETH.gt(0) &&
                   accountDataAfter.healthFactor.gte(ethers.utils.parseUnits('2', 18))) {
          console.log('✅ Healthy position maintained after withdrawal.');
        }
      } else {
        console.log('\n✅ No debt - Safe to withdraw anytime!');
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

  console.log('\n✅ Withdrawal operation completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });