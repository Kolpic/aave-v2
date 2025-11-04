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
  repayAmount: string;
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
  const repayAmount = process.env.TOKEN_REPAY_AMOUNT || '0'; // 0 = repay all
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
    repayAmount: repayAmount,
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
  console.log('Repay Amount:', config.repayAmount === '0' ? 'ALL (Full Repayment)' : `${config.repayAmount} ${config.token.name}`);
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

  // Get current debt
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
      
      console.log('\n=== Current Debt Position ===');
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
      console.log(
        `Total debt:`,
        ethers.utils.formatUnits(totalDebt, config.token.decimals),
        config.token.name
      );
      
      if (totalDebt.eq(0)) {
        console.log('\n✅ No debt to repay!');
        return;
      }
      
      // Check if user has enough balance
      const targetDebt = config.interestRateMode === 1 
        ? userReserve.currentStableDebt 
        : userReserve.currentVariableDebt;
        
      if (targetDebt.eq(0)) {
        console.log(`\n⚠️  No ${config.interestRateMode === 1 ? 'stable' : 'variable'} debt to repay!`);
        console.log(`💡 Change INTEREST_RATE_MODE in .env to match your debt type`);
        return;
      }
      
    } catch (e: any) {
      console.log('⚠️  Could not fetch debt data:', e.message);
    }
  }

  // Get account health before repayment
  const accountDataBefore = await lendingPool.getUserAccountData(user1.address);
  console.log('\n=== Account Health (Before Repayment) ===');
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

  // REPAY
  console.log(`\n=== Repaying ${config.token.name} Debt ===`);
  
  let repayAmountWei;
  if (config.repayAmount === '0' || config.repayAmount === '') {
    // Repay all debt - use max uint256
    repayAmountWei = ethers.constants.MaxUint256;
    console.log('Repaying ALL debt (full repayment)...');
  } else {
    repayAmountWei = parseUnits(config.repayAmount, config.token.decimals);
    console.log(`Repaying ${config.repayAmount} ${config.token.name}...`);
  }

  try {
    console.log(`Interest rate mode: ${config.interestRateMode === 1 ? 'Stable' : 'Variable'}`);
    
    // Approve tokens for repayment
    console.log('Approving tokens for repayment...');
    const approveTx = await token.connect(user1).approve(
      config.lendingPoolAddress,
      repayAmountWei === ethers.constants.MaxUint256 
        ? ethers.constants.MaxUint256 
        : repayAmountWei
    );
    await approveTx.wait();
    console.log('✓ Approved');
    
    // Repay
    console.log('Executing repayment...');
    const repayTx = await lendingPool.connect(user1).repay(
      config.token.address,
      repayAmountWei,
      config.interestRateMode, // 1 = stable, 2 = variable
      user1.address
    );
    const receipt = await repayTx.wait();
    console.log('✓ Repayment successful!');
    
    // Show new balance
    const newBalance = await token.balanceOf(user1.address);
    console.log(
      `New wallet balance:`,
      ethers.utils.formatUnits(newBalance, config.token.decimals),
      config.token.name
    );
    
    const spent = initialBalance.sub(newBalance);
    console.log(
      `Repaid:`,
      ethers.utils.formatUnits(spent, config.token.decimals),
      config.token.name
    );
    
  } catch (error: any) {
    console.log('❌ Repayment failed!');
    console.log('Error:', error.message);
    
    // Common error codes
    if (error.message.includes('5')) {
      console.log('💡 Error code 5: No debt of matching type');
    } else if (error.message.includes('14')) {
      console.log('💡 Error code 14: Amount exceeds debt');
    } else if (error.message.includes('15')) {
      console.log('💡 Error code 15: No variable rate debt');
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
      console.log('\n=== Updated Account Health (After Repayment) ===');
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
      
      // Show improvement
      console.log('\n=== Health Factor Improvement ===');
      
      // Check if debt is fully repaid
      if (accountDataAfter.totalDebtETH.eq(0)) {
        console.log('✅ All debt repaid! Health Factor: ∞ (Infinite)');
        console.log('💯 Perfect health - Zero liquidation risk!');
        
        // Show previous health factor if it was measurable
        if (accountDataBefore.healthFactor.lt(ethers.utils.parseUnits('1000000', 18))) {
          const hfBeforeFormatted = ethers.utils.formatUnits(accountDataBefore.healthFactor, 18);
          console.log(`Previous Health Factor: ${parseFloat(hfBeforeFormatted).toFixed(4)}`);
        }
      } else {
        // Both have measurable health factors
        if (accountDataBefore.healthFactor.lt(ethers.utils.parseUnits('1000000', 18)) &&
            accountDataAfter.healthFactor.lt(ethers.utils.parseUnits('1000000', 18))) {
          
          const hfBeforeNum = parseFloat(ethers.utils.formatUnits(accountDataBefore.healthFactor, 18));
          const hfAfterNum = parseFloat(ethers.utils.formatUnits(accountDataAfter.healthFactor, 18));
          
          if (hfAfterNum > hfBeforeNum) {
            const improvement = ((hfAfterNum - hfBeforeNum) / hfBeforeNum * 100).toFixed(2);
            console.log(`Health factor increased by ${improvement}%`);
            console.log(`From ${hfBeforeNum.toFixed(4)} → ${hfAfterNum.toFixed(4)} ✅`);
          } else if (hfAfterNum === hfBeforeNum) {
            console.log(`Health factor unchanged: ${hfAfterNum.toFixed(4)}`);
          }
        }
        
        // Warning or success message based on final health factor
        if (accountDataAfter.healthFactor.lt(ethers.utils.parseUnits('1.5', 18))) {
          console.log('⚠️  WARNING: Health factor still low! Consider repaying more or adding collateral.');
        } else if (accountDataAfter.healthFactor.gte(ethers.utils.parseUnits('2', 18))) {
          console.log('✅ Healthy position! Low liquidation risk.');
        } else {
          console.log('✅ Moderate health - Monitor your position.');
        }
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

  console.log('\n✅ Repayment operation completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });