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
  supplyAmount: string;
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
  const supplyAmount = process.env.TOKEN_SUPPLY_AMOUNT || '100';

  return {
    network,
    lendingPoolAddress: lendingPoolAddress!,
    dataProviderAddress: dataProviderAddress || '',
    token: {
      name: tokenName,
      address: tokenAddress!,
      decimals: tokenDecimals,
    },
    supplyAmount: supplyAmount,
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
  console.log('Supply Amount:', config.supplyAmount, config.token.name);
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

  console.log('\n=== Checking Initial Balance ===');
  const userBalance = await token.balanceOf(user1.address);
  console.log(
    `User ${config.token.name}:`,
    ethers.utils.formatUnits(userBalance, config.token.decimals)
  );

  // PHASE 1: User supplies tokens
  console.log(`\n=== Supplying ${config.supplyAmount} ${config.token.name} ===`);
  
  const supplyAmountWei = parseUnits(
    config.supplyAmount,
    config.token.decimals
  );

  if (userBalance.gte(supplyAmountWei)) {
    console.log(`Approving ${config.supplyAmount} ${config.token.name}...`);
    const approveTx = await token.connect(user1).approve(
      config.lendingPoolAddress,
      supplyAmountWei
    );
    await approveTx.wait();
    console.log('✓ Approved');

    console.log(`Depositing ${config.supplyAmount} ${config.token.name}...`);
    const depositTx = await lendingPool.connect(user1).deposit(
      config.token.address,
      supplyAmountWei,
      user1.address,
      0
    );
    await depositTx.wait();
    console.log('✓ Deposited');
  } else {
    const available = ethers.utils.formatUnits(userBalance, config.token.decimals);
    console.log(`⚠️  Insufficient ${config.token.name} balance`);
    console.log(`   Required: ${config.supplyAmount} ${config.token.name}`);
    console.log(`   Available: ${available} ${config.token.name}`);
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
        `  aToken balance (a${config.token.name}):`,
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
      
      // Also show wallet balance
      const finalBalance = await token.balanceOf(user1.address);
      console.log(
        `  Wallet balance:`,
        ethers.utils.formatUnits(finalBalance, config.token.decimals),
        config.token.name
      );
      
    } catch (e: any) {
      console.log('❌ Could not fetch detailed reserve data');
      console.log('Error:', e.message || e);
      console.log('Data Provider Address:', config.dataProviderAddress);
      
      if (!config.dataProviderAddress) {
        console.log('⚠️  No DATA_PROVIDER_ADDRESS configured in .env');
      }
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

  console.log('\n✅ All supply operations completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  });