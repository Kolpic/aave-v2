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
    console.log('❌ Missing LENDING_POOL_ADDRESS!');
    console.log('Set LENDING_POOL_ADDRESS or LOCAL_*/SEPOLIA_* versions in .env');
    return;
  }

  console.log('=== Querying Pool Reserves ===\n');
  console.log('Network:', network);
  console.log('Pool:', lendingPoolAddress);
  
  // Check pool pause status first
  const pool = await ethers.getContractAt('ILendingPool', lendingPoolAddress);
  let isPoolPaused = false;
  
  try {
    isPoolPaused = await pool.paused();
    console.log('Pool Paused:', isPoolPaused);
    
    if (isPoolPaused) {
      console.log('\n⚠️  WARNING: This pool is PAUSED!');
      console.log('All operations (deposits, withdrawals, borrows) are blocked.');
      console.log('You cannot interact with ANY reserve in this pool.');
      console.log('Error code 64 (LP_IS_PAUSED) will be returned for all operations.\n');
    }
  } catch (e) {
    console.log('Pool Paused: (could not check)');
  }
  console.log('');
  
  if (!dataProviderAddress) {
    console.log('Data Provider: Not configured');
    console.log('⚠️  Trying to get reserves list from pool directly...\n');
    
    try {
      // Try to get reserves list (this method may not exist in all versions)
      const reservesList = await pool.getReservesList();
      
      if (reservesList.length === 0) {
        console.log('❌ No reserves found in this pool!');
        console.log('This pool may not be initialized or may be empty.');
        return;
      }
      
      console.log(`✅ Found ${reservesList.length} reserve(s):\n`);
      
      for (let i = 0; i < reservesList.length; i++) {
        const tokenAddress = reservesList[i];
        console.log(`${i + 1}. Token Address: ${tokenAddress}`);
        
        try {
          const token = await ethers.getContractAt(
            'contracts/dependencies/openzeppelin/contracts/IERC20.sol:IERC20',
            tokenAddress
          );
          
          // Try to get token symbol
          try {
            const symbol = await token.symbol();
            const name = await token.name();
            const decimals = await token.decimals();
            console.log(`   Name: ${name}`);
            console.log(`   Symbol: ${symbol}`);
            console.log(`   Decimals: ${decimals}`);
          } catch (e) {
            console.log(`   (Could not read token metadata)`);
          }
          
          // Get reserve data
          const reserveData = await pool.getReserveData(tokenAddress);
          console.log(`   aToken: ${reserveData.aTokenAddress}`);
          
          // Check if active - Use correct bit positions
          const configData = reserveData.configuration.data;
          const isActive = configData.shr(56).and(1).eq(1);   // Bit 56
          const isFrozen = configData.shr(57).and(1).eq(1);   // Bit 57
          
          console.log(`   Active: ${isActive}, Frozen: ${isFrozen}`);
          
        } catch (e: any) {
          console.log(`   Error reading token: ${e.message}`);
        }
        console.log('');
      }
      
      if (isPoolPaused) {
        console.log('\n⚠️  IMPORTANT: While these reserves exist, the pool is PAUSED.');
        console.log('You will NOT be able to deposit/withdraw until the pool is unpaused!');
      }
      
    } catch (error: any) {
      console.log('❌ Could not get reserves list:', error.message);
      console.log('\nThe pool may not support the getReservesList() method.');
      console.log('Try providing a DATA_PROVIDER_ADDRESS in your .env file.');
    }
    
  } else {
    console.log('Data Provider:', dataProviderAddress);
    console.log('');
    
    try {
      const dataProvider = await ethers.getContractAt(
        'AaveProtocolDataProvider',
        dataProviderAddress
      );
      
      const reserves = await dataProvider.getAllReservesTokens();
      
      if (reserves.length === 0) {
        console.log('❌ No reserves found!');
        return;
      }
      
      console.log(`✅ Found ${reserves.length} reserve(s):\n`);
      
      for (let i = 0; i < reserves.length; i++) {
        const reserve = reserves[i];
        console.log(`${i + 1}. ${reserve.symbol}`);
        console.log(`   Address: ${reserve.tokenAddress}`);
        
        // Get additional reserve info
        try {
          const reserveTokens = await dataProvider.getReserveTokensAddresses(
            reserve.tokenAddress
          );
          console.log(`   aToken: ${reserveTokens.aTokenAddress}`);
          
          // Get reserve configuration
          const configData = await dataProvider.getReserveConfigurationData(
            reserve.tokenAddress
          );
          console.log(`   Active: ${configData.isActive}`);
          console.log(`   Frozen: ${configData.isFrozen}`);
          
        } catch (e: any) {
          console.log(`   (Could not read additional data)`);
        }
        console.log('');
      }
      
      if (isPoolPaused) {
        console.log('\n⚠️  IMPORTANT: While these reserves exist, the pool is PAUSED.');
        console.log('You will NOT be able to deposit/withdraw until the pool is unpaused!');
        console.log('\n💡 Solutions:');
        console.log('   1. Use a different pool (e.g., Aave V3 on Sepolia)');
        console.log('   2. Wait for this pool to be unpaused (if temporary)');
      } else {
        console.log('\n💡 To use one of these tokens, update your .env:');
        console.log('   TOKEN_ADDRESS=<address_from_above>');
        console.log('   TOKEN_NAME=<symbol_from_above>');
        console.log('   TOKEN_DECIMALS=<decimals_of_token>');
      }
      
    } catch (error: any) {
      console.log('❌ Error:', error.message);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });