import { ethers } from 'hardhat';
import * as dotenv from 'dotenv';

dotenv.config();

function isLocalNetwork(): boolean {
  const network = process.env.NETWORK || 'hardhat';
  return network === 'hardhat' || network === 'localhost';
}

async function main() {
  const network = process.env.NETWORK || 'localhost';
  const isLocal = isLocalNetwork();
  
  // Auto-select addresses based on network
  const lendingPoolAddress = isLocal
    ? (process.env.LOCAL_LENDING_POOL_ADDRESS || process.env.LENDING_POOL_ADDRESS)
    : (process.env.SEPOLIA_LENDING_POOL_ADDRESS || process.env.LENDING_POOL_ADDRESS);
    
  const dataProviderAddress = isLocal
    ? (process.env.LOCAL_DATA_PROVIDER_ADDRESS || process.env.DATA_PROVIDER_ADDRESS)
    : (process.env.SEPOLIA_DATA_PROVIDER_ADDRESS || process.env.DATA_PROVIDER_ADDRESS);

  if (!lendingPoolAddress) {
    console.log('❌ Missing LENDING_POOL_ADDRESS in .env');
    return;
  }

  console.log('=== Checking All Token Balances ===\n');
  console.log('Network:', network);
  console.log('Pool:', lendingPoolAddress);
  if (dataProviderAddress) {
    console.log('Data Provider:', dataProviderAddress);
  }
  console.log('');

  // Get signer - network-aware account selection
  const signers = await ethers.getSigners();
  
  let user;
  if (isLocal) {
    if (signers.length < 2) {
      console.log('⚠️  Only 1 account available on local network');
      console.log('Checking deployer account (account[0])...\n');
      user = signers[0];
    } else {
      const [deployer, localUser] = signers;
      user = localUser;
      console.log('Mode: LOCAL (checking user account[1])');
      console.log('Deployer:', deployer.address);
    }
  } else {
    if (signers.length === 0) {
      console.log('❌ No accounts configured!');
      return;
    }
    user = signers[0];
    console.log('Mode: LIVE NETWORK (checking account[0])');
  }
  
  console.log('User Address:', user.address);
  console.log('');

  const pool = await ethers.getContractAt('ILendingPool', lendingPoolAddress);

  // Try to get all reserves
  let reserves: Array<{ symbol: string; tokenAddress: string }> = [];
  
  if (dataProviderAddress) {
    try {
      const dataProvider = await ethers.getContractAt(
        'AaveProtocolDataProvider',
        dataProviderAddress
      );
      
      const reservesData = await dataProvider.getAllReservesTokens();
      
      for (const reserve of reservesData) {
        reserves.push({
          symbol: reserve.symbol,
          tokenAddress: reserve.tokenAddress,
        });
      }
      
      console.log(`Found ${reserves.length} token(s) in the pool\n`);
      
    } catch (error: any) {
      console.log('⚠️  Could not get reserves from Data Provider:', error.message);
      console.log('Trying alternative method...\n');
    }
  }
  
  // Method 2: Fallback to pool's getReservesList
  if (reserves.length === 0) {
    try {
      const reservesList = await pool.getReservesList();
      
      for (const tokenAddress of reservesList) {
        reserves.push({
          symbol: '???',
          tokenAddress: tokenAddress,
        });
      }
      
      console.log(`Found ${reserves.length} token(s) in the pool\n`);
      
    } catch (error: any) {
      console.log('❌ Could not get reserves list:', error.message);
      console.log('Try setting DATA_PROVIDER_ADDRESS in .env');
      return;
    }
  }

  if (reserves.length === 0) {
    console.log('❌ No reserves found in this pool!');
    return;
  }

  // Check balances for all tokens
  console.log('=== Token Balances ===\n');
  
  let hasAnyBalance = false;
  
  // Define ERC20 ABI with metadata methods
  const erc20Abi = [
    'function balanceOf(address) view returns (uint256)',
    'function symbol() view returns (string)',
    'function decimals() view returns (uint8)',
    'function name() view returns (string)'
  ];
  
  for (let i = 0; i < reserves.length; i++) {
    const reserve = reserves[i];
    
    try {
      // Create contract with extended ERC20 ABI
      const token = new ethers.Contract(
        reserve.tokenAddress,
        erc20Abi,
        ethers.provider
      );
      
      // Get token metadata
      let symbol = reserve.symbol;
      let decimals = 18; // Default
      
      try {
        // Read actual values from contract
        if (symbol === '???') {
          symbol = await token.symbol();
        }
        decimals = await token.decimals();
      } catch (e: any) {
        // Silently use defaults if metadata unavailable
      }
      
      // Get wallet balance
      const walletBalance = await token.balanceOf(user.address);
      
      // Get aToken balance (deposited amount)
      let aTokenBalance = ethers.BigNumber.from(0);
      try {
        const reserveData = await pool.getReserveData(reserve.tokenAddress);
        
        if (reserveData.aTokenAddress !== ethers.constants.AddressZero) {
          const aToken = new ethers.Contract(
            reserveData.aTokenAddress,
            erc20Abi,
            ethers.provider
          );
          aTokenBalance = await aToken.balanceOf(user.address);
        }
      } catch (e) {
        // Ignore aToken errors
      }
      
      const totalBalance = walletBalance.add(aTokenBalance);
      
      // Only show if user has any balance
      if (totalBalance.gt(0)) {
        hasAnyBalance = true;
        
        console.log(`${i + 1}. ${symbol}`);
        console.log(`   Address: ${reserve.tokenAddress}`);
        console.log(`   Decimals: ${decimals}`);
        console.log(`   Wallet:  ${ethers.utils.formatUnits(walletBalance, decimals)} ${symbol}`);
        console.log(`   Deposited: ${ethers.utils.formatUnits(aTokenBalance, decimals)} ${symbol}`);
        console.log(`   Total:   ${ethers.utils.formatUnits(totalBalance, decimals)} ${symbol}`);
        console.log('');
      }
      
    } catch (error: any) {
      console.log(`${i + 1}. ${reserve.symbol || 'Unknown'}`);
      console.log(`   Address: ${reserve.tokenAddress}`);
      console.log(`   Error: ${error.message}`);
      console.log('');
    }
  }
  
  if (!hasAnyBalance) {
    console.log('⚠️  No token balances found for this address\n');
    
    if (isLocal) {
      console.log('💡 Run test-local-deployment.ts to deploy and mint tokens');
    } else {
      console.log('💡 Acquire test tokens from a faucet or DEX');
    }
  } else {
    console.log('✅ Balance check complete!');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });